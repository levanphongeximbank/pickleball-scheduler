/**
 * I&A-08 — Customer and Player Analytics enums and analytical-method constants.
 * Descriptive analytics only — no Customer/Player/CRM/Competition business rules.
 */

export const CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION = Object.freeze({
  SUMMARY: "ia08.customer_player_summary_v1",
  DISTRIBUTION: "ia08.customer_player_distribution_v1",
  LINKAGE: "ia08.customer_player_linkage_v1",
  ACTIVITY: "ia08.customer_player_activity_v1",
  PARTICIPATION: "ia08.player_competition_participation_v1",
  MEMBERSHIP: "ia08.player_club_membership_v1",
  COMPLETENESS: "ia08.profile_completeness_v1",
  HISTORICAL: "ia08.customer_player_historical_v1",
  DASHBOARD: "ia08.customer_player_dashboard_v1",
});

/**
 * Snapshot completeness for analytical envelopes.
 */
export const CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
});

/**
 * Descriptive customer/player lifecycle buckets (label mapping only).
 */
export const ENTITY_LIFECYCLE_BUCKET = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  ARCHIVED: "archived",
  UNKNOWN: "unknown",
});

/**
 * Descriptive profile-completeness buckets (label mapping only — never
 * computed from raw PII, only from explicit source-provided signals).
 */
export const PROFILE_COMPLETENESS_STATUS = Object.freeze({
  COMPLETE: "complete",
  INCOMPLETE: "incomplete",
  UNKNOWN: "unknown",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isCustomerPlayerAnalyticsEnumValue(value, enumObject) {
  return Object.values(enumObject).includes(/** @type {string} */ (value));
}
