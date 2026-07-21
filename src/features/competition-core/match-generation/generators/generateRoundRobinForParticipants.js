/**
 * CORE-09 Phase 1C — single / double round-robin generation for one participant set.
 */

import { generateCircleRoundRobinPairings } from "./roundRobinCircle.js";
import {
  materializeCircleLeg,
  materializeReversedSecondLeg,
} from "./materializeRoundRobinMatches.js";

/**
 * @param {object} args
 * @param {ReadonlyArray<{ participantId: string, placementRef: string }>} args.participants
 * @param {string} args.competitionId
 * @param {string} args.divisionId
 * @param {string|null} args.categoryId
 * @param {string} args.stageId
 * @param {string|null} [args.groupId]
 * @param {1|2} args.legs
 * @param {number} [args.deterministicOrderStart=1]
 * @returns {{
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   nextDeterministicOrder: number,
 *   leg1RoundCount: number,
 *   byeRecipientIdsByLeg: ReadonlyArray<ReadonlyArray<string>>,
 * }}
 */
export function generateRoundRobinForParticipants(args) {
  const circle = generateCircleRoundRobinPairings(args.participants);
  const leg1RoundCount = circle.length;

  const leg1 = materializeCircleLeg(circle, {
    competitionId: args.competitionId,
    divisionId: args.divisionId,
    categoryId: args.categoryId,
    stageId: args.stageId,
    groupId: args.groupId ?? null,
    roundNumberOffset: 0,
    deterministicOrderStart: args.deterministicOrderStart ?? 1,
    legNumber: 1,
  });

  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  let logicalMatches = [...leg1.logicalMatches];
  let nextDeterministicOrder = leg1.nextDeterministicOrder;
  /** @type {string[][]} */
  const byeRecipientIdsByLeg = [leg1.byeRecipientIds];

  if (args.legs === 2) {
    const leg2 = materializeReversedSecondLeg(leg1.logicalMatches, {
      competitionId: args.competitionId,
      divisionId: args.divisionId,
      categoryId: args.categoryId,
      stageId: args.stageId,
      groupId: args.groupId ?? null,
      roundNumberOffset: leg1RoundCount,
      deterministicOrderStart: nextDeterministicOrder,
      legNumber: 2,
    });
    logicalMatches = logicalMatches.concat(leg2.logicalMatches);
    nextDeterministicOrder = leg2.nextDeterministicOrder;

    /** @type {string[]} */
    const leg2Byes = [];
    for (const m of leg2.logicalMatches) {
      if (!m.isByeMatch) continue;
      const id =
        m.participantSlotA?.isBye !== true
          ? m.participantSlotA?.participantId
          : m.participantSlotB?.participantId;
      if (id) leg2Byes.push(id);
    }
    byeRecipientIdsByLeg.push(leg2Byes);
  }

  return {
    logicalMatches,
    nextDeterministicOrder,
    leg1RoundCount,
    byeRecipientIdsByLeg: Object.freeze(
      byeRecipientIdsByLeg.map((x) => Object.freeze([...x]))
    ),
  };
}
