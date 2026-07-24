/**
 * CRM → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not change lead/opportunity stages, assignment, duplicate detection,
 * pipeline behavior, customer conversion, follow-up rules, or authorization
 * outcomes. Does not generate IDs or access persistence / environment / globals.
 * CRM authorization and pipeline policy remain entirely CRM-owned.
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
  projectOperationIdentity,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
  projectPlatformCapabilityDescriptor,
} from "../../../core/platform/index.js";

export const CRM_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "CRM_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  VENUE_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_VENUE_ID_REQUIRED",
  LEAD_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_LEAD_ID_REQUIRED",
  CUSTOMER_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_CUSTOMER_ID_REQUIRED",
  PERMISSION_REQUIRED: "CRM_PLATFORM_ADAPTER_PERMISSION_REQUIRED",
  OPERATION_ID_REQUIRED: "CRM_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  EVENT_REQUIRED: "CRM_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "CRM_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "CRM_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
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
 * Project an already-resolved CRM actor (user).
 *
 * @param {*} input
 */
export function projectCrmActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM actor input must be a plain object"
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
        CRM_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "CRM actor projection requires an explicit actorId, userId, or authUserId",
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
 * Project an explicit CRM tenant+venue scope. Does not infer venue from tenant.
 *
 * @param {*} input
 */
export function projectCrmScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "CRM scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  if (!("venueId" in input) || input.venueId === undefined || input.venueId === null) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.VENUE_ID_REQUIRED,
        "CRM scope requires an explicit venueId",
        "venueId"
      )
    );
  }
  return projectTenantScope({
    scopeType: "VENUE",
    scopeId: input.venueId,
    tenantId: input.tenantId,
  });
}

/**
 * Project a Subject Reference for an explicit leadId.
 *
 * @param {*} input
 */
export function projectCrmLeadSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM lead subject input must be a plain object"
      )
    );
  }
  if (!("leadId" in input) || input.leadId === undefined || input.leadId === null) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.LEAD_ID_REQUIRED,
        "CRM lead subject requires an explicit leadId",
        "leadId"
      )
    );
  }
  return createSubjectReference({
    subjectType: typeof input.subjectType === "string" ? input.subjectType : "CRM_LEAD",
    subjectId: input.leadId,
  });
}

/**
 * Project a Subject Reference for an explicit customer/contact id.
 *
 * @param {*} input
 */
export function projectCrmCustomerSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM customer subject input must be a plain object"
      )
    );
  }
  const customerId =
    "customerId" in input && input.customerId !== undefined
      ? input.customerId
      : "contactId" in input && input.contactId !== undefined
        ? input.contactId
        : input.subjectId;
  if (customerId === undefined || customerId === null) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.CUSTOMER_ID_REQUIRED,
        "CRM customer subject requires an explicit customerId, contactId, or subjectId",
        "customerId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : "CRM_CUSTOMER",
    subjectId: customerId,
  });
}

/**
 * Project an already-resolved CRM permission string. Does not map or evaluate.
 *
 * @param {*} input
 */
export function projectCrmPermission(input) {
  if (typeof input === "string") {
    return projectPermissionCode(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM permission input must be a string or plain object"
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
        CRM_PLATFORM_ADAPTER_ERROR.PERMISSION_REQUIRED,
        "CRM permission projection requires an explicit permission string",
        "permission"
      )
    );
  }
  return projectPermissionCode(permission);
}

/**
 * Project a security context from an already-resolved CRM actor.
 *
 * @param {*} input
 */
export function projectCrmSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM security context input must be a plain object"
      )
    );
  }
  const actorResult = projectCrmActor(input.actor ?? input);
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
export function projectCrmAuthorizationRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM authorization request input must be a plain object"
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
export function projectCrmAuthorizationDecision(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM authorization decision input must be a plain object"
      )
    );
  }
  return projectAuthorizationDecision(input);
}

/**
 * Project Operation Identity for an already-identified CRM command.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectCrmOperationIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.INVALID,
        "CRM operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "CRM operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project a Common Event Envelope from explicit CRM event fields.
 * Requires caller-supplied eventId and occurredAt. Does not publish events.
 *
 * @param {*} input
 */
export function projectCrmEventEnvelope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "CRM event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable CRM boundary.
 *
 * @param {*} input
 */
export function projectCrmErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "CRM error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project a capability descriptor for an explicit CRM public boundary.
 *
 * @param {*} input
 */
export function projectCrmCapabilityDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        CRM_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "CRM capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
