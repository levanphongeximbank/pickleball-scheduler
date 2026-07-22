/**
 * CORE-14 — UTF-8 bytewise comparators (locale-independent).
 * Do not use localeCompare. Do not rely on caller array order as identity.
 */

const textEncoder = new TextEncoder();

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
export function utf8Bytes(value) {
  return textEncoder.encode(String(value));
}

/**
 * Compare two strings by UTF-8 bytewise ascending order.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareUtf8Bytewise(a, b) {
  const left = utf8Bytes(a == null ? "" : String(a));
  const right = utf8Bytes(b == null ? "" : String(b));
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareIdentifier(a, b) {
  return compareUtf8Bytewise(a, b);
}

/**
 * Sort a copy of identifiers. Does not mutate input.
 * @param {readonly unknown[]} values
 * @returns {string[]}
 */
export function sortIdentifiers(values) {
  const out = Array.isArray(values) ? values.map((v) => String(v)) : [];
  out.sort(compareUtf8Bytewise);
  return out;
}

/**
 * Sort object keys UTF-8 bytewise. Does not mutate input.
 * @param {Record<string, unknown>} obj
 * @returns {string[]}
 */
export function sortedObjectKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj).sort(compareUtf8Bytewise);
}

/**
 * Numeric compare for safe integers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function compareSafeInteger(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
