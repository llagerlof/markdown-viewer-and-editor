<script>
  import { tick, onDestroy } from "svelte";
  import SourceEditor from "./SourceEditor.svelte";
  import MilkdownEditor from "./MilkdownEditor.svelte";
  import Splitter from "./Splitter.svelte";
  import { STORAGE_KEYS, readStorage, writeStorage } from "./storage.js";
  import "./app.css";
  import packageInfo from "../package.json";

  const version = packageInfo.version;
  const SAVE_DELAY = 500;
  const DEFAULT_SPLIT = 40;
  const DEFAULT_FILE_NAME = "document.md";
  // Width of the rendered column in full-width mode, per unit
  const READING_WIDTH_LIMITS = {
    "%": { min: 20, max: 100, step: 5, fallback: 70 },
    px: { min: 300, max: 4000, step: 50, fallback: 900 },
  };
  const DEFAULT_READING_WIDTH = { value: 70, unit: "%" };
  const ICONS = {
    new: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M12 18v-6M9 15h6",
    open: "M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    edit: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
    expand: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
    code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
    collapse: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
  };

  let markdown = $state(readStorage(STORAGE_KEYS.content, ""));
  let fileName = $state(readStorage(STORAGE_KEYS.fileName, DEFAULT_FILE_NAME));
  let realtimeEditorEnabled = $state(false);
  // Which pane fills the workspace: "source", "preview" or null for the split view
  let fullView = $state(parseFullView(readStorage(STORAGE_KEYS.fullWidth)));
  let splitRatio = $state(parseSplitRatio(readStorage(STORAGE_KEYS.splitRatio)));
  let readingWidth = $state(parseReadingWidth(readStorage(STORAGE_KEYS.readingWidth)));
  let saveState = $state("saved");
  let draggingFile = $state(false);
  let sourceEditor = $state(null);
  let milkdownEditor = $state(null);
  let fileInput;
  let initialRealtimeSourceOffset = $state(0);
  let saveTimeout = null;

  const stats = $derived.by(() => {
    const trimmed = markdown.trim();
    return {
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      characters: markdown.length,
      lines: markdown ? markdown.split("\n").length : 0,
    };
  });

  const saveLabel = $derived(
    { saving: "Saving…", saved: "Saved in this browser", error: "Not saved (storage unavailable)" }[
      saveState
    ]
  );

  onDestroy(flushSave);

  function parseSplitRatio(storedValue) {
    const ratio = Number(storedValue);
    return Number.isFinite(ratio) && ratio >= 20 && ratio <= 80 ? ratio : DEFAULT_SPLIT;
  }

  function parseFullView(storedValue) {
    // "true" is the legacy value from when only the preview could be full width
    if (storedValue === "true" || storedValue === "preview") return "preview";
    return storedValue === "source" ? "source" : null;
  }

  function parseReadingWidth(storedValue) {
    const match = /^(\d+(?:\.\d+)?)(%|px)$/.exec(storedValue ?? "");
    if (!match) return { ...DEFAULT_READING_WIDTH };
    const unit = match[2];
    const { min, max } = READING_WIDTH_LIMITS[unit];
    const value = Number(match[1]);
    return value >= min && value <= max ? { value, unit } : { ...DEFAULT_READING_WIDTH };
  }

  function setReadingWidth(value, unit) {
    const { min, max } = READING_WIDTH_LIMITS[unit];
    readingWidth = { value: Math.round(Math.min(max, Math.max(min, value))), unit };
    writeStorage(STORAGE_KEYS.readingWidth, `${readingWidth.value}${readingWidth.unit}`);
  }

  function handleReadingWidthInput(event) {
    // Apply valid values while typing; out-of-range ones are clamped on change
    const value = event.currentTarget.valueAsNumber;
    const { min, max } = READING_WIDTH_LIMITS[readingWidth.unit];
    if (value >= min && value <= max) setReadingWidth(value, readingWidth.unit);
  }

  function handleReadingWidthChange(event) {
    const value = event.currentTarget.valueAsNumber;
    const { fallback } = READING_WIDTH_LIMITS[readingWidth.unit];
    setReadingWidth(Number.isFinite(value) ? value : fallback, readingWidth.unit);
    event.currentTarget.value = readingWidth.value;
  }

  function handleReadingUnitChange(event) {
    const unit = event.currentTarget.value;
    setReadingWidth(READING_WIDTH_LIMITS[unit].fallback, unit);
  }

  function scheduleSave() {
    saveState = "saving";
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(flushSave, SAVE_DELAY);
  }

  function flushSave() {
    if (saveTimeout === null) return;
    clearTimeout(saveTimeout);
    saveTimeout = null;
    saveState = writeStorage(STORAGE_KEYS.content, markdown) ? "saved" : "error";
  }

  function setMarkdown(nextMarkdown) {
    if (nextMarkdown === markdown) return;
    markdown = nextMarkdown;
    scheduleSave();
  }

  async function toggleRealtimeEditor() {
    if (!realtimeEditorEnabled) {
      if (fullView === "source") setFullView(null);
      initialRealtimeSourceOffset = sourceEditor?.getCursorOffset() ?? 0;
      realtimeEditorEnabled = true;
      return;
    }

    const sourceOffset = milkdownEditor?.getSourceOffset() ?? 0;
    realtimeEditorEnabled = false;

    if (fullView !== "preview") {
      await tick();
      sourceEditor?.setCursorOffset(sourceOffset);
    }
  }

  async function setFullView(view) {
    // Leaving the preview editor hidden would strand its edits and cursor
    if (view === "source" && realtimeEditorEnabled) await toggleRealtimeEditor();
    fullView = view;
    writeStorage(STORAGE_KEYS.fullWidth, view ?? "");
  }

  function toggleFullView(view) {
    setFullView(fullView === view ? null : view);
  }

  function setSplitRatio(ratio) {
    splitRatio = ratio;
    writeStorage(STORAGE_KEYS.splitRatio, ratio);
  }

  function handleWindowKeydown(event) {
    if (event.key === "Escape" && fullView && !event.defaultPrevented) {
      setFullView(null);
    }
  }

  function newDocument() {
    if (markdown.trim() && !confirm("Discard the current content and start a new document?")) return;

    setMarkdown("");
    fileName = DEFAULT_FILE_NAME;
    writeStorage(STORAGE_KEYS.fileName, DEFAULT_FILE_NAME);
  }

  async function loadFile(file) {
    if (!file) return;
    if (markdown.trim() && !confirm(`Replace the current content with "${file.name}"?`)) return;

    try {
      setMarkdown(await file.text());
      fileName = file.name;
      writeStorage(STORAGE_KEYS.fileName, file.name);
    } catch (error) {
      console.error("Failed to read the file:", error);
      alert(`Could not read "${file.name}".`);
    }
  }

  function handleFileInput(event) {
    loadFile(event.currentTarget.files?.[0]);
    // Allow opening the same file again
    event.currentTarget.value = "";
  }

  function downloadMarkdown() {
    const name = /\.(md|markdown)$/i.test(fileName) ? fileName : `${fileName}.md`;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function hasFiles(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  function handleDragOver(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    draggingFile = true;
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      draggingFile = false;
    }
  }

  function handleDrop(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    draggingFile = false;
    loadFile(event.dataTransfer.files[0]);
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} onpagehide={flushSave} />

{#snippet icon(name)}
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={ICONS[name]} />
  </svg>
{/snippet}

<div class="app-shell">
  <header class="app-header">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">M↓</span>
      <h1>Markdown Viewer and Editor</h1>
      <span class="version-badge" title="Version {version}">v{version}</span>
    </div>

    <div class="toolbar" role="toolbar" aria-label="Document actions">
      <div class="toolbar-group">
        <button type="button" class="btn" onclick={newDocument} title="Start a new document">
          {@render icon("new")}
          <span class="btn-label">New</span>
        </button>
        <button type="button" class="btn" onclick={() => fileInput.click()} title="Open a Markdown file">
          {@render icon("open")}
          <span class="btn-label">Open</span>
        </button>
        <button type="button" class="btn" onclick={downloadMarkdown} title="Download as {fileName}">
          {@render icon("download")}
          <span class="btn-label">Download</span>
        </button>
      </div>

      <span class="toolbar-divider" aria-hidden="true"></span>

      <div class="toolbar-group">
        <button
          type="button"
          class="btn btn-toggle"
          aria-pressed={realtimeEditorEnabled}
          onclick={toggleRealtimeEditor}
          title="Edit the rendered Markdown directly"
        >
          {@render icon("edit")}
          <span class="btn-label">Edit preview</span>
        </button>
        <button
          type="button"
          class="btn btn-toggle"
          aria-pressed={fullView === "source"}
          onclick={() => toggleFullView("source")}
          title={fullView === "source"
            ? "Show the rendered Markdown pane (Esc)"
            : "Show only the Markdown source"}
        >
          {@render icon(fullView === "source" ? "collapse" : "code")}
          <span class="btn-label">Full source</span>
        </button>
        <button
          type="button"
          class="btn btn-toggle"
          aria-pressed={fullView === "preview"}
          onclick={() => toggleFullView("preview")}
          title={fullView === "preview"
            ? "Show the source pane (Esc)"
            : "Show only the rendered Markdown"}
        >
          {@render icon(fullView === "preview" ? "collapse" : "expand")}
          <span class="btn-label">Full preview</span>
        </button>
      </div>
    </div>

    <input
      bind:this={fileInput}
      class="visually-hidden"
      type="file"
      accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
      tabindex="-1"
      aria-hidden="true"
      onchange={handleFileInput}
    />
  </header>

  <main
    class="workspace"
    class:is-source-only={fullView === "source"}
    style:--split="{splitRatio}%"
    aria-label="Markdown workspace"
  >
    <section
      class="panel panel-source"
      class:is-drop-target={draggingFile}
      aria-labelledby="source-title"
      hidden={fullView === "preview"}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
    >
      <div class="panel-heading">
        <h2 id="source-title">Markdown Source</h2>
        <span class="panel-hint">Drop a .md file here</span>
      </div>
      <SourceEditor
        bind:this={sourceEditor}
        value={markdown}
        labelledby="source-title"
        onChange={setMarkdown}
      />
    </section>

    {#if !fullView}
      <Splitter
        ratio={splitRatio}
        defaultRatio={DEFAULT_SPLIT}
        label="Resize panes"
        onChange={setSplitRatio}
      />
    {/if}

    <section
      class="panel panel-preview"
      aria-labelledby="preview-title"
      hidden={fullView === "source"}
    >
      <div class="panel-heading">
        <h2 id="preview-title">Rendered Markdown</h2>
        {#if fullView === "preview"}
          <div class="width-control" role="group" aria-label="Reading column width">
            <label for="reading-width">Width</label>
            <input
              id="reading-width"
              type="number"
              inputmode="numeric"
              min={READING_WIDTH_LIMITS[readingWidth.unit].min}
              max={READING_WIDTH_LIMITS[readingWidth.unit].max}
              step={READING_WIDTH_LIMITS[readingWidth.unit].step}
              value={readingWidth.value}
              oninput={handleReadingWidthInput}
              onchange={handleReadingWidthChange}
            />
            <select
              aria-label="Width unit"
              value={readingWidth.unit}
              onchange={handleReadingUnitChange}
            >
              <option value="%">%</option>
              <option value="px">px</option>
            </select>
          </div>
        {/if}
        <span class="chip" class:chip-active={realtimeEditorEnabled}>
          {realtimeEditorEnabled ? "Editing" : "Read-only"}
        </span>
      </div>
      {#key realtimeEditorEnabled}
        <MilkdownEditor
          bind:this={milkdownEditor}
          value={markdown}
          editable={realtimeEditorEnabled}
          centered={fullView === "preview"}
          readingWidth="{readingWidth.value}{readingWidth.unit}"
          initialSourceOffset={initialRealtimeSourceOffset}
          onChange={setMarkdown}
        />
      {/key}
    </section>
  </main>

  <footer class="status-bar">
    <span class="status-file" title={fileName}>{fileName}</span>
    <span class="status-stats">
      <span>{stats.words.toLocaleString()} words</span>
      <span>{stats.characters.toLocaleString()} characters</span>
      <span>{stats.lines.toLocaleString()} lines</span>
    </span>
    <span class="status-save" class:is-error={saveState === "error"}>
      {saveLabel}
    </span>
  </footer>
</div>
