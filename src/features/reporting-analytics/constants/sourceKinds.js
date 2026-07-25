/**
 * Report data source kinds (REPORTING-01).
 * References only — Reporting does not become an analytical runtime.
 */

export const REPORT_SOURCE_KIND = Object.freeze({
  OPERATIONAL: "OPERATIONAL",
  STATISTICS: "STATISTICS",
  INTELLIGENCE_PROJECTION: "INTELLIGENCE_PROJECTION",
  DASHBOARD_ADAPTER: "DASHBOARD_ADAPTER",
  UNAVAILABLE: "UNAVAILABLE",
});

export const REPORT_SOURCE_KIND_VALUES = Object.freeze(
  Object.values(REPORT_SOURCE_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportSourceKind(value) {
  return REPORT_SOURCE_KIND_VALUES.includes(/** @type {string} */ (value));
}
