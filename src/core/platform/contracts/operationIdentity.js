/**
 * Operation Identity contract (Platform Core Phase 1F–1J).
 *
 * Technical identity of an operation provided by an external caller.
 * Does not generate identifiers, store execution state, detect duplicates,
 * retry, or recover.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";
import { createIdempotencyKey } from "./idempotencyKey.js";

/**
 * @typedef {{
 *   operationId: string,
 *   idempotencyKey?: string,
 *   correlationId?: string,
 * }} OperationIdentity
 */

export const OPERATION_IDENTITY_ERROR = Object.freeze({
  INVALID: "OPERATION_IDENTITY_INVALID",
  OPERATION_ID_INVALID: "OPERATION_IDENTITY_OPERATION_ID_INVALID",
  IDEMPOTENCY_KEY_INVALID: "OPERATION_IDENTITY_IDEMPOTENCY_KEY_INVALID",
  CORRELATION_ID_INVALID: "OPERATION_IDENTITY_CORRELATION_ID_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function operationIdentityError(code, message, field) {
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
export function createOperationIdentity(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      operationIdentityError(
        OPERATION_IDENTITY_ERROR.INVALID,
        "OperationIdentity input must be a plain object"
      )
    );
  }

  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      operationIdentityError(
        OPERATION_IDENTITY_ERROR.OPERATION_ID_INVALID,
        "OperationIdentity operationId is required",
        "operationId"
      )
    );
  }

  const operationIdResult = normalizeOpaqueId(input.operationId);
  if (!operationIdResult.ok) {
    return fail(
      operationIdentityError(
        OPERATION_IDENTITY_ERROR.OPERATION_ID_INVALID,
        "OperationIdentity operationId must be a non-empty opaque identifier",
        "operationId"
      )
    );
  }

  /** @type {OperationIdentity} */
  const identity = {
    operationId: operationIdResult.value,
  };

  if ("idempotencyKey" in input && input.idempotencyKey !== undefined) {
    const idempotencyKeyResult = createIdempotencyKey(input.idempotencyKey);
    if (!idempotencyKeyResult.ok) {
      return fail(
        operationIdentityError(
          OPERATION_IDENTITY_ERROR.IDEMPOTENCY_KEY_INVALID,
          "OperationIdentity idempotencyKey must be a valid IdempotencyKey",
          "idempotencyKey"
        )
      );
    }
    identity.idempotencyKey = idempotencyKeyResult.value;
  }

  if ("correlationId" in input && input.correlationId !== undefined) {
    const correlationIdResult = normalizeOpaqueId(input.correlationId);
    if (!correlationIdResult.ok) {
      return fail(
        operationIdentityError(
          OPERATION_IDENTITY_ERROR.CORRELATION_ID_INVALID,
          "OperationIdentity correlationId must be a non-empty opaque identifier",
          "correlationId"
        )
      );
    }
    identity.correlationId = correlationIdResult.value;
  }

  return ok(Object.freeze(identity));
}

/**
 * @param {*} value
 * @returns {value is OperationIdentity}
 */
export function isOperationIdentity(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (typeof value.operationId !== "string") {
    return false;
  }
  return createOperationIdentity(value).ok === true;
}
