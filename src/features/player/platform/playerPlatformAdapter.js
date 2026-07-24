/**
 * Player Management → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not look up players, change privacy, map userId→playerId ownership,
 * evaluate self-profile authorization, or access persistence / environment.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectEventErrorDescriptor,
  projectOperationIdentity,
} from "../../../core/platform/index.js";

export const PLAYER_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "PLAYER_PLATFORM_ADAPTER_INVALID",
  PLAYER_ID_REQUIRED: "PLAYER_PLATFORM_ADAPTER_PLAYER_ID_REQUIRED",
  ACTOR_ID_REQUIRED: "PLAYER_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "PLAYER_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  ERROR_REQUIRED: "PLAYER_PLATFORM_ADAPTER_ERROR_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
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
 * @returns {input is Record<string, *>}
 */
function isPlainObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

/**
 * Project an Actor Reference from an already-resolved auth user.
 *
 * @param {*} input
 */
export function projectPlayerActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "authUserId" in input && input.authUserId !== undefined
        ? input.authUserId
        : input.userId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Player actor projection requires an explicit actorId, authUserId, or userId",
        "actorId"
      )
    );
  }
  return projectIdentityActor({
    actorType: typeof input.actorType === "string" ? input.actorType : "USER",
    actorId,
  });
}

/**
 * Project a Subject Reference for an explicit playerId. Does not look up players.
 *
 * @param {*} input
 */
export function projectPlayerSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player subject input must be a plain object"
      )
    );
  }
  if (!("playerId" in input) || input.playerId === undefined || input.playerId === null) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.PLAYER_ID_REQUIRED,
        "Player subject projection requires an explicit playerId",
        "playerId"
      )
    );
  }
  return createSubjectReference({
    subjectType: "PLAYER",
    subjectId: input.playerId,
  });
}

/**
 * Project a Security Context from an already-resolved user.
 *
 * @param {*} input
 */
export function projectPlayerSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player security context input must be a plain object"
      )
    );
  }
  const actorResult = projectPlayerActor(input.actor ?? input);
  if (!actorResult.ok) {
    return actorResult;
  }
  /** @type {{ actor: *, tenantId?: *, sessionId?: *, requestId?: *, correlationId?: * }} */
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
  return projectSecurityContext(payload);
}

/**
 * Project a Platform Error Descriptor at a stable Player facade boundary.
 *
 * @param {*} input
 */
export function projectPlayerErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Player error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project Operation Identity for an already-identified command or read request.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectPlayerOperationIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        PLAYER_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Player operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}
