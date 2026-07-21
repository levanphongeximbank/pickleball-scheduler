/**
 * Scope guards for CRM (Phase 1B).
 * Fail closed. No env reads. No demo-club defaults.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { createTenantVenueScope } from "../models/scope.js";

/**
 * @param {unknown} scopeInput
 * @returns {{ ok: true, scope: { tenantId: string, venueId: string } } | { ok: false, code: string, error: string }}
 */
export function requireCrmScope(scopeInput) {
  try {
    const scope = createTenantVenueScope(scopeInput || {});
    return { ok: true, scope };
  } catch (err) {
    return crmFailure(
      err?.code || CRM_ERROR_CODES.MISSING_SCOPE,
      err?.message || "tenantId and venueId are required."
    );
  }
}

/**
 * @param {{ tenantId: string, venueId: string }} actorScope
 * @param {{ tenantId: string, venueId: string }} resourceScope
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertCrmScopeMatch(actorScope, resourceScope) {
  if (
    !actorScope?.tenantId ||
    !actorScope?.venueId ||
    !resourceScope?.tenantId ||
    !resourceScope?.venueId
  ) {
    return crmFailure(CRM_ERROR_CODES.MISSING_SCOPE, "Scope is incomplete.");
  }
  if (
    actorScope.tenantId !== resourceScope.tenantId ||
    actorScope.venueId !== resourceScope.venueId
  ) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-tenant or cross-venue CRM access is forbidden."
    );
  }
  return { ok: true };
}
