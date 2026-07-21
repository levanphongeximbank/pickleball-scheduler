import { deepFreeze } from "../domain/deepFreeze.js";
import {
  ASSIGNMENT_SOURCE,
  ELIGIBILITY_STATUS,
  OVERRIDE_ACTION,
} from "../domain/constants.js";
import { createSeedAssignment } from "../domain/createSeedAssignment.js";
import { buildCandidateOrderingTuple } from "./buildCandidateOrderingTuple.js";
import { orderCandidatesByDeterministicComparator } from "./createDeterministicCandidateComparator.js";
import {
  buildAssignmentFingerprintPayload,
  stringifyCanonicalJson,
} from "./buildAssignmentFingerprintPayload.js";
import { fingerprintCanonicalPayload } from "../ports/FingerprintPort.js";

/**
 * Allocate seed numbers after override reservation (doc 10 §5).
 *
 * @param {{
 *   candidates: ReadonlyArray<import('../domain/normalizeSeedingCandidate.js').SeedingCandidate>,
 *   policy: import('../policies/normalizeSeedingPolicy.js').NormalizedSeedingPolicy,
 *   acceptedReservations: ReadonlyArray<{
 *     override: import('../domain/normalizeManualSeedOverride.js').NormalizedManualSeedOverride,
 *     seedNumber: number,
 *     candidate: import('../domain/normalizeSeedingCandidate.js').SeedingCandidate,
 *   }>,
 *   reservedSeedNumbers: ReadonlySet<number>,
 *   reservedEntryIds: ReadonlySet<string>,
 *   snapshotId: string|null,
 *   fingerprintPort: import('../ports/FingerprintPort.js').FingerprintPort,
 * }} input
 * @returns {{
 *   orderedAssignments: ReadonlyArray<import('../domain/createSeedAssignment.js').SeedAssignment>,
 *   eligibleUnseededEntries: ReadonlyArray<Record<string, unknown>>,
 *   excludedEntries: ReadonlyArray<Record<string, unknown>>,
 * }}
 */
export function allocateSeedNumbers(input) {
  const {
    candidates,
    policy,
    acceptedReservations,
    reservedSeedNumbers,
    reservedEntryIds,
    snapshotId,
    fingerprintPort,
  } = input;

  /** @type {Record<string, unknown>[]} */
  const excluded = [];
  /** @type {import('../domain/normalizeSeedingCandidate.js').SeedingCandidate[]} */
  const eligible = [];

  for (const c of candidates) {
    if (c.eligibilityStatus === ELIGIBILITY_STATUS.INELIGIBLE) {
      excluded.push(
        deepFreeze({
          entryId: c.entryId,
          reasonCodes: deepFreeze(
            c.eligibilityReasonCodes.length
              ? c.eligibilityReasonCodes.slice()
              : ["ENTRY_INELIGIBLE"]
          ),
          eligibilityStatus: c.eligibilityStatus,
        })
      );
    } else if (c.eligibilityStatus === ELIGIBILITY_STATUS.UNKNOWN) {
      excluded.push(
        deepFreeze({
          entryId: c.entryId,
          reasonCodes: deepFreeze(["ELIGIBILITY_REQUIRED"]),
          eligibilityStatus: c.eligibilityStatus,
        })
      );
    } else {
      eligible.push(c);
    }
  }

  excluded.sort((a, b) =>
    String(a.entryId) < String(b.entryId)
      ? -1
      : String(a.entryId) > String(b.entryId)
        ? 1
        : 0
  );

  /** @type {import('../domain/createSeedAssignment.js').SeedAssignment[]} */
  const assignments = [];
  const reserved = new Set(reservedSeedNumbers);

  // Override assignments first (sorted by seed number for ordinal stability).
  const overrideSorted = acceptedReservations
    .slice()
    .sort((a, b) => a.seedNumber - b.seedNumber);

  for (let i = 0; i < overrideSorted.length; i += 1) {
    const item = overrideSorted[i];
    const source =
      item.override.action === OVERRIDE_ACTION.PROTECT
        ? ASSIGNMENT_SOURCE.PROTECTED
        : ASSIGNMENT_SOURCE.MANUAL_OVERRIDE;
    const tuple = buildCandidateOrderingTuple(item.candidate, policy);
    const draft = {
      entryId: item.candidate.entryId,
      seedNumber: item.seedNumber,
      assignmentSource: source,
      scoreValuesUsed: {
        rankingPosition: item.candidate.rankingPosition,
        rankingScore: item.candidate.rankingScore,
        ratingValue: item.candidate.ratingValue,
      },
      orderedTieBreakValues: tuple.map((s) => s.value),
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      snapshotId,
      overrideId: item.override.overrideId,
      reasonCodes: [],
      deterministicOrdinal: i,
      assignmentFingerprint: "",
    };
    const payload = buildAssignmentFingerprintPayload({
      ...draft,
      assignmentFingerprint: "",
    });
    const fp = fingerprintCanonicalPayload(
      fingerprintPort,
      stringifyCanonicalJson(payload)
    );
    assignments.push(
      createSeedAssignment({ ...draft, assignmentFingerprint: fp })
    );
  }

  const autoPool = eligible.filter((c) => !reservedEntryIds.has(c.entryId));
  const orderedAuto = orderCandidatesByDeterministicComparator(
    autoPool,
    policy
  );

  let next = policy.seedNumberStart;
  let totalAssigned = assignments.length;
  /** @type {Record<string, unknown>[]} */
  const unseeded = [];

  for (let i = 0; i < orderedAuto.length; i += 1) {
    if (
      policy.maximumSeededEntries != null &&
      totalAssigned >= policy.maximumSeededEntries
    ) {
      for (let j = i; j < orderedAuto.length; j += 1) {
        unseeded.push(
          deepFreeze({
            entryId: orderedAuto[j].entryId,
            reasonCodes: deepFreeze(["MAXIMUM_SEEDED_ENTRIES"]),
            eligibilityStatus: orderedAuto[j].eligibilityStatus,
          })
        );
      }
      break;
    }

    while (reserved.has(next)) {
      next += 1;
    }

    const candidate = orderedAuto[i];
    const tuple = buildCandidateOrderingTuple(candidate, policy);
    const ordinal = assignments.length;
    const draft = {
      entryId: candidate.entryId,
      seedNumber: next,
      assignmentSource: ASSIGNMENT_SOURCE.AUTO_ORDER,
      scoreValuesUsed: {
        rankingPosition: candidate.rankingPosition,
        rankingScore: candidate.rankingScore,
        ratingValue: candidate.ratingValue,
      },
      orderedTieBreakValues: tuple.map((s) => s.value),
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      snapshotId,
      overrideId: null,
      reasonCodes: [],
      deterministicOrdinal: ordinal,
      assignmentFingerprint: "",
    };
    const payload = buildAssignmentFingerprintPayload({
      ...draft,
      assignmentFingerprint: "",
    });
    const fp = fingerprintCanonicalPayload(
      fingerprintPort,
      stringifyCanonicalJson(payload)
    );
    assignments.push(
      createSeedAssignment({ ...draft, assignmentFingerprint: fp })
    );
    reserved.add(next);
    totalAssigned += 1;
    next += 1;
  }

  assignments.sort((a, b) => a.seedNumber - b.seedNumber);
  unseeded.sort((a, b) =>
    String(a.entryId) < String(b.entryId)
      ? -1
      : String(a.entryId) > String(b.entryId)
        ? 1
        : 0
  );

  return {
    orderedAssignments: deepFreeze(assignments),
    eligibleUnseededEntries: deepFreeze(unseeded),
    excludedEntries: deepFreeze(excluded),
  };
}
