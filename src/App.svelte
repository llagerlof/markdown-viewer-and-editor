<script>
  import SourceEditor from "./SourceEditor.svelte";
  import MilkdownEditor from "./MilkdownEditor.svelte";
  import "./app.css";

  let markdown = $state("# Hello Milkdown\n\nStart writing your markdown here...\n");

  function handleSourceChange(newMarkdown) {
    markdown = newMarkdown;
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <div>
      <p class="eyebrow">Svelte + Milkdown + Vite</p>
      <h1>Markdown Viewer and Editor</h1>
    </div>
    <p class="app-summary">
      Write Markdown in the source pane or edit the live document on the right.
      Both views stay synchronized.
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
      <div class="panel-heading">
        <h2 id="preview-title">Rendered Markdown</h2>
        <p>Read-only preview powered by Milkdown.</p>
      </div>
      <MilkdownEditor value={markdown} />
    </section>
  </main>
</div>
