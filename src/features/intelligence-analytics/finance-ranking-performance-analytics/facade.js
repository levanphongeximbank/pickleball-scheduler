/**
 * Read-only Finance / Ranking / Performance Analytics facade / runtime
 * (I&A-09). Composes source adapter + guards + projections + optional
 * dashboard/historical. No global singleton. No write/persist surface. No
 * Finance / Ranking / Rating / Competition / Player imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createFinanceRankingPerformanceAnalyticsQuery } from "./query.js";
import {
  createFinanceRankingPerformanceAnalyticsSourceRequest,
  isFinanceRankingPerformanceAnalyticsSourceAdapter,
  wrapFinanceRankingPerformanceSourceFailure,
} from "./sourceAdapter.js";
import { guardFinanceRankingPerformanceAnalyticsSnapshot } from "./guards.js";
import { projectFinanceRankingPerformanceSummary } from "./projections.js";
import { composeFinanceRankingPerformanceHistoricalObservations } from "./historical.js";
import { composeFinanceRankingPerformanceDashboardPayloads } from "./dashboardPayloads.js";
import {
  createFinanceRankingPerformanceAnalyticsMetricCatalogEntries,
  createFinanceRankingPerformanceAnalyticsMetricDefinitions,
} from "./metrics.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyFinanceRankingPerformanceAnalyticsFacade does not expose write/command operations";

const RETAINED_SOURCE_ERROR_CODES = new Set([
  ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
  ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TENANT_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CURRENCY_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_SYSTEM_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RANKING_VERSION_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RATING_SYSTEM_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_RATING_VERSION_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_PLAYER_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TEAM_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_COMPETITION_MISMATCH,
  ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_ISOLATION_VIOLATION,
]);

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsFacade(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "createFinanceRankingPerformanceAnalyticsFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const sourceAdapter = deps.sourceAdapter;
  if (!isFinanceRankingPerformanceAnalyticsSourceAdapter(sourceAdapter)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "createFinanceRankingPerformanceAnalyticsFacade requires sourceAdapter.load",
        "deps.sourceAdapter"
      )
    );
  }

  const nowIso =
    typeof deps.nowIso === "function"
      ? deps.nowIso
      : () => new Date().toISOString();

  let executionCounter = 0;

  /**
   * Validate-only — never calls the source adapter.
   * @param {unknown} queryInput
   */
  function validate(queryInput) {
    return createFinanceRankingPerformanceAnalyticsQuery(queryInput);
  }

  /**
   * @param {unknown} queryInput
   * @param {unknown} [options]
   */
  function analyze(queryInput, options = {}) {
    const optionsObj = isPlainObject(options) ? options : {};
    const inputSnapshot = isPlainObject(queryInput)
      ? JSON.stringify(queryInput)
      : null;

    const normalized = createFinanceRankingPerformanceAnalyticsQuery(queryInput);
    if (!normalized.ok) return normalized;

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
          "Finance/Ranking/Performance analytics query input must not be mutated",
          "query"
        )
      );
    }

    const query = normalized.value;
    executionCounter += 1;
    const tenantId = query.context.tenantScope.tenantId;
    const executionId =
      typeof optionsObj.executionId === "string" && optionsObj.executionId.trim()
        ? String(optionsObj.executionId).trim()
        : `ia09-${executionCounter}-${tenantId}`;

    const sourceRequestResult = createFinanceRankingPerformanceAnalyticsSourceRequest({
      context: query.context,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.load(sourceRequestResult.value);
    } catch (error) {
      return wrapFinanceRankingPerformanceSourceFailure(error);
    }

    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_SOURCE_FAILURE,
          "Async Finance/Ranking/Performance analytics source adapters are deferred",
          "sourceAdapter"
        )
      );
    }

    if (!sourceResponse || sourceResponse.ok !== true) {
      if (sourceResponse && sourceResponse.ok === false) {
        const code = sourceResponse.error?.code;
        if (RETAINED_SOURCE_ERROR_CODES.has(code)) {
          return sourceResponse;
        }
        return wrapFinanceRankingPerformanceSourceFailure(sourceResponse.error);
      }
      return wrapFinanceRankingPerformanceSourceFailure(sourceResponse);
    }

    const snapshot = sourceResponse.value.snapshot;
    const guard = guardFinanceRankingPerformanceAnalyticsSnapshot(query.context, snapshot);
    if (!guard.ok) return guard;

    const generatedAt = nowIso();
    const summaryResult = projectFinanceRankingPerformanceSummary(snapshot, {
      timeWindow: query.timeWindow,
      generatedAt,
      movementCompare: query.movementCompare,
      requireSingleCurrency: optionsObj.requireSingleCurrency,
    });
    if (!summaryResult.ok) return summaryResult;

    /** @type {Record<string, unknown>} */
    const result = {
      query,
      summary: summaryResult.value,
      snapshotMeta: deepFreeze({
        sourceTimestamp: snapshot.sourceTimestamp,
        freshness: snapshot.freshness,
        completeness: snapshot.completeness,
        provenance: snapshot.provenance,
        canonicalSourceRef: snapshot.canonicalSourceRef,
      }),
      generatedAt,
      executionId,
      stale: snapshot.freshness === ANALYTICS_FRESHNESS_STATE.STALE,
      isCanonicalFinanceState: false,
      isCanonicalRankingState: false,
      isCanonicalRatingState: false,
      isCanonicalPerformanceState: false,
      isCanonicalModuleState: false,
    };

    if (query.includeHistoricalObservations) {
      const historical = composeFinanceRankingPerformanceHistoricalObservations(
        summaryResult.value,
        { observedAt: snapshot.sourceTimestamp || generatedAt }
      );
      if (!historical.ok) return historical;
      result.historicalObservations = historical.value;
    }

    if (query.includeDashboardPayloads) {
      const dashboard = composeFinanceRankingPerformanceDashboardPayloads(
        summaryResult.value,
        {
          historicalSeries: optionsObj.historicalSeries,
          effectiveWindow: optionsObj.effectiveWindow,
        }
      );
      if (!dashboard.ok) return dashboard;
      result.dashboardPayloads = dashboard.value;
    }

    return ok(deepFreeze(clonePlain(result)));
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    analyze,
    validate,
    projectSummary: projectFinanceRankingPerformanceSummary,
    composeHistoricalObservations: composeFinanceRankingPerformanceHistoricalObservations,
    composeDashboardPayloads: composeFinanceRankingPerformanceDashboardPayloads,
    createMetricDefinitions: createFinanceRankingPerformanceAnalyticsMetricDefinitions,
    createMetricCatalogEntries: createFinanceRankingPerformanceAnalyticsMetricCatalogEntries,
  };

  const rejectedWriteOps = [
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "persist",
    "register",
  ];
  for (let i = 0; i < rejectedWriteOps.length; i += 1) {
    const rejectedOp = rejectedWriteOps[i];
    Object.defineProperty(facade, rejectedOp, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              rejectedOp
            )
          );
      },
    });
  }

  return ok(Object.freeze(facade));
}

/**
 * Alias emphasizing the read-only facade contract.
 * @param {unknown} deps
 */
export function createReadOnlyFinanceRankingPerformanceAnalyticsFacade(deps) {
  return createFinanceRankingPerformanceAnalyticsFacade(deps);
}
