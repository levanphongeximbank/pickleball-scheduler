/**
 * Finance / Ranking / Performance analytics query descriptor (I&A-09).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import { createFinanceRankingPerformanceAnalyticsContext } from "./context.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeMovementCompare(input) {
  if (input === undefined) return ok(undefined);
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "movementCompare must be a plain object",
        "query.movementCompare"
      )
    );
  }
  if (
    !isNonEmptyString(input.baselineSnapshotId) ||
    !isNonEmptyString(input.comparisonSnapshotId)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "movementCompare requires baselineSnapshotId and comparisonSnapshotId",
        "query.movementCompare"
      )
    );
  }
  return ok(
    deepFreeze({
      baselineSnapshotId: String(input.baselineSnapshotId).trim(),
      comparisonSnapshotId: String(input.comparisonSnapshotId).trim(),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "FinanceRankingPerformanceAnalyticsQuery must be a plain object",
        "query"
      )
    );
  }

  const contextResult = createFinanceRankingPerformanceAnalyticsContext(
    input.context || { tenantScope: input.tenantScope }
  );
  if (!contextResult.ok) return contextResult;

  /** @type {Record<string, unknown>} */
  const query = {
    context: contextResult.value,
    includeDashboardPayloads: input.includeDashboardPayloads === true,
    includeHistoricalObservations: input.includeHistoricalObservations === true,
  };

  if (input.timeWindow !== undefined) {
    const timeWindowResult = createAnalyticsTimeWindow(input.timeWindow);
    if (!timeWindowResult.ok) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
          timeWindowResult.error.message,
          "query.timeWindow",
          timeWindowResult.error.details
        )
      );
    }
    query.timeWindow = timeWindowResult.value;
  }

  const movementCompareResult = normalizeMovementCompare(input.movementCompare);
  if (!movementCompareResult.ok) return movementCompareResult;
  if (movementCompareResult.value !== undefined) {
    query.movementCompare = movementCompareResult.value;
  }

  return ok(deepFreeze(query));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function normalizeFinanceRankingPerformanceAnalyticsQuery(input) {
  return createFinanceRankingPerformanceAnalyticsQuery(input);
}
