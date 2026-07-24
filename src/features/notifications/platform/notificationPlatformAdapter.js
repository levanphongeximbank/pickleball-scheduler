/**
 * Notification → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not resolve recipients, render templates, select channels, evaluate
 * retry, publish events, start workers, enqueue jobs, generate IDs or
 * timestamps, or access persistence / environment / globals.
 * Delivery, retry, persistence, and Notification Center remain Notification-owned.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectIdempotencyKey,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  projectEventTraceContext,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
  projectPlatformCapabilityDescriptor,
} from "../../../core/platform/index.js";

export const NOTIFICATION_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "NOTIFICATION_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  RECIPIENT_ID_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_RECIPIENT_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  IDEMPOTENCY_KEY_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_IDEMPOTENCY_KEY_REQUIRED",
  VERSION_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_VERSION_REQUIRED",
  EVENT_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  COMPATIBILITY_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
  TRACE_REQUIRED: "NOTIFICATION_PLATFORM_ADAPTER_TRACE_REQUIRED",
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
 * Project an already-resolved Notification actor (user).
 *
 * @param {*} input
 */
export function projectNotificationActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "actorUserId" in input && input.actorUserId !== undefined
        ? input.actorUserId
        : "userId" in input && input.userId !== undefined
          ? input.userId
          : input.authUserId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Notification actor projection requires an explicit actorId, actorUserId, or userId",
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
 * Project a security context from an already-resolved Notification actor.
 *
 * @param {*} input
 */
export function projectNotificationSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification security context input must be a plain object"
      )
    );
  }
  const actorResult = projectNotificationActor(input.actor ?? input);
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
 * Project an explicit Notification tenant scope. Does not infer tenant.
 *
 * @param {*} input
 */
export function projectNotificationScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Notification scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  return projectTenantScope({
    scopeType: "TENANT",
    tenantId: input.tenantId,
    ...(input.scopeId !== undefined ? { scopeId: input.scopeId } : {}),
  });
}

/**
 * Project a Subject Reference for an explicit recipient id.
 * Does not resolve profiles or membership.
 *
 * @param {*} input
 */
export function projectNotificationRecipient(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification recipient input must be a plain object"
      )
    );
  }
  const recipientId =
    "recipientId" in input && input.recipientId !== undefined
      ? input.recipientId
      : "userId" in input && input.userId !== undefined
        ? input.userId
        : input.subjectId;
  if (recipientId === undefined || recipientId === null) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.RECIPIENT_ID_REQUIRED,
        "Notification recipient requires an explicit recipientId, userId, or subjectId",
        "recipientId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string"
        ? input.subjectType
        : "NOTIFICATION_RECIPIENT",
    subjectId: recipientId,
  });
}

/**
 * Project Operation Identity for an already-identified Notification command.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectNotificationOperation(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Notification operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project a caller-supplied Notification idempotency key. Does not generate keys.
 *
 * @param {*} input
 */
export function projectNotificationIdempotencyKey(input) {
  if (typeof input === "string") {
    return projectIdempotencyKey(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification idempotency key input must be a string or plain object"
      )
    );
  }
  const key =
    "idempotencyKey" in input && input.idempotencyKey !== undefined
      ? input.idempotencyKey
      : input.key;
  if (key === undefined || key === null) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.IDEMPOTENCY_KEY_REQUIRED,
        "Notification idempotency key projection requires an explicit idempotencyKey",
        "idempotencyKey"
      )
    );
  }
  return projectIdempotencyKey(key);
}

/**
 * Project Trace Context from caller-supplied correlation/causation ids.
 * Does not generate identifiers.
 *
 * @param {*} input
 */
export function projectNotificationTrace(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.TRACE_REQUIRED,
        "Notification trace context input must be a plain object"
      )
    );
  }
  return projectEventTraceContext(input);
}

/**
 * Project a Common Event Envelope from explicit Notification event fields.
 * Requires caller-supplied eventId and occurredAt. Does not publish events.
 *
 * @param {*} input
 */
export function projectNotificationEvent(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Notification event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable Notification boundary.
 *
 * @param {*} input
 */
export function projectNotificationError(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Notification error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project Contract Version for an explicit Notification contract or event version.
 *
 * @param {*} input
 */
export function projectNotificationVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.INVALID,
        "Notification contract version input must be a string or plain object"
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
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Notification contract version requires an explicit version",
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
export function projectNotificationCompatibility(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Notification compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project a capability descriptor for an explicit Notification public boundary.
 *
 * @param {*} input
 */
export function projectNotificationCapability(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        NOTIFICATION_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Notification capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
