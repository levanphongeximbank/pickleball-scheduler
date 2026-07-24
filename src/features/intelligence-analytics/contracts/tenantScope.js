/**
 * Tenant scope contracts for analytics queries and results.
 * Fail-closed for tenant-scoped kinds when tenant context is missing.
 */

import { fail, ok } from "./result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "./errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "./shared.js";

export const ANALYTICS_TENANT_SCOPE_KIND = Object.freeze({
  PLATFORM: "platform",
  TENANT: "tenant",
  VENUE: "venue",
  CLUB: "club",
});

/**
 * @typedef {{
 *   kind: string,
 *   tenantId?: string,
 *   venueId?: string,
 *   clubId?: string,
 * }} AnalyticsTenantScope
 */

/**
 * @param {string} kind
 * @returns {boolean}
 */
function isTenantBoundKind(kind) {
  return (
    kind === ANALYTICS_TENANT_SCOPE_KIND.TENANT ||
    kind === ANALYTICS_TENANT_SCOPE_KIND.VENUE ||
    kind === ANALYTICS_TENANT_SCOPE_KIND.CLUB
  );
}

/**
 * @param {unknown} input
 * @returns {import("./result.js").Result}
 */
export function createAnalyticsTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        "AnalyticsTenantScope must be a plain object",
        "tenantScope"
      )
    );
  }

  if (!isNonEmptyString(input.kind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        "AnalyticsTenantScope.kind is required",
        "tenantScope.kind"
      )
    );
  }

  const kind = String(input.kind).trim();
  const allowed = new Set(Object.values(ANALYTICS_TENANT_SCOPE_KIND));
  if (!allowed.has(kind)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        `Unsupported AnalyticsTenantScope.kind: ${kind}`,
        "tenantScope.kind",
        { kind }
      )
    );
  }

  /** @type {AnalyticsTenantScope} */
  const scope = { kind };

  if (input.tenantId !== undefined) {
    if (!isNonEmptyString(input.tenantId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
          "AnalyticsTenantScope.tenantId must be a non-empty string when provided",
          "tenantScope.tenantId"
        )
      );
    }
    scope.tenantId = String(input.tenantId).trim();
  }

  if (input.venueId !== undefined) {
    if (!isNonEmptyString(input.venueId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
          "AnalyticsTenantScope.venueId must be a non-empty string when provided",
          "tenantScope.venueId"
        )
      );
    }
    scope.venueId = String(input.venueId).trim();
  }

  if (input.clubId !== undefined) {
    if (!isNonEmptyString(input.clubId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
          "AnalyticsTenantScope.clubId must be a non-empty string when provided",
          "tenantScope.clubId"
        )
      );
    }
    scope.clubId = String(input.clubId).trim();
  }

  // Fail closed: tenant-bound scopes require explicit tenantId.
  if (isTenantBoundKind(kind) && !scope.tenantId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Tenant-scoped analytics require an explicit tenantId (fail closed)",
        "tenantScope.tenantId",
        { kind }
      )
    );
  }

  if (kind === ANALYTICS_TENANT_SCOPE_KIND.VENUE && !scope.venueId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Venue-scoped analytics require an explicit venueId (fail closed)",
        "tenantScope.venueId",
        { kind }
      )
    );
  }

  if (kind === ANALYTICS_TENANT_SCOPE_KIND.CLUB && !scope.clubId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Club-scoped analytics require an explicit clubId (fail closed)",
        "tenantScope.clubId",
        { kind }
      )
    );
  }

  if (kind === ANALYTICS_TENANT_SCOPE_KIND.PLATFORM && scope.tenantId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        "Platform-scoped analytics must not carry a tenantId",
        "tenantScope.tenantId"
      )
    );
  }

  return ok(deepFreeze(scope));
}
