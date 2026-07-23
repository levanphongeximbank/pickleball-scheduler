/**
 * Shared contract helpers for CORE-02 role-permission.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function optionalNonEmptyString(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return s ? s : null;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const s = optionalNonEmptyString(item);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * @param {unknown} value
 * @returns {Readonly<Record<string, unknown>>}
 */
export function freezeRecord(value) {
  const src = isPlainObject(value) ? value : {};
  return Object.freeze({ ...src });
}
