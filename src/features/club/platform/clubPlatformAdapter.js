/**
 * Club Management → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not evaluate governance, membership, roles, or authorization outcomes.
 * Module-owned guards remain responsible for allow/deny.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectPermissionCode,
  projectAuthorizationRequest,
  projectAuthorizationDecision,
} from "../../../core/platform/index.js";

export const CLUB_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "CLUB_PLATFORM_ADAPTER_INVALID",
  CLUB_ID_REQUIRED: "CLUB_PLATFORM_ADAPTER_CLUB_ID_REQUIRED",
  ACTOR_ID_REQUIRED: "CLUB_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  PERMISSION_REQUIRED: "CLUB_PLATFORM_ADAPTER_PERMISSION_REQUIRED",
  MEMBER_ID_REQUIRED: "CLUB_PLATFORM_ADAPTER_MEMBER_ID_REQUIRED",
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
 * Project an already-resolved club actor (user).
 *
 * @param {*} input
 */
export function projectClubActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "userId" in input && input.userId !== undefined
        ? input.userId
        : input.authUserId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Club actor projection requires an explicit actorId, userId, or authUserId",
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
 * Project an explicit club scope. Does not equate clubId with tenantId/venueId.
 *
 * @param {*} input
 */
export function projectClubScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club scope input must be a plain object"
      )
    );
  }
  if (!("clubId" in input) || input.clubId === undefined || input.clubId === null) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.CLUB_ID_REQUIRED,
        "Club scope projection requires an explicit clubId",
        "clubId"
      )
    );
  }
  /** @type {{ scopeType: string, scopeId: *, tenantId?: * }} */
  const payload = {
    scopeType: "CLUB",
    scopeId: input.clubId,
  };
  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  return projectTenantScope(payload);
}

/**
 * Project a Subject Reference for an explicit club entity.
 *
 * @param {*} input
 */
export function projectClubSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club subject input must be a plain object"
      )
    );
  }
  if (!("clubId" in input) || input.clubId === undefined || input.clubId === null) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.CLUB_ID_REQUIRED,
        "Club subject projection requires an explicit clubId",
        "clubId"
      )
    );
  }
  return createSubjectReference({
    subjectType: "CLUB",
    subjectId: input.clubId,
  });
}

/**
 * Project a Subject Reference for an explicit club member entity.
 *
 * @param {*} input
 */
export function projectClubMemberSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club member subject input must be a plain object"
      )
    );
  }
  const memberId =
    "memberId" in input && input.memberId !== undefined
      ? input.memberId
      : input.userId;
  if (memberId === undefined || memberId === null) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.MEMBER_ID_REQUIRED,
        "Club member subject requires an explicit memberId or userId",
        "memberId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : "CLUB_MEMBER",
    subjectId: memberId,
  });
}

/**
 * Project an already-resolved permission string. Does not map or rewrite.
 *
 * @param {*} input
 */
export function projectClubPermission(input) {
  if (typeof input === "string") {
    return projectPermissionCode(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club permission input must be a string or plain object"
      )
    );
  }
  const permission =
    "permissionCode" in input && input.permissionCode !== undefined
      ? input.permissionCode
      : "permission" in input && input.permission !== undefined
        ? input.permission
        : input.code;
  if (permission === undefined || permission === null) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.PERMISSION_REQUIRED,
        "Club permission projection requires an explicit permission string",
        "permission"
      )
    );
  }
  return projectPermissionCode(permission);
}

/**
 * Project a security context from an already-resolved club actor.
 *
 * @param {*} input
 */
export function projectClubSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club security context input must be a plain object"
      )
    );
  }
  const actorResult = projectClubActor(input.actor ?? input);
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
 * Project an authorization request for an already-resolved permission check.
 * Does not evaluate allow/deny.
 *
 * @param {*} input
 */
export function projectClubAuthorizationRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club authorization request input must be a plain object"
      )
    );
  }
  return projectAuthorizationRequest(input);
}

/**
 * Project an already-resolved authorization decision. Does not re-evaluate.
 *
 * @param {*} input
 */
export function projectClubAuthorizationDecision(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CLUB_PLATFORM_ADAPTER_ERROR.INVALID,
        "Club authorization decision input must be a plain object"
      )
    );
  }
  return projectAuthorizationDecision(input);
}
