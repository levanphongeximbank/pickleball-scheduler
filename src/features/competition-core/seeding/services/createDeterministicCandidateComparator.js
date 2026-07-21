import {
  MISSING_VALUE_BEHAVIOUR,
  SORT_DIRECTION,
  TIE_BREAK_FIELD,
  CORE07_COMPARISON_CONTRACT_VERSION,
} from "../domain/constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import {
  buildCandidateOrderingTuple,
  readCandidateOrderingField,
} from "./buildCandidateOrderingTuple.js";

/**
 * Compare two finite numbers (doc 10 §4.7).
 * @param {number} left
 * @param {number} right
 * @param {string} direction
 * @returns {number}
 */
function compareFiniteNumbers(left, right, direction) {
  if (left === right) return 0;
  if (direction === SORT_DIRECTION.DESC) {
    return left > right ? -1 : 1;
  }
  return left < right ? -1 : 1;
}

/**
 * UTF-16 code unit string compare — never localeCompare (doc 10 §4.7).
 * @param {string} left
 * @param {string} right
 * @param {string} direction
 * @returns {number}
 */
function compareStringsCodeUnit(left, right, direction) {
  if (left === right) return 0;
  if (direction === SORT_DIRECTION.DESC) {
    return left > right ? -1 : 1;
  }
  return left < right ? -1 : 1;
}

/**
 * @param {import('./buildCandidateOrderingTuple.js').OrderingTupleSlot} left
 * @param {import('./buildCandidateOrderingTuple.js').OrderingTupleSlot} right
 * @param {string} missingValueBehaviour
 * @returns {number}
 */
function compareTupleSlots(left, right, missingValueBehaviour) {
  if (left.field !== right.field) {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "Ordering tuple field mismatch during compare",
      { leftField: left.field, rightField: right.field }
    );
  }

  const bothMissing = left.missing && right.missing;
  if (bothMissing) {
    return 0;
  }

  if (left.missing !== right.missing) {
    if (missingValueBehaviour === MISSING_VALUE_BEHAVIOUR.FAIL) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE,
        "Missing value encountered under FAIL missingValueBehaviour",
        { field: left.field }
      );
    }
    // SORT_FIRST / EXCLUDE(as first-among-missing-side for ordering) / SORT_LAST
    const missingFirst =
      missingValueBehaviour === MISSING_VALUE_BEHAVIOUR.SORT_FIRST;
    if (left.missing) {
      return missingFirst ? -1 : 1;
    }
    return missingFirst ? 1 : -1;
  }

  if (left.kind === "timestamp" || right.kind === "timestamp") {
    if (left.timestampForm !== right.timestampForm) {
      throwSeedingError(
        SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
        "Mixed timestamp forms in the same ordering field",
        {
          field: left.field,
          leftForm: left.timestampForm,
          rightForm: right.timestampForm,
        }
      );
    }
    if (left.timestampForm === "epochMs") {
      return compareFiniteNumbers(
        /** @type {number} */ (left.value),
        /** @type {number} */ (right.value),
        left.direction
      );
    }
    return compareStringsCodeUnit(
      String(left.value),
      String(right.value),
      left.direction
    );
  }

  if (left.kind === "number" && right.kind === "number") {
    return compareFiniteNumbers(
      /** @type {number} */ (left.value),
      /** @type {number} */ (right.value),
      left.direction
    );
  }

  if (left.kind === "string" && right.kind === "string") {
    return compareStringsCodeUnit(
      String(left.value),
      String(right.value),
      left.direction
    );
  }

  throwSeedingError(
    SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
    "Incompatible ordering value kinds",
    { field: left.field, leftKind: left.kind, rightKind: right.kind }
  );
}

/**
 * Create a deterministic total-order comparator (`core07-compare-v1`).
 *
 * Reflexive: compare(A,A) === 0
 * Distinct validated candidates: non-zero after final stableCanonicalId
 *
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @returns {(left: import('../domain/normalizeSeedingCandidate.js').SeedingCandidate, right: import('../domain/normalizeSeedingCandidate.js').SeedingCandidate) => number}
 */
export function createDeterministicCandidateComparator(policy) {
  if (!policy || typeof policy !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "Normalized SeedingPolicy is required for comparator"
    );
  }

  const missingMode =
    policy.missingValueBehaviour || MISSING_VALUE_BEHAVIOUR.SORT_LAST;

  /**
   * @param {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate} left
   * @param {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate} right
   * @returns {number}
   */
  return function compareCandidates(left, right) {
    if (left === right) {
      return 0;
    }
    if (
      left &&
      right &&
      left.stableCanonicalId != null &&
      left.stableCanonicalId === right.stableCanonicalId &&
      left.entryId === right.entryId
    ) {
      return 0;
    }

    const leftTuple = buildCandidateOrderingTuple(left, policy);
    const rightTuple = buildCandidateOrderingTuple(right, policy);

    const len = Math.min(leftTuple.length, rightTuple.length);
    for (let i = 0; i < len; i += 1) {
      const cmp = compareTupleSlots(leftTuple[i], rightTuple[i], missingMode);
      if (cmp !== 0) {
        return cmp < 0 ? -1 : 1;
      }
    }

    // Mandatory final stableCanonicalId (defense in depth).
    const leftId = readCandidateOrderingField(
      left,
      TIE_BREAK_FIELD.STABLE_CANONICAL_ID
    );
    const rightId = readCandidateOrderingField(
      right,
      TIE_BREAK_FIELD.STABLE_CANONICAL_ID
    );
    const idCmp = compareStringsCodeUnit(
      String(leftId.value),
      String(rightId.value),
      SORT_DIRECTION.ASC
    );
    if (idCmp === 0) {
      // Distinct candidates with equal stableCanonicalId must have been rejected earlier.
      throwSeedingError(
        SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE,
        "Distinct candidates compared equal after stableCanonicalId; duplicates must fail before sort",
        {
          leftEntryId: left?.entryId,
          rightEntryId: right?.entryId,
          stableCanonicalId: leftId.value,
        }
      );
    }
    return idCmp < 0 ? -1 : 1;
  };
}

/**
 * Sort a validated candidate array without mutating the input.
 * Output order is independent of input permutation when all ordering fields are present.
 *
 * @param {ReadonlyArray<import('../domain/normalizeSeedingCandidate.js').SeedingCandidate>} candidates
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @returns {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate[]}
 */
export function orderCandidatesByDeterministicComparator(candidates, policy) {
  const compare = createDeterministicCandidateComparator(policy);
  return candidates.slice().sort(compare);
}

export { CORE07_COMPARISON_CONTRACT_VERSION };
