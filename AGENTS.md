# AGENTS

- This is a Svelte + Vite app. Run `npm run dev` for development, `npm run build` for production.
- Runtime libraries (`@milkdown/crepe`, `@milkdown/kit`, `highlight.js`, `dompurify`, `@fontsource/mulish`) are installed via npm. Fonts are bundled from npm too; do not load them from a CDN.
- Source code lives in `src/`. The entry point is `src/main.js`.
- Preserve the two-pane layout: source editor on the left, Milkdown editor on the right.
- Maintain bidirectional sync between the textarea and Milkdown via `replaceAll` from `@milkdown/kit/utils`.
- Milkdown Crepe is the editor abstraction. Use `crepe.editor.action(replaceAll(...))` to update content programmatically.
- Use `crepe.on(listener => listener.markdownUpdated(...))` to listen for changes from the Milkdown side.
- Milkdown helpers live in `src/milkdown/`: `htmlPlugin.js` renders raw HTML (always sanitized with DOMPurify), `unescape.js` removes needless serializer escapes only when the parsed document stays identical, and `listSpread.js` works around Milkdown serializing tight lists as loose ones.
- The read-only preview must never write back to the source; only edits made in edit mode propagate.
- Access `localStorage` only through `src/storage.js`.
- Prefer small, focused edits and keep the visual style simple, clear and accessible.
- Do not use esm.sh or CDN imports for Milkdown. All dependencies come from npm.
- If it was necessary to create or modify resources that do not comply with the AGENTS.md guidelines, update the AGENTS.md accordingly. If necessary, update the README.md as well.
- Bump the app version whenever behavior is implemented or fixed, following Semantic Versioning 2.0.0.
