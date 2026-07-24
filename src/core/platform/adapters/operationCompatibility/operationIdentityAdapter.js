/**
 * Operation Identity Adapter — projects already-resolved operation identifiers
 * into Platform Core OperationIdentity.
 *
 * Does not generate operationId / correlationId / idempotencyKey, detect
 * duplicates, retry, replay, recover, persist, or inspect HTTP headers /
 * runtime globals.
 */

import { fail } from "../../contracts/result.js";
import { createOperationIdentity } from "../../contracts/operationIdentity.js";
import { projectIdempotencyKey } from "./idempotencyKeyAdapter.js";

export const OPERATION_IDENTITY_ADAPTER_ERROR = Object.freeze({
  INVALID: "OPERATION_IDENTITY_ADAPTER_INVALID",
  OPERATION_ID_REQUIRED: "OPERATION_IDENTITY_ADAPTER_OPERATION_ID_REQUIRED",
  IDEMPOTENCY_KEY_INVALID: "OPERATION_IDENTITY_ADAPTER_IDEMPOTENCY_KEY_INVALID",
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
 * Project caller-supplied operationId with optional idempotencyKey and
 * correlationId into OperationIdentity.
 *
 * When an explicit raw idempotency key is supplied, it is composed through
 * projectIdempotencyKey before createOperationIdentity.
 *
 * @param {*} input
 * @returns {import("../../contracts/result.js").Result}
 */
export function projectOperationIdentity(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      adapterError(
        OPERATION_IDENTITY_ADAPTER_ERROR.INVALID,
        "Operation identity input must be a plain object"
      )
    );
  }

  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        OPERATION_IDENTITY_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Operation identity projection requires an explicit operationId",
        "operationId"
      )
    );
  }

  /** @type {{ operationId: *, idempotencyKey?: *, correlationId?: * }} */
  const payload = {
    operationId: input.operationId,
  };

  if ("idempotencyKey" in input && input.idempotencyKey !== undefined) {
    const keyResult = projectIdempotencyKey(input.idempotencyKey);
    if (!keyResult.ok) {
      return fail(
        adapterError(
          OPERATION_IDENTITY_ADAPTER_ERROR.IDEMPOTENCY_KEY_INVALID,
          "Operation identity idempotencyKey must be a valid IdempotencyKey",
          "idempotencyKey"
        )
      );
    }
    payload.idempotencyKey = keyResult.value;
  }

  if ("correlationId" in input && input.correlationId !== undefined) {
    payload.correlationId = input.correlationId;
  }

  return createOperationIdentity(payload);
}
