import { deepFreeze, deepFreezeClone } from "../domain/deepFreeze.js";
import { FINALIZATION_STATE } from "../domain/constants.js";
import { buildSeedingScopeKey } from "../domain/normalizeSeedingScope.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";

/**
 * Read-only authoritative projection for downstream draw consumers.
 * Does not regenerate seed numbers or fingerprints.
 *
 * @param {object} result
 * @returns {Readonly<object>}
 */
export function projectAuthoritativeSeedingResult(result) {
  if (!result || typeof result !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.DOWNSTREAM_PROJECTION_INVALID,
      "SeedingResult is required for projection"
    );
  }
  if (result.finalizationState !== FINALIZATION_STATE.FINALIZED) {
    const code =
      result.finalizationState == null
        ? SEEDING_ERROR_CODE.DOWNSTREAM_PROJECTION_INVALID
        : result.finalizationState === FINALIZATION_STATE.DRAFT ||
            result.finalizationState === FINALIZATION_STATE.SUPERSEDED ||
            result.finalizationState === FINALIZATION_STATE.CANCELLED
          ? SEEDING_ERROR_CODE.AUTHORITATIVE_RESULT_NOT_FINALIZED
          : SEEDING_ERROR_CODE.DOWNSTREAM_PROJECTION_INVALID;
    throwSeedingError(
      code,
      "Only FINALIZED authoritative results may be projected",
      { finalizationState: result.finalizationState }
    );
  }

  const assignments = Array.isArray(result.orderedAssignments)
    ? result.orderedAssignments.map((a) =>
        deepFreeze({
          entryId: a.entryId,
          seedNumber: a.seedNumber,
          assignmentSource: a.assignmentSource,
        })
      )
    : [];

  return deepFreeze({
    resultId: result.resultId,
    resultVersion: result.resultVersion,
    seedingScope: deepFreezeClone(result.scope),
    seedingScopeKey: buildSeedingScopeKey(result.scope),
    finalizationState: FINALIZATION_STATE.FINALIZED,
    assignments: deepFreeze(assignments),
    policyProvenance: deepFreezeClone(result.policyProvenance || {}),
    snapshotProvenance:
      result.snapshotProvenance == null
        ? null
        : deepFreezeClone(result.snapshotProvenance),
    fingerprint: result.deterministicFingerprint,
    finalizedAt: result.finalizedAt ?? null,
  });
}

/**
 * Map CORE-07 authoritative projection to a neutral seed-ranking list that a
 * CORE-08 consumer can accept as caller-supplied ranking.
 * Lives in integration boundary — does not import CORE-08.
 *
 * @param {Readonly<object>} projection
 * @returns {ReadonlyArray<{ entryId: string, seedNumber: number, rank: number }>}
 */
export function mapAuthoritativeProjectionToDrawSeedRanking(projection) {
  if (!projection || projection.finalizationState !== FINALIZATION_STATE.FINALIZED) {
    throwSeedingError(
      SEEDING_ERROR_CODE.DOWNSTREAM_PROJECTION_INVALID,
      "Draw seed ranking requires a FINALIZED authoritative projection"
    );
  }
  const rows = Array.isArray(projection.assignments)
    ? projection.assignments.slice()
    : [];
  rows.sort((a, b) => a.seedNumber - b.seedNumber);
  return deepFreeze(
    rows.map((a, index) =>
      deepFreeze({
        entryId: String(a.entryId),
        seedNumber: a.seedNumber,
        rank: index + 1,
      })
    )
  );
}
