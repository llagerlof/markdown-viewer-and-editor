<script>
  import SourceEditor from "./SourceEditor.svelte";
  import MilkdownEditor from "./MilkdownEditor.svelte";
  import "./app.css";
  import packageInfo from "../package.json";

  const version = packageInfo.version;
  let markdown = $state("");
  let realtimeEditorEnabled = $state(false);

  function handleSourceChange(newMarkdown) {
    markdown = newMarkdown;
  }

  function toggleRealtimeEditor() {
    realtimeEditorEnabled = !realtimeEditorEnabled;
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <div>
      <p class="eyebrow">Version {version}</p>
      <h1>Markdown Viewer and Editor</h1>
    </div>
    <p class="app-summary">
      Write Markdown in the source pane on the left. The live view will be displayed on the right pane.
    </p>
  </header>

  <main class="workspace" aria-label="Markdown workspace">
    <section class="panel panel-source" aria-labelledby="source-title">
      <div class="panel-heading">
        <h2 id="source-title">Markdown Source</h2>
        <p>Source editor with Markdown syntax highlighting.</p>
      </div>
      <SourceEditor value={markdown} onChange={handleSourceChange} />
    </section>

    <section class="panel panel-preview" aria-labelledby="preview-title">
      <div class="panel-heading panel-heading-split">
        <div>
          <h2 id="preview-title">Rendered Markdown</h2>
          <p>
            {realtimeEditorEnabled
              ? "Editable preview with formatting bar."
              : "Read-only preview."}
          </p>
        </div>
        <button
          type="button"
          class="preview-toggle"
          aria-pressed={realtimeEditorEnabled}
          onclick={toggleRealtimeEditor}
        >
          {realtimeEditorEnabled
            ? "Disable realtime editor"
            : "Enable realtime editor"}
        </button>
      </div>
      {#key realtimeEditorEnabled}
        <MilkdownEditor
          value={markdown}
          editable={realtimeEditorEnabled}
          onChange={handleSourceChange}
        />
      {/key}
    </section>
  </main>
</div>
