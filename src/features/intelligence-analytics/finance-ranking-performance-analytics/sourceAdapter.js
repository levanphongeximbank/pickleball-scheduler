/**
 * Finance / Ranking / Performance analytics source adapter contracts
 * (I&A-09). Read-only — adapter.load(request) returns an analytical
 * snapshot. No Finance / Ranking / Rating / Competition / Player / DB /
 * Supabase imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createFinanceRankingPerformanceAnalyticsContext } from "./context.js";
import { createFinanceRankingPerformanceAnalyticsSnapshot } from "./snapshot.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "FinanceRankingPerformanceAnalyticsSourceRequest must be a plain object",
        "request"
      )
    );
  }

  const contextResult = createFinanceRankingPerformanceAnalyticsContext(
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
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
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
export function createFinanceRankingPerformanceAnalyticsSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
        "FinanceRankingPerformanceAnalyticsSourceResponse must be a plain object",
        "response"
      )
    );
  }
  const snapshotResult = createFinanceRankingPerformanceAnalyticsSnapshot(
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
export function wrapFinanceRankingPerformanceSourceFailure(error) {
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
        : "Finance/Ranking/Performance analytics source failure";

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
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
export function isFinanceRankingPerformanceAnalyticsSourceAdapter(adapter) {
  return isPlainObject(adapter) && typeof adapter.load === "function";
}
