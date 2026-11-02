import { parserCtx } from "@milkdown/kit/core";

// Milkdown's serializer escapes characters such as `_` and `*` even when the
// escape is not needed (e.g. `snake_case` becomes `snake\_case`). Removing an
// escape is only safe when it does not change the meaning of the document, so
// every candidate is verified by parsing both versions and comparing the
// resulting ProseMirror documents. Escapes inside code are protected for free:
// removing them changes the code content, so the comparison fails.

const ESCAPE_PATTERN = /\\([!-/:-@[-`{-~])/g;
const ESCAPE_TEST = /\\[!-/:-@[-`{-~]/;
const MAX_CHECKS = 200;

function findEscape(line, fromIndex) {
  const match = ESCAPE_TEST.exec(line.slice(fromIndex));
  return match ? fromIndex + match.index : -1;
}

export function unescapeMarkdown(ctx, markdown) {
  if (!markdown || !markdown.includes("\\")) return markdown;

  const parse = ctx.get(parserCtx);
  const isEquivalent = (candidate) => {
    try {
      return parse(candidate).eq(reference);
    } catch {
      return false;
    }
  };

  let reference;
  try {
    reference = parse(markdown);
  } catch {
    return markdown;
  }

  const fullyUnescaped = markdown.replace(ESCAPE_PATTERN, "$1");
  if (isEquivalent(fullyUnescaped)) return fullyUnescaped;

  // Some escapes are meaningful: try each one and keep only the safe removals.
  const lines = markdown.split("\n");
  let checks = 0;

  for (let i = 0; i < lines.length && checks < MAX_CHECKS; i += 1) {
    if (!ESCAPE_TEST.test(lines[i])) continue;

    let position = 0;
    while (checks < MAX_CHECKS) {
      const escapeIndex = findEscape(lines[i], position);
      if (escapeIndex === -1) break;

      checks += 1;
      const original = lines[i];
      lines[i] = original.slice(0, escapeIndex) + original.slice(escapeIndex + 1);
      if (isEquivalent(lines.join("\n"))) {
        position = escapeIndex + 1;
      } else {
        lines[i] = original;
        position = escapeIndex + 2;
      }
    }
  }

  return lines.join("\n");
}
