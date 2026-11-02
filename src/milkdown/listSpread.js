import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";

// Milkdown stores the `spread` attribute of lists as the strings "true" /
// "false", but mdast-util-to-markdown only honours booleans. Without this,
// every tight list is serialized as a loose one (blank line between items).
function joinStringSpread(left, right, parent) {
  if (typeof parent.spread !== "string") return undefined;
  // Consecutive paragraphs always need a blank line; keep the default
  if (left.type === "paragraph" && right.type === "paragraph") return undefined;
  return parent.spread === "true" ? 1 : 0;
}

export function useTightListFix(editor) {
  editor.config((ctx) => {
    ctx.update(remarkStringifyOptionsCtx, (options) => ({
      ...options,
      join: [...(options.join ?? []), joinStringSpread],
    }));
  });
}
