/**
 * Pure Coaching authorization foundation (COACHING-01).
 *
 * Fail closed when actor, scope, action, or authorization dependency is missing
 * or malformed. Does not read VITE_RBAC_ENABLED or any environment variable.
 * Not wired to Production routes / Identity SQL in this phase.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { isCoachingAction } from "../constants/actions.js";
import { coachingFailure } from "../errors/CoachingError.js";
import { createCoachingScope } from "../domain/scope.js";

/**
 * @param {object|null|undefined} actor
 * @returns {{ ok: true, actor: object } | { ok: false, code: string, error: string }}
 */
export function requireCoachingActor(actor) {
  if (!actor || typeof actor !== "object") {
    return coachingFailure(
      COACHING_ERROR_CODES.MISSING_ACTOR,
      "Authenticated Coaching actor is required."
    );
  }
  if (actor.authenticated === false) {
    return coachingFailure(
      COACHING_ERROR_CODES.UNAUTHORIZED,
      "Coaching actor is not authenticated."
    );
  }
  const userId =
    typeof actor.userId === "string"
      ? actor.userId.trim()
      : typeof actor.actorId === "string"
        ? actor.actorId.trim()
        : "";
  if (!userId) {
    return coachingFailure(
      COACHING_ERROR_CODES.MISSING_ACTOR,
      "Coaching actor.userId (or actorId) is required."
    );
  }
  const tenantId = typeof actor.tenantId === "string" ? actor.tenantId.trim() : "";
  if (!tenantId) {
    return coachingFailure(
      COACHING_ERROR_CODES.MISSING_ACTOR,
      "Coaching actor.tenantId is required."
    );
  }
  const clubIds = Array.isArray(actor.clubIds)
    ? actor.clubIds.map(String).filter(Boolean)
    : [];
  const actions = Array.isArray(actor.actions)
    ? actor.actions.map(String).filter(Boolean)
    : Array.isArray(actor.permissions)
      ? actor.permissions.map(String).filter(Boolean)
      : [];

  return {
    ok: true,
    actor: {
      userId,
      tenantId,
      clubIds,
      actions,
      authenticated: actor.authenticated !== false,
    },
  };
}

/**
 * @param {unknown} scopeInput
 * @returns {{ ok: true, scope: object } | { ok: false, code: string, error: string }}
 */
export function requireCoachingScope(scopeInput) {
  try {
    const scope = createCoachingScope(scopeInput || {});
    return { ok: true, scope };
  } catch (err) {
    return coachingFailure(
      err?.code || COACHING_ERROR_CODES.MISSING_SCOPE,
      err?.message || "tenantId and clubId are required."
    );
  }
}

/**
 * Authorize a canonical Coaching action within explicit tenant+club scope.
 *
 * @param {object|null|undefined} actor
 * @param {string} action
 * @param {{ tenantId?: string, clubId?: string, venueId?: string }} scopeInput
 * @returns {{ ok: true, actor: object, scope: object } | { ok: false, code: string, error: string }}
 */
export function authorizeCoaching(actor, action, scopeInput) {
  const actorResult = requireCoachingActor(actor);
  if (!actorResult.ok) return actorResult;

  const scopeResult = requireCoachingScope(scopeInput);
  if (!scopeResult.ok) return scopeResult;

  const { scope } = scopeResult;
  const normalizedActor = actorResult.actor;

  if (normalizedActor.tenantId !== scope.tenantId) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Actor tenant does not match Coaching command scope."
    );
  }

  if (
    normalizedActor.clubIds.length > 0 &&
    !normalizedActor.clubIds.includes(scope.clubId)
  ) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Actor is not allowed to operate in this club."
    );
  }

  const act = String(action || "").trim();
  if (!act) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_ACTION,
      "Coaching action is required."
    );
  }
  if (!isCoachingAction(act)) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_ACTION,
      `Unknown or non-Coaching action: ${act}`
    );
  }
  if (!normalizedActor.actions.includes(act)) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_ACTION,
      `Missing Coaching action: ${act}`
    );
  }

  return { ok: true, actor: normalizedActor, scope };
}

/**
 * Guard a resource already loaded from storage.
 *
 * @param {object|null|undefined} actor
 * @param {string} action
 * @param {{ tenantId: string, clubId: string, venueId?: string|null }} resource
 */
export function authorizeCoachingResource(actor, action, resource) {
  if (!resource?.tenantId || !resource?.clubId) {
    return coachingFailure(
      COACHING_ERROR_CODES.MISSING_SCOPE,
      "Resource scope is incomplete."
    );
  }
  const auth = authorizeCoaching(actor, action, {
    tenantId: resource.tenantId,
    clubId: resource.clubId,
    venueId: resource.venueId ?? undefined,
  });
  if (!auth.ok) return auth;
  if (
    auth.scope.tenantId !== resource.tenantId ||
    auth.scope.clubId !== resource.clubId
  ) {
    return coachingFailure(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-tenant or cross-club Coaching access is forbidden."
    );
  }
  return auth;
}

/**
 * Optional injectable authorization port — fail closed when missing/malformed.
 *
 * @param {object|null|undefined} authorizationPort
 * @param {object|null|undefined} actor
 * @param {string} action
 * @param {object} scopeInput
 */
export function authorizeCoachingViaPort(
  authorizationPort,
  actor,
  action,
  scopeInput
) {
  if (authorizationPort == null) {
    // Local pure authorize is the default when no port is injected.
    return authorizeCoaching(actor, action, scopeInput);
  }
  if (typeof authorizationPort !== "object" || typeof authorizationPort.authorize !== "function") {
    return coachingFailure(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Coaching authorization dependency is missing or malformed."
    );
  }
  let decision;
  try {
    decision = authorizationPort.authorize(actor, action, scopeInput);
  } catch (err) {
    return coachingFailure(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Coaching authorization dependency threw unexpectedly.",
      { message: err?.message }
    );
  }
  if (!decision || typeof decision !== "object" || decision.ok !== true) {
    if (decision && decision.ok === false && decision.code) {
      return decision;
    }
    return coachingFailure(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Coaching authorization decision is malformed (fail closed)."
    );
  }
  if (!decision.scope?.tenantId || !decision.scope?.clubId || !decision.actor?.userId) {
    return coachingFailure(
      COACHING_ERROR_CODES.DEPENDENCY_UNAVAILABLE,
      "Coaching authorization decision missing required actor/scope fields."
    );
  }
  return decision;
}
