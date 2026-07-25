/**
 * I&A-06 — Competition Analytics enums and analytical-method constants.
 * Descriptive analytics only — no Competition Engine business rules.
 */

export const COMPETITION_ANALYTICS_METHOD_VERSION = Object.freeze({
  SUMMARY: "ia06.competition_summary_v1",
  DISTRIBUTION: "ia06.competition_distribution_v1",
  PROGRESS: "ia06.competition_progress_v1",
  SCHEDULE_ADHERENCE: "ia06.competition_schedule_adherence_v1",
  DURATION: "ia06.competition_duration_v1",
  RESULT_ACCEPTANCE: "ia06.competition_result_acceptance_v1",
  HISTORICAL: "ia06.competition_historical_v1",
  DASHBOARD: "ia06.competition_dashboard_v1",
});

/**
 * Default on-time start threshold (seconds). Documented and versioned via
 * COMPETITION_ANALYTICS_METHOD_VERSION.SCHEDULE_ADHERENCE — callers may override.
 */
export const COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT = 0;

/**
 * Progress denominator policy for cancelled/void matches.
 */
export const COMPETITION_PROGRESS_EXCLUSION_POLICY = Object.freeze({
  INCLUDE_ALL: "include_all",
  EXCLUDE_CANCELLED_VOID: "exclude_cancelled_void",
});

/**
 * Snapshot completeness for analytical envelopes.
 */
export const COMPETITION_ANALYTICS_COMPLETENESS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
});

/**
 * Canonical analytical match lifecycle buckets (descriptive labels only).
 * Source must supply explicit status strings; analytics does not infer.
 */
export const COMPETITION_MATCH_LIFECYCLE_BUCKET = Object.freeze({
  SCHEDULED: "scheduled",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
  VOID: "void",
  ABANDONED: "abandoned",
  UNKNOWN: "unknown",
});

/**
 * Canonical analytical result-acceptance buckets.
 */
export const COMPETITION_RESULT_ACCEPTANCE_BUCKET = Object.freeze({
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PENDING: "pending",
  UNKNOWN: "unknown",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isCompetitionAnalyticsEnumValue(value, enumObject) {
  return Object.values(enumObject).includes(/** @type {string} */ (value));
}
