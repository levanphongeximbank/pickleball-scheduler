/**
 * Tenant / scope access validation for Player Rating reads (Phase 1I).
 * Fail closed. No silent fallback from tenant → global.
 */

import {
  getScopeTenantId,
  requireExplicitPlayerRatingScope,
} from "../contracts/scopeContract.js";
import { isNonEmptyString } from "../contracts/shared.js";
import { PLAYER_RATING_READ_CAPABILITY } from "./privacyProjectionLevels.js";
import {
  PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE,
  failSecurityPrivacy,
} from "./securityPrivacyErrors.js";

/**
 * @param {unknown} actorInput
 * @returns {{ hasGlobal: boolean, actorTenantId: string|null, capabilities: string[] }}
 */
function readActorScopeHints(actorInput) {
  const raw =
    actorInput && typeof actorInput === "object"
      ? /** @type {Record<string, unknown>} */ (actorInput)
      : {};

  const hasGlobal =
    raw.globalScope === "global" ||
    raw.scopeKind === "global" ||
    (raw.scope &&
      typeof raw.scope === "object" &&
      /** @type {{ kind?: unknown }} */ (raw.scope).kind === "global");

  const actorTenantId = isNonEmptyString(raw.tenantId)
    ? String(raw.tenantId).trim()
    : null;

  /** @type {string[]} */
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.filter((c) => isNonEmptyString(c)).map((c) => String(c))
    : [];

  return { hasGlobal, actorTenantId, capabilities };
}

/**
 * Validate that the actor may access the subject rating scope.
 *
 * @param {{
 *   accessContext: unknown,
 *   subjectScope: unknown,
 * }} input
 * @returns {Readonly<import('../contracts/scopeContract.js').PlayerRatingScope>}
 */
export function validatePlayerRatingScopeAccess(input) {
  if (!input || typeof input !== "object") {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.INVALID_RATING_CONTRACT,
      "Scope access validation requires an input object"
    );
  }

  const subjectScope = requireExplicitPlayerRatingScope(input.subjectScope);
  const hints = readActorScopeHints(input.accessContext);

  if (!hints.hasGlobal && !hints.actorTenantId) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
      "Actor must supply tenantId or explicit global scope",
      { field: "tenantId" }
    );
  }

  if (subjectScope.kind === "global") {
    if (!hints.hasGlobal) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_GLOBAL_SCOPE_DENIED,
        "Global rating scope requires explicit actor global scope",
        { scopeKind: "global" }
      );
    }
    if (!hints.capabilities.includes(PLAYER_RATING_READ_CAPABILITY.READ_GLOBAL)) {
      failSecurityPrivacy(
        PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_GLOBAL_SCOPE_DENIED,
        "Global rating scope requires PLAYER_RATING_READ_GLOBAL capability",
        {
          scopeKind: "global",
          requiredCapability: PLAYER_RATING_READ_CAPABILITY.READ_GLOBAL,
        }
      );
    }
    return subjectScope;
  }

  const subjectTenantId = getScopeTenantId(subjectScope);
  if (!isNonEmptyString(subjectTenantId)) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
      "Tenant scope is missing tenantId",
      { scopeKind: "tenant" }
    );
  }

  if (hints.hasGlobal) {
    // Explicit global actor may read across tenants when authorized upstream.
    return subjectScope;
  }

  if (hints.actorTenantId !== subjectTenantId) {
    failSecurityPrivacy(
      PLAYER_RATING_SECURITY_PRIVACY_ERROR_CODE.RATING_TENANT_ACCESS_DENIED,
      "Actor tenantId does not match subject tenant scope",
      { scopeKind: "tenant" }
    );
  }

  return subjectScope;
}
