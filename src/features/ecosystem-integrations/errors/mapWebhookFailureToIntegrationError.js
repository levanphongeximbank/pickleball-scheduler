/**
 * Map webhook ingress / verification failures onto ECO error taxonomy.
 * Includes retry classification metadata — no retry worker.
 */

import {
  INTEGRATION_ERROR_CODE,
  WEBHOOK_INGRESS_OUTCOME,
  WEBHOOK_VERIFICATION_OUTCOME,
} from "../constants/catalogues.js";
import {
  classifyIntegrationRetry,
  createIntegrationError,
} from "./errorTaxonomy.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

const VERIFICATION_OUTCOME_TO_CODE = Object.freeze({
  [WEBHOOK_VERIFICATION_OUTCOME.MISSING]: INTEGRATION_ERROR_CODE.AUTHENTICATION,
  [WEBHOOK_VERIFICATION_OUTCOME.MALFORMED]: INTEGRATION_ERROR_CODE.VALIDATION,
  [WEBHOOK_VERIFICATION_OUTCOME.INVALID]: INTEGRATION_ERROR_CODE.AUTHENTICATION,
  [WEBHOOK_VERIFICATION_OUTCOME.EXPIRED]: INTEGRATION_ERROR_CODE.VALIDATION,
  [WEBHOOK_VERIFICATION_OUTCOME.REPLAY_SUSPECTED]:
    INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
});

const INGRESS_OUTCOME_TO_CODE = Object.freeze({
  [WEBHOOK_INGRESS_OUTCOME.REJECTED_VERIFICATION]:
    INTEGRATION_ERROR_CODE.AUTHENTICATION,
  [WEBHOOK_INGRESS_OUTCOME.REJECTED_ROUTING]:
    INTEGRATION_ERROR_CODE.CONFIGURATION,
  [WEBHOOK_INGRESS_OUTCOME.REJECTED_IDEMPOTENCY]:
    INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
  [WEBHOOK_INGRESS_OUTCOME.CONFLICT]: INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
  [WEBHOOK_INGRESS_OUTCOME.FAILED]:
    INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE,
  [WEBHOOK_INGRESS_OUTCOME.PRODUCTION_BLOCKED]:
    INTEGRATION_ERROR_CODE.CONFIGURATION,
});

/**
 * @param {*} failure
 * @returns {{
 *   integrationError: object,
 *   retryClassification: { code: string, retryable: boolean, reason: string },
 * }}
 */
export function mapWebhookFailureToIntegrationError(failure) {
  if (typeof failure === "string") {
    const normalized = failure.trim().toUpperCase();
    const code =
      VERIFICATION_OUTCOME_TO_CODE[normalized] ??
      INGRESS_OUTCOME_TO_CODE[normalized] ??
      INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE;
    const integrationError = createIntegrationError(
      code,
      `Webhook failure: ${failure.trim()}`,
      { failureClass: failure.trim() }
    );
    return deepFreeze({
      integrationError,
      retryClassification: classifyIntegrationRetry(integrationError),
    });
  }

  if (!isPlainObject(failure)) {
    const integrationError = createIntegrationError(
      INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE,
      "Unknown webhook failure shape",
      { failureShape: typeof failure }
    );
    return deepFreeze({
      integrationError,
      retryClassification: classifyIntegrationRetry(integrationError),
    });
  }

  if (
    typeof failure.code === "string" &&
    Object.values(INTEGRATION_ERROR_CODE).includes(failure.code)
  ) {
    const integrationError = createIntegrationError(
      failure.code,
      typeof failure.message === "string" && failure.message.trim()
        ? failure.message
        : `Webhook failure: ${failure.code}`,
      isPlainObject(failure.context) ? failure.context : undefined,
      {
        retryable:
          typeof failure.retryable === "boolean" ? failure.retryable : undefined,
      }
    );
    return deepFreeze({
      integrationError,
      retryClassification: classifyIntegrationRetry(integrationError),
    });
  }

  if (
    typeof failure.verificationOutcome === "string" &&
    VERIFICATION_OUTCOME_TO_CODE[failure.verificationOutcome]
  ) {
    const code = VERIFICATION_OUTCOME_TO_CODE[failure.verificationOutcome];
    const integrationError = createIntegrationError(
      code,
      typeof failure.message === "string" && failure.message.trim()
        ? failure.message
        : `Webhook verification ${failure.verificationOutcome}`,
      {
        verificationOutcome: failure.verificationOutcome,
        ...(typeof failure.reason === "string" ? { reason: failure.reason } : {}),
      }
    );
    return deepFreeze({
      integrationError,
      retryClassification: classifyIntegrationRetry(integrationError),
    });
  }

  if (
    typeof failure.outcome === "string" &&
    INGRESS_OUTCOME_TO_CODE[failure.outcome]
  ) {
    const code = INGRESS_OUTCOME_TO_CODE[failure.outcome];
    const integrationError = createIntegrationError(
      code,
      typeof failure.message === "string" && failure.message.trim()
        ? failure.message
        : `Webhook ingress ${failure.outcome}`,
      {
        outcome: failure.outcome,
        ...(typeof failure.reason === "string" ? { reason: failure.reason } : {}),
      }
    );
    return deepFreeze({
      integrationError,
      retryClassification: classifyIntegrationRetry(integrationError),
    });
  }

  const failureClass =
    typeof failure.failureClass === "string"
      ? failure.failureClass.trim().toLowerCase()
      : "internal";

  const classMap = Object.freeze({
    authentication: INTEGRATION_ERROR_CODE.AUTHENTICATION,
    validation: INTEGRATION_ERROR_CODE.VALIDATION,
    configuration: INTEGRATION_ERROR_CODE.CONFIGURATION,
    conflict: INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
    duplicate: INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
    transient: INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER,
    timeout: INTEGRATION_ERROR_CODE.TIMEOUT,
    network: INTEGRATION_ERROR_CODE.NETWORK,
    malformed: INTEGRATION_ERROR_CODE.MALFORMED_PROVIDER_RESPONSE,
    internal: INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE,
  });

  const code =
    classMap[failureClass] ?? INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE;

  const integrationError = createIntegrationError(
    code,
    typeof failure.message === "string" && failure.message.trim()
      ? failure.message
      : `Webhook failure: ${failureClass}`,
    isPlainObject(failure.context)
      ? failure.context
      : { failureClass }
  );

  return deepFreeze({
    integrationError,
    retryClassification: classifyIntegrationRetry(integrationError),
  });
}
