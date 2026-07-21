import { deepFreeze } from "../domain/deepFreeze.js";
import {
  CORE07_COMPARISON_CONTRACT_VERSION,
  CORE07_SEEDING_CONTRACT_VERSION,
} from "../domain/constants.js";
import { buildCandidateOrderingTuple } from "./buildCandidateOrderingTuple.js";

/**
 * Build canonical result fingerprint payload (doc 10 §4.9).
 * Excludes generatedAt and non-ordering sourceMetadata.
 *
 * @param {{
 *   scope: import('../domain/normalizeSeedingScope.js').SeedingScope,
 *   policy: import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy,
 *   candidates: ReadonlyArray<import('../domain/normalizeSeedingCandidate.js').SeedingCandidate>,
 *   orderedAssignments: ReadonlyArray<import('../domain/createSeedAssignment.js').SeedAssignment>,
 *   acceptedOverrides: ReadonlyArray<{
 *     overrideId: string,
 *     entryId: string,
 *     action: string,
 *     requestedSeedNumber: number|null,
 *   }>,
 *   snapshotProvenance: Record<string, unknown>|null,
 *   deterministicContext?: Record<string, unknown>|null,
 * }} input
 * @returns {Readonly<Record<string, unknown>>}
 */
export function buildResultFingerprintPayload(input) {
  const orderedCandidates = input.candidates.slice().sort((a, b) => {
    if (a.stableCanonicalId === b.stableCanonicalId) return 0;
    return a.stableCanonicalId < b.stableCanonicalId ? -1 : 1;
  });

  const candidateRows = orderedCandidates.map((c) => {
    const tuple = buildCandidateOrderingTuple(c, input.policy);
    return {
      entryId: c.entryId,
      stableCanonicalId: c.stableCanonicalId,
      eligibilityStatus: c.eligibilityStatus,
      rankingPosition: c.rankingPosition,
      rankingScore: c.rankingScore,
      ratingValue: c.ratingValue,
      registrationTimestamp: c.registrationTimestamp,
      orderingTuple: tuple.map((slot) => ({
        field: slot.field,
        direction: slot.direction,
        missing: slot.missing,
        value: slot.value,
        timestampForm: slot.timestampForm,
      })),
    };
  });

  const assignments = input.orderedAssignments
    .slice()
    .sort((a, b) => a.seedNumber - b.seedNumber)
    .map((a) => ({
      entryId: a.entryId,
      seedNumber: a.seedNumber,
      assignmentSource: a.assignmentSource,
      orderedTieBreakValues: a.orderedTieBreakValues,
      reasonCodes: a.reasonCodes,
      overrideId: a.overrideId,
      deterministicOrdinal: a.deterministicOrdinal,
    }));

  const appliedOverrides = (input.acceptedOverrides || [])
    .slice()
    .sort((a, b) =>
      a.overrideId < b.overrideId ? -1 : a.overrideId > b.overrideId ? 1 : 0
    )
    .map((o) => ({
      overrideId: o.overrideId,
      entryId: o.entryId,
      action: o.action,
      requestedSeedNumber: o.requestedSeedNumber,
    }));

  return deepFreeze({
    contractVersion: CORE07_SEEDING_CONTRACT_VERSION,
    comparisonContractVersion: CORE07_COMPARISON_CONTRACT_VERSION,
    scope: input.scope,
    policy: {
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      primaryOrderingSource: input.policy.primaryOrderingSource,
      sortDirection: input.policy.sortDirection,
      missingValueBehaviour: input.policy.missingValueBehaviour,
      tieBreakSequence: input.policy.tieBreakSequence,
      seedNumberStart: input.policy.seedNumberStart,
      maximumSeededEntries: input.policy.maximumSeededEntries,
      manualOverrideMode: input.policy.manualOverrideMode,
    },
    snapshotProvenance: input.snapshotProvenance,
    deterministicContext: input.deterministicContext
      ? {
          comparisonContractVersion:
            input.deterministicContext.comparisonContractVersion ?? null,
          effectiveAt: input.deterministicContext.effectiveAt ?? null,
        }
      : null,
    candidates: candidateRows,
    appliedOverrides,
    orderedAssignments: assignments,
  });
}
