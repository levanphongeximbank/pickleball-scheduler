/**
 * Historical observation composition for Venue / Court / Club Analytics (I&A-07).
 * Reuses I&A-05 observation contracts — does not duplicate the historical engine.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsHistoricalObservation } from "../historical-trend/series.js";
import {
  deepFreeze,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS } from "./metrics.js";

/**
 * Build I&A-05-compatible historical observations from a VCC summary.
 * @param {unknown} summary
 * @param {{ observedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeVenueCourtClubHistoricalObservations(
  summary,
  options = {}
) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        "composeVenueCourtClubHistoricalObservations requires a summary",
        "summary"
      )
    );
  }

  const observedAt =
    options.observedAt || summary.sourceTimestamp || summary.generatedAt;

  if (!isValidIsoTimestamp(observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TIMESTAMP_INVALID,
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
      sourceId: "venue-court-club-analytics-explicit",
      sourceKind: "explicit_input",
      ownerModule: "intelligence-analytics",
      reference: "ia-07-historical",
    },
  };

  /** @type {Record<string, string>} */
  const dimensions = {};
  if (summary.venueId) dimensions.venueId = String(summary.venueId);
  if (summary.courtId) dimensions.courtId = String(summary.courtId);
  if (summary.clubId) dimensions.clubId = String(summary.clubId);

  const pairs = [
    [VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.VENUE_COUNT, summary.venueCount],
    [VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_COUNT, summary.courtCount],
    [
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_AVAILABILITY_RATE,
      summary.availabilityRate,
    ],
    [
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_UTILIZATION_RATE,
      summary.utilizationRate,
    ],
    [
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_BOOKINGS_COUNT,
      summary.bookingCount,
    ],
    [VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_COUNT, summary.clubCount],
    [
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.CLUB_MEMBERS_COUNT,
      summary.membershipCount,
    ],
    [
      VENUE_COURT_CLUB_ANALYTICS_METRIC_IDS.COURT_DOWNTIME_MINUTES,
      summary.downtimeMinutes,
    ],
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
        VENUE_COURT_CLUB_ANALYTICS_METHOD_VERSION.HISTORICAL,
      deterministic: true,
    })
  );
}
