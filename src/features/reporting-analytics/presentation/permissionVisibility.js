/**
 * Reporting permission visibility helpers (REPORTING-04E).
 *
 * Visibility only — not a security boundary.
 * Service/application authorization remains authoritative.
 */

import { REPORTING_PERMISSIONS } from "../constants/permissions.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

export const REPORTING_PERMISSION_VISIBILITY_KEYS = Object.freeze([
  "canViewDashboard",
  "canExecuteReport",
  "canSaveReport",
  "canExportReport",
  "canViewSensitiveFields",
  "canSaveFilter",
  "canScopeTenant",
  "canScopeClub",
  "canScopeVenue",
  "canScopeCrossTenant",
]);

/**
 * @param {unknown} actorOrPermissions
 * @param {string} permission
 * @returns {boolean}
 */
export function actorHasReportingPermission(actorOrPermissions, permission) {
  const wanted = String(permission || "");
  if (!wanted) return false;

  if (Array.isArray(actorOrPermissions)) {
    return actorOrPermissions.map(String).includes(wanted);
  }

  if (!isPlainObject(actorOrPermissions)) return false;

  if (Array.isArray(actorOrPermissions.permissions)) {
    return actorOrPermissions.permissions.map(String).includes(wanted);
  }

  if (
    typeof actorOrPermissions.can === "function" &&
    actorOrPermissions.can(wanted) === true
  ) {
    return true;
  }

  return false;
}

/**
 * @param {unknown} actorOrPermissions
 */
export function resolveReportingPermissionVisibility(actorOrPermissions) {
  return deepFreeze({
    canViewDashboard: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.DASHBOARD_VIEW
    ),
    canExecuteReport: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.REPORT_EXECUTE
    ),
    canSaveReport: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.REPORT_SAVE
    ),
    canExportReport: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.REPORT_EXPORT
    ),
    canViewSensitiveFields: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW
    ),
    canSaveFilter: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.FILTER_SAVE
    ),
    canScopeTenant: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.SCOPE_TENANT
    ),
    canScopeClub: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.SCOPE_CLUB
    ),
    canScopeVenue: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.SCOPE_VENUE
    ),
    canScopeCrossTenant: actorHasReportingPermission(
      actorOrPermissions,
      REPORTING_PERMISSIONS.SCOPE_CROSS_TENANT
    ),
    // Explicit reminder: hidden UI is not authorization.
    isVisibilityOnly: true,
  });
}
