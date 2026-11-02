<script>
  import { onMount, onDestroy } from "svelte";
  import { Crepe, CrepeFeature } from "@milkdown/crepe";
  import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
  import { replaceAll } from "@milkdown/kit/utils";
  import { TextSelection } from "@milkdown/kit/prose/state";
  import { useHtmlRendering } from "./milkdown/htmlPlugin.js";
  import { useTightListFix } from "./milkdown/listSpread.js";
  import { unescapeMarkdown } from "./milkdown/unescape.js";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";

  let {
    value = "",
    editable = false,
    centered = false,
    initialSourceOffset = null,
    onChange,
  } = $props();

  const CURSOR_MARKER_PREFIX = "\uE000cursor-marker-";
  const CURSOR_MARKER_SUFFIX = "\uE001";
  const SOURCE_SYNC_DELAY = 150;

  let containerEl;
  let crepe;
  let createPromise;
  let ready = false;
  let destroyed = false;
  let debounceTimer;
  let markerSequence = 0;
  // Last markdown exchanged with the parent, to avoid echoing it back.
  let lastExternalValue = null;
  // Milkdown's serialization right after the last programmatic replaceAll.
  // Updates equal to it are echoes of that sync, not user edits.
  let lastAppliedMarkdown = null;

  onMount(() => {
    const initialValue = value;
    lastExternalValue = initialValue;

    crepe = new Crepe({
      root: containerEl,
      defaultValue: initialValue,
      features: {
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.BlockEdit]: editable,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.TopBar]: editable,
        [CrepeFeature.Placeholder]: false,
      },
    });

    useHtmlRendering(crepe.editor);
    useTightListFix(crepe.editor);

    crepe.on((listener) => {
      listener.markdownUpdated((ctx, markdown) => {
        // A read-only preview must never rewrite the user's source.
        if (destroyed || !ready || !editable) return;
        if (markdown === lastAppliedMarkdown) return;

        lastAppliedMarkdown = markdown;
        const output = unescapeMarkdown(ctx, markdown);
        lastExternalValue = output;
        onChange?.(output);
      });
    });

    crepe.setReadonly(!editable);

    createPromise = crepe
      .create()
      .then(() => {
        if (destroyed) return;
        ready = true;
        lastAppliedMarkdown = crepe.getMarkdown();

        // The source may have changed while the editor was being created.
        if (value !== initialValue) {
          applyExternalValue(value);
        }

        if (editable) {
          restoreCursor(initialSourceOffset);
        }
      })
      .catch((error) => {
        console.error("Failed to create the Milkdown editor:", error);
      });
  });

  onDestroy(() => {
    destroyed = true;
    clearTimeout(debounceTimer);
    createPromise?.finally(() => crepe?.destroy());
  });

  $effect(() => {
    const nextValue = value;
    if (!ready || nextValue === lastExternalValue) return;
    lastExternalValue = nextValue;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyExternalValue(nextValue), SOURCE_SYNC_DELAY);
  });

  export function getSourceOffset() {
    const editorState = getEditorState();
    if (!editorState) return 0;

    return getSourceOffsetForPosition(editorState, editorState.view.state.selection.from);
  }

  function applyExternalValue(markdown) {
    if (destroyed || !ready) return;
    lastExternalValue = markdown;

    if (normalizeMarkdown(markdown) === normalizeMarkdown(crepe.getMarkdown())) return;

    crepe.editor.action(replaceAll(markdown));
    lastAppliedMarkdown = crepe.getMarkdown();
  }

  function normalizeMarkdown(md) {
    return (md || "").replace(/\r\n/g, "\n").trim();
  }

  function restoreCursor(offset) {
    if (offset === null || offset === undefined) {
      focusEditor();
      return;
    }

    setCursorAtNearestSourceOffset(offset);
  }

  function focusEditor() {
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
  class:is-centered={centered}
  bind:this={containerEl}
></div>

<style>
  .milkdown-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--surface);
    scrollbar-gutter: stable;
  }

  .milkdown-wrap :global(.milkdown) {
    padding: 0;
    background: transparent;
  }

  /* Remove the extra border from the crepe frame theme */
  .milkdown-wrap :global(.milkdown .editor) {
    border: none;
    box-shadow: none;
  }

  .milkdown-wrap :global(.milkdown-top-bar) {
    position: sticky;
    top: 0;
    z-index: 4;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .milkdown-wrap:not(.is-editable) :global(.milkdown-top-bar) {
    display: none;
  }

  .milkdown-wrap :global(.ProseMirror) {
    padding: 22px 28px 32px;
    min-height: 100%;
    outline: none;
    color: var(--text);
    font-family: var(--font-preview);
    font-size: 1rem;
    line-height: 1.72;
    text-rendering: optimizeLegibility;
  }

  .milkdown-wrap.is-editable :global(.ProseMirror) {
    padding-left: 104px;
  }

  .milkdown-wrap.is-centered :global(.ProseMirror) {
    max-width: calc(var(--reading-width) + 56px);
    margin-inline: auto;
  }

  .milkdown-wrap.is-centered.is-editable :global(.ProseMirror) {
    max-width: calc(var(--reading-width) + 132px);
  }

  .milkdown-wrap.is-editable :global(.milkdown-block-handle) {
    z-index: 3;
  }

  .milkdown-wrap :global(.ProseMirror > :first-child) {
    margin-top: 0;
  }

  .milkdown-wrap :global(.ProseMirror > :last-child) {
    margin-bottom: 0;
  }

  .milkdown-wrap :global(.ProseMirror p) {
    margin: 0.63rem 0;
  }

  .milkdown-wrap :global(.ProseMirror h1),
  .milkdown-wrap :global(.ProseMirror h2),
  .milkdown-wrap :global(.ProseMirror h3),
  .milkdown-wrap :global(.ProseMirror h4),
  .milkdown-wrap :global(.ProseMirror h5),
  .milkdown-wrap :global(.ProseMirror h6) {
    margin-top: 1.65rem;
    margin-bottom: 0.55rem;
    font-family: var(--font-preview);
    font-weight: 700;
    line-height: 1.22;
    letter-spacing: -0.02em;
    color: var(--text-strong);
  }

  .milkdown-wrap :global(.ProseMirror h1) {
    padding-bottom: 0.3rem;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 1.9rem;
  }

  .milkdown-wrap :global(.ProseMirror h2) {
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 1.55rem;
  }

  .milkdown-wrap :global(.ProseMirror h3) {
    font-size: 1.28rem;
  }

  .milkdown-wrap :global(.ProseMirror h4) {
    font-size: 1.12rem;
  }

  .milkdown-wrap :global(.ProseMirror h5) {
    font-size: 1rem;
  }

  .milkdown-wrap :global(.ProseMirror h6) {
    font-size: 0.92rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .milkdown-wrap :global(.ProseMirror :is(h1, h2, h3, h4, h5, h6) + p) {
    margin-top: 0;
  }

  .milkdown-wrap :global(.ProseMirror pre) {
    margin: 1.5rem 0;
    padding: 1rem 1.1rem;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--code-bg);
    color: var(--text-strong);
    overflow-x: auto;
  }

  .milkdown-wrap :global(.ProseMirror code) {
    padding: 0.12rem 0.35rem;
    border-radius: 4px;
    background: var(--code-bg);
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 0.88em;
  }

  .milkdown-wrap :global(.ProseMirror pre code),
  .milkdown-wrap :global(.ProseMirror pre .hljs) {
    padding: 0;
    background: transparent;
    color: inherit;
  }

  .milkdown-wrap :global(.ProseMirror ul),
  .milkdown-wrap :global(.ProseMirror ol) {
    margin: 1rem 0 1.15rem;
    padding-left: 1.5rem;
  }

  .milkdown-wrap :global(.ProseMirror li) {
    margin: 0;
    padding-left: 0.2rem;
  }

  .milkdown-wrap :global(.ProseMirror li p) {
    margin: 0;
  }

  /* Crepe wraps nested lists in a div, so match any descendant */
  .milkdown-wrap :global(.ProseMirror li ul),
  .milkdown-wrap :global(.ProseMirror li ol) {
    margin-top: 0;
    margin-bottom: 0;
  }

  .milkdown-wrap :global(.ProseMirror table) {
    width: 100%;
    margin: 1.4rem 0 1.5rem;
    border-collapse: collapse;
    border-spacing: 0;
    font-size: 0.96rem;
  }

  .milkdown-wrap :global(.ProseMirror th),
  .milkdown-wrap :global(.ProseMirror td) {
    border: 1px solid var(--border-subtle);
    text-align: left;
    vertical-align: top;
  }

  .milkdown-wrap :global(.ProseMirror th) {
    background: var(--surface-muted);
    font-family: var(--font-preview);
    font-weight: 600;
  }

  .milkdown-wrap :global(.ProseMirror th p),
  .milkdown-wrap :global(.ProseMirror td p) {
    margin: 0;
  }

  .milkdown-wrap :global(.ProseMirror blockquote) {
    margin: 1.2rem 0;
    padding: 0.1rem 0 0.1rem 1rem;
    border-left: 3px solid var(--border);
    color: var(--text-muted);
  }

  .milkdown-wrap :global(.ProseMirror hr) {
    margin: 1.6rem 0;
    border: 0;
    border-top: 1px solid var(--border-subtle);
  }

  .milkdown-wrap :global(.ProseMirror a) {
    color: var(--link);
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.16em;
  }

  .milkdown-wrap :global(.ProseMirror img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.25rem auto;
  }

  /* Raw HTML rendered by htmlPlugin.js */
  .milkdown-wrap :global(.md-html img) {
    display: inline-block;
    margin: 0;
    vertical-align: middle;
  }

  .milkdown-wrap :global(.md-html-block) {
    display: block;
    margin: 0.63rem 0;
  }

  .milkdown-wrap :global(.md-html kbd) {
    display: inline-block;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--border);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--surface-muted);
    font-family: var(--font-mono);
    font-size: 0.82em;
    line-height: 1.4;
  }

  .milkdown-wrap :global(.md-html mark) {
    padding: 0 0.15rem;
    border-radius: 2px;
    background: #fff3a3;
  }

  .milkdown-wrap :global(.md-html details) {
    margin: 0.8rem 0;
    padding: 0.5rem 0.8rem;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
  }

  .milkdown-wrap :global(.md-html summary) {
    cursor: pointer;
    font-weight: 600;
  }

  /* In edit mode, make HTML atoms discoverable and selectable */
  .milkdown-wrap.is-editable :global(.md-html) {
    outline: 1px dashed var(--border);
    outline-offset: 1px;
    border-radius: 2px;
  }

  .milkdown-wrap.is-editable :global(.md-html.is-empty)::before {
    content: "</>";
    padding: 0 0.2rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.75em;
  }

  .milkdown-wrap :global(.md-html.ProseMirror-selectednode) {
    outline: 2px solid var(--accent);
  }
</style>
