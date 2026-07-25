/**
 * Venue / Court / Club analytics source adapter contracts (I&A-07).
 * Read-only — adapter.load(request) returns an analytical snapshot.
 * No Venue/Court/Club module / DB / Supabase imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createVenueCourtClubAnalyticsContext } from "./context.js";
import { createVenueCourtClubAnalyticsSnapshot } from "./snapshot.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
        "VenueCourtClubAnalyticsSourceRequest must be a plain object",
        "request"
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

  /** @type {Record<string, unknown>} */
  const request = {
    context: contextResult.value,
  };

  if (input.executionId !== undefined) {
    if (!isNonEmptyString(input.executionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_QUERY_INVALID,
          "executionId must be a non-empty string when provided",
          "executionId"
        )
      );
    }
    request.executionId = String(input.executionId).trim();
  }

  return ok(deepFreeze(request));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE,
        "VenueCourtClubAnalyticsSourceResponse must be a plain object",
        "response"
      )
    );
  }
  const snapshotResult = createVenueCourtClubAnalyticsSnapshot(
    input.snapshot || input
  );
  if (!snapshotResult.ok) return snapshotResult;
  return ok(
    deepFreeze({
      snapshot: snapshotResult.value,
    })
  );
}

/**
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapVenueCourtClubSourceFailure(error) {
  if (
    error &&
    typeof error === "object" &&
    error.ok === false &&
    error.error &&
    typeof error.error.code === "string"
  ) {
    return /** @type {import("../contracts/result.js").Result} */ (error);
  }

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Venue/Court/Club analytics source failure";

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE,
      message,
      "sourceAdapter",
      error && typeof error === "object" && error.code
        ? { wrappedCode: String(error.code) }
        : undefined
    )
  );
}

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function isVenueCourtClubAnalyticsSourceAdapter(adapter) {
  return isPlainObject(adapter) && typeof adapter.load === "function";
}
