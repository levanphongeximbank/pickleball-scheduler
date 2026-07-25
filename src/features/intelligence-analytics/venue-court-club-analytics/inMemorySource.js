/**
 * In-memory Venue / Court / Club Analytics source for certification (I&A-07).
 * No DB / localStorage / Supabase / Venue-Court / Club imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createVenueCourtClubAnalyticsSnapshot } from "./snapshot.js";
import {
  createVenueCourtClubAnalyticsSourceRequest,
  wrapVenueCourtClubSourceFailure,
} from "./sourceAdapter.js";
import { guardVenueCourtClubAnalyticsSnapshot } from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryVenueCourtClubAnalyticsSource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE,
        "createInMemoryVenueCourtClubAnalyticsSource input must be a plain object",
        "input"
      )
    );
  }

  const snapshotResult = createVenueCourtClubAnalyticsSnapshot(
    input.snapshot || input
  );
  if (!snapshotResult.ok) return snapshotResult;

  const frozenSnapshot = deepFreeze(clonePlain(snapshotResult.value));
  const failMode = input.failMode;

  /**
   * @param {unknown} requestInput
   */
  function load(requestInput) {
    try {
      if (failMode === "throw") {
        throw new Error("venue court club analytics certification source throw");
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Venue/Court/Club analytics certification source unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_SOURCE_FAILURE,
            "Venue/Court/Club analytics certification source failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult =
        createVenueCourtClubAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const guard = guardVenueCourtClubAnalyticsSnapshot(
        request.context,
        frozenSnapshot
      );
      if (!guard.ok) return guard;

      return ok(
        deepFreeze({
          snapshot: clonePlain(frozenSnapshot),
        })
      );
    } catch (error) {
      return wrapVenueCourtClubSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      load,
      kind: "in-memory-venue-court-club-analytics",
      snapshotContext: frozenSnapshot.context,
    })
  );
}
