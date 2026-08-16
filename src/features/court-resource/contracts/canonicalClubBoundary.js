/**
 * Canonical club boundary validator (thin adapter).
 *
 * Reuses Club / Venue-Court club scope projections. Not a new SSOT contract.
 * Club identity framing ≠ court operational access.
 */
import { projectClubScope } from "../../club/platform/clubPlatformAdapter.js";
import { projectVenueCourtClubScope } from "../../venue-court/platform/venueCourtPlatformAdapter.js";
import {
  COURT_OPERATIONS_SCOPE_CODE,
  requireCanonicalClubScope,
} from "../scope/courtOperationsScope.js";

/**
 * @param {object} input
 * @param {object} [adapters] injectable projections / framing asserts
 */
export function assertCanonicalClubBoundary(input = {}, adapters = {}) {
  return requireCanonicalClubScope(input, {
    projectClubScope: adapters.projectClubScope || projectClubScope,
    assertClubBelongsToTenant: adapters.assertClubBelongsToTenant,
    assertVenueBelongsToTenant: adapters.assertVenueBelongsToTenant,
  });
}

/**
 * Project club framing only (no court access evaluation).
 *
 * @param {object} input
 */
export function projectCanonicalClubBoundary(input = {}, adapters = {}) {
  const project =
    typeof adapters.projectClubScope === "function"
      ? adapters.projectClubScope
      : projectClubScope;
  const projected = project(input);
  if (!projected?.ok) {
    return {
      ok: false,
      code: COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED,
      error:
        projected?.error?.message
        || projected?.error
        || "Club boundary projection rejected.",
      projection: projected,
    };
  }
  const venueCourt =
    typeof adapters.projectVenueCourtClubScope === "function"
      ? adapters.projectVenueCourtClubScope
      : projectVenueCourtClubScope;
  const vc = venueCourt(input);
  if (!vc?.ok) {
    return {
      ok: false,
      code: COURT_OPERATIONS_SCOPE_CODE.CLUB_SCOPE_REJECTED,
      error:
        vc?.error?.message || vc?.error || "Venue/Court club framing rejected.",
      projection: vc,
    };
  }
  return { ok: true, code: COURT_OPERATIONS_SCOPE_CODE.OK, club: projected.value, framing: vc.value };
}
