/**
 * Actor Reference contract (Platform Core Phase 1C).
 *
 * Technical reference for the initiator of an action or event.
 * Does not authenticate, load profiles, resolve roles/permissions, or
 * claim actorId is an authUserId / playerId.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";

/**
 * @typedef {{ actorType: string, actorId: string }} ActorReference
 */

export const ACTOR_REFERENCE_ERROR = Object.freeze({
  INVALID: "ACTOR_REFERENCE_INVALID",
  TYPE_INVALID: "ACTOR_TYPE_INVALID",
  ID_INVALID: "ACTOR_ID_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function actorReferenceError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createActorReference(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      actorReferenceError(
        ACTOR_REFERENCE_ERROR.INVALID,
        "ActorReference input must be a plain object"
      )
    );
  }

  if (typeof input.actorType !== "string") {
    return fail(
      actorReferenceError(
        ACTOR_REFERENCE_ERROR.TYPE_INVALID,
        "ActorReference actorType must be a string",
        "actorType"
      )
    );
  }

  const actorType = input.actorType.trim();
  if (actorType.length === 0) {
    return fail(
      actorReferenceError(
        ACTOR_REFERENCE_ERROR.TYPE_INVALID,
        "ActorReference actorType must be a non-empty string",
        "actorType"
      )
    );
  }

  const actorIdResult = normalizeOpaqueId(input.actorId);
  if (!actorIdResult.ok) {
    return fail(
      actorReferenceError(
        ACTOR_REFERENCE_ERROR.ID_INVALID,
        "ActorReference actorId must be a non-empty opaque identifier",
        "actorId"
      )
    );
  }

  /** @type {ActorReference} */
  const reference = {
    actorType,
    actorId: actorIdResult.value,
  };
  return ok(Object.freeze(reference));
}

/**
 * @param {*} value
 * @returns {value is ActorReference}
 */
export function isActorReference(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (typeof value.actorType !== "string" || typeof value.actorId !== "string") {
    return false;
  }
  return createActorReference(value).ok === true;
}
