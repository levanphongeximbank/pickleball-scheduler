/**
 * Operational report types (REPORTING-01).
 * Intentionally excludes analytical metric-registry / query-runtime concerns.
 */

export const REPORT_TYPE = Object.freeze({
  OPERATIONAL_KPI: "OPERATIONAL_KPI",
  OPERATIONAL_TABLE: "OPERATIONAL_TABLE",
  OPERATIONAL_DASHBOARD: "OPERATIONAL_DASHBOARD",
  OPERATIONAL_SNAPSHOT: "OPERATIONAL_SNAPSHOT",
  STATISTICS_COMPOSE: "STATISTICS_COMPOSE",
});

export const REPORT_TYPE_VALUES = Object.freeze(Object.values(REPORT_TYPE));

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportType(value) {
  return REPORT_TYPE_VALUES.includes(/** @type {string} */ (value));
}
