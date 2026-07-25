/**
 * I&A-09 — Finance, Ranking and Performance Analytics enums and
 * analytical-method constants. Descriptive analytics only — no ledger
 * posting, revenue calculation, ranking/rating/standings recalculation, or
 * winner inference.
 */

export const FINANCE_RANKING_PERFORMANCE_ANALYTICS_METHOD_VERSION = Object.freeze({
  FINANCE_SUMMARY: "ia09.finance_summary_v1",
  RANKING_SUMMARY: "ia09.ranking_summary_v1",
  RANKING_MOVEMENT: "ia09.ranking_movement_v1",
  RATING_SUMMARY: "ia09.rating_summary_v1",
  PERFORMANCE_SUMMARY: "ia09.performance_summary_v1",
  SUMMARY: "ia09.finance_ranking_performance_summary_v1",
  HISTORICAL: "ia09.finance_ranking_performance_historical_v1",
  DASHBOARD: "ia09.finance_ranking_performance_dashboard_v1",
});

/**
 * Snapshot completeness for analytical envelopes.
 */
export const FINANCE_RANKING_PERFORMANCE_ANALYTICS_COMPLETENESS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
});

/**
 * Explicit rank-direction contract. A ranking system must state whether a
 * lower or higher numeric rank is "better" — this module never hard-codes
 * or infers that meaning when it is not explicitly provided by the source.
 */
export const RANK_DIRECTION = Object.freeze({
  ASCENDING_BETTER: "ascending_better",
  DESCENDING_BETTER: "descending_better",
  UNKNOWN: "unknown",
});

/**
 * Explicit performance outcome vocabulary — never inferred from score.
 */
export const PERFORMANCE_OUTCOME = Object.freeze({
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw",
  OTHER: "other",
  UNKNOWN: "unknown",
});

/**
 * Explicit result validation-status vocabulary. Only ACCEPTED outcomes may
 * be counted as validated results/wins/losses/draws.
 */
export const OUTCOME_VALIDATION_STATUS = Object.freeze({
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PENDING: "pending",
  VOID: "void",
  UNKNOWN: "unknown",
});

/**
 * Descriptive receivable-status label mapping only — never used to infer
 * overdue from due dates.
 */
export const RECEIVABLE_STATUS_BUCKET = Object.freeze({
  OUTSTANDING: "outstanding",
  OVERDUE: "overdue",
  PAID: "paid",
  UNKNOWN: "unknown",
});

/**
 * Performance entity kinds carried on ranking/rating/performance facts.
 */
export const PERFORMANCE_ENTITY_TYPE = Object.freeze({
  PLAYER: "player",
  TEAM: "team",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isFinanceRankingPerformanceAnalyticsEnumValue(value, enumObject) {
  return Object.values(enumObject).includes(/** @type {string} */ (value));
}
