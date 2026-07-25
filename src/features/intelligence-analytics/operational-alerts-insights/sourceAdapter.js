/**
 * Operational signals source adapter contracts (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createAlertEvaluationContext } from "./context.js";
import { createOperationalSignalsSnapshot } from "./snapshot.js";
import { sanitizeErrorMessage } from "./privacy.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalSignalSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
        "OperationalSignalSourceRequest must be a plain object",
        "request"
      )
    );
  }

  const contextResult = createAlertEvaluationContext(
    input.context || { tenantScope: input.tenantScope }
  );
  if (!contextResult.ok) return contextResult;

  /** @type {Record<string, unknown>} */
  const request = {
    context: contextResult.value,
  };

  if (input.executionId !== undefined) {
    if (!isNonEmptyString(input.executionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_QUERY_INVALID,
          "executionId must be a non-empty string when provided",
          "executionId"
        )
      );
    }
    request.executionId = String(input.executionId).trim();
  }

  return ok(deepFreeze(request));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createOperationalSignalSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
        "OperationalSignalSourceResponse must be a plain object",
        "response"
      )
    );
  }
  const snapshotResult = createOperationalSignalsSnapshot(input.snapshot || input);
  if (!snapshotResult.ok) return snapshotResult;
  return ok(deepFreeze({ snapshot: snapshotResult.value }));
}

/**
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapOperationalAlertsSourceFailure(error) {
  if (
    error &&
    typeof error === "object" &&
    error.ok === false &&
    error.error &&
    typeof error.error.code === "string"
  ) {
    return /** @type {import("../contracts/result.js").Result} */ (error);
  }

  const message =
    error instanceof Error
      ? sanitizeErrorMessage(error.message)
      : error && typeof error === "object" && typeof error.message === "string"
        ? sanitizeErrorMessage(error.message)
        : "Operational alerts insights source failure";

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
      message,
      "sourceAdapter",
      error && typeof error === "object" && error.code
        ? { wrappedCode: String(error.code) }
        : undefined
    )
  );
}

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function isOperationalSignalSourceAdapter(adapter) {
  return isPlainObject(adapter) && typeof adapter.load === "function";
}
