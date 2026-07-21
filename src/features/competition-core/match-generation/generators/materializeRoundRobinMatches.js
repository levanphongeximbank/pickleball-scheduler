/**
 * CORE-09 Phase 1C — build LogicalMatch rows from circle pairings.
 */

import {
  createLogicalMatch,
  createParticipantSlot,
  createByeParticipantSlot,
} from "../contracts/index.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";

/**
 * @typedef {object} MatchBuildContext
 * @property {string} competitionId
 * @property {string} divisionId
 * @property {string|null} categoryId
 * @property {string} stageId
 * @property {string|null} [groupId]
 * @property {number} roundNumberOffset 0-based offset added to circle roundIndex+1
 * @property {number} deterministicOrderStart
 * @property {1|2} legNumber
 */

/**
 * @param {import('./roundRobinCircle.js').CircleSlot} slot
 * @returns {import('../contracts/participantSlot.js').ParticipantSlot}
 */
function slotFromCircle(slot) {
  if (slot.isVirtualBye) {
    return createByeParticipantSlot({
      phase1c: Object.freeze({ virtualBye: true }),
    });
  }
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: slot.participantId,
    placementRef: slot.placementRef,
  });
}

/**
 * Materialize one leg of circle pairings into LogicalMatch objects.
 * Bye pairings become isByeMatch LogicalMatches (BYE slot contract) — never
 * invent a fake played participant.
 *
 * @param {ReadonlyArray<import('./roundRobinCircle.js').CircleRound>} circleRounds
 * @param {MatchBuildContext} ctx
 * @returns {{
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   nextDeterministicOrder: number,
 *   byeRecipientIds: string[],
 * }}
 */
export function materializeCircleLeg(circleRounds, ctx) {
  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  const logicalMatches = [];
  /** @type {string[]} */
  const byeRecipientIds = [];
  let deterministicOrder = ctx.deterministicOrderStart;

  for (const round of circleRounds) {
    const roundNumber = ctx.roundNumberOffset + round.roundIndex + 1;
    let matchNumber = 0;

    for (const pairing of round.pairings) {
      matchNumber += 1;
      const participantSlotA = slotFromCircle(pairing.slotA);
      const participantSlotB = slotFromCircle(pairing.slotB);

      /** @type {string[]} */
      const sourcePlacementRefs = [];
      if (
        pairing.slotA.placementRef &&
        pairing.slotA.isVirtualBye !== true
      ) {
        sourcePlacementRefs.push(pairing.slotA.placementRef);
      }
      if (
        pairing.slotB.placementRef &&
        pairing.slotB.isVirtualBye !== true
      ) {
        sourcePlacementRefs.push(pairing.slotB.placementRef);
      }

      if (pairing.isBye) {
        const recipient = pairing.slotA.isVirtualBye
          ? pairing.slotB
          : pairing.slotA;
        if (recipient?.participantId) {
          byeRecipientIds.push(recipient.participantId);
        }
      }

      logicalMatches.push(
        createLogicalMatch({
          competitionId: ctx.competitionId,
          divisionId: ctx.divisionId,
          categoryId: ctx.categoryId,
          stageId: ctx.stageId,
          groupId: ctx.groupId ?? null,
          roundNumber,
          matchNumber,
          deterministicOrder,
          participantSlotA,
          participantSlotB,
          isByeMatch: pairing.isBye === true,
          sourcePlacementRefs,
          metadata: {
            phase1c: Object.freeze({
              legNumber: ctx.legNumber,
              circleRoundIndex: round.roundIndex,
              isBye: pairing.isBye === true,
            }),
          },
        })
      );
      deterministicOrder += 1;
    }
  }

  return {
    logicalMatches,
    nextDeterministicOrder: deterministicOrder,
    byeRecipientIds,
  };
}

/**
 * Second leg: reverse A/B of every first-leg match; continue round numbers.
 *
 * @param {ReadonlyArray<import('../contracts/logicalMatch.js').LogicalMatch>} firstLegMatches
 * @param {MatchBuildContext} ctx Must set roundNumberOffset to first-leg round count.
 * @returns {{
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   nextDeterministicOrder: number,
 * }}
 */
export function materializeReversedSecondLeg(firstLegMatches, ctx) {
  /** @type {Map<number, import('../contracts/logicalMatch.js').LogicalMatch[]>} */
  const byRound = new Map();
  for (const m of firstLegMatches) {
    const list = byRound.get(m.roundNumber) || [];
    list.push(m);
    byRound.set(m.roundNumber, list);
  }

  const firstLegRoundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  const logicalMatches = [];
  let deterministicOrder = ctx.deterministicOrderStart;

  for (let i = 0; i < firstLegRoundNumbers.length; i += 1) {
    const sourceRound = firstLegRoundNumbers[i];
    const roundNumber = ctx.roundNumberOffset + i + 1;
    const sourceMatches = byRound.get(sourceRound) || [];
    // Preserve first-leg matchNumber order within the round.
    const ordered = [...sourceMatches].sort(
      (a, b) => a.matchNumber - b.matchNumber
    );

    for (const src of ordered) {
      logicalMatches.push(
        createLogicalMatch({
          competitionId: ctx.competitionId,
          divisionId: ctx.divisionId,
          categoryId: ctx.categoryId,
          stageId: ctx.stageId,
          groupId: ctx.groupId ?? src.groupId ?? null,
          roundNumber,
          matchNumber: src.matchNumber,
          deterministicOrder,
          participantSlotA: createParticipantSlot(src.participantSlotB),
          participantSlotB: createParticipantSlot(src.participantSlotA),
          isByeMatch: src.isByeMatch === true,
          sourcePlacementRefs: [...(src.sourcePlacementRefs || [])],
          metadata: {
            phase1c: Object.freeze({
              legNumber: 2,
              reversesLogicalMatchKey: src.logicalMatchKey,
              isBye: src.isByeMatch === true,
            }),
          },
        })
      );
      deterministicOrder += 1;
    }
  }

  return { logicalMatches, nextDeterministicOrder: deterministicOrder };
}
