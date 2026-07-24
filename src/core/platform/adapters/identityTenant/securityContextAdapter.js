/**
 * Security Context Adapter — projects already-resolved runtime values into
 * Platform Core SecurityContext.
 *
 * Does not restore sessions, read environment/localStorage, invent tenant
 * or session identifiers, or authenticate.
 */

import { fail, ok } from "../../contracts/result.js";
import { createSecurityContext } from "../../contracts/securityContext.js";
import { isActorReference } from "../../contracts/actorReference.js";
import { projectIdentityActor } from "./identityActorAdapter.js";

export const SECURITY_CONTEXT_ADAPTER_ERROR = Object.freeze({
  INVALID: "SECURITY_CONTEXT_ADAPTER_INVALID",
  ACTOR_REQUIRED: "SECURITY_CONTEXT_ADAPTER_ACTOR_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
function resolveActor(input) {
  if (!("actor" in input) || input.actor === undefined) {
    return fail(
      adapterError(
        SECURITY_CONTEXT_ADAPTER_ERROR.ACTOR_REQUIRED,
        "Security context projection requires an explicit actor",
        "actor"
      )
    );
  }

  if (isActorReference(input.actor)) {
    return ok(input.actor);
  }

  return projectIdentityActor(input.actor);
}

/**
 * Project already-resolved identity and optional identifiers into
 * SecurityContext. Optional fields are included only when supplied.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectSecurityContext(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        SECURITY_CONTEXT_ADAPTER_ERROR.INVALID,
        "Security context input must be a plain object"
      )
    );
  }

  const actorResult = resolveActor(input);
  if (!actorResult.ok) return actorResult;

  /** @type {{ actor: import("../../contracts/actorReference.js").ActorReference, tenantId?: *, sessionId?: *, requestId?: *, correlationId?: * }} */
  const payload = { actor: actorResult.value };

  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  if ("sessionId" in input && input.sessionId !== undefined) {
    payload.sessionId = input.sessionId;
  }
  if ("requestId" in input && input.requestId !== undefined) {
    payload.requestId = input.requestId;
  }
  if ("correlationId" in input && input.correlationId !== undefined) {
    payload.correlationId = input.correlationId;
  }

  return createSecurityContext(payload);
}
