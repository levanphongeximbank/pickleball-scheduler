/**
 * Phase 3G — SeedAssignment contract.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import {
  ASSIGNMENT_REASON,
  isAssignmentReason,
} from "../enums/assignmentReasons.js";
import {
  SEEDING_SOURCE_TYPE,
  isSeedingSourceType,
} from "../enums/seedingSourceTypes.js";
import {
  buildAssignmentIdentityKey,
  buildSeedingIdentityKey,
} from "./seedingIdentity.js";

/**
 * @typedef {Object} SeedAssignment
 * @property {string} assignmentId
 * @property {string} identityKey
 * @property {string} seedingIdentityKey
 * @property {string} candidateIdentityKey
 * @property {number} seedNumber
 * @property {string|null} [seedTier]
 * @property {string} sourceType
 * @property {string} assignmentReason
 * @property {string[]} [tieBreakTrace]
 * @property {unknown} [deterministicSeed]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<SeedAssignment> & {
 *   competitionId?: string,
 *   contextId?: string,
 * }} [partial]
 * @returns {SeedAssignment}
 */
export function createSeedAssignment(partial = {}) {
  const seedNumber = Number(partial.seedNumber);
  const seedingIdentityKey =
    isNonEmptyString(partial.seedingIdentityKey)
      ? String(partial.seedingIdentityKey).trim()
      : buildSeedingIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });

  const identityKey =
    isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : buildAssignmentIdentityKey({
          seedingIdentityKey,
          seedNumber,
        });

  const candidateIdentityKey = String(partial.candidateIdentityKey || "").trim();
  const assignmentId = String(partial.assignmentId || identityKey).trim();

  return {
    assignmentId,
    identityKey,
    seedingIdentityKey,
    candidateIdentityKey,
    seedNumber,
    seedTier: partial.seedTier != null ? String(partial.seedTier) : null,
    sourceType: isSeedingSourceType(partial.sourceType)
      ? partial.sourceType
      : SEEDING_SOURCE_TYPE.UNKNOWN,
    assignmentReason: isAssignmentReason(partial.assignmentReason)
      ? partial.assignmentReason
      : ASSIGNMENT_REASON.IDENTITY_ORDER,
    tieBreakTrace: Array.isArray(partial.tieBreakTrace)
      ? partial.tieBreakTrace.map((step) => String(step))
      : undefined,
    deterministicSeed:
      partial.deterministicSeed !== undefined
        ? partial.deterministicSeed
        : undefined,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}
