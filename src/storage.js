// Thin wrapper around localStorage. Storage can throw (private mode, quota
// exceeded, disabled cookies), and the app must keep working when it does.

export const STORAGE_KEYS = {
  content: "markdown-editor-content",
  splitRatio: "markdown-editor-split-ratio",
  fullWidth: "markdown-editor-full-width",
  readingWidth: "markdown-editor-reading-width",
  fileName: "markdown-editor-file-name",
};

export function readStorage(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
