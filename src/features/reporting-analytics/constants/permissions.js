/**
 * Service-level Reporting permissions / capabilities (REPORTING-01).
 * Fail-closed authorization; not menu/UI visibility.
 */

export const REPORTING_PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: "reporting.dashboard.view",
  REPORT_EXECUTE: "reporting.report.execute",
  SENSITIVE_FIELD_VIEW: "reporting.field.sensitive.view",
  REPORT_SAVE: "reporting.report.save",
  FILTER_SAVE: "reporting.filter.save",
  REPORT_EXPORT: "reporting.report.export",
  SCOPE_CROSS_TENANT: "reporting.scope.cross_tenant",
  SCOPE_TENANT: "reporting.scope.tenant",
  SCOPE_VENUE: "reporting.scope.venue",
  SCOPE_CLUB: "reporting.scope.club",
});

export const REPORTING_PERMISSION_VALUES = Object.freeze(
  Object.values(REPORTING_PERMISSIONS)
);

/**
 * @param {unknown} permission
 * @returns {boolean}
 */
export function isReportingPermission(permission) {
  return REPORTING_PERMISSION_VALUES.includes(String(permission || ""));
}
