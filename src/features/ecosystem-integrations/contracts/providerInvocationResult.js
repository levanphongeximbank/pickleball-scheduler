/**
 * Provider invocation result — provider-neutral outcome envelope.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  IDEMPOTENCY_OUTCOME_VALUES,
  INVOCATION_RESULT_STATUS_VALUES,
  PROVIDER_INVOCATION_RESULT_VERSION,
} from "../constants/catalogues.js";
import {
  classifyIntegrationRetry,
  createIntegrationError,
} from "../errors/errorTaxonomy.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  normalizeOpaquePayload,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const PROVIDER_INVOCATION_RESULT_ERROR = Object.freeze({
  INVALID: "PROVIDER_INVOCATION_RESULT_INVALID",
  ID_INVALID: "PROVIDER_INVOCATION_RESULT_ID_INVALID",
  STATUS_INVALID: "PROVIDER_INVOCATION_RESULT_STATUS_INVALID",
  REFERENCE_INVALID: "PROVIDER_INVOCATION_RESULT_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "PROVIDER_INVOCATION_RESULT_TIMESTAMP_INVALID",
  OUTPUT_INVALID: "PROVIDER_INVOCATION_RESULT_OUTPUT_INVALID",
  ERROR_INVALID: "PROVIDER_INVOCATION_RESULT_ERROR_INVALID",
  IDEMPOTENCY_INVALID: "PROVIDER_INVOCATION_RESULT_IDEMPOTENCY_INVALID",
  VERSION_INVALID: "PROVIDER_INVOCATION_RESULT_VERSION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createProviderInvocationResult(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        PROVIDER_INVOCATION_RESULT_ERROR.INVALID,
        "ProviderInvocationResult input must be a plain object"
      )
    );
  }

  const requestId = requireNonEmptyString(
    input.requestId,
    "requestId",
    PROVIDER_INVOCATION_RESULT_ERROR.ID_INVALID,
    "requestId"
  );
  if (!requestId.ok) return requestId;

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? PROVIDER_INVOCATION_RESULT_VERSION,
    "contractVersion",
    PROVIDER_INVOCATION_RESULT_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const resultStatus = requireEnumMember(
    input.resultStatus ?? input.status,
    INVOCATION_RESULT_STATUS_VALUES,
    "resultStatus",
    PROVIDER_INVOCATION_RESULT_ERROR.STATUS_INVALID,
    "resultStatus"
  );
  if (!resultStatus.ok) return resultStatus;

  const adapterId = requireNonEmptyString(
    input.adapterId,
    "adapterId",
    PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
    "adapterId"
  );
  if (!adapterId.ok) return adapterId;

  const providerKey = requireNonEmptyString(
    input.providerKey,
    "providerKey",
    PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
    "providerKey"
  );
  if (!providerKey.ok) return providerKey;

  const completedAt = requireIsoInstant(
    input.completedAt ?? new Date().toISOString(),
    "completedAt",
    PROVIDER_INVOCATION_RESULT_ERROR.TIMESTAMP_INVALID
  );
  if (!completedAt.ok) return completedAt;

  let output = Object.freeze({});
  if ("output" in input && input.output !== undefined) {
    const normalized = normalizeOpaquePayload(
      input.output,
      "output",
      PROVIDER_INVOCATION_RESULT_ERROR.OUTPUT_INVALID
    );
    if (!normalized.ok) return normalized;
    output = normalized.value;
  }

  /** @type {object|undefined} */
  let integrationError;
  if ("integrationError" in input && input.integrationError !== undefined) {
    if (!isPlainObject(input.integrationError)) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_RESULT_ERROR.ERROR_INVALID,
          "integrationError must be a plain object",
          "integrationError"
        )
      );
    }
    try {
      integrationError = createIntegrationError(
        input.integrationError.code,
        input.integrationError.message,
        input.integrationError.context,
        {
          retryable:
            typeof input.integrationError.retryable === "boolean"
              ? input.integrationError.retryable
              : undefined,
        }
      );
    } catch (err) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_RESULT_ERROR.ERROR_INVALID,
          err instanceof Error ? err.message : "invalid integrationError",
          "integrationError"
        )
      );
    }
  }

  /** @type {object|undefined} */
  let retryClassification;
  if (integrationError) {
    retryClassification = classifyIntegrationRetry(integrationError);
  } else if (
    "retryClassification" in input &&
    input.retryClassification !== undefined
  ) {
    if (!isPlainObject(input.retryClassification)) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_RESULT_ERROR.ERROR_INVALID,
          "retryClassification must be a plain object",
          "retryClassification"
        )
      );
    }
    retryClassification = classifyIntegrationRetry(input.retryClassification);
  }

  /** @type {string|undefined} */
  let idempotencyOutcome;
  if ("idempotencyOutcome" in input && input.idempotencyOutcome !== undefined) {
    const outcome = requireEnumMember(
      input.idempotencyOutcome,
      IDEMPOTENCY_OUTCOME_VALUES,
      "idempotencyOutcome",
      PROVIDER_INVOCATION_RESULT_ERROR.IDEMPOTENCY_INVALID,
      "idempotencyOutcome"
    );
    if (!outcome.ok) return outcome;
    idempotencyOutcome = outcome.value;
  }

  /** @type {object|undefined} */
  let diagnostics;
  if ("diagnostics" in input && input.diagnostics !== undefined) {
    const redacted = createRedactedDiagnostics(input.diagnostics);
    if (!redacted.ok) return redacted;
    diagnostics = redacted.value;
  }

  /** @type {string|undefined} */
  let providerReceiptRef;
  if ("providerReceiptRef" in input && input.providerReceiptRef !== undefined) {
    const receipt = requireNonEmptyString(
      input.providerReceiptRef,
      "providerReceiptRef",
      PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
      "providerReceiptRef"
    );
    if (!receipt.ok) return receipt;
    if (/(secret|password|token|credential)/i.test(receipt.value)) {
      return fail(
        contractError(
          PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
          "providerReceiptRef must not look credential-shaped",
          "providerReceiptRef"
        )
      );
    }
    providerReceiptRef = receipt.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
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
      PROVIDER_INVOCATION_RESULT_ERROR.REFERENCE_INVALID,
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
      PROVIDER_INVOCATION_RESULT_ERROR.IDEMPOTENCY_INVALID,
      "idempotencyKey"
    );
    if (!key.ok) return key;
    idempotencyKey = key.value;
  }

  return ok(
    deepFreeze({
      requestId: requestId.value,
      contractVersion: contractVersion.value,
      resultStatus: resultStatus.value,
      adapterId: adapterId.value,
      providerKey: providerKey.value,
      completedAt: completedAt.value,
      output,
      ...(integrationError ? { integrationError } : {}),
      ...(retryClassification ? { retryClassification } : {}),
      ...(idempotencyOutcome ? { idempotencyOutcome } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(diagnostics ? { diagnostics } : {}),
      ...(providerReceiptRef ? { providerReceiptRef } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(causationId ? { causationId } : {}),
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isProviderInvocationResult(value) {
  return createProviderInvocationResult(value).ok === true;
}
