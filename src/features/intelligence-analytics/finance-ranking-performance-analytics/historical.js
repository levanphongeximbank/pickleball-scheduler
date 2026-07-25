/**
 * Historical observation composition for Finance / Ranking / Performance
 * Analytics (I&A-09). Reuses I&A-05 observation contracts — does not
 * duplicate the historical engine.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsHistoricalObservation } from "../historical-trend/series.js";
import { deepFreeze, isPlainObject, isValidIsoTimestamp } from "../contracts/shared.js";
import { FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS } from "./metrics.js";

/**
 * Build I&A-05-compatible historical observations from a Finance / Ranking
 * / Performance summary projection. Dimensions carry currencyCode /
 * rankingSystemId / rankingSystemVersion / playerId / teamId /
 * competitionId only when present on the summary — never inferred.
 * @param {unknown} summary
 * @param {{ observedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeFinanceRankingPerformanceHistoricalObservations(
  summary,
  options = {}
) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_QUERY_INVALID,
        "composeFinanceRankingPerformanceHistoricalObservations requires a summary",
        "summary"
      )
    );
  }

  const observedAt =
    options.observedAt || summary.sourceTimestamp || summary.generatedAt;

  if (!isValidIsoTimestamp(observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TIMESTAMP_INVALID,
        "observedAt / sourceTimestamp / generatedAt must be a valid ISO timestamp",
        "observedAt"
      )
    );
  }

  const tenantScope = {
    kind: "tenant",
    tenantId: summary.tenantId,
  };

  const provenance = summary.provenance || {
    source: {
      sourceId: "finance-ranking-performance-analytics-explicit",
      sourceKind: "explicit_input",
      ownerModule: "intelligence-analytics",
      reference: "ia-09-historical",
    },
  };

  /** @type {Record<string, string>} */
  const dimensions = {};
  if (summary.currencyCode) dimensions.currencyCode = String(summary.currencyCode);
  if (summary.rankingSystemId) dimensions.rankingSystemId = String(summary.rankingSystemId);
  if (summary.rankingSystemVersion) {
    dimensions.rankingSystemVersion = String(summary.rankingSystemVersion);
  }
  if (summary.ratingSystemId) dimensions.ratingSystemId = String(summary.ratingSystemId);
  if (summary.ratingSystemVersion) {
    dimensions.ratingSystemVersion = String(summary.ratingSystemVersion);
  }
  if (summary.playerId) dimensions.playerId = String(summary.playerId);
  if (summary.teamId) dimensions.teamId = String(summary.teamId);
  if (summary.competitionId) dimensions.competitionId = String(summary.competitionId);

  const ids = FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS;
  const pairs = [
    [ids.FINANCE_TRANSACTIONS_COUNT, summary.transactionsCount],
    [ids.FINANCE_PAYMENTS_SETTLED_COUNT, summary.paymentsSettledCount],
    [ids.FINANCE_RECEIVABLES_OUTSTANDING_COUNT, summary.receivablesOutstandingCount],
    [ids.FINANCE_RECEIVABLES_OVERDUE_COUNT, summary.receivablesOverdueCount],
    [ids.FINANCE_COLLECTIONS_RATE, summary.collectionsRate],
    [ids.RANKING_SNAPSHOTS_COUNT, summary.rankingSnapshotsCount],
    [ids.RANKING_ENTITIES_RANKED_COUNT, summary.rankedEntityCount],
    [ids.RATING_SNAPSHOTS_COUNT, summary.ratingSnapshotsCount],
    [ids.RATING_ENTITIES_RATED_COUNT, summary.ratedEntityCount],
    [ids.RATING_CHANGES_AVERAGE, summary.ratingChangesAverage],
    [ids.PERFORMANCE_PARTICIPATIONS_COUNT, summary.participationCount],
    [ids.PERFORMANCE_MATCHES_PLAYED_COUNT, summary.matchesPlayedCount],
    [ids.PERFORMANCE_WIN_RATE, summary.winRate],
    [ids.PERFORMANCE_COMPLETION_RATE, summary.completionRate],
    [ids.PERFORMANCE_VALIDATED_RESULTS_COUNT, summary.validatedResultsCount],
  ];

  /** @type {unknown[]} */
  const observations = [];
  for (const [metricId, value] of pairs) {
    const missing = value === null || value === undefined;
    const created = createAnalyticsHistoricalObservation({
      metricId,
      metricVersion: "1.0.0",
      tenantScope,
      observedAt,
      dimensions,
      value: missing ? null : value,
      missing,
      provenance,
      freshness: summary.freshness || ANALYTICS_FRESHNESS_STATE.FRESH,
    });
    if (!created.ok) return created;
    observations.push(created.value);
  }

  return ok(
    deepFreeze({
      observations: Object.freeze(observations),
      analyticalMethodVersion:
        FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION.HISTORICAL,
      deterministic: true,
    })
  );
}
