/**
 * Club-owned auth session projection (Wave 2).
 * Registered into Platform auth session hooks — Auth storage must not import this file.
 *
 * Preserves prior authStorage semantics:
 * - session load: V2 strip / legacy athlete-link merge, then governance elevation
 * - cloud profile: V2 strip / legacy reconcile only (no governance elevation here)
 */
import {
  mergeAthleteClubLink,
  reconcileAthleteClubLinkWithProfile,
  clearAthleteClubLink,
} from "../storage/athleteClubLinkStore.js";
import { syncGovernanceAuthRoleFromClub } from "./governanceRoleElevation.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { stripLegacyProfileClubFields } from "./clubActiveMembershipService.js";
import { normalizeUser } from "../../../models/user.js";

/**
 * @param {object} user
 * @param {{ source?: "session"|"cloud_profile" }} [meta]
 * @returns {{ user: object, changed: boolean }}
 */
export function projectClubAuthSessionUser(user, meta = {}) {
  if (!user) {
    return { user, changed: false };
  }

  const source = meta.source === "cloud_profile" ? "cloud_profile" : "session";
  let next = normalizeUser(user);

  if (isClubStorageV2Enabled()) {
    if (next.id) {
      clearAthleteClubLink(next.id);
    }
    next = stripLegacyProfileClubFields(next);
  } else if (source === "cloud_profile") {
    next = reconcileAthleteClubLinkWithProfile(next);
  } else {
    next = mergeAthleteClubLink(next);
  }

  if (source === "cloud_profile") {
    return { user: next, changed: false };
  }

  const synced = syncGovernanceAuthRoleFromClub(next);
  if (synced.changed) {
    return { user: synced.user, changed: true };
  }

  return { user: next, changed: false };
}
