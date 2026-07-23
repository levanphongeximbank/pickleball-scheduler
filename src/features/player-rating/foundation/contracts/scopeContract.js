/**
 * Explicit rating scope contract — tenant or global (fail-closed).
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract, isNonEmptyString, requireNonEmptyString } from "./shared.js";

/**
 * @typedef {Object} PlayerRatingTenantScope
 * @property {'tenant'} kind
 * @property {string} tenantId
 * @property {string} [venueId]
 */

/**
 * @typedef {Object} PlayerRatingGlobalScope
 * @property {'global'} kind
 */

/**
 * @typedef {PlayerRatingTenantScope|PlayerRatingGlobalScope} PlayerRatingScope
 */

/**
 * @param {unknown} scope
 * @returns {scope is PlayerRatingScope}
 */
export function isExplicitPlayerRatingScope(scope) {
  if (!scope || typeof scope !== "object") return false;
  const kind = /** @type {{ kind?: unknown }} */ (scope).kind;
  if (kind === "global") return true;
  if (kind === "tenant") {
    return isNonEmptyString(/** @type {{ tenantId?: unknown }} */ (scope).tenantId);
  }
  return false;
}

/**
 * Accepts a scope object, or a bare non-empty tenantId string for convenience.
 * Missing / ambiguous scope fails closed.
 *
 * @param {unknown} scopeOrTenantId
 * @returns {PlayerRatingScope}
 */
export function requireExplicitPlayerRatingScope(scopeOrTenantId) {
  if (typeof scopeOrTenantId === "string") {
    const tenantId = requireNonEmptyString(scopeOrTenantId, "tenantId");
    return Object.freeze({ kind: "tenant", tenantId });
  }

  if (!scopeOrTenantId || typeof scopeOrTenantId !== "object") {
    failContract(
      PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
      "Player Rating scope is unresolved: provide tenant scope or explicit global scope",
      { scope: scopeOrTenantId }
    );
  }

  const raw = /** @type {{ kind?: unknown, tenantId?: unknown, venueId?: unknown }} */ (
    scopeOrTenantId
  );

  if (raw.kind === "global") {
    return Object.freeze({ kind: "global" });
  }

  if (raw.kind === "tenant" || raw.tenantId != null) {
    const tenantId = requireNonEmptyString(raw.tenantId, "tenantId");
    /** @type {PlayerRatingTenantScope} */
    const scope = { kind: "tenant", tenantId };
    if (isNonEmptyString(raw.venueId)) {
      scope.venueId = String(raw.venueId).trim();
    }
    return Object.freeze(scope);
  }

  failContract(
    PLAYER_RATING_FOUNDATION_ERROR_CODE.TENANT_OR_SCOPE_UNRESOLVED,
    "Player Rating scope is unresolved: kind must be 'tenant' or 'global'",
    { scope: scopeOrTenantId }
  );
}

/**
 * @param {PlayerRatingScope} scope
 * @returns {string|null}
 */
export function getScopeTenantId(scope) {
  return scope.kind === "tenant" ? scope.tenantId : null;
}
