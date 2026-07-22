/**
 * CORE-13 — stable string / ID comparator (UTF-16 code-unit ordering).
 * Locale-sensitive string comparison APIs are forbidden.
 */

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareStableString(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const ca = left.charCodeAt(i);
    const cb = right.charCodeAt(i);
    if (ca !== cb) return ca - cb;
  }
  return left.length - right.length;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareStableId(a, b) {
  return compareStableString(a, b);
}

/**
 * @param {readonly string[]} values
 * @returns {string[]}
 */
export function sortStableIds(values) {
  const out = Array.isArray(values) ? values.map((v) => String(v)) : [];
  out.sort(compareStableString);
  return out;
}

/**
 * @param {Record<string, unknown>} obj
 * @returns {string[]}
 */
export function sortedObjectKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return [];
  }
  return Object.keys(obj).sort(compareStableString);
}
