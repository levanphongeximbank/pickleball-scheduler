/**
 * Provider invocation request — provider-neutral envelope.
 * No credentials, no env reads, no vendor models.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT_VALUES,
  PROVIDER_INVOCATION_REQUEST_VERSION,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  normalizeOpaquePayload,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const PROVIDER_INVOCATION_REQUEST_ERROR = Object.freeze({
  INVALID: "PROVIDER_INVOCATION_REQUEST_INVALID",
  ID_INVALID: "PROVIDER_INVOCATION_REQUEST_ID_INVALID",
  VERSION_INVALID: "PROVIDER_INVOCATION_REQUEST_VERSION_INVALID",
  REFERENCE_INVALID: "PROVIDER_INVOCATION_REQUEST_REFERENCE_INVALID",
  OPERATION_INVALID: "PROVIDER_INVOCATION_REQUEST_OPERATION_INVALID",
  ENVIRONMENT_INVALID: "PROVIDER_INVOCATION_REQUEST_ENVIRONMENT_INVALID",
  PAYLOAD_INVALID: "PROVIDER_INVOCATION_REQUEST_PAYLOAD_INVALID",
  METADATA_INVALID: "PROVIDER_INVOCATION_REQUEST_METADATA_INVALID",
  TIMEOUT_INVALID: "PROVIDER_INVOCATION_REQUEST_TIMEOUT_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderInvocationRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_INVOCATION_REQUEST_ERROR.INVALID,
        "ProviderInvocationRequest input must be a plain object"
      )
    );
  }

  const requestId = requireNonEmptyString(
    input.requestId,
    "requestId",
    PROVIDER_INVOCATION_REQUEST_ERROR.ID_INVALID,
    "requestId"
  );
  if (!requestId.ok) return requestId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? PROVIDER_INVOCATION_REQUEST_VERSION,
    "contractVersion",
    PROVIDER_INVOCATION_REQUEST_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const adapterId = requireNonEmptyString(
    input.adapterId,
    "adapterId",
    PROVIDER_INVOCATION_REQUEST_ERROR.REFERENCE_INVALID,
    "adapterId"
  );
  if (!adapterId.ok) return adapterId;

  const connectorId = requireNonEmptyString(
    input.connectorId,
    "connectorId",
    PROVIDER_INVOCATION_REQUEST_ERROR.REFERENCE_INVALID,
    "connectorId"
  );
  if (!connectorId.ok) return connectorId;

  const capabilityId = requireNonEmptyString(
    input.capabilityId,
    "capabilityId",
    PROVIDER_INVOCATION_REQUEST_ERROR.REFERENCE_INVALID,
    "capabilityId"
  );
  if (!capabilityId.ok) return capabilityId;

  const operation = requireNonEmptyString(
    input.operation,
    "operation",
    PROVIDER_INVOCATION_REQUEST_ERROR.OPERATION_INVALID,
    "operation"
  );
  if (!operation.ok) return operation;

  const requestedEnvironment = requireEnumMember(
    input.requestedEnvironment ?? input.environment ?? "TEST",
    CONNECTOR_ENVIRONMENT_VALUES,
    "requestedEnvironment",
    PROVIDER_INVOCATION_REQUEST_ERROR.ENVIRONMENT_INVALID,
    "requestedEnvironment"
  );
  if (!requestedEnvironment.ok) return requestedEnvironment;

  const payload = normalizeOpaquePayload(
    input.payload ?? {},
    "payload",
    PROVIDER_INVOCATION_REQUEST_ERROR.PAYLOAD_INVALID
  );
  if (!payload.ok) return payload;

  /** @type {string|undefined} */
  let tenantId;
  if ("tenantId" in input && input.tenantId !== undefined) {
    const tenant = requireNonEmptyString(
      input.tenantId,
      "tenantId",
      PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
      "tenantId"
    );
    if (!tenant.ok) return tenant;
    tenantId = tenant.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  /** @type {string|undefined} */
  let causationId;
  if ("causationId" in input && input.causationId !== undefined) {
    const cause = requireNonEmptyString(
      input.causationId,
      "causationId",
      PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
      "causationId"
    );
    if (!cause.ok) return cause;
    causationId = cause.value;
  }

  /** @type {string|undefined} */
  let idempotencyKey;
  if ("idempotencyKey" in input && input.idempotencyKey !== undefined) {
    const key = requireNonEmptyString(
      input.idempotencyKey,
      "idempotencyKey",
      PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
      "idempotencyKey"
    );
    if (!key.ok) return key;
    idempotencyKey = key.value;
  }

  /** @type {{ timeoutMs: number }|undefined} */
  let timeoutPolicy;
  if ("timeoutPolicy" in input && input.timeoutPolicy !== undefined) {
    if (!isPlainObject(input.timeoutPolicy)) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_REQUEST_ERROR.TIMEOUT_INVALID,
          "timeoutPolicy must be a plain object",
          "timeoutPolicy"
        )
      );
    }
    const timeoutMs = input.timeoutPolicy.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_REQUEST_ERROR.TIMEOUT_INVALID,
          "timeoutPolicy.timeoutMs must be a positive integer",
          "timeoutPolicy"
        )
      );
    }
    timeoutPolicy = Object.freeze({ timeoutMs });
  }

  let observationContext = Object.freeze({});
  if ("observationContext" in input && input.observationContext !== undefined) {
    if (!isPlainObject(input.observationContext)) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
          "observationContext must be a plain object",
          "observationContext"
        )
      );
    }
    for (const key of Object.keys(input.observationContext)) {
      if (/(secret|password|token|api[_-]?key|credential)/i.test(key)) {
        return fail(
          contractError(
            PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID,
            `observationContext must not include credential-like key: ${key}`,
            "observationContext"
          )
        );
      }
    }
    observationContext = deepFreeze({ ...input.observationContext });
  }

  /** @type {string|undefined} */
  let requestedAt;
  if ("requestedAt" in input && input.requestedAt !== undefined) {
    const at = requireIsoInstant(
      input.requestedAt,
      "requestedAt",
      PROVIDER_INVOCATION_REQUEST_ERROR.METADATA_INVALID
    );
    if (!at.ok) return at;
    requestedAt = at.value;
  }

  return ok(
    deepFreeze({
      requestId: requestId.value,
      contractVersion: contractVersion.value,
      adapterId: adapterId.value,
      connectorId: connectorId.value,
      capabilityId: capabilityId.value,
      operation: operation.value,
      requestedEnvironment: requestedEnvironment.value,
      payload: payload.value,
      ...(tenantId ? { tenantId } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(causationId ? { causationId } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(timeoutPolicy ? { timeoutPolicy } : {}),
      observationContext,
      ...(requestedAt ? { requestedAt } : {}),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isProviderInvocationRequest(value) {
  return createProviderInvocationRequest(value).ok === true;
}
