/**
 * Venue / Court / Club Analytics metric catalog (I&A-07).
 * Registry-compatible definitions — no business-rule calculation.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_GRANULARITY,
  ANALYTICS_METRIC_KIND,
  ANALYTICS_METRIC_UNIT,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "../contracts/enums.js";
import { ANALYTICS_TENANT_SCOPE_KIND } from "../contracts/tenantScope.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { ANALYTICS_METRIC_LIFECYCLE_STATE } from "../registry/lifecycle.js";

export const VENUE_COURT_CLUB_ANALYTICS_METRIC_SOURCE = Object.freeze({
  sourceId: "venue-court-club-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-07-venue-court-club-analytics",
});

/**
 * Stable metric ID catalog for Venue / Court / Club Analytics foundation.
 */
export const VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS = Object.freeze({
  VENUE_COUNT: "venue.count",
  VENUE_ACTIVE_COUNT: "venue.active_count",
  VENUE_INACTIVE_COUNT: "venue.inactive_count",
  COURT_COUNT: "court.count",
  COURT_ACTIVE_COUNT: "court.active_count",
  COURT_INACTIVE_COUNT: "court.inactive_count",
  COURT_STATUS_DISTRIBUTION: "court.status_distribution",
  COURT_AVAILABLE_COUNT: "court.available_count",
  COURT_UNAVAILABLE_COUNT: "court.unavailable_count",
  COURT_AVAILABILITY_RATE: "court.availability_rate",
  COURT_OPERATING_HOURS_TOTAL_MINUTES: "court.operating_hours.total_minutes",
  COURT_OPERATING_HOURS_COVERAGE_RATE: "court.operating_hours.coverage_rate",
  COURT_BOOKINGS_COUNT: "court.bookings.count",
  COURT_BOOKINGS_STATUS_DISTRIBUTION: "court.bookings.status_distribution",
  COURT_BOOKED_MINUTES: "court.booked_minutes",
  COURT_UTILIZATION_RATE: "court.utilization_rate",
  COURT_MAINTENANCE_COUNT: "court.maintenance_count",
  COURT_DOWNTIME_MINUTES: "court.downtime_minutes",
  COURT_DOWNTIME_RATE: "court.downtime_rate",
  CLUB_COUNT: "club.count",
  CLUB_ACTIVE_COUNT: "club.active_count",
  CLUB_INACTIVE_COUNT: "club.inactive_count",
  CLUB_MEMBERS_COUNT: "club.members.count",
  CLUB_MEMBERS_STATUS_DISTRIBUTION: "club.members.status_distribution",
  CLUB_ROLES_ASSIGNMENT_COUNT: "club.roles.assignment_count",
  CLUB_ROLES_DISTRIBUTION: "club.roles.distribution",
  CLUB_ACTIVITIES_COUNT: "club.activities.count",
});

const METRIC_VERSION = "1.0.0";

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
  return {
    metricId,
    version: METRIC_VERSION,
    definition,
    unit,
    aggregationKind,
    metricKind,
    source: VENUE_COURT_CLUB_ANALYTICS_METRIC_SOURCE,
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
      { key: "venueId" },
      { key: "courtId" },
      { key: "clubId" },
      { key: "status" },
    ],
    missingDataSemantics: ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  };
}

/**
 * Build validated Venue / Court / Club Analytics metric definitions.
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsMetricDefinitions() {
  const drafts = [
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_COUNT,
      "Count of explicit venue analytical facts in the snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_ACTIVE_COUNT,
      "Count of venues with explicit active lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_INACTIVE_COUNT,
      "Count of venues with explicit inactive lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_COUNT,
      "Count of explicit court analytical facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_ACTIVE_COUNT,
      "Count of courts with explicit active status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_INACTIVE_COUNT,
      "Count of courts with explicit inactive status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_STATUS_DISTRIBUTION,
      "Distribution of explicit court status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABLE_COUNT,
      "Count of courts with explicit available availability facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UNAVAILABLE_COUNT,
      "Count of courts with explicit unavailable availability facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
      "available / (available + unavailable). Null when denominator is zero or availability facts missing.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_OPERATING_HOURS_TOTAL_MINUTES,
      "Sum of explicit configured operating-hours minutes. Missing config is not treated as 24/7.",
      ANALYTICS_METRIC_UNIT.DURATION_SECONDS,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_OPERATING_HOURS_COVERAGE_RATE,
      "venues with configured hours / venue count. Null when venue count is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_BOOKINGS_COUNT,
      "Count of explicit court booking facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_BOOKINGS_STATUS_DISTRIBUTION,
      "Distribution of explicit booking status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_BOOKED_MINUTES,
      "Sum of explicit bookedMinutes per cancellation policy. Missing minutes are not coerced to zero.",
      ANALYTICS_METRIC_UNIT.DURATION_SECONDS,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
      "occupied eligible minutes / available eligible minutes (versioned method). Null when denominator missing or zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_MAINTENANCE_COUNT,
      "Count of explicit court maintenance facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_MINUTES,
      "Sum of explicit downtime minutes.",
      ANALYTICS_METRIC_UNIT.DURATION_SECONDS,
      ANALYTICS_AGGREGATION_KIND.SUM
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_RATE,
      "downtime minutes / eligible minutes. Null when denominator missing or zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_COUNT,
      "Count of explicit club analytical facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_ACTIVE_COUNT,
      "Count of clubs with explicit active lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_INACTIVE_COUNT,
      "Count of clubs with explicit inactive lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT,
      "Count of explicit club membership facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_STATUS_DISTRIBUTION,
      "Distribution of explicit membership status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_ROLES_ASSIGNMENT_COUNT,
      "Count of explicit club role assignment facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_ROLES_DISTRIBUTION,
      "Distribution of explicit roleId assignments.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_ACTIVITIES_COUNT,
      "Count of explicit club activity facts.",
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
 * Build registry-compatible entry requests for Venue / Court / Club metrics.
 * @param {{ lifecycleState?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsMetricCatalogEntries(options = {}) {
  if (!isPlainObject(options)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "options must be a plain object",
        "options"
      )
    );
  }

  const definitionsResult = createVenueCourtClubAnalyticsMetricDefinitions();
  if (!definitionsResult.ok) return definitionsResult;

  const lifecycleState =
    options.lifecycleState || ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE;

  const entries = definitionsResult.value.map((definition) =>
    Object.freeze({
      definition,
      lifecycleState,
      displayName: definition.metricId,
    })
  );

  return ok(deepFreeze(entries));
}
