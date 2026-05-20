<script>
  import { onMount, onDestroy } from "svelte";
  import { Crepe, CrepeFeature } from "@milkdown/crepe";
  import { editorViewCtx } from "@milkdown/kit/core";
  import { replaceAll } from "@milkdown/kit/utils";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";

  let { value = "", editable = false, onChange } = $props();

  let containerEl;
  let crepe;
  let ready = false;
  let lastExternalValue = $state("");
  let debounceTimer;
  let externalSyncTarget = null;

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
        if (
          externalSyncTarget !== null &&
          normalizeMarkdown(markdown) === normalizeMarkdown(externalSyncTarget)
        ) {
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

    if (editable) {
      focusEditor();
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
      requestAnimationFrame(() => {
        focusEditor();
      });
    }
  });

  function normalizeMarkdown(md) {
    return (md || "").trim().replace(/\r\n/g, "\n");
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
