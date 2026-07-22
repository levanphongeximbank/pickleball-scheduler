/**
 * CORE-12 deterministic match / court ordering.
 * Comparator version: CORE12_COMPARATOR_V1.
 */

import {
  CORE12_COMPARATOR_VERSION,
} from "../constants/versions.js";
import {
  COURT_ORDERING_STRATEGY,
  MATCH_ORDERING_STRATEGY,
} from "../enums/orderingStrategy.js";
import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";
import {
  compareFiniteNumber,
  compareStableId,
  compareStableString,
} from "./compare.js";
import { instantToEpochMs } from "./intervals.js";

/**
 * @param {string} comparatorVersion
 */
export function assertComparatorVersion(comparatorVersion) {
  if (comparatorVersion !== CORE12_COMPARATOR_VERSION) {
    throw new CourtAssignmentContractError(
      COURT_ASSIGNMENT_REJECTION_CODE.UNSUPPORTED_POLICY_VERSION,
      `Unsupported comparatorVersion: ${comparatorVersion}`,
      {
        comparatorVersion,
        expected: CORE12_COMPARATOR_VERSION,
      }
    );
  }
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} strategy
 * @returns {number}
 */
export function compareMatches(a, b, strategy) {
  if (strategy === MATCH_ORDERING_STRATEGY.STABLE_ID_ONLY) {
    return compareStableId(a.matchId, b.matchId);
  }
  if (strategy === MATCH_ORDERING_STRATEGY.STABLE_START_THEN_ID) {
    const startCmp = compareFiniteNumber(
      instantToEpochMs(a.scheduledStart),
      instantToEpochMs(b.scheduledStart)
    );
    if (startCmp !== 0) return startCmp;
    return compareStableId(a.matchId, b.matchId);
  }
  // STABLE_PRIORITY_THEN_ID — higher priority first, then matchId
  const prioCmp = compareFiniteNumber(
    Number(b.priority ?? 0),
    Number(a.priority ?? 0)
  );
  if (prioCmp !== 0) return prioCmp;
  return compareStableId(a.matchId, b.matchId);
}

/**
 * @param {object} a
 * @param {object} b
 * @param {string} strategy
 * @returns {number}
 */
export function compareCourts(a, b, strategy) {
  if (strategy === COURT_ORDERING_STRATEGY.STABLE_ID_ONLY) {
    return compareStableId(a.courtId, b.courtId);
  }
  // STABLE_PRIORITY_THEN_ID — higher priority first, then courtId
  const prioCmp = compareFiniteNumber(
    Number(b.priority ?? 0),
    Number(a.priority ?? 0)
  );
  if (prioCmp !== 0) return prioCmp;
  return compareStableId(a.courtId, b.courtId);
}

/**
 * Sort a copy; does not mutate input.
 * @template T
 * @param {readonly T[]} items
 * @param {(a: T, b: T) => number} cmp
 * @returns {T[]}
 */
export function stableSortCopy(items, cmp) {
  const out = Array.isArray(items) ? items.slice() : [];
  out.sort(cmp);
  return out;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareConflictIds(a, b) {
  return compareStableString(a, b);
}
