/**
 * Finance / Ranking / Performance Analytics metric catalog (I&A-09).
 * Registry-compatible definitions — no ledger posting, revenue calculation,
 * ranking/rating/standings recalculation, or winner inference.
 */

import { ok } from "../contracts/result.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_GRANULARITY,
  ANALYTICS_METRIC_KIND,
  ANALYTICS_METRIC_UNIT,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "../contracts/enums.js";
import { ANALYTICS_TENANT_SCOPE_KIND } from "../contracts/tenantScope.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";
import { deepFreeze } from "../contracts/shared.js";
import { ANALYTICS_METRIC_LIFECYCLE_STATE } from "../registry/lifecycle.js";

export const FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_SOURCE = Object.freeze({
  sourceId: "finance-ranking-performance-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-09-finance-ranking-performance-analytics",
});

/**
 * Stable metric ID catalog for Finance, Ranking and Performance Analytics.
 */
export const FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS = Object.freeze({
  FINANCE_TRANSACTIONS_COUNT: "finance.transactions.count",
  FINANCE_TRANSACTIONS_STATUS_DISTRIBUTION: "finance.transactions.status_distribution",
  FINANCE_INVOICES_ISSUED_COUNT: "finance.invoices.issued_count",
  FINANCE_INVOICES_STATUS_DISTRIBUTION: "finance.invoices.status_distribution",
  FINANCE_PAYMENTS_COUNT: "finance.payments.count",
  FINANCE_PAYMENTS_SETTLED_COUNT: "finance.payments.settled_count",
  FINANCE_PAYMENTS_SETTLED_AMOUNT: "finance.payments.settled_amount",
  FINANCE_REFUNDS_COUNT: "finance.refunds.count",
  FINANCE_REFUNDS_SETTLED_AMOUNT: "finance.refunds.settled_amount",
  FINANCE_SETTLEMENTS_COUNT: "finance.settlements.count",
  FINANCE_RECEIVABLES_OUTSTANDING_COUNT: "finance.receivables.outstanding_count",
  FINANCE_RECEIVABLES_OUTSTANDING_AMOUNT: "finance.receivables.outstanding_amount",
  FINANCE_RECEIVABLES_OVERDUE_COUNT: "finance.receivables.overdue_count",
  FINANCE_RECEIVABLES_OVERDUE_AMOUNT: "finance.receivables.overdue_amount",
  FINANCE_COLLECTIONS_RATE: "finance.collections.rate",
  FINANCE_REVENUE_RECOGNIZED_AMOUNT: "finance.revenue.recognized_amount",
  FINANCE_EXPENSES_RECOGNIZED_AMOUNT: "finance.expenses.recognized_amount",
  RANKING_SNAPSHOTS_COUNT: "ranking.snapshots.count",
  RANKING_ENTITIES_RANKED_COUNT: "ranking.entities.ranked_count",
  RANKING_POSITIONS_DISTRIBUTION: "ranking.positions.distribution",
  RANKING_MOVEMENT_UP_COUNT: "ranking.movement.up_count",
  RANKING_MOVEMENT_DOWN_COUNT: "ranking.movement.down_count",
  RANKING_MOVEMENT_UNCHANGED_COUNT: "ranking.movement.unchanged_count",
  RANKING_MOVEMENT_AVERAGE_ABSOLUTE_CHANGE: "ranking.movement.average_absolute_change",
  RATING_SNAPSHOTS_COUNT: "rating.snapshots.count",
  RATING_ENTITIES_RATED_COUNT: "rating.entities.rated_count",
  RATING_CHANGES_COUNT: "rating.changes.count",
  RATING_CHANGES_AVERAGE: "rating.changes.average",
  RATING_CHANGES_POSITIVE_COUNT: "rating.changes.positive_count",
  RATING_CHANGES_NEGATIVE_COUNT: "rating.changes.negative_count",
  RATING_CHANGES_UNCHANGED_COUNT: "rating.changes.unchanged_count",
  PERFORMANCE_PARTICIPATIONS_COUNT: "performance.participations.count",
  PERFORMANCE_MATCHES_PLAYED_COUNT: "performance.matches.played_count",
  PERFORMANCE_MATCHES_COMPLETED_COUNT: "performance.matches.completed_count",
  PERFORMANCE_OUTCOMES_WIN_COUNT: "performance.outcomes.win_count",
  PERFORMANCE_OUTCOMES_LOSS_COUNT: "performance.outcomes.loss_count",
  PERFORMANCE_OUTCOMES_DRAW_COUNT: "performance.outcomes.draw_count",
  PERFORMANCE_OUTCOMES_OTHER_COUNT: "performance.outcomes.other_count",
  PERFORMANCE_WIN_RATE: "performance.win_rate",
  PERFORMANCE_COMPLETION_RATE: "performance.completion_rate",
  PERFORMANCE_VALIDATED_RESULTS_COUNT: "performance.validated_results.count",
});

const METRIC_VERSION = "1.0.0";

const MONETARY_METRIC_IDS = new Set([
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_PAYMENTS_SETTLED_AMOUNT,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_REFUNDS_SETTLED_AMOUNT,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OUTSTANDING_AMOUNT,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_RECEIVABLES_OVERDUE_AMOUNT,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_REVENUE_RECOGNIZED_AMOUNT,
  FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS.FINANCE_EXPENSES_RECOGNIZED_AMOUNT,
]);

/**
 * @param {string} metricId
 * @param {string} definition
 * @param {string} unit
 * @param {string} aggregationKind
 * @param {string} [metricKind]
 * @returns {Record<string, unknown>}
 */
function metricDraft(
  metricId,
  definition,
  unit,
  aggregationKind,
  metricKind = ANALYTICS_METRIC_KIND.DERIVED
) {
  const isMonetary = MONETARY_METRIC_IDS.has(metricId);
  return {
    metricId,
    version: METRIC_VERSION,
    definition: isMonetary
      ? `${definition} Currency-safe aggregation: never summed across differing currencyCode; see amountsByCurrency when mixed.`
      : definition,
    unit,
    aggregationKind,
    metricKind,
    source: FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_SOURCE,
    supportedTenantScopeKinds: [
      ANALYTICS_TENANT_SCOPE_KIND.TENANT,
      ANALYTICS_TENANT_SCOPE_KIND.VENUE,
      ANALYTICS_TENANT_SCOPE_KIND.CLUB,
    ],
    supportedGranularities: [
      ANALYTICS_GRANULARITY.RAW,
      ANALYTICS_GRANULARITY.DAY,
      ANALYTICS_GRANULARITY.WEEK,
      ANALYTICS_GRANULARITY.MONTH,
      ANALYTICS_GRANULARITY.WINDOW,
    ],
    allowedDimensions: [
      { key: "currencyCode" },
      { key: "rankingSystemId" },
      { key: "rankingSystemVersion" },
      { key: "ratingSystemId" },
      { key: "ratingSystemVersion" },
      { key: "entityId" },
      { key: "entityType" },
      { key: "competitionId" },
      { key: "status" },
    ],
    missingDataSemantics: ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  };
}

/**
 * Build validated Finance / Ranking / Performance Analytics metric
 * definitions.
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsMetricDefinitions() {
  const ids = FINANCE_RANKING_PERFORMANCE_ANALYTICS_METRIC_IDS;
  const drafts = [
    metricDraft(
      ids.FINANCE_TRANSACTIONS_COUNT,
      "Count of explicit finance transaction facts in the snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_TRANSACTIONS_STATUS_DISTRIBUTION,
      "Distribution of explicit finance transaction status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      ids.FINANCE_INVOICES_ISSUED_COUNT,
      "Count of explicit invoice facts with ISSUED status or an explicit issuedAt.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_INVOICES_STATUS_DISTRIBUTION,
      "Distribution of explicit invoice status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      ids.FINANCE_PAYMENTS_COUNT,
      "Count of explicit finance payment facts in the snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_PAYMENTS_SETTLED_COUNT,
      "Count of payments explicitly settled (status SETTLED/CONFIRMED or settled === true).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_PAYMENTS_SETTLED_AMOUNT,
      "Sum of settled payment amounts.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.FINANCE_REFUNDS_COUNT,
      "Count of explicit finance refund facts in the snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_REFUNDS_SETTLED_AMOUNT,
      "Sum of settled refund amounts.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.FINANCE_SETTLEMENTS_COUNT,
      "Count of explicit finance settlement facts in the snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_RECEIVABLES_OUTSTANDING_COUNT,
      "Count of receivables with explicit OUTSTANDING/OPEN status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_RECEIVABLES_OUTSTANDING_AMOUNT,
      "Sum of outstanding receivable amounts.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.FINANCE_RECEIVABLES_OVERDUE_COUNT,
      "Count of receivables explicitly overdue (status OVERDUE or overdue === true). Never inferred from due dates.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.FINANCE_RECEIVABLES_OVERDUE_AMOUNT,
      "Sum of explicitly overdue receivable amounts. Never inferred from due dates.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.FINANCE_COLLECTIONS_RATE,
      "settledPaymentCount / (settledPaymentCount + outstandingReceivableCount). Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.FINANCE_REVENUE_RECOGNIZED_AMOUNT,
      "Sum of explicitly recognized revenue amounts. Never derived from payment/booking facts.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.FINANCE_EXPENSES_RECOGNIZED_AMOUNT,
      "Sum of explicitly recognized expense amounts. Never derived from payment/booking facts.",
      ANALYTICS_METRIC_UNIT.CURRENCY,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      ids.RANKING_SNAPSHOTS_COUNT,
      "Count of explicit ranking snapshot facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RANKING_ENTITIES_RANKED_COUNT,
      "Distinct entityIds present in explicit ranking position facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RANKING_POSITIONS_DISTRIBUTION,
      "Distribution of explicit ranking position facts by rank value.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      ids.RANKING_MOVEMENT_UP_COUNT,
      "Entities whose numeric rank decreased between baseline and comparison ranking snapshots (numeric direction only — never a claim of 'better').",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RANKING_MOVEMENT_DOWN_COUNT,
      "Entities whose numeric rank increased between baseline and comparison ranking snapshots.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RANKING_MOVEMENT_UNCHANGED_COUNT,
      "Entities whose numeric rank was unchanged between baseline and comparison ranking snapshots.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RANKING_MOVEMENT_AVERAGE_ABSOLUTE_CHANGE,
      "Average absolute numeric rank change across entities present in both compared snapshots. Null when no matched entities.",
      ANALYTICS_METRIC_UNIT.DIMENSIONLESS,
      ANALYTICS_AGGREGATION_KIND.AVERAGE
    ),
    metricDraft(
      ids.RATING_SNAPSHOTS_COUNT,
      "Count of explicit rating snapshot facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RATING_ENTITIES_RATED_COUNT,
      "Distinct entityIds present in explicit rating snapshot facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RATING_CHANGES_COUNT,
      "Count of explicit rating change facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RATING_CHANGES_AVERAGE,
      "Average delta across explicit rating change facts. Null when no rating changes exist.",
      ANALYTICS_METRIC_UNIT.DIMENSIONLESS,
      ANALYTICS_AGGREGATION_KIND.AVERAGE
    ),
    metricDraft(
      ids.RATING_CHANGES_POSITIVE_COUNT,
      "Count of rating changes with delta > 0.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RATING_CHANGES_NEGATIVE_COUNT,
      "Count of rating changes with delta < 0.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.RATING_CHANGES_UNCHANGED_COUNT,
      "Count of rating changes with delta === 0.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_PARTICIPATIONS_COUNT,
      "Count of explicit performance participation facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_MATCHES_PLAYED_COUNT,
      "Count of matches with explicit PLAYED/COMPLETED lifecycle status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_MATCHES_COMPLETED_COUNT,
      "Count of matches explicitly completed (completed === true or lifecycleStatus COMPLETED).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_OUTCOMES_WIN_COUNT,
      "Count of accepted (validationStatus ACCEPTED) outcomes with explicit outcome === 'win'.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_OUTCOMES_LOSS_COUNT,
      "Count of accepted outcomes with explicit outcome === 'loss'.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_OUTCOMES_DRAW_COUNT,
      "Count of accepted outcomes with explicit outcome === 'draw'.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_OUTCOMES_OTHER_COUNT,
      "Count of accepted outcomes with explicit outcome === 'other' or 'unknown'.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PERFORMANCE_WIN_RATE,
      "wins / (wins + losses [+ draws when present]) from accepted outcomes only. Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.PERFORMANCE_COMPLETION_RATE,
      "completedMatchCount / playedMatchCount. Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.PERFORMANCE_VALIDATED_RESULTS_COUNT,
      "Count of outcomes with explicit validationStatus ACCEPTED.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
  ];

  /** @type {unknown[]} */
  const definitions = [];
  for (const draft of drafts) {
    const created = createAnalyticsMetricDefinition(draft);
    if (!created.ok) return created;
    definitions.push(created.value);
  }

  return ok(Object.freeze(definitions));
}

/**
 * Build registry-compatible entry requests for Finance / Ranking /
 * Performance metrics.
 * @param {{ lifecycleState?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsMetricCatalogEntries(
  options = {}
) {
  const definitionsResult = createFinanceRankingPerformanceAnalyticsMetricDefinitions();
  if (!definitionsResult.ok) return definitionsResult;

  const lifecycleState =
    (options && options.lifecycleState) || ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE;

  const entries = definitionsResult.value.map((definition) =>
    Object.freeze({
      definition,
      lifecycleState,
      displayName: definition.metricId,
    })
  );

  return ok(deepFreeze(entries));
}
