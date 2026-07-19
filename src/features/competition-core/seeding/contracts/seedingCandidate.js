/**
 * Phase 3G — SeedingCandidate contract.
 * Ranking / rating values are immutable snapshots or opaque references.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import { CANDIDATE_TYPE, isCandidateType } from "../enums/candidateTypes.js";
import {
  buildCandidateIdentityKey,
  buildSeedingIdentityKey,
} from "./seedingIdentity.js";

/**
 * @typedef {Object} SeedingCandidate
 * @property {string} candidateId
 * @property {string} candidateIdentityKey
 * @property {string} candidateType
 * @property {string} candidateReference
 * @property {string|null} [participantReference]
 * @property {string|null} [teamReference]
 * @property {string|null} [entryReference]
 * @property {string|null} [registrationReference]
 * @property {string|null} [rankingReference]
 * @property {string|null} [ratingReference]
 * @property {number|null} [rankingPosition]
 * @property {number|null} [ratingValue]
 * @property {number|null} [manualSeed]
 * @property {boolean} [protectedSeed]
 * @property {boolean} [eligible]
 * @property {number|null} [sourcePriority]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<SeedingCandidate> & {
 *   competitionId?: string,
 *   contextId?: string,
 *   seedingIdentityKey?: string,
 * }} [partial]
 * @returns {SeedingCandidate}
 */
export function createSeedingCandidate(partial = {}) {
  const candidateReference = String(
    partial.candidateReference ||
      partial.entryReference ||
      partial.teamReference ||
      partial.participantReference ||
      partial.candidateId ||
      ""
  ).trim();

  const candidateId = String(partial.candidateId || candidateReference || "").trim();

  const seedingIdentityKey =
    isNonEmptyString(partial.seedingIdentityKey)
      ? String(partial.seedingIdentityKey).trim()
      : buildSeedingIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });

  const candidateType = isCandidateType(partial.candidateType)
    ? partial.candidateType
    : CANDIDATE_TYPE.UNKNOWN;

  const rankingPosition =
    partial.rankingPosition != null && Number.isFinite(Number(partial.rankingPosition))
      ? Number(partial.rankingPosition)
      : null;

  const ratingValue =
    partial.ratingValue != null && Number.isFinite(Number(partial.ratingValue))
      ? Number(partial.ratingValue)
      : null;

  const manualSeed =
    partial.manualSeed != null && Number.isFinite(Number(partial.manualSeed))
      ? Number(partial.manualSeed)
      : null;

  const sourcePriority =
    partial.sourcePriority != null && Number.isFinite(Number(partial.sourcePriority))
      ? Number(partial.sourcePriority)
      : null;

  const candidateIdentityKey =
    isNonEmptyString(partial.candidateIdentityKey)
      ? String(partial.candidateIdentityKey).trim()
      : buildCandidateIdentityKey({
          seedingIdentityKey,
          candidateReference,
        });

  return {
    candidateId,
    candidateIdentityKey,
    candidateType,
    candidateReference,
    participantReference:
      partial.participantReference != null
        ? String(partial.participantReference)
        : null,
    teamReference:
      partial.teamReference != null ? String(partial.teamReference) : null,
    entryReference:
      partial.entryReference != null ? String(partial.entryReference) : null,
    registrationReference:
      partial.registrationReference != null
        ? String(partial.registrationReference)
        : null,
    rankingReference:
      partial.rankingReference != null
        ? String(partial.rankingReference)
        : null,
    ratingReference:
      partial.ratingReference != null ? String(partial.ratingReference) : null,
    rankingPosition,
    ratingValue,
    manualSeed,
    protectedSeed: partial.protectedSeed === true,
    eligible: partial.eligible !== false,
    sourcePriority,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}
