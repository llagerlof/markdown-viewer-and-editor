import DOMPurify from "dompurify";
import { htmlSchema, remarkPreserveEmptyLinePlugin } from "@milkdown/kit/preset/commonmark";
import { $remark, $view } from "@milkdown/kit/utils";

// Milkdown keeps raw HTML as an atomic `html` node and displays its source
// text. These plugins render that HTML (sanitized) instead, so `<br>`,
// `<kbd>…</kbd>`, `<sub>…</sub>`, `<details>…</details>` etc. look as they
// would on GitHub. The node value is untouched, so serialization is lossless.

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "source", "track", "wbr",
]);

const BLOCK_CONTAINERS = new Set(["root", "blockquote", "listItem"]);

const BLOCK_TAG_PATTERN =
  /^\s*<(address|article|aside|blockquote|details|div|dl|fieldset|figure|footer|form|h[1-6]|header|hr|ol|p|pre|section|table|ul)\b/i;

const OPEN_TAG_PATTERN = /^<([a-zA-Z][\w-]*)(?:\s[^>]*)?>$/;
const CLOSE_TAG_PATTERN = /^<\/([a-zA-Z][\w-]*)\s*>$/;

function getOpeningTag(node) {
  if (node.type !== "html") return null;
  const value = node.value.trim();
  if (value.endsWith("/>")) return null;
  const match = value.match(OPEN_TAG_PATTERN);
  if (!match) return null;
  const tag = match[1].toLowerCase();
  return VOID_TAGS.has(tag) ? null : tag;
}

function getClosingTag(node) {
  if (node.type !== "html") return null;
  return node.value.trim().match(CLOSE_TAG_PATTERN)?.[1].toLowerCase() ?? null;
}

function findClosingIndex(children, startIndex, tag) {
  let depth = 0;
  for (let i = startIndex; i < children.length; i += 1) {
    if (getOpeningTag(children[i]) === tag) depth += 1;
    if (getClosingTag(children[i]) === tag) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function mergeInlineHtml(parent, source) {
  if (!Array.isArray(parent.children)) return;

  parent.children.forEach((child) => mergeInlineHtml(child, source));
  if (BLOCK_CONTAINERS.has(parent.type)) return;

  const merged = [];
  const { children } = parent;

  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    const tag = getOpeningTag(node);
    const closeIndex = tag ? findClosingIndex(children, i, tag) : -1;
    const start = node.position?.start?.offset;
    const end = children[closeIndex]?.position?.end?.offset;

    if (closeIndex === -1 || start === undefined || end === undefined) {
      merged.push(node);
      continue;
    }

    merged.push({
      type: "html",
      value: source.slice(start, end),
      position: { start: node.position.start, end: children[closeIndex].position.end },
    });
    i = closeIndex;
  }

  parent.children = merged;
}

/// Merge `<tag>`, its content and `</tag>` into one html node so the pair
/// renders as a single element.
export const inlineHtmlPairs = $remark(
  "inlineHtmlPairs",
  () => () => (tree, file) => {
    mergeInlineHtml(tree, String(file));
  }
);

function renderHtml(dom, value) {
  dom.innerHTML = DOMPurify.sanitize(value);
  dom.classList.toggle("is-empty", dom.childNodes.length === 0);
}

/// Render html nodes as sanitized HTML instead of their source text.
export const htmlView = $view(htmlSchema.node, () => (initialNode) => {
  let node = initialNode;
  const isBlock = BLOCK_TAG_PATTERN.test(node.attrs.value);
  const dom = document.createElement(isBlock ? "div" : "span");
  dom.className = isBlock ? "md-html md-html-block" : "md-html";
  dom.dataset.type = "html";
  renderHtml(dom, node.attrs.value);

  return {
    dom,
    update(nextNode) {
      if (nextNode.type !== node.type) return false;
      if (BLOCK_TAG_PATTERN.test(nextNode.attrs.value) !== isBlock) return false;
      if (nextNode.attrs.value !== node.attrs.value) {
        renderHtml(dom, nextNode.attrs.value);
      }
      node = nextNode;
      return true;
    },
    ignoreMutation: () => true,
  };
});

/// Enable HTML rendering on an editor that has not been created yet.
/// Milkdown's preserve-empty-line plugin deletes every `<br>` html node while
/// parsing (it is meant for the `<br />` it writes for empty paragraphs), which
/// hides user line breaks and drops them from the source on edits. Removing it
/// keeps `<br>` as a regular html node, rendered by `htmlView`.
export function useHtmlRendering(editor) {
  editor.remove([remarkPreserveEmptyLinePlugin].flat());
  editor.use([inlineHtmlPairs, htmlView].flat());
}
