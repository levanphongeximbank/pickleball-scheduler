import { deepFreeze } from "../domain/deepFreeze.js";
import {
  DEFAULT_FIELD_SORT_DIRECTION,
  SORT_DIRECTION,
  SORT_DIRECTION_VALUES,
  TIE_BREAK_FIELD,
  TIE_BREAK_FIELD_VALUES,
} from "../domain/constants.js";
import {
  normalizeOpaqueId,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";

/**
 * @typedef {Object} NormalizedTieBreakStep
 * @property {string} field
 * @property {string} direction
 */

/**
 * Normalize an ordered tie-break sequence.
 * Ensures `stableCanonicalId` is the mandatory final step (doc 10 §4.6).
 *
 * @param {unknown} rawSequence
 * @returns {ReadonlyArray<NormalizedTieBreakStep>}
 */
export function normalizeTieBreakSequence(rawSequence) {
  if (rawSequence == null) {
    return deepFreeze([
      {
        field: TIE_BREAK_FIELD.STABLE_CANONICAL_ID,
        direction: SORT_DIRECTION.ASC,
      },
    ]);
  }

  if (!Array.isArray(rawSequence)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
      "tieBreakSequence must be an array",
      { field: "tieBreakSequence" }
    );
  }

  /** @type {NormalizedTieBreakStep[]} */
  const steps = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (let i = 0; i < rawSequence.length; i += 1) {
    const raw = rawSequence[i];
    let field;
    let direction;

    if (typeof raw === "string") {
      field = normalizeOpaqueId(raw);
      direction = null;
    } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const obj = /** @type {Record<string, unknown>} */ (raw);
      field = normalizeOpaqueId(obj.field ?? obj.key ?? obj.name);
      direction =
        obj.direction == null || obj.direction === ""
          ? null
          : normalizeOpaqueId(obj.direction);
    } else {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
        "tie-break entry must be a field string or { field, direction?}",
        { index: i, value: raw }
      );
    }

    if (!field || !TIE_BREAK_FIELD_VALUES.has(field)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
        "Unknown or illegal tie-break field",
        { index: i, field, value: raw }
      );
    }

    if (seen.has(field)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
        "Duplicate tie-break field in sequence",
        { index: i, field }
      );
    }
    seen.add(field);

    if (direction != null && !SORT_DIRECTION_VALUES.has(direction)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
        "Invalid tie-break direction",
        { index: i, field, direction }
      );
    }

    const resolvedDirection =
      direction ||
      DEFAULT_FIELD_SORT_DIRECTION[field] ||
      SORT_DIRECTION.ASC;

    steps.push({ field, direction: resolvedDirection });
  }

  const last = steps[steps.length - 1];
  if (!last || last.field !== TIE_BREAK_FIELD.STABLE_CANONICAL_ID) {
    if (seen.has(TIE_BREAK_FIELD.STABLE_CANONICAL_ID)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.INVALID_TIE_BREAK,
        "stableCanonicalId must be the final tie-break step",
        { field: TIE_BREAK_FIELD.STABLE_CANONICAL_ID }
      );
    }
    steps.push({
      field: TIE_BREAK_FIELD.STABLE_CANONICAL_ID,
      direction: SORT_DIRECTION.ASC,
    });
  }

  return deepFreeze(steps.slice());
}
