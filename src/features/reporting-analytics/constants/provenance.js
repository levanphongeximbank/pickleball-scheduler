/**
 * Business-facing freshness / provenance (REPORTING-01).
 *
 * MIXED is only valid when a payload is composed from multiple component
 * sources with differing provenance. Live failure must never silently become
 * mock success.
 */

export const REPORT_PROVENANCE = Object.freeze({
  LIVE: "LIVE",
  MOCK: "MOCK",
  PREVIEW: "PREVIEW",
  UNAVAILABLE: "UNAVAILABLE",
  STALE: "STALE",
  MIXED: "MIXED",
});

export const REPORT_PROVENANCE_VALUES = Object.freeze(
  Object.values(REPORT_PROVENANCE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportProvenance(value) {
  return REPORT_PROVENANCE_VALUES.includes(/** @type {string} */ (value));
}
