/**
 * Comparator: UTF-16 code-unit ordinal ordering (locale-independent).
 * Version: CORE12_COMPARATOR_V1.
 * Locale-sensitive string comparison APIs are forbidden.
 */

/**
 * Compare two strings by UTF-16 code units.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
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

/**
 * Numeric ascending then stable id.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function compareFiniteNumber(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
