import { deepFreeze } from "./deepFreeze.js";
import { SEEDING_ERROR_CODE } from "../errors/seedingErrorCodes.js";
import { normalizeSeedingCandidate } from "./normalizeSeedingCandidate.js";
import { throwSeedingError } from "./normalizeHelpers.js";

/**
 * Normalize a candidate collection and reject duplicates fail-closed.
 * Does not depend on input array order for acceptance; does not silently dedupe.
 *
 * @param {unknown} rawCandidates
 * @param {{
 *   scopeEntryType?: string,
 *   scopeDivisionId?: string|null,
 *   scopeCategoryId?: string|null,
 * }} [context]
 * @returns {ReadonlyArray<import('./normalizeSeedingCandidate.js').SeedingCandidate>}
 */
export function normalizeSeedingCandidates(rawCandidates, context = {}) {
  if (!Array.isArray(rawCandidates)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "candidates must be an array",
      { field: "candidates" }
    );
  }

  /** @type {import('./normalizeSeedingCandidate.js').SeedingCandidate[]} */
  const normalized = [];
  /** @type {Map<string, number>} */
  const entryIds = new Map();
  /** @type {Map<string, number>} */
  const stableIds = new Map();

  for (let i = 0; i < rawCandidates.length; i += 1) {
    const candidate = normalizeSeedingCandidate(rawCandidates[i], context);

    if (entryIds.has(candidate.entryId)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE,
        "Duplicate entryId in candidate collection",
        {
          entryId: candidate.entryId,
          field: "entryId",
          firstIndex: entryIds.get(candidate.entryId),
          duplicateIndex: i,
        }
      );
    }
    if (stableIds.has(candidate.stableCanonicalId)) {
      throwSeedingError(
        SEEDING_ERROR_CODE.DUPLICATE_CANDIDATE,
        "Duplicate stableCanonicalId in candidate collection",
        {
          entryId: candidate.entryId,
          field: "stableCanonicalId",
          stableCanonicalId: candidate.stableCanonicalId,
          firstIndex: stableIds.get(candidate.stableCanonicalId),
          duplicateIndex: i,
        }
      );
    }

    entryIds.set(candidate.entryId, i);
    stableIds.set(candidate.stableCanonicalId, i);
    normalized.push(candidate);
  }

  return deepFreeze(normalized.slice());
}
