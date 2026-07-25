/**
 * Pure Reporting authorization foundation (REPORTING-01).
 *
 * Fail closed when actor, scope, or permission is missing.
 * Does not read VITE_RBAC_ENABLED or any environment variable.
 * Does not trust client-supplied permission booleans outside actor.permissions.
 */

import { REPORT_SCOPE_KIND } from "../constants/reportScopes.js";
import {
  REPORTING_PERMISSIONS,
  isReportingPermission,
} from "../constants/permissions.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { reportingFailure } from "../errors/ReportingError.js";
import {
  assertReportingScopeMatch,
  requireReportingScope,
} from "./scopeGuards.js";

/**
 * @param {object|null|undefined} actor
 */
export function requireReportingActor(actor) {
  if (!actor || typeof actor !== "object") {
    return reportingFailure(
      REPORTING_ERROR_CODE.MISSING_ACTOR,
      "Authenticated Reporting actor is required."
    );
  }
  if (actor.authenticated === false) {
    return reportingFailure(
      REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
      "Reporting actor is not authenticated."
    );
  }
  const userId = typeof actor.userId === "string" ? actor.userId.trim() : "";
  if (!userId) {
    return reportingFailure(
      REPORTING_ERROR_CODE.MISSING_ACTOR,
      "Reporting actor.userId is required."
    );
  }
  const tenantId = typeof actor.tenantId === "string" ? actor.tenantId.trim() : "";
  // Cross-tenant actors may omit tenantId only when they carry explicit permission later.
  const permissions = Array.isArray(actor.permissions)
    ? actor.permissions.map(String).filter(Boolean)
    : [];

  return {
    ok: true,
    actor: {
      userId,
      tenantId: tenantId || null,
      venueIds: Array.isArray(actor.venueIds)
        ? actor.venueIds.map(String).filter(Boolean)
        : [],
      clubIds: Array.isArray(actor.clubIds)
        ? actor.clubIds.map(String).filter(Boolean)
        : [],
      permissions,
      authenticated: actor.authenticated !== false,
    },
  };
}

/**
 * @param {object} normalizedActor
 * @param {string} permission
 */
function requirePermission(normalizedActor, permission) {
  const perm = String(permission || "").trim();
  if (!perm) {
    return reportingFailure(
      REPORTING_ERROR_CODE.FORBIDDEN_PERMISSION,
      "Reporting permission is required."
    );
  }
  if (!isReportingPermission(perm)) {
    return reportingFailure(
      REPORTING_ERROR_CODE.FORBIDDEN_PERMISSION,
      `Unknown or non-Reporting permission: ${perm}`
    );
  }
  if (!normalizedActor.permissions.includes(perm)) {
    return reportingFailure(
      REPORTING_ERROR_CODE.FORBIDDEN_PERMISSION,
      `Missing Reporting permission: ${perm}`
    );
  }
  return { ok: true, permission: perm };
}

/**
 * Authorize a Reporting permission within an explicit scope.
 *
 * @param {object|null|undefined} actor
 * @param {string} permission
 * @param {object} scopeInput
 */
export function authorizeReporting(actor, permission, scopeInput) {
  const actorResult = requireReportingActor(actor);
  if (!actorResult.ok) return actorResult;

  const scopeResult = requireReportingScope(scopeInput);
  if (!scopeResult.ok) return scopeResult;

  const { scope } = scopeResult;
  const normalizedActor = actorResult.actor;

  const permResult = requirePermission(normalizedActor, permission);
  if (!permResult.ok) return permResult;

  if (scope.kind === REPORT_SCOPE_KIND.PLATFORM_CROSS_TENANT) {
    if (!normalizedActor.permissions.includes(REPORTING_PERMISSIONS.SCOPE_CROSS_TENANT)) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Cross-tenant reporting requires reporting.scope.cross_tenant."
      );
    }
  } else {
    if (!normalizedActor.tenantId) {
      return reportingFailure(
        REPORTING_ERROR_CODE.MISSING_ACTOR,
        "Reporting actor.tenantId is required for tenant-scoped reports."
      );
    }
    if (scope.tenantId && normalizedActor.tenantId !== scope.tenantId) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Actor tenant does not match reporting scope."
      );
    }
  }

  if (scope.kind === REPORT_SCOPE_KIND.TENANT) {
    if (!normalizedActor.permissions.includes(REPORTING_PERMISSIONS.SCOPE_TENANT)) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Missing reporting.scope.tenant permission."
      );
    }
  }

  if (scope.kind === REPORT_SCOPE_KIND.VENUE) {
    if (!normalizedActor.permissions.includes(REPORTING_PERMISSIONS.SCOPE_VENUE)) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Missing reporting.scope.venue permission."
      );
    }
    if (
      normalizedActor.venueIds.length > 0 &&
      scope.venueId &&
      !normalizedActor.venueIds.includes(scope.venueId)
    ) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Actor is not allowed to operate in this venue."
      );
    }
  }

  if (scope.kind === REPORT_SCOPE_KIND.CLUB) {
    if (!normalizedActor.permissions.includes(REPORTING_PERMISSIONS.SCOPE_CLUB)) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Missing reporting.scope.club permission."
      );
    }
    if (
      normalizedActor.clubIds.length > 0 &&
      scope.clubId &&
      !normalizedActor.clubIds.includes(scope.clubId)
    ) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Actor is not allowed to operate in this club."
      );
    }
  }

  return { ok: true, actor: normalizedActor, scope, permission: permResult.permission };
}

/**
 * @param {object|null|undefined} actor
 * @param {string} permission
 * @param {object} resource
 */
export function authorizeReportingResource(actor, permission, resource) {
  if (!resource?.scope) {
    return reportingFailure(
      REPORTING_ERROR_CODE.MISSING_SCOPE,
      "Resource scope is incomplete."
    );
  }
  const auth = authorizeReporting(actor, permission, resource.scope);
  if (!auth.ok) return auth;
  const match = assertReportingScopeMatch(auth.scope, resource.scope);
  if (!match.ok) return match;
  return auth;
}

/**
 * Sensitive fields are authorized separately from execute.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeSensitiveFields(actor, scopeInput) {
  return authorizeReporting(
    actor,
    REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW,
    scopeInput
  );
}

/**
 * Export is authorized separately from execute.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeExport(actor, scopeInput) {
  return authorizeReporting(actor, REPORTING_PERMISSIONS.REPORT_EXPORT, scopeInput);
}

/**
 * Save report is authorized separately.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeSaveReport(actor, scopeInput) {
  return authorizeReporting(actor, REPORTING_PERMISSIONS.REPORT_SAVE, scopeInput);
}

/**
 * Save filter is authorized separately.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeSaveFilter(actor, scopeInput) {
  return authorizeReporting(actor, REPORTING_PERMISSIONS.FILTER_SAVE, scopeInput);
}

/**
 * View operational dashboard.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeDashboardView(actor, scopeInput) {
  return authorizeReporting(actor, REPORTING_PERMISSIONS.DASHBOARD_VIEW, scopeInput);
}

/**
 * Execute report.
 * @param {object|null|undefined} actor
 * @param {object} scopeInput
 */
export function authorizeExecuteReport(actor, scopeInput) {
  return authorizeReporting(actor, REPORTING_PERMISSIONS.REPORT_EXECUTE, scopeInput);
}
