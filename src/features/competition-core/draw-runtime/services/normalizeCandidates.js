/**
 * Phase 3H — normalize raw candidates into DrawCandidate[].
 */

import { createDrawCandidate } from "../contracts/drawCandidate.js";
import { CANDIDATE_TYPE } from "../enums/candidateTypes.js";

/**
 * @param {Array<Record<string, unknown>>} rawCandidates
 * @param {{
 *   competitionId?: string,
 *   contextId?: string,
 *   drawIdentityKey?: string,
 * }} [context]
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
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

    let manualPlacement = item.manualPlacement || null;
    if (!manualPlacement && (item.manualGroup != null || item.manualSlot != null)) {
      manualPlacement = {
        groupNumber: item.manualGroup ?? item.groupNumber ?? null,
        slotNumber: item.manualSlot ?? item.slotNumber ?? null,
        positionNumber: item.manualPosition ?? item.positionNumber ?? null,
      };
    }

    return createDrawCandidate({
      ...item,
      competitionId: context.competitionId,
      contextId: context.contextId,
      drawIdentityKey: context.drawIdentityKey,
      candidateType,
      candidateReference,
      candidateId: String(item.candidateId || candidateReference),
      seedNumber: item.seedNumber ?? item.seed ?? null,
      seedTier: item.seedTier ?? item.tier ?? item.pot ?? null,
      seedAssignmentReference:
        item.seedAssignmentReference ?? item.assignmentIdentityKey ?? null,
      protectedPlacement:
        item.protectedPlacement === true || item.locked === true,
      manualPlacement,
      eligible: item.eligible !== false && item.ineligible !== true,
      sourcePriority: item.sourcePriority ?? null,
    });
  });
}
