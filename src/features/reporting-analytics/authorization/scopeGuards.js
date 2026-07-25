/**
 * Reporting scope guards (REPORTING-01).
 */

import { REPORT_SCOPE_KIND } from "../constants/reportScopes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { reportingFailure } from "../errors/ReportingError.js";
import { createReportScope, reportScopesEqual } from "../contracts/scope.js";

/**
 * @param {unknown} scopeInput
 */
export function requireReportingScope(scopeInput) {
  try {
    const scope = createReportScope(scopeInput);
    return { ok: true, scope };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? /** @type {{ code: string, message?: string }} */ (err).code
        : REPORTING_ERROR_CODE.INVALID_SCOPE;
    const message =
      err instanceof Error ? err.message : "Invalid reporting scope";
    return reportingFailure(code, message);
  }
}

/**
 * @param {object} authorizedScope
 * @param {object} resourceScope
 */
export function assertReportingScopeMatch(authorizedScope, resourceScope) {
  if (!reportScopesEqual(authorizedScope, resourceScope)) {
    // Allow TENANT actor scope to match CLUB/VENUE resource under same tenant
    // only when kinds intentionally align — REPORTING-01 is fail-closed on mismatch.
    if (
      authorizedScope?.kind === REPORT_SCOPE_KIND.TENANT &&
      resourceScope?.tenantId &&
      authorizedScope.tenantId === resourceScope.tenantId &&
      (resourceScope.kind === REPORT_SCOPE_KIND.CLUB ||
        resourceScope.kind === REPORT_SCOPE_KIND.VENUE ||
        resourceScope.kind === REPORT_SCOPE_KIND.TENANT)
    ) {
      // Still require exact kind match for saved resources in this phase.
    }
    if (!reportScopesEqual(authorizedScope, resourceScope)) {
      return reportingFailure(
        REPORTING_ERROR_CODE.FORBIDDEN_SCOPE,
        "Authorized scope does not match resource scope."
      );
    }
  }
  return { ok: true, scope: authorizedScope };
}
