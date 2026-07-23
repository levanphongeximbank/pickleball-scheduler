/**
 * Security Context contract (Platform Core Phase 1C).
 *
 * Technical envelope of externally provided identity/request identifiers.
 * Does not authenticate, authorize, resolve roles/permissions, fetch
 * profiles, evaluate tenant membership, or invent optional identifiers.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";
import {
  createActorReference,
  isActorReference,
} from "./actorReference.js";

/**
 * @typedef {{
 *   actor: import("./actorReference.js").ActorReference,
 *   tenantId?: string,
 *   sessionId?: string,
 *   requestId?: string,
 *   correlationId?: string,
 * }} SecurityContext
 */

export const SECURITY_CONTEXT_ERROR = Object.freeze({
  INVALID: "SECURITY_CONTEXT_INVALID",
  ACTOR_INVALID: "SECURITY_CONTEXT_ACTOR_INVALID",
  IDENTIFIER_INVALID: "SECURITY_CONTEXT_IDENTIFIER_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function securityContextError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @param {string} field
 * @returns {import("./result.js").Result}
 */
function normalizeOptionalOpaqueId(input, field) {
  if (!(field in input) || input[field] === undefined) {
    return ok(undefined);
  }

  const result = normalizeOpaqueId(input[field]);
  if (!result.ok) {
    return fail(
      securityContextError(
        SECURITY_CONTEXT_ERROR.IDENTIFIER_INVALID,
        `SecurityContext ${field} must be a non-empty opaque identifier`,
        field
      )
    );
  }

  return ok(result.value);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createSecurityContext(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      securityContextError(
        SECURITY_CONTEXT_ERROR.INVALID,
        "SecurityContext input must be a plain object"
      )
    );
  }

  if (!("actor" in input) || input.actor === undefined) {
    return fail(
      securityContextError(
        SECURITY_CONTEXT_ERROR.ACTOR_INVALID,
        "SecurityContext actor is required",
        "actor"
      )
    );
  }

  const actorResult = createActorReference(input.actor);
  if (!actorResult.ok) {
    return fail(
      securityContextError(
        SECURITY_CONTEXT_ERROR.ACTOR_INVALID,
        "SecurityContext actor must be a valid ActorReference",
        "actor"
      )
    );
  }

  const tenantIdResult = normalizeOptionalOpaqueId(input, "tenantId");
  if (!tenantIdResult.ok) return tenantIdResult;

  const sessionIdResult = normalizeOptionalOpaqueId(input, "sessionId");
  if (!sessionIdResult.ok) return sessionIdResult;

  const requestIdResult = normalizeOptionalOpaqueId(input, "requestId");
  if (!requestIdResult.ok) return requestIdResult;

  const correlationIdResult = normalizeOptionalOpaqueId(input, "correlationId");
  if (!correlationIdResult.ok) return correlationIdResult;

  /** @type {SecurityContext} */
  const context = { actor: actorResult.value };

  if (tenantIdResult.value !== undefined) {
    context.tenantId = tenantIdResult.value;
  }
  if (sessionIdResult.value !== undefined) {
    context.sessionId = sessionIdResult.value;
  }
  if (requestIdResult.value !== undefined) {
    context.requestId = requestIdResult.value;
  }
  if (correlationIdResult.value !== undefined) {
    context.correlationId = correlationIdResult.value;
  }

  return ok(Object.freeze(context));
}

/**
 * @param {*} value
 * @returns {value is SecurityContext}
 */
export function isSecurityContext(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!isActorReference(value.actor)) {
    return false;
  }
  return createSecurityContext(value).ok === true;
}
