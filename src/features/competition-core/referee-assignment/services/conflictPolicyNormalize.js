/**
 * Shared conflict-policy normalization for CORE-13 services.
 *
 * Affiliation intersection with match sides is NOT hard by default.
 * Use disallowAffiliated* flags (default false) or explicit prohibited* lists.
 */

import { isPlainObject } from "../deterministic/canonicalize.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";

/**
 * @param {unknown} policy
 */
export function normalizeConflictPolicy(policy) {
  const raw = isPlainObject(policy) ? policy : {};
  const matchExclusions = [];
  const rawExclusions = Array.isArray(raw.matchExclusions)
    ? raw.matchExclusions
    : [];
  for (const item of rawExclusions) {
    if (typeof item === "string" && item.includes(":")) {
      const [refereeId, matchId] = item.split(":");
      if (refereeId && matchId) {
        matchExclusions.push({
          refereeId: refereeId.trim(),
          matchId: matchId.trim(),
        });
      }
    } else if (isPlainObject(item) && item.refereeId && item.matchId) {
      matchExclusions.push({
        refereeId: String(item.refereeId).trim(),
        matchId: String(item.matchId).trim(),
      });
    }
  }
  matchExclusions.sort((a, b) => {
    const c = compareStableString(a.refereeId, b.refereeId);
    if (c !== 0) return c;
    return compareStableString(a.matchId, b.matchId);
  });

  const sortIds = (arr) =>
    [...(Array.isArray(arr) ? arr : [])]
      .map((id) => String(id).trim())
      .filter(Boolean)
      .sort(compareStableString);

  return ownedFreeze({
    policyId: String(raw.policyId || "default-conflict-policy"),
    /** Participant/player COI — hard by default */
    prohibitSamePlayerId: raw.prohibitSamePlayerId !== false,
    prohibitSelfReferee: raw.prohibitSelfReferee !== false,
    /** General affiliation intersection — hard only when true (default false) */
    disallowAffiliatedTeamReferee: raw.disallowAffiliatedTeamReferee === true,
    disallowAffiliatedClubReferee: raw.disallowAffiliatedClubReferee === true,
    disallowAffiliatedOrganizationReferee:
      raw.disallowAffiliatedOrganizationReferee === true,
    /** When affiliation is not hard, emit soft notes if true (default true) */
    softAffiliationAwareness: raw.softAffiliationAwareness !== false,
    excludedRefereeIds: Object.freeze(sortIds(raw.excludedRefereeIds)),
    prohibitedTeamIds: Object.freeze(sortIds(raw.prohibitedTeamIds)),
    prohibitedClubIds: Object.freeze(sortIds(raw.prohibitedClubIds)),
    prohibitedOrganizationIds: Object.freeze(
      sortIds(raw.prohibitedOrganizationIds)
    ),
    matchExclusions: Object.freeze(matchExclusions),
  });
}

/**
 * Active assignment statuses that count for overlap / capacity / workload.
 */
export function isActiveAssignmentStatus(status) {
  return status === "PLANNED" || status === "CONFIRMED";
}
