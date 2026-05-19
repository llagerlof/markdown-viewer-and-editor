<script>
  import { onMount, onDestroy } from "svelte";
  import { Crepe, CrepeFeature } from "@milkdown/crepe";
  import { replaceAll } from "@milkdown/kit/utils";
  import "@milkdown/crepe/theme/common/style.css";
  import "@milkdown/crepe/theme/frame.css";

  let { value = "" } = $props();

  let containerEl;
  let crepe;
  let ready = false;
  let lastExternalValue = $state("");
  let debounceTimer;

  onMount(async () => {
    crepe = new Crepe({
      root: containerEl,
      defaultValue: value,
      features: {
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.Placeholder]: false,
      },
    });

    await crepe.create();
    crepe.setReadonly(true);
    ready = true;
    lastExternalValue = value;
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
        crepe.editor.action(replaceAll(v));
      }
    }, 150);
  });

  function normalizeMarkdown(md) {
    return (md || "").trim().replace(/\r\n/g, "\n");
  }
</script>

<div class="milkdown-wrap" bind:this={containerEl}></div>

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

  .milkdown-wrap :global(.ProseMirror) {
    padding: 12px;
    min-height: 100%;
    white-space: pre-wrap;
    outline: none;
  }

  /* Remove any extra border from crepe frame theme */
  .milkdown-wrap :global(.milkdown .editor) {
    border: none;
    box-shadow: none;
  }
</style>
