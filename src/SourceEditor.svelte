<script>
  import { onMount, onDestroy, tick } from "svelte";
  import hljs from "highlight.js/lib/core";
  import markdown_lang from "highlight.js/lib/languages/markdown";
  import "highlight.js/styles/github.css";

  hljs.registerLanguage("markdown", markdown_lang);

  let { value = "", onChange } = $props();

  let textareaEl;
  let highlightEl;
  let skipNextEffect = false;

  onMount(() => {
    textareaEl.value = value;
    renderHighlight(value);
    
    // Explicitly set cursor to the first position
    textareaEl.setSelectionRange(0, 0);
    
    // Reset scroll positions of both textarea and highlight overlay to top-left
    textareaEl.scrollTop = 0;
    textareaEl.scrollLeft = 0;
    if (highlightEl) {
      highlightEl.scrollTop = 0;
      highlightEl.scrollLeft = 0;
    }
    
    textareaEl.focus();
  });

  $effect(() => {
    // Update textarea when value changes externally (from Milkdown)
    const v = value;
    if (skipNextEffect) {
      skipNextEffect = false;
      return;
    }
    if (textareaEl && textareaEl.value !== v) {
      textareaEl.value = v;
      renderHighlight(v);
    }
  });

  function renderHighlight(text) {
    if (!highlightEl) return;
    const escaped = text || "";
    const result = hljs.highlight(escaped, { language: "markdown" });
    // Append a newline so the pre/code always has room for the last line
    highlightEl.innerHTML = result.value + "\n";
  }

  function handleInput() {
    const val = textareaEl.value;
    skipNextEffect = true;
    renderHighlight(val);
    onChange?.(val);
  }

  function handleScroll() {
    if (highlightEl && textareaEl) {
      highlightEl.scrollTop = textareaEl.scrollTop;
      highlightEl.scrollLeft = textareaEl.scrollLeft;
    }
  }

  export function getCursorOffset() {
    return textareaEl?.selectionStart ?? 0;
  }

  export function setCursorOffset(offset) {
    if (!textareaEl) return;

    const nextOffset = clampOffset(offset, textareaEl.value.length);

    textareaEl.focus();
    textareaEl.setSelectionRange(nextOffset, nextOffset);
  }

  export function focus() {
    textareaEl?.focus();
  }

  function clampOffset(offset, max) {
    const nextOffset = Number.isFinite(offset) ? offset : 0;
    return Math.max(0, Math.min(max, nextOffset));
  }
</script>

<div class="source-editor-wrap">
  <pre class="source-highlight" bind:this={highlightEl} aria-hidden="true"></pre>
  <textarea
    bind:this={textareaEl}
    class="source-textarea"
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    oninput={handleInput}
    onscroll={handleScroll}
  ></textarea>
</div>

<style>
  .source-editor-wrap {
    position: relative;
    flex: 1;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--bg-panel);
  }

  .source-highlight,
  .source-textarea {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 12px;
    font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: auto;
    tab-size: 2;
  }

  .source-highlight {
    pointer-events: none;
    z-index: 0;
  }

  .source-textarea {
    z-index: 1;
    color: transparent;
    caret-color: #333;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    -webkit-text-fill-color: transparent;
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: 0;
  }

  /* Make highlight visible underneath */
  .source-highlight :global(code) {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: 0;
  }
</style>
