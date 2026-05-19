# Markdown Viewer and Editor

A two-pane Markdown workspace built with Svelte, Milkdown and Vite.

## Features

- **Left pane** — Markdown source textarea with live syntax highlighting (Highlight.js).
- **Right pane** — WYSIWYG editor powered by Milkdown Crepe.
- Bidirectional sync: edits in either pane update the other in real time.
- Responsive 40/60 split on desktop; stacked on mobile.

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Svelte 5 (runes mode) |
| Bundler | Vite |
| Rich editor | @milkdown/crepe + @milkdown/kit |
| Syntax highlight | highlight.js |

## Project Structure

```
src/
  main.js            – Svelte mount point
  App.svelte         – Layout, state, sync logic
  SourceEditor.svelte – Textarea + highlight.js overlay
  MilkdownEditor.svelte – Milkdown Crepe wrapper
  app.css            – Global styles
index.html           – HTML shell
vite.config.js       – Vite + Svelte plugin
```

## Getting Started

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```
- The same versions are mirrored in `package.json` so dependency updates can be managed with npm.