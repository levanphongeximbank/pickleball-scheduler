import {
  MISSING_VALUE_BEHAVIOUR,
  PRIMARY_ORDERING_SOURCE,
  SORT_DIRECTION,
  TIE_BREAK_FIELD,
} from "../domain/constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import { deepFreeze } from "../domain/deepFreeze.js";

/**
 * @typedef {'number'|'string'|'timestamp'|'missing'} OrderingValueKind
 */

/**
 * @typedef {Object} OrderingTupleSlot
 * @property {string} field
 * @property {string} direction
 * @property {OrderingValueKind} kind
 * @property {unknown} value
 * @property {boolean} missing
 * @property {'epochMs'|'isoUtc'|null} [timestampForm]
 */

/**
 * Read an ordering-relevant field from a normalized candidate.
 *
 * @param {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate} candidate
 * @param {string} field
 * @returns {{ kind: OrderingValueKind, value: unknown, missing: boolean, timestampForm?: 'epochMs'|'isoUtc'|null }}
 */
export function readCandidateOrderingField(candidate, field) {
  if (field === TIE_BREAK_FIELD.STABLE_CANONICAL_ID) {
    return {
      kind: "string",
      value: candidate.stableCanonicalId,
      missing: false,
      timestampForm: null,
    };
  }

  if (field === PRIMARY_ORDERING_SOURCE.RANKING_POSITION) {
    const missing = candidate.rankingPosition == null;
    return {
      kind: missing ? "missing" : "number",
      value: missing ? null : candidate.rankingPosition,
      missing,
      timestampForm: null,
    };
  }

  if (field === PRIMARY_ORDERING_SOURCE.RANKING_SCORE) {
    const missing = candidate.rankingScore == null;
    return {
      kind: missing ? "missing" : "number",
      value: missing ? null : candidate.rankingScore,
      missing,
      timestampForm: null,
    };
  }

  if (field === PRIMARY_ORDERING_SOURCE.RATING_VALUE) {
    const missing = candidate.ratingValue == null;
    return {
      kind: missing ? "missing" : "number",
      value: missing ? null : candidate.ratingValue,
      missing,
      timestampForm: null,
    };
  }

  if (field === PRIMARY_ORDERING_SOURCE.REGISTRATION_TIMESTAMP) {
    const ts = candidate.registrationTimestamp;
    if (ts == null) {
      return {
        kind: "missing",
        value: null,
        missing: true,
        timestampForm: null,
      };
    }
    return {
      kind: "timestamp",
      value: ts.value,
      missing: false,
      timestampForm: ts.form,
    };
  }

  throwSeedingError(
    SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
    `Unsupported ordering field: ${field}`,
    { field }
  );
}

/**
 * Build the ordered comparison tuple for a candidate under a normalized policy.
 *
 * @param {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate} candidate
 * @param {import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy} policy
 * @returns {ReadonlyArray<OrderingTupleSlot>}
 */
export function buildCandidateOrderingTuple(candidate, policy) {
  if (!candidate || !policy) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "candidate and policy are required to build ordering tuple"
    );
  }

  /** @type {OrderingTupleSlot[]} */
  const slots = [];

  const primary = readCandidateOrderingField(
    candidate,
    policy.primaryOrderingSource
  );
  if (
    primary.missing &&
    policy.missingValueBehaviour === MISSING_VALUE_BEHAVIOUR.FAIL
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE,
      "Missing primary ordering value under FAIL missingValueBehaviour",
      {
        entryId: candidate.entryId,
        field: policy.primaryOrderingSource,
      }
    );
  }

  slots.push({
    field: policy.primaryOrderingSource,
    direction: policy.sortDirection,
    kind: primary.kind,
    value: primary.value,
    missing: primary.missing,
    timestampForm: primary.timestampForm ?? null,
  });

  for (let i = 0; i < policy.tieBreakSequence.length; i += 1) {
    const step = policy.tieBreakSequence[i];
    if (step.field === policy.primaryOrderingSource) {
      // Primary already applied; skip duplicate primary in tie-break list if present.
      continue;
    }
    const read = readCandidateOrderingField(candidate, step.field);
    if (
      read.missing &&
      step.field !== TIE_BREAK_FIELD.STABLE_CANONICAL_ID &&
      policy.missingValueBehaviour === MISSING_VALUE_BEHAVIOUR.FAIL
    ) {
      throwSeedingError(
        SEEDING_ERROR_CODE.SNAPSHOT_INCOMPLETE,
        "Missing tie-break value under FAIL missingValueBehaviour",
        { entryId: candidate.entryId, field: step.field }
      );
    }
    slots.push({
      field: step.field,
      direction: step.direction || SORT_DIRECTION.ASC,
      kind: read.kind,
      value: read.value,
      missing: read.missing,
      timestampForm: read.timestampForm ?? null,
    });
  }

  return deepFreeze(slots);
}
