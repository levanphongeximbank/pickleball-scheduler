/**
 * Identity Actor Adapter — projects an already-resolved identity into
 * Platform Core ActorReference.
 *
 * Does not authenticate, fetch profiles, generate IDs, evaluate roles,
 * or touch Supabase / localStorage / environment.
 */

import { fail } from "../../contracts/result.js";
import { createActorReference } from "../../contracts/actorReference.js";

export const IDENTITY_ACTOR_ADAPTER_ERROR = Object.freeze({
  INVALID: "IDENTITY_ACTOR_ADAPTER_INVALID",
  ACTOR_TYPE_REQUIRED: "IDENTITY_ACTOR_ADAPTER_ACTOR_TYPE_REQUIRED",
  ACTOR_ID_REQUIRED: "IDENTITY_ACTOR_ADAPTER_ACTOR_ID_REQUIRED",
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
 * Project an externally supplied actorType + actorId into ActorReference.
 *
 * Accepts either:
 * - `{ actorType, actorId }`
 * - `{ actorType, id }` (common auth/user shape; id is not generated)
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectIdentityActor(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        IDENTITY_ACTOR_ADAPTER_ERROR.INVALID,
        "Identity actor input must be a plain object"
      )
    );
  }

  if (typeof input.actorType !== "string" || input.actorType.trim().length === 0) {
    return fail(
      adapterError(
        IDENTITY_ACTOR_ADAPTER_ERROR.ACTOR_TYPE_REQUIRED,
        "Identity actor projection requires an explicit actorType",
        "actorType"
      )
    );
  }

  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : input.id;

  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        IDENTITY_ACTOR_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Identity actor projection requires an explicit actorId",
        "actorId"
      )
    );
  }

  return createActorReference({
    actorType: input.actorType,
    actorId,
  });
}
