/**
 * Finance → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not calculate money, round amounts, post ledger entries, execute
 * payments/refunds, generate IDs or idempotency keys, detect duplicates,
 * evaluate approval policy, or access persistence / environment / globals.
 * Money semantics remain entirely Finance-owned.
 */

import {
  fail,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectIdempotencyKey,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
  projectPlatformCapabilityDescriptor,
} from "../../../core/platform/index.js";

export const FINANCE_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "FINANCE_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "FINANCE_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "FINANCE_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "FINANCE_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  IDEMPOTENCY_KEY_REQUIRED: "FINANCE_PLATFORM_ADAPTER_IDEMPOTENCY_KEY_REQUIRED",
  VERSION_REQUIRED: "FINANCE_PLATFORM_ADAPTER_VERSION_REQUIRED",
  EVENT_REQUIRED: "FINANCE_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "FINANCE_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "FINANCE_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  COMPATIBILITY_REQUIRED: "FINANCE_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
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
 * Project an already-resolved Finance actor (user).
 *
 * @param {*} input
 */
export function projectFinanceActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance actor input must be a plain object"
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
        FINANCE_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Finance actor projection requires an explicit actorId, userId, or authUserId",
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
 * Project an explicit Finance tenant scope. Does not resolve tenant from user.
 *
 * @param {*} input
 */
export function projectFinanceTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance tenant scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Finance tenant scope requires an explicit tenantId",
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
 * Project a security context from an already-resolved Finance actor.
 *
 * @param {*} input
 */
export function projectFinanceSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance security context input must be a plain object"
      )
    );
  }
  const actorResult = projectFinanceActor(input.actor ?? input);
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
 * Project Operation Identity for an already-identified Finance command.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectFinanceOperationIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Finance operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project a caller-supplied Finance idempotency key. Does not generate keys.
 *
 * @param {*} input
 */
export function projectFinanceIdempotencyKey(input) {
  if (typeof input === "string") {
    return projectIdempotencyKey(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance idempotency key input must be a string or plain object"
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
        FINANCE_PLATFORM_ADAPTER_ERROR.IDEMPOTENCY_KEY_REQUIRED,
        "Finance idempotency key projection requires an explicit idempotencyKey",
        "idempotencyKey"
      )
    );
  }
  return projectIdempotencyKey(key);
}

/**
 * Project Contract Version for an explicit Finance contract or event version.
 *
 * @param {*} input
 */
export function projectFinanceContractVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.INVALID,
        "Finance contract version input must be a string or plain object"
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
        FINANCE_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Finance contract version requires an explicit version",
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
export function projectFinanceCompatibilityDecision(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Finance compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project a Common Event Envelope from explicit Finance event fields.
 * Requires caller-supplied eventId and occurredAt. Does not publish events.
 *
 * @param {*} input
 */
export function projectFinanceEventEnvelope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Finance event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable Finance boundary.
 *
 * @param {*} input
 */
export function projectFinanceErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Finance error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project a capability descriptor for an explicit Finance public boundary.
 *
 * @param {*} input
 */
export function projectFinanceCapabilityDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        FINANCE_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Finance capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
