<script>
  import { onMount } from "svelte";
  import hljs from "highlight.js/lib/core";
  import markdownLanguage from "highlight.js/lib/languages/markdown";
  import "highlight.js/styles/github.css";

  hljs.registerLanguage("markdown", markdownLanguage);

  let { value = "", labelledby = undefined, onChange } = $props();

  let textareaEl;
  let highlightEl;

  onMount(() => {
    textareaEl.value = value;
    renderHighlight(value);

    // Start at the top of the document with the cursor in the first position
    textareaEl.setSelectionRange(0, 0);
    textareaEl.focus();
  });

  $effect(() => {
    // Update the textarea when the value changes externally (Milkdown, file open)
    const nextValue = value;
    if (textareaEl && textareaEl.value !== nextValue) {
      textareaEl.value = nextValue;
      renderHighlight(nextValue);
      syncScroll();
    }
  });

  function renderHighlight(text) {
    if (!highlightEl) return;
    const result = hljs.highlight(text || "", { language: "markdown" });
    // Append a newline so the overlay always has room for the last line
    highlightEl.innerHTML = result.value + "\n";
  }

  function handleInput() {
    const nextValue = textareaEl.value;
    renderHighlight(nextValue);
    syncScroll();
    onChange?.(nextValue);
  }

  function handleKeydown(event) {
    if (event.key !== "Enter" || event.isComposing) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

    event.preventDefault();

    const currentValue = textareaEl.value;
    const { selectionStart, selectionEnd } = textareaEl;
    const lineStart = currentValue.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextLineBreak = currentValue.indexOf("\n", selectionEnd);
    const lineEnd = nextLineBreak === -1 ? currentValue.length : nextLineBreak;
    const currentLine = currentValue.slice(lineStart, lineEnd);

    // On a whitespace-only line, drop the indentation instead of repeating it
    if (selectionStart === selectionEnd && currentLine.length > 0 && currentLine.trim() === "") {
      insertText("\n", lineStart, lineEnd);
      return;
    }

    const indentation = currentLine.match(/^[\t ]*/)?.[0] ?? "";
    insertText(`\n${indentation}`, selectionStart, selectionEnd);
  }

  // Insert through the browser's editing pipeline so native undo/redo keeps working
  function insertText(text, start, end) {
    textareaEl.setSelectionRange(start, end);
    const inserted = document.execCommand?.("insertText", false, text);
    if (!inserted) {
      textareaEl.setRangeText(text, start, end, "end");
      handleInput();
    }
  }

  function syncScroll() {
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
    aria-labelledby={labelledby}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    onkeydown={handleKeydown}
    oninput={handleInput}
    onscroll={syncScroll}
  ></textarea>
</div>

<style>
  .source-editor-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background: var(--surface);
  }

  .source-highlight,
  .source-textarea {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 16px 18px;
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    tab-size: 2;
    font-kerning: none;
    font-variant-ligatures: none;
    letter-spacing: 0;
    /* Keep the same text width in both layers whether or not a scrollbar shows */
    scrollbar-gutter: stable;
  }

  .source-highlight {
    z-index: 0;
    overflow: hidden;
    color: var(--text);
    pointer-events: none;
  }

  .source-textarea {
    z-index: 1;
    overflow: auto;
    color: transparent;
    caret-color: var(--text-strong);
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    -webkit-text-fill-color: transparent;
  }

  .source-textarea::selection {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
  }
</style>
