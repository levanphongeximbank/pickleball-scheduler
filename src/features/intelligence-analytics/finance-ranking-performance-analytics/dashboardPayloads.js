/**
 * Presentation-neutral Finance / Ranking / Performance dashboard/report
 * payloads (I&A-09). Reuses I&A-04 payload contracts — no React / route /
 * UI wiring.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE, ANALYTICS_GRANULARITY } from "../contracts/enums.js";
import {
  createAnalyticsBreakdownPayload,
  createAnalyticsDataState,
  createAnalyticsKpiPayload,
  createAnalyticsTimeSeriesPayload,
} from "../dashboard-reporting/payloads.js";
import { ANALYTICS_DATA_STATE } from "../dashboard-reporting/enums.js";
import { deepFreeze, isPlainObject, isValidIsoTimestamp } from "../contracts/shared.js";
import { FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS } from "./metrics.js";

const DEFAULT_WINDOW = Object.freeze({
  startAt: "1970-01-01T00:00:00.000Z",
  endAt: "9999-12-31T23:59:59.999Z",
  inclusive: true,
  timezone: "UTC",
});

/**
 * @param {unknown} summary
 * @returns {import("../contracts/result.js").Result}
 */
function buildDataState(summary) {
  let state = ANALYTICS_DATA_STATE.READY;
  if (summary.incompleteSnapshot) {
    state = ANALYTICS_DATA_STATE.PARTIAL;
  } else if (summary.freshness === ANALYTICS_FRESHNESS_STATE.STALE) {
    state = ANALYTICS_DATA_STATE.STALE;
  } else if (
    summary.transactionsCount === 0 &&
    summary.rankingSnapshotsCount === 0 &&
    summary.ratingSnapshotsCount === 0 &&
    summary.participationCount === 0
  ) {
    state = ANALYTICS_DATA_STATE.EMPTY;
  }

  /** @type {Record<string, unknown>} */
  const input = {
    state,
    warnings: summary.warnings || [],
  };
  if (summary.freshness) input.freshness = summary.freshness;
  if (summary.provenance) input.provenance = summary.provenance;

  return createAnalyticsDataState(input);
}

/**
 * @param {Record<string, number>} distribution
 * @returns {{ categories: string[], values: number[] }}
 */
function distributionToCategories(distribution) {
  const categories = Object.keys(distribution || {}).sort();
  const values = categories.map((key) => distribution[key]);
  return { categories, values };
}

/**
 * Compose Finance / Ranking / Performance dashboard/report payloads from a
 * summary projection.
 * @param {unknown} summary
 * @param {{
 *   historicalSeries?: unknown,
 *   effectiveWindow?: unknown,
 * }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeFinanceRankingPerformanceDashboardPayloads(
  summary,
  options = {}
) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "composeFinanceRankingPerformanceDashboardPayloads requires a summary",
        "summary"
      )
    );
  }

  const dataStateResult = buildDataState(summary);
  if (!dataStateResult.ok) return dataStateResult;
  const dataState = dataStateResult.value;

  const effectiveWindow = isPlainObject(options.effectiveWindow)
    ? options.effectiveWindow
    : isPlainObject(summary.requestedWindow)
      ? summary.requestedWindow
      : {
          ...DEFAULT_WINDOW,
          ...(isValidIsoTimestamp(summary.sourceTimestamp)
            ? {
                startAt: summary.sourceTimestamp,
                endAt: summary.generatedAt || summary.sourceTimestamp,
              }
            : {}),
        };

  const provenance = summary.provenance;
  if (!provenance) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "summary.provenance is required for dashboard payloads",
        "summary.provenance"
      )
    );
  }

  const ids = FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS;
  const kpiDefs = [
    ["finance_transactions", ids.FINANCE_TRANSACTIONS_COUNT, summary.transactionsCount, "count"],
    [
      "finance_payments_settled",
      ids.FINANCE_PAYMENTS_SETTLED_COUNT,
      summary.paymentsSettledCount,
      "count",
    ],
    [
      "finance_receivables_outstanding",
      ids.FINANCE_RECEIVABLES_OUTSTANDING_COUNT,
      summary.receivablesOutstandingCount,
      "count",
    ],
    [
      "finance_receivables_overdue",
      ids.FINANCE_RECEIVABLES_OVERDUE_COUNT,
      summary.receivablesOverdueCount,
      "count",
    ],
    ["finance_collections_rate", ids.FINANCE_COLLECTIONS_RATE, summary.collectionsRate, "ratio"],
    ["ranking_snapshots", ids.RANKING_SNAPSHOTS_COUNT, summary.rankingSnapshotsCount, "count"],
    [
      "ranking_entities_ranked",
      ids.RANKING_ENTITIES_RANKED_COUNT,
      summary.rankedEntityCount,
      "count",
    ],
    ["rating_snapshots", ids.RATING_SNAPSHOTS_COUNT, summary.ratingSnapshotsCount, "count"],
    ["rating_entities_rated", ids.RATING_ENTITIES_RATED_COUNT, summary.ratedEntityCount, "count"],
    [
      "performance_participations",
      ids.PERFORMANCE_PARTICIPATIONS_COUNT,
      summary.participationCount,
      "count",
    ],
    [
      "performance_matches_played",
      ids.PERFORMANCE_MATCHES_PLAYED_COUNT,
      summary.matchesPlayedCount,
      "count",
    ],
    ["performance_win_rate", ids.PERFORMANCE_WIN_RATE, summary.winRate, "ratio"],
    ["performance_completion_rate", ids.PERFORMANCE_COMPLETION_RATE, summary.completionRate, "ratio"],
  ];

  /** @type {Record<string, unknown>} */
  const kpis = {};
  for (const [key, metricId, value, unit] of kpiDefs) {
    const created = createAnalyticsKpiPayload({
      metricId,
      metricVersion: "1.0.0",
      value: value === undefined ? null : value,
      unit,
      effectiveWindow,
      provenance,
      dataState,
      label: key,
    });
    if (!created.ok) return created;
    kpis[key] = created.value;
  }

  const transactionStatus = distributionToCategories(
    summary.transactionsStatusDistribution || {}
  );
  const transactionStatusBreakdown = createAnalyticsBreakdownPayload({
    metricId: ids.FINANCE_TRANSACTIONS_STATUS_DISTRIBUTION,
    metricVersion: "1.0.0",
    dimension: "transactionStatus",
    categories: transactionStatus.categories,
    values: transactionStatus.values,
    provenance,
    dataState,
  });
  if (!transactionStatusBreakdown.ok) return transactionStatusBreakdown;

  const outcomeDistribution = Object.freeze({
    win: summary.outcomesWinCount || 0,
    loss: summary.outcomesLossCount || 0,
    draw: summary.outcomesDrawCount || 0,
    other: summary.outcomesOtherCount || 0,
  });
  const outcomes = distributionToCategories(outcomeDistribution);
  const outcomesBreakdown = createAnalyticsBreakdownPayload({
    metricId: ids.PERFORMANCE_OUTCOMES_WIN_COUNT,
    metricVersion: "1.0.0",
    dimension: "performanceOutcome",
    categories: outcomes.categories,
    values: outcomes.values,
    provenance,
    dataState,
  });
  if (!outcomesBreakdown.ok) return outcomesBreakdown;

  const movement = isPlainObject(summary.movement) ? summary.movement : null;
  const movementDistribution = movement
    ? Object.freeze({
        up: movement.movementUpCount || 0,
        down: movement.movementDownCount || 0,
        unchanged: movement.movementUnchangedCount || 0,
      })
    : Object.freeze({});
  const rankingMovement = distributionToCategories(movementDistribution);
  const rankingMovementBreakdown = createAnalyticsBreakdownPayload({
    metricId: ids.RANKING_MOVEMENT_UP_COUNT,
    metricVersion: "1.0.0",
    dimension: "rankingMovement",
    categories: rankingMovement.categories,
    values: rankingMovement.values,
    provenance,
    dataState,
  });
  if (!rankingMovementBreakdown.ok) return rankingMovementBreakdown;

  /** @type {unknown | undefined} */
  let timeSeries;
  if (options.historicalSeries && isPlainObject(options.historicalSeries)) {
    const seriesResult = createAnalyticsTimeSeriesPayload({
      metricId: options.historicalSeries.metricId || ids.FINANCE_TRANSACTIONS_COUNT,
      metricVersion: options.historicalSeries.metricVersion || "1.0.0",
      seriesId: options.historicalSeries.seriesId || "finance-ranking-performance-trend",
      granularity:
        options.historicalSeries.granularity || ANALYTICS_GRANULARITY.DAY,
      effectiveWindow:
        options.historicalSeries.effectiveWindow || effectiveWindow,
      points: options.historicalSeries.points || [],
      dataState,
      provenance,
    });
    if (!seriesResult.ok) return seriesResult;
    timeSeries = seriesResult.value;
  }

  return ok(
    deepFreeze({
      kpis: Object.freeze(kpis),
      transactionStatusBreakdown: transactionStatusBreakdown.value,
      outcomesBreakdown: outcomesBreakdown.value,
      rankingMovementBreakdown: rankingMovementBreakdown.value,
      ...(timeSeries ? { financeRankingPerformanceTimeSeries: timeSeries } : {}),
      dataState,
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.DASHBOARD,
      isCanonicalModuleState: false,
    })
  );
}
