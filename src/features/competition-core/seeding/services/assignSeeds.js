/**
 * Phase 3G — assign seed numbers from ordered + manual candidates.
 * Partial manuals supported; duplicate manuals rejected upstream.
 */

import { createSeedAssignment } from "../contracts/seedAssignment.js";
import { ASSIGNMENT_REASON } from "../enums/assignmentReasons.js";
import { SEEDING_SOURCE_TYPE } from "../enums/seedingSourceTypes.js";
import { orderCandidatesDeterministically } from "./tieBreak.js";
import { validateManualSeeds } from "./validateCandidates.js";

/**
 * @param {import('../contracts/seedingCandidate.js').SeedingCandidate[]} eligible
 * @param {{
 *   seedingIdentityKey: string,
 *   competitionId: string,
 *   contextId: string,
 *   deterministicSeed?: unknown,
 *   policyCompare?: Function,
 * }} options
 * @returns {{
 *   assignments: import('../contracts/seedAssignment.js').SeedAssignment[],
 *   decisionTrace: string[],
 * }}
 */
export function assignSeeds(eligible = [], options) {
  validateManualSeeds(eligible);

  const manual = eligible.filter((c) => c.manualSeed != null);
  const automatic = eligible.filter((c) => c.manualSeed == null);

  const { ordered, traces } = orderCandidatesDeterministically(automatic, {
    deterministicSeed: options.deterministicSeed,
    policyCompare: options.policyCompare,
  });

  /** @type {Set<number>} */
  const reserved = new Set();
  for (const candidate of manual) {
    reserved.add(Number(candidate.manualSeed));
  }

  const n = eligible.length;
  /** @type {number[]} */
  const freeNumbers = [];
  for (let i = 1; i <= n; i += 1) {
    if (!reserved.has(i)) freeNumbers.push(i);
  }

  /** @type {import('../contracts/seedAssignment.js').SeedAssignment[]} */
  const assignments = [];
  /** @type {string[]} */
  const decisionTrace = [];

  for (const candidate of manual) {
    const seedNumber = Number(candidate.manualSeed);
    const reason = candidate.protectedSeed
      ? ASSIGNMENT_REASON.PROTECTED_SEED
      : ASSIGNMENT_REASON.MANUAL_LOCKED;
    const sourceType = candidate.protectedSeed
      ? SEEDING_SOURCE_TYPE.PROTECTED
      : SEEDING_SOURCE_TYPE.MANUAL;

    assignments.push(
      createSeedAssignment({
        seedingIdentityKey: options.seedingIdentityKey,
        competitionId: options.competitionId,
        contextId: options.contextId,
        candidateIdentityKey: candidate.candidateIdentityKey,
        seedNumber,
        sourceType,
        assignmentReason: reason,
        tieBreakTrace: [reason],
        deterministicSeed: options.deterministicSeed,
        metadata: {
          candidateReference: candidate.candidateReference,
          candidateType: candidate.candidateType,
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→#${seedNumber}(${reason})`
    );
  }

  let freeIndex = 0;
  for (const candidate of ordered) {
    const seedNumber = freeNumbers[freeIndex];
    freeIndex += 1;
    const tieTrace = traces.get(candidate.candidateIdentityKey) || [
      ASSIGNMENT_REASON.IDENTITY_ORDER,
    ];
    const primaryReason =
      manual.length > 0
        ? ASSIGNMENT_REASON.PARTIAL_AUTO_FILL
        : tieTrace[tieTrace.length - 1] || ASSIGNMENT_REASON.IDENTITY_ORDER;

    let sourceType = SEEDING_SOURCE_TYPE.IDENTITY;
    if (tieTrace.includes(ASSIGNMENT_REASON.RANKING_ORDER)) {
      sourceType = SEEDING_SOURCE_TYPE.RANKING;
    } else if (tieTrace.includes(ASSIGNMENT_REASON.RATING_ORDER)) {
      sourceType = SEEDING_SOURCE_TYPE.RATING;
    } else if (tieTrace.includes(ASSIGNMENT_REASON.SOURCE_PRIORITY)) {
      sourceType = SEEDING_SOURCE_TYPE.SOURCE_PRIORITY;
    } else if (tieTrace.includes(ASSIGNMENT_REASON.DETERMINISTIC_RANDOM)) {
      sourceType = SEEDING_SOURCE_TYPE.DETERMINISTIC_RANDOM;
    } else if (manual.length > 0) {
      sourceType = SEEDING_SOURCE_TYPE.COMPOSITE;
    }

    assignments.push(
      createSeedAssignment({
        seedingIdentityKey: options.seedingIdentityKey,
        competitionId: options.competitionId,
        contextId: options.contextId,
        candidateIdentityKey: candidate.candidateIdentityKey,
        seedNumber,
        sourceType,
        assignmentReason: primaryReason,
        tieBreakTrace: [...new Set(tieTrace)],
        deterministicSeed: options.deterministicSeed,
        metadata: {
          candidateReference: candidate.candidateReference,
          candidateType: candidate.candidateType,
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→#${seedNumber}(${primaryReason})`
    );
  }

  assignments.sort((a, b) => a.seedNumber - b.seedNumber);

  /** @type {Set<number>} */
  const seenSeeds = new Set();
  for (const assignment of assignments) {
    if (seenSeeds.has(assignment.seedNumber)) {
      // Should be unreachable after validateManualSeeds + free pool
      throw new Error("SEEDING_ASSIGNMENT_DUPLICATE_INTERNAL");
    }
    seenSeeds.add(assignment.seedNumber);
  }

  return { assignments, decisionTrace };
}
