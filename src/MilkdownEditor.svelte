<script>
  import { onMount, onDestroy } from "svelte";
  import { Crepe, CrepeFeature } from "@milkdown/crepe";
  import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
  import { replaceAll } from "@milkdown/kit/utils";
  import { TextSelection } from "@milkdown/prose/state";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";

  let { value = "", editable = false, initialSourceOffset = null, onChange } = $props();

  const CURSOR_MARKER_PREFIX = "\uE000copilot-cursor-";
  const CURSOR_MARKER_SUFFIX = "-anchor\uE001";

  let containerEl;
  let crepe;
  let ready = false;
  let lastExternalValue = $state("");
  let debounceTimer;
  let externalSyncTarget = null;
  let markerSequence = 0;
  let pendingSourceOffset = null;

  onMount(async () => {
    crepe = new Crepe({
      root: containerEl,
      defaultValue: value,
      features: {
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.BlockEdit]: editable,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: editable,
        [CrepeFeature.Placeholder]: false,
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        // Ignore the first update after an external replaceAll() call.
        // Milkdown may normalize tables or spacing, but that echo should not
        // overwrite the active source textarea while the user is typing.
        if (externalSyncTarget !== null) {
          externalSyncTarget = null;
          lastExternalValue = markdown;
          return;
        }

        externalSyncTarget = null;
        lastExternalValue = markdown;
        onChange?.(markdown);
      });
    });

    crepe.setReadonly(!editable);

    await crepe.create();
    ready = true;
    lastExternalValue = value;
    pendingSourceOffset = initialSourceOffset;

    if (editable) {
      restorePendingSourceOffset();
    }
  });

  onDestroy(() => {
    clearTimeout(debounceTimer);
    if (crepe) {
      crepe.destroy();
    }
  });

  $effect(() => {
    const v = value;
    if (!ready || !crepe) return;
    if (v === lastExternalValue) return;
    lastExternalValue = v;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const currentMarkdown = crepe.getMarkdown();
      if (normalizeMarkdown(v) !== normalizeMarkdown(currentMarkdown)) {
        externalSyncTarget = v;
        crepe.editor.action(replaceAll(v));
      }
    }, 150);
  });

  $effect(() => {
    const isEditable = editable;
    if (!ready || !crepe) return;

    crepe.setReadonly(!isEditable);

    if (isEditable) {
      pendingSourceOffset = initialSourceOffset;
      requestAnimationFrame(() => {
        restorePendingSourceOffset();
      });
    }
  });

  export function getSourceOffset() {
    const editorState = getEditorState();
    if (!editorState) return 0;

    return getSourceOffsetForPosition(editorState, editorState.view.state.selection.from);
  }

  export function setCursorFromSourceOffset(offset) {
    pendingSourceOffset = offset;
    restorePendingSourceOffset();
  }

  function normalizeMarkdown(md) {
    return (md || "").trim().replace(/\r\n/g, "\n");
  }

  function restorePendingSourceOffset() {
    if (!editable) return;

    if (pendingSourceOffset === null || pendingSourceOffset === undefined) {
      focusEditor();
      return;
    }

    const offsetToRestore = pendingSourceOffset;
    pendingSourceOffset = null;
    setCursorAtNearestSourceOffset(offsetToRestore);
  }

  function focusEditor() {
    if (!crepe) return;

    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (!view.hasFocus()) {
        view.focus();
      }
    });
  }

  function setCursorAtNearestSourceOffset(targetOffset) {
    const editorState = getEditorState();
    if (!editorState) return;

    const position = findNearestPositionForSourceOffset(editorState, targetOffset);
    const resolved = editorState.view.state.doc.resolve(position);
    const selection = TextSelection.near(resolved, 1);

    editorState.view.dispatch(
      editorState.view.state.tr.setSelection(selection).scrollIntoView()
    );
    editorState.view.focus();
  }

  function findNearestPositionForSourceOffset(editorState, targetOffset) {
    const positions = collectSelectablePositions(editorState.view.state.doc);
    if (!positions.length) {
      return 1;
    }

    const wantedOffset = clampOffset(targetOffset, Number.MAX_SAFE_INTEGER);
    const offsetCache = new Map();
    const getOffset = (index) => {
      if (offsetCache.has(index)) {
        return offsetCache.get(index);
      }

      const mappedOffset = getSourceOffsetForPosition(editorState, positions[index]);
      offsetCache.set(index, mappedOffset);
      return mappedOffset;
    };

    let low = 0;
    let high = positions.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midOffset = getOffset(mid);

      if (midOffset === wantedOffset) {
        return positions[mid];
      }

      if (midOffset < wantedOffset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const candidateIndexes = [
      clampOffset(high, positions.length - 1),
      clampOffset(low, positions.length - 1),
    ];

    candidateIndexes.sort((leftIndex, rightIndex) => {
      const leftDistance = Math.abs(getOffset(leftIndex) - wantedOffset);
      const rightDistance = Math.abs(getOffset(rightIndex) - wantedOffset);

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return positions[leftIndex] - positions[rightIndex];
    });

    return positions[candidateIndexes[0]];
  }

  function getSourceOffsetForPosition(editorState, position) {
    const marker = createCursorMarker();
    const transaction = editorState.view.state.tr.insertText(marker, position, position);
    const markdown = editorState.serializer(transaction.doc);
    const markerIndex = markdown.indexOf(marker);

    return markerIndex === -1 ? 0 : markerIndex;
  }

  function collectSelectablePositions(doc) {
    const positions = new Set();

    doc.descendants((node, pos) => {
      if (!node.isTextblock) {
        return true;
      }

      const start = pos + 1;
      const end = pos + node.nodeSize - 1;
      positions.add(start);
      positions.add(end);

      if (node.childCount === 0) {
        return false;
      }

      node.forEach((child, childOffset) => {
        const childPos = start + childOffset;

        positions.add(childPos);
        positions.add(childPos + child.nodeSize);

        if (!child.isText) {
          return;
        }

        for (let charIndex = 1; charIndex < child.text.length; charIndex += 1) {
          positions.add(childPos + charIndex);
        }
      });

      return false;
    });

    return Array.from(positions).sort((left, right) => left - right);
  }

  function getEditorState() {
    if (!ready || !crepe) return null;

    let editorState = null;

    crepe.editor.action((ctx) => {
      editorState = {
        view: ctx.get(editorViewCtx),
        serializer: ctx.get(serializerCtx),
      };
    });

    return editorState;
  }

  function createCursorMarker() {
    markerSequence += 1;
    return `${CURSOR_MARKER_PREFIX}${markerSequence}${CURSOR_MARKER_SUFFIX}`;
  }

  function clampOffset(offset, max) {
    const nextOffset = Number.isFinite(offset) ? offset : 0;
    return Math.max(0, Math.min(max, nextOffset));
  }
</script>

<div
  class="milkdown-wrap"
  class:is-editable={editable}
  bind:this={containerEl}
></div>

<style>
  .milkdown-wrap {
    flex: 1;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-panel);
  }

  /* Trim excessive Milkdown padding */
  .milkdown-wrap :global(.milkdown) {
    padding: 0;
  }

  .milkdown-wrap :global(.milkdown-top-bar) {
    border-bottom: 1px solid var(--border);
  }

  .milkdown-wrap:not(.is-editable) :global(.milkdown-top-bar) {
    display: none;
  }

  .milkdown-wrap :global(.ProseMirror) {
    padding: 12px;
    min-height: 100%;
    white-space: pre-wrap;
    outline: none;
  }

  .milkdown-wrap.is-editable :global(.ProseMirror) {
    padding: 16px 24px 24px 104px;
  }

  .milkdown-wrap.is-editable :global(.milkdown-block-handle) {
    z-index: 3;
  }

  .milkdown-wrap :global(.ProseMirror pre) {
    background: #f7f7f8;
    color: #1f2328;
    margin-top: 20px;
    margin-bottom: 20px;
  }

  .milkdown-wrap :global(.ProseMirror pre code),
  .milkdown-wrap :global(.ProseMirror pre .hljs) {
    background: transparent;
    color: inherit;
  }

  /* Remove any extra border from crepe frame theme */
  .milkdown-wrap :global(.milkdown .editor) {
    border: none;
    box-shadow: none;
  }
</style>
