# AGENTS

- This is a Svelte + Vite app. Run `npm run dev` for development, `npm run build` for production.
- Runtime libraries (`@milkdown/crepe`, `@milkdown/kit`, `highlight.js`) are installed via npm.
- Source code lives in `src/`. The entry point is `src/main.js`.
- Preserve the two-pane layout: source editor on the left, Milkdown editor on the right.
- Maintain bidirectional sync between the textarea and Milkdown via `replaceAll` from `@milkdown/kit/utils`.
- Milkdown Crepe is the editor abstraction. Use `crepe.editor.action(replaceAll(...))` to update content programmatically.
- Use `crepe.on(listener => listener.markdownUpdated(...))` to listen for changes from the Milkdown side.
- Prefer small, focused edits and keep the visual style simple, clear and accessible.
- Do not use esm.sh or CDN imports for Milkdown. All dependencies come from npm.
- Bump the app version whenever behavior is implemented or fixed, following Semantic Versioning 2.0.0.