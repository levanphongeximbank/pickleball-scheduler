/**
 * Pure CRM authorization foundation (Phase 1B).
 *
 * Fail closed when actor, scope, or permission is missing.
 * Does not read VITE_RBAC_ENABLED or any environment variable.
 * Not wired to Production routes / Identity SQL in this phase.
 */

import { CRM_ERROR_CODES, crmFailure } from "../constants/errorCodes.js";
import { isCrmPermission } from "../constants/permissions.js";
import { assertCrmScopeMatch, requireCrmScope } from "./scopeGuards.js";

/**
 * @param {object|null|undefined} actor
 * @returns {{ ok: true, actor: object } | { ok: false, code: string, error: string }}
 */
export function requireCrmActor(actor) {
  if (!actor || typeof actor !== "object") {
    return crmFailure(CRM_ERROR_CODES.MISSING_ACTOR, "Authenticated CRM actor is required.");
  }
  if (actor.authenticated === false) {
    return crmFailure(CRM_ERROR_CODES.UNAUTHORIZED, "CRM actor is not authenticated.");
  }
  const userId = typeof actor.userId === "string" ? actor.userId.trim() : "";
  if (!userId) {
    return crmFailure(CRM_ERROR_CODES.MISSING_ACTOR, "CRM actor.userId is required.");
  }
  const tenantId = typeof actor.tenantId === "string" ? actor.tenantId.trim() : "";
  if (!tenantId) {
    return crmFailure(CRM_ERROR_CODES.MISSING_ACTOR, "CRM actor.tenantId is required.");
  }
  return {
    ok: true,
    actor: {
      userId,
      tenantId,
      venueIds: Array.isArray(actor.venueIds)
        ? actor.venueIds.map(String).filter(Boolean)
        : [],
      permissions: Array.isArray(actor.permissions)
        ? actor.permissions.map(String).filter(Boolean)
        : [],
      authenticated: actor.authenticated !== false,
    },
  };
}

/**
 * Authorize a CRM permission within an explicit tenant+venue scope.
 *
 * @param {object|null|undefined} actor
 * @param {string} permission
 * @param {{ tenantId?: string, venueId?: string }} scopeInput
 * @returns {{ ok: true, actor: object, scope: object } | { ok: false, code: string, error: string }}
 */
export function authorizeCrm(actor, permission, scopeInput) {
  const actorResult = requireCrmActor(actor);
  if (!actorResult.ok) return actorResult;

  const scopeResult = requireCrmScope(scopeInput);
  if (!scopeResult.ok) return scopeResult;

  const { scope } = scopeResult;
  const normalizedActor = actorResult.actor;

  if (normalizedActor.tenantId !== scope.tenantId) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Actor tenant does not match CRM command scope."
    );
  }

  if (
    normalizedActor.venueIds.length > 0 &&
    !normalizedActor.venueIds.includes(scope.venueId)
  ) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Actor is not allowed to operate in this venue."
    );
  }

  const perm = String(permission || "").trim();
  if (!perm) {
    return crmFailure(CRM_ERROR_CODES.FORBIDDEN_PERMISSION, "CRM permission is required.");
  }
  if (!isCrmPermission(perm)) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_PERMISSION,
      `Unknown or non-CRM permission: ${perm}`
    );
  }
  if (!normalizedActor.permissions.includes(perm)) {
    return crmFailure(
      CRM_ERROR_CODES.FORBIDDEN_PERMISSION,
      `Missing CRM permission: ${perm}`
    );
  }

  return { ok: true, actor: normalizedActor, scope };
}

/**
 * Guard a resource already loaded from storage.
 *
 * @param {object|null|undefined} actor
 * @param {string} permission
 * @param {{ tenantId: string, venueId: string }} resource
 */
export function authorizeCrmResource(actor, permission, resource) {
  if (!resource?.tenantId || !resource?.venueId) {
    return crmFailure(CRM_ERROR_CODES.MISSING_SCOPE, "Resource scope is incomplete.");
  }
  const auth = authorizeCrm(actor, permission, {
    tenantId: resource.tenantId,
    venueId: resource.venueId,
  });
  if (!auth.ok) return auth;
  const match = assertCrmScopeMatch(auth.scope, resource);
  if (!match.ok) return match;
  return auth;
}
