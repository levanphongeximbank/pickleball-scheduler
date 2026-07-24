/**
 * Customer → Platform Core integration adapter.
 *
 * Pure projections only. Does not mint IDs, access persistence, env, or globals.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectPermissionCode,
  projectOperationIdentity,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
} from "../../../core/platform/index.js";

export const CUSTOMER_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "CUSTOMER_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  CUSTOMER_ID_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_CUSTOMER_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  PERMISSION_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_PERMISSION_REQUIRED",
  EVENT_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "CUSTOMER_PLATFORM_ADAPTER_ERROR_REQUIRED",
});

export const CUSTOMER_SUBJECT_TYPE = "CUSTOMER";

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
 * @param {*} input
 */
export function projectCustomerActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer actor input must be a plain object"
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
        CUSTOMER_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Customer actor projection requires an explicit actorId, userId, or authUserId",
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
 * @param {*} input
 */
export function projectCustomerTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer tenant scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Customer tenant scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  return projectTenantScope({
    scopeType: "TENANT",
    tenantId: input.tenantId,
  });
}

/**
 * Project Customer-owned subject. Default subjectType is CUSTOMER
 * (not CRM_CUSTOMER — that remains CRM's projection default).
 *
 * @param {*} input
 */
export function projectCustomerSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer subject input must be a plain object"
      )
    );
  }
  const customerId =
    "customerId" in input && input.customerId !== undefined
      ? input.customerId
      : input.subjectId;
  if (customerId === undefined || customerId === null) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.CUSTOMER_ID_REQUIRED,
        "Customer subject requires an explicit customerId or subjectId",
        "customerId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : CUSTOMER_SUBJECT_TYPE,
    subjectId: customerId,
  });
}

/**
 * @param {*} input
 */
export function projectCustomerPermission(input) {
  if (typeof input === "string") {
    return projectPermissionCode(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer permission input must be a string or plain object"
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
        CUSTOMER_PLATFORM_ADAPTER_ERROR.PERMISSION_REQUIRED,
        "Customer permission projection requires an explicit permission string",
        "permission"
      )
    );
  }
  return projectPermissionCode(permission);
}

/**
 * @param {*} input
 */
export function projectCustomerSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer security context input must be a plain object"
      )
    );
  }
  const actorResult = projectCustomerActor(input.actor ?? input);
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
 * @param {*} input
 */
export function projectCustomerOperationIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined || input.operationId === null) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Customer operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * @param {*} input
 */
export function projectCustomerErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Customer error descriptor input must be a plain object"
      )
    );
  }
  if (!("code" in input) || input.code === undefined || input.code === null) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Customer error descriptor requires an explicit code",
        "code"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * @param {*} input
 */
export function projectCustomerEventEnvelope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.INVALID,
        "Customer event envelope input must be a plain object"
      )
    );
  }
  if (!("eventType" in input) || input.eventType === undefined || input.eventType === null) {
    return fail(
      adapterError(
        CUSTOMER_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Customer event envelope requires an explicit eventType",
        "eventType"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}
