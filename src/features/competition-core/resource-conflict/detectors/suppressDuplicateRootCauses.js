/**
 * CORE-14 Phase 1D — deterministic duplicate root-cause suppression.
 * Does not suppress materially independent conflicts.
 */

import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";

const SPECIALIZED_OVERLAP_CODES = new Set([
  RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.LOCATION_TIME_OVERLAP,
]);

const REST_CODES = new Set([
  RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION,
  RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING,
]);

/**
 * @param {readonly string[]} ids
 * @returns {string}
 */
function occupancyPairKey(ids) {
  return [...ids].sort(compareUtf8Bytewise).join("\u0000");
}

/**
 * @param {object} finding
 * @returns {string}
 */
function resourceKeyOf(finding) {
  try {
    return serializeCanonicalResourceKey(finding.resourceKey);
  } catch {
    return String(finding.findingId || "");
  }
}

/**
 * Apply explicit suppression rules. Returns a new array (no mutation).
 *
 * Rules:
 * 1. Drop RESOURCE_CAPACITY_EXCEEDED when VENUE_CAPACITY_EXCEEDED exists for same venue key + overlapping window.
 * 2. Drop RESOURCE_UNAVAILABLE when VENUE_UNAVAILABLE exists for same venue occupancy set.
 * 3. Drop RESOURCE_CAPACITY_EXCEEDED when specialized overlap exists for same resource key with overlapping occupancy set.
 * 4. Drop LOCATION capacity duplicate when LOCATION_TIME_OVERLAP covers same exclusive location.
 * 5. Drop rest finding when overlap finding exists for the same occupancy pair (negative-gap case).
 *
 * @param {readonly object[]} findings
 * @returns {object[]}
 */
export function suppressDuplicateRootCauses(findings) {
  const list = Array.isArray(findings) ? [...findings] : [];

  /** @type {Set<string>} */
  const venueCapacityKeys = new Set();
  /** @type {Set<string>} */
  const venueUnavailableKeys = new Set();
  /** @type {Map<string, Set<string>>} */
  const overlapOccupancyByResource = new Map();
  /** @type {Set<string>} */
  const overlapPairs = new Set();

  for (const f of list) {
    const rk = resourceKeyOf(f);
    if (f.code === RESOURCE_FINDING_CODE.VENUE_CAPACITY_EXCEEDED) {
      venueCapacityKeys.add(rk);
    }
    if (f.code === RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE) {
      venueUnavailableKeys.add(`${rk}|${occupancyPairKey(f.occupancyIds || [])}`);
    }
    if (SPECIALIZED_OVERLAP_CODES.has(f.code)) {
      const set = overlapOccupancyByResource.get(rk) || new Set();
      for (const id of f.occupancyIds || []) set.add(id);
      overlapOccupancyByResource.set(rk, set);
      overlapPairs.add(`${rk}|${occupancyPairKey(f.occupancyIds || [])}`);
    }
  }

  const retained = list.filter((f) => {
    const rk = resourceKeyOf(f);
    const pair = occupancyPairKey(f.occupancyIds || []);

    // Venue: never keep generic capacity alongside venue capacity for same key.
    if (
      f.code === RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED &&
      venueCapacityKeys.has(rk)
    ) {
      return false;
    }

    // Venue: never keep generic unavailable alongside venue unavailable for same occupancy set.
    if (
      f.code === RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE &&
      venueUnavailableKeys.has(`${rk}|${pair}`)
    ) {
      return false;
    }

    // Specialized overlap owns capacity-one / exclusive-location root cause.
    if (f.code === RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED) {
      const overlapIds = overlapOccupancyByResource.get(rk);
      if (overlapIds) {
        const ids = f.occupancyIds || [];
        const shares = ids.some((id) => overlapIds.has(id));
        if (shares) return false;
      }
    }

    // Rest suppressed when overlap already covers the same pair (negative gap).
    if (REST_CODES.has(f.code) && overlapPairs.has(`${rk}|${pair}`)) {
      return false;
    }

    return true;
  });

  return retained;
}

export const DUPLICATE_SUPPRESSION_RULES = Object.freeze([
  "VENUE_CAPACITY_EXCEEDED suppresses RESOURCE_CAPACITY_EXCEEDED for same venue key",
  "VENUE_UNAVAILABLE suppresses RESOURCE_UNAVAILABLE for same venue occupancy set",
  "Specialized overlap suppresses RESOURCE_CAPACITY_EXCEEDED for shared occupancy on same resource key",
  "LOCATION_TIME_OVERLAP path skips capacity findings for exclusive locations (detector-level)",
  "Overlap finding suppresses rest finding for the same occupancy pair",
]);
