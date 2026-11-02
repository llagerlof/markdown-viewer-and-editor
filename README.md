# Markdown Viewer and Editor

A two-pane Markdown workspace built with Svelte, Milkdown and Vite.

## Features

- **Left pane** — Markdown source textarea with live syntax highlighting (Highlight.js). Enter keeps the current indentation, and native undo/redo keeps working.
- **Right pane** — rendered Markdown powered by Milkdown Crepe. It is read-only by default; **Edit preview** turns it into a WYSIWYG editor whose changes sync back to the source.
- **Inline HTML** — raw HTML in the Markdown is rendered (sanitized with DOMPurify): `<br>`, `<kbd>`, `<sub>`/`<sup>`, `<mark>`, `<img>`, `<details>`, etc.
- **Full width** — show only the rendered Markdown in a centered reading column. Its width is configurable in percent or pixels (70% by default) from the preview heading. Press `Esc` to return to the split view.
- **Resizable split** — drag the handle between the panes, or focus it and use the arrow keys / Home / End. Double-click resets it to 40/60.
- **Open / Download** — load a local `.md` file (or drop it onto the source pane) and download the current content as `.md`.
- **Status bar** — word, character and line counts, plus the state of the automatic in-browser save.
- Content, split ratio, full-width preference and reading width are saved in `localStorage`.
- Stacked layout on mobile.

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | Svelte 5 (runes mode) |
| Bundler | Vite |
| Rich editor | @milkdown/crepe + @milkdown/kit |
| Syntax highlight | highlight.js |
| HTML sanitizing | DOMPurify |
| Preview font | @fontsource/mulish (bundled, no CDN) |

## Project Structure

```
src/
  main.js                – Svelte mount point
  App.svelte             – Layout, toolbar, state, file open/download
  SourceEditor.svelte    – Textarea + highlight.js overlay
  MilkdownEditor.svelte  – Milkdown Crepe wrapper and sync logic
  Splitter.svelte        – Accessible resize handle between panes
  milkdown/htmlPlugin.js – Renders raw HTML nodes (sanitized)
  milkdown/unescape.js   – Removes needless serializer escapes safely
  milkdown/listSpread.js – Keeps tight lists tight when serializing
  storage.js             – Safe localStorage wrapper
  app.css                – Global styles and design tokens
index.html               – HTML shell
vite.config.js           – Vite + Svelte plugin
```

## Getting Started

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```
