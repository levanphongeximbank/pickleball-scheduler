/**
 * CORE-09 Phase 1D — winner/loser dependency graph for Single Elimination.
 */

import {
  createLogicalMatch,
  createParticipantSlot,
  createMatchDependency,
} from "../contracts/index.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";
import { MATCH_DEPENDENCY_TYPE } from "../enums/dependencyType.js";
import { priorChampionshipFeeders } from "./singleEliminationBracket.js";

/**
 * @param {string} sourceKey
 * @returns {import('../contracts/participantSlot.js').ParticipantSlot}
 */
function winnerOfSlot(sourceKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.WINNER_OF,
    sourceLogicalMatchKey: sourceKey,
    dependency: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
      logicalMatchKey: sourceKey,
    }),
  });
}

/**
 * @param {string} sourceKey
 * @returns {import('../contracts/participantSlot.js').ParticipantSlot}
 */
function loserOfSlot(sourceKey) {
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.LOSER_OF,
    sourceLogicalMatchKey: sourceKey,
    dependency: createMatchDependency({
      type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
      logicalMatchKey: sourceKey,
    }),
  });
}

/**
 * Build later-round championship matches and wire winnerTo / dependencyInputs.
 * Mutates opening matches in-place only through returned rebuilt list (immutable recreate).
 *
 * @param {object} args
 * @param {ReadonlyArray<import('../contracts/logicalMatch.js').LogicalMatch>} args.openingMatches
 * @param {number} args.bracketSize
 * @param {number} args.championshipRoundCount
 * @param {string} args.competitionId
 * @param {string} args.divisionId
 * @param {string|null} args.categoryId
 * @param {string} args.stageId
 * @param {string|null} args.bracketId
 * @param {number} args.deterministicOrderStart
 * @param {boolean} args.includeThirdPlace
 * @returns {{
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   finalKey: string,
 *   thirdPlaceKey: string|null,
 *   semifinalKeys: string[],
 * }}
 */
export function buildEliminationDependencyGraph(args) {
  const {
    openingMatches,
    championshipRoundCount,
    competitionId,
    divisionId,
    categoryId,
    stageId,
    bracketId,
    includeThirdPlace,
  } = args;

  /** @type {Map<string, import('../contracts/logicalMatch.js').LogicalMatch>} */
  const byCoord = new Map();
  const coordKey = (round, match) => `${round}:${match}`;

  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  let working = openingMatches.map((m) => m);
  for (const m of working) {
    byCoord.set(coordKey(m.roundNumber, m.matchNumber), m);
  }

  let deterministicOrder = args.deterministicOrderStart;

  for (let round = 2; round <= championshipRoundCount; round += 1) {
    const matchCount = args.bracketSize / 2 ** round;
    for (let matchNumber = 1; matchNumber <= matchCount; matchNumber += 1) {
      const [feedA, feedB] = priorChampionshipFeeders(matchNumber);
      const srcA = byCoord.get(coordKey(round - 1, feedA));
      const srcB = byCoord.get(coordKey(round - 1, feedB));
      if (!srcA || !srcB) {
        throw new Error(
          `BRACKET_INVARIANT_VIOLATION: missing feeder for R${round}M${matchNumber}`
        );
      }

      const isFinal =
        round === championshipRoundCount && matchNumber === 1;
      const match = createLogicalMatch({
        competitionId,
        divisionId,
        categoryId,
        stageId,
        groupId: null,
        bracketId,
        roundNumber: round,
        matchNumber,
        deterministicOrder,
        participantSlotA: winnerOfSlot(srcA.logicalMatchKey),
        participantSlotB: winnerOfSlot(srcB.logicalMatchKey),
        isByeMatch: false,
        sourcePlacementRefs: [],
        dependencyInputs: [
          createMatchDependency({
            type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
            logicalMatchKey: srcA.logicalMatchKey,
          }),
          createMatchDependency({
            type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
            logicalMatchKey: srcB.logicalMatchKey,
          }),
        ],
        winnerTo: null,
        loserTo: null,
        metadata: {
          phase1d: Object.freeze({
            role: isFinal ? "FINAL" : "CHAMPIONSHIP",
          }),
        },
      });
      working.push(match);
      byCoord.set(coordKey(round, matchNumber), match);
      deterministicOrder += 1;
    }
  }

  // Wire winnerTo from each non-final championship match to its parent.
  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  const withWinnerLinks = working.map((m) => {
    if (m.roundNumber >= championshipRoundCount) {
      return m;
    }
    const parentRound = m.roundNumber + 1;
    const parentMatchNumber = Math.ceil(m.matchNumber / 2);
    const parent = byCoord.get(coordKey(parentRound, parentMatchNumber));
    if (!parent) return m;
    const linked = createLogicalMatch({
      ...m,
      winnerTo: createMatchDependency({
        type: MATCH_DEPENDENCY_TYPE.WINNER_OF,
        logicalMatchKey: parent.logicalMatchKey,
      }),
      metadata: m.metadata,
    });
    byCoord.set(coordKey(m.roundNumber, m.matchNumber), linked);
    return linked;
  });
  working = withWinnerLinks;

  const finalMatch = byCoord.get(coordKey(championshipRoundCount, 1));
  if (!finalMatch) {
    throw new Error("BRACKET_INVARIANT_VIOLATION: missing championship final");
  }

  /** @type {string[]} */
  const semifinalKeys = [];
  /** @type {string|null} */
  let thirdPlaceKey = null;

  if (includeThirdPlace && championshipRoundCount >= 2) {
    const sf1 = byCoord.get(coordKey(championshipRoundCount - 1, 1));
    const sf2 = byCoord.get(coordKey(championshipRoundCount - 1, 2));
    if (!sf1 || !sf2) {
      throw new Error("BRACKET_INVARIANT_VIOLATION: missing semifinals for third place");
    }
    semifinalKeys.push(sf1.logicalMatchKey, sf2.logicalMatchKey);

    const thirdPlace = createLogicalMatch({
      competitionId,
      divisionId,
      categoryId,
      stageId,
      groupId: null,
      bracketId,
      roundNumber: championshipRoundCount,
      matchNumber: 2,
      deterministicOrder,
      participantSlotA: loserOfSlot(sf1.logicalMatchKey),
      participantSlotB: loserOfSlot(sf2.logicalMatchKey),
      isByeMatch: false,
      sourcePlacementRefs: [],
      dependencyInputs: [
        createMatchDependency({
          type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
          logicalMatchKey: sf1.logicalMatchKey,
        }),
        createMatchDependency({
          type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
          logicalMatchKey: sf2.logicalMatchKey,
        }),
      ],
      winnerTo: null,
      loserTo: null,
      metadata: {
        phase1d: Object.freeze({ role: "THIRD_PLACE" }),
      },
    });
    thirdPlaceKey = thirdPlace.logicalMatchKey;

    // Attach loserTo on semifinals and append third-place match.
    /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
    const withLoserLinks = [];
    for (const m of working) {
      if (
        m.logicalMatchKey === sf1.logicalMatchKey ||
        m.logicalMatchKey === sf2.logicalMatchKey
      ) {
        const linked = createLogicalMatch({
          ...m,
          loserTo: createMatchDependency({
            type: MATCH_DEPENDENCY_TYPE.LOSER_OF,
            logicalMatchKey: thirdPlace.logicalMatchKey,
          }),
          metadata: m.metadata,
        });
        byCoord.set(coordKey(m.roundNumber, m.matchNumber), linked);
        withLoserLinks.push(linked);
      } else {
        withLoserLinks.push(m);
      }
    }
    withLoserLinks.push(thirdPlace);
    working = withLoserLinks;
  }

  return {
    logicalMatches: working,
    finalKey: finalMatch.logicalMatchKey,
    thirdPlaceKey,
    semifinalKeys,
  };
}
