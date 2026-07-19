/**
 * Phase 3G — normalize raw candidates into SeedingCandidate[].
 */

import { createSeedingCandidate } from "../contracts/seedingCandidate.js";
import { CANDIDATE_TYPE } from "../enums/candidateTypes.js";

/**
 * @param {Array<Record<string, unknown>>} rawCandidates
 * @param {{
 *   competitionId?: string,
 *   contextId?: string,
 *   seedingIdentityKey?: string,
 * }} [context]
 * @returns {import('../contracts/seedingCandidate.js').SeedingCandidate[]}
 */
export function normalizeCandidates(rawCandidates = [], context = {}) {
  return (rawCandidates || []).map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw : {};
    let candidateType = item.candidateType;
    if (!candidateType) {
      if (item.teamReference != null || item.teamId != null) {
        candidateType = CANDIDATE_TYPE.TEAM;
      } else if (item.entryReference != null || item.entryId != null) {
        candidateType = CANDIDATE_TYPE.ENTRY;
      } else if (
        item.participantReference != null ||
        item.participantId != null ||
        item.playerId != null
      ) {
        candidateType = CANDIDATE_TYPE.PARTICIPANT;
      } else {
        candidateType = CANDIDATE_TYPE.UNKNOWN;
      }
    }

    const candidateReference = String(
      item.candidateReference ||
        item.entryId ||
        item.teamId ||
        item.participantId ||
        item.playerId ||
        item.id ||
        `candidate-${index + 1}`
    );

    return createSeedingCandidate({
      ...item,
      competitionId: context.competitionId,
      contextId: context.contextId,
      seedingIdentityKey: context.seedingIdentityKey,
      candidateType,
      candidateReference,
      candidateId: String(item.candidateId || candidateReference),
      entryReference:
        item.entryReference != null
          ? String(item.entryReference)
          : item.entryId != null
            ? String(item.entryId)
            : null,
      teamReference:
        item.teamReference != null
          ? String(item.teamReference)
          : item.teamId != null
            ? String(item.teamId)
            : null,
      participantReference:
        item.participantReference != null
          ? String(item.participantReference)
          : item.participantId != null
            ? String(item.participantId)
            : item.playerId != null
              ? String(item.playerId)
              : null,
      manualSeed:
        item.manualSeed != null
          ? item.manualSeed
          : item.seed != null && item.manualSeedOverride === true
            ? item.seed
            : item.manualSeedOverride != null
              ? item.manualSeedOverride
              : null,
      protectedSeed:
        item.protectedSeed === true || item.manualSeedOverride === true,
      rankingPosition:
        item.rankingPosition ?? item.rank ?? item.standingRank ?? null,
      ratingValue:
        item.ratingValue ??
        item.displayRating ??
        item.elo ??
        item.avgLevel ??
        item.rating ??
        item.level ??
        null,
      sourcePriority: item.sourcePriority ?? null,
      eligible: item.eligible !== false && item.ineligible !== true,
    });
  });
}
