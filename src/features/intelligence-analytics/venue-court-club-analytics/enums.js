/**
 * I&A-07 — Venue, Court and Club Analytics enums and analytical-method constants.
 * Descriptive analytics only — no Venue/Court/Club business rules.
 */

export const VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION = Object.freeze({
  SUMMARY: "ia07.venue_court_club_summary_v1",
  DISTRIBUTION: "ia07.venue_court_club_distribution_v1",
  AVAILABILITY: "ia07.court_availability_v1",
  UTILIZATION: "ia07.court_utilization_v1",
  BOOKING_VOLUME: "ia07.court_booking_volume_v1",
  OPERATING_HOURS: "ia07.operating_hours_v1",
  DOWNTIME: "ia07.court_downtime_v1",
  HISTORICAL: "ia07.venue_court_club_historical_v1",
  DASHBOARD: "ia07.venue_court_club_dashboard_v1",
});

/**
 * Snapshot completeness for analytical envelopes.
 */
export const VENUE_COURT_CLUB_ANALYTICS_COMPLETENESS = Object.freeze({
  COMPLETE: "complete",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
});

/**
 * Explicit availability status buckets (descriptive labels only).
 * Source must supply availability facts; analytics does not recalculate.
 */
export const COURT_AVAILABILITY_BUCKET = Object.freeze({
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  UNKNOWN: "unknown",
});

/**
 * Booking inclusion policy for booked-minutes / utilization numerators.
 */
export const BOOKING_CANCELLATION_POLICY = Object.freeze({
  INCLUDE_CANCELLED: "include_cancelled",
  EXCLUDE_CANCELLED: "exclude_cancelled",
});

/**
 * Downtime inclusion policy relative to eligible/available minutes.
 */
export const DOWNTIME_INCLUSION_POLICY = Object.freeze({
  EXCLUDE_FROM_ELIGIBLE: "exclude_from_eligible",
  INCLUDE_IN_ELIGIBLE: "include_in_eligible",
});

/**
 * Descriptive venue/court/club lifecycle buckets (label mapping only).
 */
export const ENTITY_LIFECYCLE_BUCKET = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  MAINTENANCE: "maintenance",
  UNKNOWN: "unknown",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isVenueCourtClubAnalyticsEnumValue(value, enumObject) {
  return Object.values(enumObject).includes(/** @type {string} */ (value));
}
