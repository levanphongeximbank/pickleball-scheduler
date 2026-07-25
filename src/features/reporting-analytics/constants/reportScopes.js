/**
 * Report scope kinds (REPORTING-01). Fail-closed; no ambiguous defaults.
 */

export const REPORT_SCOPE_KIND = Object.freeze({
  TENANT: "TENANT",
  CLUB: "CLUB",
  VENUE: "VENUE",
  PLATFORM_CROSS_TENANT: "PLATFORM_CROSS_TENANT",
});

export const REPORT_SCOPE_KIND_VALUES = Object.freeze(
  Object.values(REPORT_SCOPE_KIND)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportScopeKind(value) {
  return REPORT_SCOPE_KIND_VALUES.includes(/** @type {string} */ (value));
}
