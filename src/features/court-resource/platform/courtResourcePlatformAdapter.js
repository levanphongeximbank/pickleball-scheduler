/**
 * Court Resource → reused Platform / Venue-Court / Club scope projections.
 *
 * Thin wrapper only. No new identity authority. Does not equate tenantId with
 * venueId or invent either from the other.
 */
import { projectTenantScope } from "../../../core/platform/adapters/identityTenant/tenantScopeAdapter.js";
import {
  projectVenueCourtTenantScope,
  projectVenueCourtVenueScope,
  projectVenueCourtClubScope,
} from "../../venue-court/platform/venueCourtPlatformAdapter.js";
import { projectClubScope } from "../../club/platform/clubPlatformAdapter.js";

export function projectCourtOperationsTenantScope(input) {
  return projectVenueCourtTenantScope(input);
}

export function projectCourtOperationsVenueScope(input) {
  return projectVenueCourtVenueScope(input);
}

export function projectCourtOperationsClubScope(input) {
  // Prefer Club Management projection; Venue/Court club framing remains available.
  if (input && typeof input === "object" && "clubId" in input) {
    return projectClubScope(input);
  }
  return projectVenueCourtClubScope(input);
}

/** Direct Platform Core tenant scope — explicit scopeType required by adapter. */
export function projectCourtOperationsPlatformTenantScope(input) {
  return projectTenantScope(input);
}

export {
  projectTenantScope,
  projectVenueCourtTenantScope,
  projectVenueCourtVenueScope,
  projectVenueCourtClubScope,
  projectClubScope,
};
