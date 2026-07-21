import { deepFreeze } from "./deepFreeze.js";
import {
  CORE07_SEEDING_CONTRACT_VERSION,
  FINALIZATION_STATE,
} from "./constants.js";
import {
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "./normalizeHelpers.js";

/**
 * @typedef {Object} SeedingResult
 * @property {string} contractVersion
 * @property {string} requestId
 * @property {string} resultId
 * @property {string|number} resultVersion
 * @property {import('./normalizeSeedingScope.js').SeedingScope} scope
 * @property {ReadonlyArray<import('./createSeedAssignment.js').SeedAssignment>} orderedAssignments
 * @property {ReadonlyArray<Record<string, unknown>>} eligibleUnseededEntries
 * @property {ReadonlyArray<Record<string, unknown>>} excludedEntries
 * @property {ReadonlyArray<Record<string, unknown>>} rejectedOverrides
 * @property {ReadonlyArray<Record<string, unknown>>} warnings
 * @property {ReadonlyArray<Record<string, unknown>>} acceptedClears
 * @property {Readonly<Record<string, unknown>>} policyProvenance
 * @property {Readonly<Record<string, unknown>>|null} snapshotProvenance
 * @property {Readonly<Record<string, unknown>>|null} deterministicContext
 * @property {string} deterministicFingerprint
 * @property {string|number} generatedAt
 * @property {string} finalizationState
 */

/**
 * Build an immutable DRAFT SeedingResult (doc 09). Phase 1D only emits DRAFT.
 *
 * @param {object} partial
 * @returns {Readonly<SeedingResult>}
 */
export function createSeedingResult(partial) {
  if (!partial || typeof partial !== "object") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingResult partial is required"
    );
  }

  const finalizationState =
    partial.finalizationState || FINALIZATION_STATE.DRAFT;
  if (finalizationState !== FINALIZATION_STATE.DRAFT) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "Phase 1D createSeedingResult only emits DRAFT",
      { finalizationState }
    );
  }

  if (partial.generatedAt == null || partial.generatedAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "generatedAt must be caller-supplied"
    );
  }

  const ordered = Array.isArray(partial.orderedAssignments)
    ? partial.orderedAssignments.slice().sort((a, b) => a.seedNumber - b.seedNumber)
    : [];

  return deepFreeze({
    contractVersion:
      partial.contractVersion || CORE07_SEEDING_CONTRACT_VERSION,
    requestId: String(partial.requestId || ""),
    resultId: String(partial.resultId),
    resultVersion: partial.resultVersion,
    scope: partial.scope,
    orderedAssignments: deepFreeze(ordered),
    eligibleUnseededEntries: deepFreeze(
      Array.isArray(partial.eligibleUnseededEntries)
        ? partial.eligibleUnseededEntries.slice()
        : []
    ),
    excludedEntries: deepFreeze(
      Array.isArray(partial.excludedEntries)
        ? partial.excludedEntries.slice()
        : []
    ),
    rejectedOverrides: deepFreeze(
      Array.isArray(partial.rejectedOverrides)
        ? partial.rejectedOverrides.slice()
        : []
    ),
    warnings: deepFreeze(
      Array.isArray(partial.warnings) ? partial.warnings.slice() : []
    ),
    acceptedClears: deepFreeze(
      Array.isArray(partial.acceptedClears) ? partial.acceptedClears.slice() : []
    ),
    policyProvenance: deepFreeze(
      partial.policyProvenance && typeof partial.policyProvenance === "object"
        ? { ...partial.policyProvenance }
        : {}
    ),
    snapshotProvenance:
      partial.snapshotProvenance == null
        ? null
        : deepFreeze({ ...partial.snapshotProvenance }),
    deterministicContext:
      partial.deterministicContext == null
        ? null
        : deepFreeze({ ...partial.deterministicContext }),
    deterministicFingerprint: String(partial.deterministicFingerprint || ""),
    generatedAt: partial.generatedAt,
    finalizationState: FINALIZATION_STATE.DRAFT,
  });
}
