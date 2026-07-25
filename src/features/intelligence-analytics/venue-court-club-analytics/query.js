/**
 * Venue / Court / Club analytics query descriptor (I&A-07).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createVenueCourtClubAnalyticsContext } from "./context.js";
import {
  BOOKING_CANCELLATION_POLICY,
  DOWNTIME_INCLUSION_POLICY,
  isVenueCourtClubAnalyticsEnumValue,
} from "./enums.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        "VenueCourtClubAnalyticsQuery must be a plain object",
        "query"
      )
    );
  }

  const contextResult = createVenueCourtClubAnalyticsContext(
    input.context || {
      tenantScope: input.tenantScope,
      venueId: input.venueId,
      courtId: input.courtId,
      clubId: input.clubId,
    }
  );
  if (!contextResult.ok) return contextResult;

  const cancellationPolicy =
    input.cancellationPolicy || BOOKING_CANCELLATION_POLICY.EXCLUDE_CANCELLED;
  if (
    !isVenueCourtClubAnalyticsEnumValue(
      cancellationPolicy,
      BOOKING_CANCELLATION_POLICY
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        `Unsupported cancellationPolicy: ${cancellationPolicy}`,
        "cancellationPolicy"
      )
    );
  }

  const downtimeInclusionPolicy =
    input.downtimeInclusionPolicy ||
    DOWNTIME_INCLUSION_POLICY.EXCLUDE_FROM_ELIGIBLE;
  if (
    !isVenueCourtClubAnalyticsEnumValue(
      downtimeInclusionPolicy,
      DOWNTIME_INCLUSION_POLICY
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        `Unsupported downtimeInclusionPolicy: ${downtimeInclusionPolicy}`,
        "downtimeInclusionPolicy"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const query = {
    context: contextResult.value,
    cancellationPolicy,
    downtimeInclusionPolicy,
    includeDashboardPayloads: input.includeDashboardPayloads === true,
    includeHistoricalObservations:
      input.includeHistoricalObservations === true,
  };

  return ok(deepFreeze(query));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function normalizeVenueCourtClubAnalyticsQuery(input) {
  return createVenueCourtClubAnalyticsQuery(input);
}
