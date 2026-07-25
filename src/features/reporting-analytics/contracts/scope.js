/**
 * Report scope contract (REPORTING-01). Fail-closed; no ambiguous scope.
 */

import {
  REPORT_SCOPE_KIND,
  isReportScopeKind,
} from "../constants/reportScopes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalOpaqueId,
  requireOpaqueId,
} from "./shared.js";

/**
 * @param {unknown} input
 * @returns {Readonly<{
 *   kind: string,
 *   tenantId: string|null,
 *   clubId: string|null,
 *   venueId: string|null,
 * }>}
 */
export function createReportScope(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SCOPE,
      "Report scope must be a plain object",
      { field: "scope" }
    );
  }
  const kind = String(input.kind || "").trim();
  if (!isReportScopeKind(kind)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SCOPE,
      `Unsupported or missing report scope kind: ${kind || "(empty)"}`,
      { field: "kind", value: kind }
    );
  }

  const tenantId = optionalOpaqueId(input.tenantId, "tenantId");
  const clubId = optionalOpaqueId(input.clubId, "clubId");
  const venueId = optionalOpaqueId(input.venueId, "venueId");

  if (kind === REPORT_SCOPE_KIND.TENANT) {
    if (!tenantId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SCOPE,
        "TENANT scope requires tenantId",
        { field: "tenantId" }
      );
    }
    if (clubId || venueId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SCOPE,
        "TENANT scope must not include clubId or venueId",
        { field: "scope" }
      );
    }
  }

  if (kind === REPORT_SCOPE_KIND.CLUB) {
    if (!tenantId || !clubId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SCOPE,
        "CLUB scope requires tenantId and clubId",
        { field: "scope" }
      );
    }
  }

  if (kind === REPORT_SCOPE_KIND.VENUE) {
    if (!tenantId || !venueId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SCOPE,
        "VENUE scope requires tenantId and venueId",
        { field: "scope" }
      );
    }
  }

  if (kind === REPORT_SCOPE_KIND.PLATFORM_CROSS_TENANT) {
    // Cross-tenant is explicit; tenantId may be null (platform-wide) or set
    // as a requested filter — but club/venue alone without kind mismatch is rejected.
    if ((clubId || venueId) && !tenantId) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SCOPE,
        "PLATFORM_CROSS_TENANT with club/venue requires tenantId",
        { field: "scope" }
      );
    }
  }

  return deepFreeze({
    kind,
    tenantId: tenantId || null,
    clubId: clubId || null,
    venueId: venueId || null,
  });
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function reportScopesEqual(a, b) {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return (
    a.kind === b.kind &&
    (a.tenantId || null) === (b.tenantId || null) &&
    (a.clubId || null) === (b.clubId || null) &&
    (a.venueId || null) === (b.venueId || null)
  );
}

/**
 * Require a non-empty tenant id string for tenant-bound operations.
 * @param {unknown} tenantId
 * @returns {string}
 */
export function requireTenantId(tenantId) {
  return requireOpaqueId(tenantId, "tenantId");
}
