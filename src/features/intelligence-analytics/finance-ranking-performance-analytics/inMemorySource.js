/**
 * In-memory Finance / Ranking / Performance Analytics source for
 * certification (I&A-09). No DB / localStorage / Supabase / Finance /
 * Ranking / Rating / Competition imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createFinanceRankingPerformanceAnalyticsSnapshot } from "./snapshot.js";
import {
  createFinanceRankingPerformanceAnalyticsSourceRequest,
  wrapFinanceRankingPerformanceSourceFailure,
} from "./sourceAdapter.js";
import { guardFinanceRankingPerformanceAnalyticsSnapshot } from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryFinanceRankingPerformanceAnalyticsSource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
        "createInMemoryFinanceRankingPerformanceAnalyticsSource input must be a plain object",
        "input"
      )
    );
  }

  const snapshotResult = createFinanceRankingPerformanceAnalyticsSnapshot(
    input.snapshot || input
  );
  if (!snapshotResult.ok) return snapshotResult;

  const frozenSnapshot = deepFreeze(clonePlain(snapshotResult.value));
  const failMode = input.failMode;

  /**
   * @param {unknown} requestInput
   */
  function load(requestInput) {
    try {
      if (failMode === "throw") {
        throw new Error(
          "finance/ranking/performance analytics certification source throw"
        );
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Finance/Ranking/Performance analytics certification source unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
            "Finance/Ranking/Performance analytics certification source failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult =
        createFinanceRankingPerformanceAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const guard = guardFinanceRankingPerformanceAnalyticsSnapshot(
        request.context,
        frozenSnapshot
      );
      if (!guard.ok) return guard;

      return ok(
        deepFreeze({
          snapshot: clonePlain(frozenSnapshot),
        })
      );
    } catch (error) {
      return wrapFinanceRankingPerformanceSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      load,
      kind: "in-memory-finance-ranking-performance-analytics",
      snapshotContext: frozenSnapshot.context,
    })
  );
}
