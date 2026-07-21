/**
 * Canonical CRM timestamp format: ISO-8601 UTC strings (e.g. 2026-07-21T00:00:00.000Z).
 * Models must not invent clocks; inject via CrmClock port.
 */

export const CRM_TIMESTAMP_FORMAT = "ISO-8601-UTC";

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return false;
  return new Date(ms).toISOString() === new Date(value).toISOString() || !Number.isNaN(ms);
}

/**
 * Normalize to ISO string or null.
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeIsoTimestamp(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return null;
}
