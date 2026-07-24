/**
 * Coaching & Training → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not schedule sessions, assign coaches, calculate attendance, modify
 * curriculum, create billing, change eligibility, evaluate permissions,
 * generate IDs or timestamps, or access persistence / environment / globals.
 * Coaching programs and persistence remain Coaching-owned.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectPermissionCode,
  projectAuthorizationRequest,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
  projectPlatformCapabilityDescriptor,
} from "../../../core/platform/index.js";

export const COACHING_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "COACHING_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "COACHING_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "COACHING_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  SUBJECT_ID_REQUIRED: "COACHING_PLATFORM_ADAPTER_SUBJECT_ID_REQUIRED",
  PERMISSION_REQUIRED: "COACHING_PLATFORM_ADAPTER_PERMISSION_REQUIRED",
  OPERATION_ID_REQUIRED: "COACHING_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  VERSION_REQUIRED: "COACHING_PLATFORM_ADAPTER_VERSION_REQUIRED",
  EVENT_REQUIRED: "COACHING_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "COACHING_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "COACHING_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  COMPATIBILITY_REQUIRED: "COACHING_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
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
 * Project an already-resolved Coaching actor (user / coach operator).
 *
 * @param {*} input
 */
export function projectCoachingActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "userId" in input && input.userId !== undefined
        ? input.userId
        : "coachId" in input && input.coachId !== undefined
          ? input.coachId
          : input.authUserId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Coaching actor projection requires an explicit actorId, userId, or coachId",
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
 * Project a security context from an already-resolved Coaching actor.
 *
 * @param {*} input
 */
export function projectCoachingSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching security context input must be a plain object"
      )
    );
  }
  const actorResult = projectCoachingActor(input.actor ?? input);
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
 * Project an explicit Coaching tenant/club/training scope. Does not infer tenant.
 *
 * @param {*} input
 */
export function projectCoachingScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Coaching scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  const scopeId =
    "scopeId" in input && input.scopeId !== undefined
      ? input.scopeId
      : input.clubId;
  return projectTenantScope({
    scopeType: typeof input.scopeType === "string" ? input.scopeType : "TENANT",
    tenantId: input.tenantId,
    ...(scopeId !== undefined ? { scopeId } : {}),
  });
}

/**
 * Project a Subject Reference for an explicit coach, student, or player.
 * Does not resolve coaching relationships.
 *
 * @param {*} input
 */
export function projectCoachingSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching subject input must be a plain object"
      )
    );
  }
  const subjectId =
    "subjectId" in input && input.subjectId !== undefined
      ? input.subjectId
      : "coachId" in input && input.coachId !== undefined
        ? input.coachId
        : "studentId" in input && input.studentId !== undefined
          ? input.studentId
          : "playerId" in input && input.playerId !== undefined
            ? input.playerId
            : input.classId;
  if (subjectId === undefined || subjectId === null) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED,
        "Coaching subject requires an explicit subjectId, coachId, studentId, playerId, or classId",
        "subjectId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : "COACHING_ENTITY",
    subjectId,
  });
}

/**
 * Project an already-resolved Coaching permission string. Does not evaluate.
 *
 * @param {*} input
 */
export function projectCoachingPermission(input) {
  if (typeof input === "string") {
    return projectPermissionCode(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching permission input must be a string or plain object"
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
        COACHING_PLATFORM_ADAPTER_ERROR.PERMISSION_REQUIRED,
        "Coaching permission projection requires an explicit permission string",
        "permission"
      )
    );
  }
  return projectPermissionCode(permission);
}

/**
 * Project an authorization request for an already-resolved permission check.
 * Does not evaluate allow/deny.
 *
 * @param {*} input
 */
export function projectCoachingAuthorizationRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching authorization request input must be a plain object"
      )
    );
  }
  return projectAuthorizationRequest(input);
}

/**
 * Project Operation Identity for an already-identified Coaching command.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectCoachingOperation(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Coaching operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project Contract Version for an explicit Coaching contract or event version.
 *
 * @param {*} input
 */
export function projectCoachingVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Coaching contract version input must be a string or plain object"
      )
    );
  }
  const version =
    "version" in input && input.version !== undefined
      ? input.version
      : input.contractVersion;
  if (version === undefined || version === null) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Coaching contract version requires an explicit version",
        "version"
      )
    );
  }
  return projectContractVersion(version);
}

/**
 * Project Compatibility Decision when an outcome is already resolved externally.
 *
 * @param {*} input
 */
export function projectCoachingCompatibility(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Coaching compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project a Common Event Envelope from explicit Coaching event fields.
 * Requires caller-supplied eventId and occurredAt. Does not schedule sessions.
 *
 * @param {*} input
 */
export function projectCoachingEvent(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Coaching event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable Coaching boundary.
 *
 * @param {*} input
 */
export function projectCoachingError(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Coaching error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project a capability descriptor for an explicit Coaching public boundary.
 *
 * @param {*} input
 */
export function projectCoachingCapability(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        COACHING_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Coaching capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
