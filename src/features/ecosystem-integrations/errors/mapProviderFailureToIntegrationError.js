/**
 * Map provider-neutral failure classes onto ECO-01 integration error taxonomy.
 * No competing taxonomy. No retry scheduler.
 */

import { INTEGRATION_ERROR_CODE } from "../constants/catalogues.js";
import {
  classifyIntegrationRetry,
  createIntegrationError,
} from "./errorTaxonomy.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

const FAILURE_CLASS_TO_CODE = Object.freeze({
  authentication: INTEGRATION_ERROR_CODE.AUTHENTICATION,
  authorization: INTEGRATION_ERROR_CODE.AUTHORIZATION,
  validation: INTEGRATION_ERROR_CODE.VALIDATION,
  configuration: INTEGRATION_ERROR_CODE.CONFIGURATION,
  unsupported: INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY,
  unsupported_capability: INTEGRATION_ERROR_CODE.UNSUPPORTED_CAPABILITY,
  rate_limited: INTEGRATION_ERROR_CODE.RATE_LIMITED,
  transient: INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER,
  transient_provider: INTEGRATION_ERROR_CODE.TRANSIENT_PROVIDER,
  timeout: INTEGRATION_ERROR_CODE.TIMEOUT,
  network: INTEGRATION_ERROR_CODE.NETWORK,
  conflict: INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
  duplicate: INTEGRATION_ERROR_CODE.CONFLICT_DUPLICATE,
  permanent_rejection: INTEGRATION_ERROR_CODE.PERMANENT_PROVIDER_REJECTION,
  permanent: INTEGRATION_ERROR_CODE.PERMANENT_PROVIDER_REJECTION,
  malformed: INTEGRATION_ERROR_CODE.MALFORMED_PROVIDER_RESPONSE,
  internal: INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE,
});

/**
 * @param {*} failure
 * @returns {{
 *   integrationError: object,
 *   retryClassification: { code: string, retryable: boolean, reason: string },
 * }}
 */
export function mapProviderFailureToIntegrationError(failure) {
  if (typeof failure === "string") {
    const code =
      FAILURE_CLASS_TO_CODE[failure.trim().toLowerCase()] ??
      INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE;
    const integrationError = createIntegrationError(
      code,
      `Provider failure class: ${failure.trim()}`,
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
      "Unknown provider failure shape",
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
        : `Integration failure: ${failure.code}`,
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

  const failureClass =
    typeof failure.failureClass === "string"
      ? failure.failureClass.trim().toLowerCase()
      : typeof failure.class === "string"
        ? failure.class.trim().toLowerCase()
        : "internal";

  const code =
    FAILURE_CLASS_TO_CODE[failureClass] ??
    INTEGRATION_ERROR_CODE.INTERNAL_INTEGRATION_FAILURE;

  const integrationError = createIntegrationError(
    code,
    typeof failure.message === "string" && failure.message.trim()
      ? failure.message
      : `Provider failure: ${failureClass}`,
    isPlainObject(failure.context)
      ? failure.context
      : { failureClass }
  );

  return deepFreeze({
    integrationError,
    retryClassification: classifyIntegrationRetry(integrationError),
  });
}
