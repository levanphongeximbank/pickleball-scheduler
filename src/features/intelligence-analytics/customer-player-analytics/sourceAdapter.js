/**
 * Customer / Player analytics source adapter contracts (I&A-08).
 * Read-only — adapter.load(request) returns an analytical snapshot.
 * No Customer / Player / CRM / Competition / DB / Supabase imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createCustomerPlayerAnalyticsContext } from "./context.js";
import { createCustomerPlayerAnalyticsSnapshot } from "./snapshot.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
        "CustomerPlayerAnalyticsSourceRequest must be a plain object",
        "request"
      )
    );
  }

  const contextResult = createCustomerPlayerAnalyticsContext(
    input.context || {
      tenantScope: input.tenantScope,
      customerId: input.customerId,
      playerId: input.playerId,
    }
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
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
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
export function createCustomerPlayerAnalyticsSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE,
        "CustomerPlayerAnalyticsSourceResponse must be a plain object",
        "response"
      )
    );
  }
  const snapshotResult = createCustomerPlayerAnalyticsSnapshot(
    input.snapshot || input
  );
  if (!snapshotResult.ok) return snapshotResult;
  return ok(
    deepFreeze({
      snapshot: snapshotResult.value,
    })
  );
}

/**
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapCustomerPlayerSourceFailure(error) {
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
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Customer/Player analytics source failure";

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE,
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
export function isCustomerPlayerAnalyticsSourceAdapter(adapter) {
  return isPlainObject(adapter) && typeof adapter.load === "function";
}
