/**
 * CORE-16 — pure point progression (rally / side-out) + game/set/match rollup.
 */

import { SCORING_SIDE, oppositeScoringSide } from "../enums/scoringSides.js";
import { SCORING_SYSTEM } from "../enums/scoringSystems.js";
import { SCORING_EVENT_TYPE } from "../enums/scoringEventTypes.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";
import {
  evaluateGameComplete,
  evaluateSetComplete,
  evaluateMatchComplete,
} from "./winConditions.js";

/**
 * @param {object} draft mutable working state
 * @param {string} rallyWinnerSide
 * @returns {{ awardedPoint: boolean, domainHints: string[] }}
 */
export function applyRallyOrSideOutPoint(draft, rallyWinnerSide) {
  const format = draft.format;
  const hints = [];

  if (format.scoringSystem === SCORING_SYSTEM.RALLY) {
    draft.points[rallyWinnerSide] += 1;
    hints.push(SCORING_EVENT_TYPE.POINT_RECORDED);

    if (draft.serve) {
      const prev = draft.serve.servingSide;
      draft.serve = {
        servingSide: rallyWinnerSide,
        serverNumber: 1,
      };
      if (prev !== rallyWinnerSide) {
        hints.push(SCORING_EVENT_TYPE.SERVE_CHANGED);
      }
    }

    const sideSwitchAt = format.sideSwitchAt;
    if (sideSwitchAt != null) {
      const total =
        draft.points[SCORING_SIDE.SIDE_A] + draft.points[SCORING_SIDE.SIDE_B];
      if (total === sideSwitchAt) {
        hints.push("ENDS_SWITCH_MILESTONE");
      }
    }

    return { awardedPoint: true, domainHints: hints };
  }

  // SIDE_OUT
  if (!draft.serve) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_PROGRESSION,
      "Side-out scoring requires serve state",
      {}
    );
  }

  if (rallyWinnerSide === draft.serve.servingSide) {
    draft.points[rallyWinnerSide] += 1;
    hints.push(SCORING_EVENT_TYPE.POINT_RECORDED);
    return { awardedPoint: true, domainHints: hints };
  }

  // Receiving side won the rally — no point
  hints.push(SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE);
  if (draft.serve.serverNumber < format.serversPerSide) {
    draft.serve = {
      servingSide: draft.serve.servingSide,
      serverNumber: draft.serve.serverNumber + 1,
    };
    hints.push(SCORING_EVENT_TYPE.SERVER_NUMBER_CHANGED);
    return { awardedPoint: false, domainHints: hints };
  }

  draft.serve = {
    servingSide: rallyWinnerSide,
    serverNumber: 1,
  };
  hints.push(SCORING_EVENT_TYPE.SERVE_CHANGED);
  return { awardedPoint: false, domainHints: hints };
}

/**
 * After a point may have been awarded, roll up game/set/match if complete.
 * @param {object} draft
 * @returns {string[]} domain event type hints
 */
export function rollupCompletedUnits(draft) {
  const hints = [];
  if (draft.matchComplete) {
    return hints;
  }

  const game = evaluateGameComplete(draft.points, draft.format);
  if (!game.complete || !game.winnerSide) {
    return hints;
  }

  hints.push(SCORING_EVENT_TYPE.GAME_COMPLETED);
  draft.completedGames.push({
    setIndex: draft.currentSetIndex,
    gameIndex: draft.currentGameIndex,
    [SCORING_SIDE.SIDE_A]: draft.points[SCORING_SIDE.SIDE_A],
    [SCORING_SIDE.SIDE_B]: draft.points[SCORING_SIDE.SIDE_B],
    winnerSide: game.winnerSide,
  });
  draft.gamesWonInCurrentSet[game.winnerSide] += 1;
  draft.points = {
    [SCORING_SIDE.SIDE_A]: 0,
    [SCORING_SIDE.SIDE_B]: 0,
  };
  draft.currentGameIndex += 1;

  if (draft.serve) {
    // Winner of game typically serves next — deterministic CORE-16 policy.
    draft.serve = {
      servingSide: game.winnerSide,
      serverNumber: 1,
    };
    hints.push(SCORING_EVENT_TYPE.SERVE_CHANGED);
  }

  const set = evaluateSetComplete(draft.gamesWonInCurrentSet, draft.format);
  if (!set.complete || !set.winnerSide) {
    return hints;
  }

  hints.push(SCORING_EVENT_TYPE.SET_COMPLETED);
  draft.completedSets.push({
    setIndex: draft.currentSetIndex,
    [SCORING_SIDE.SIDE_A]: draft.gamesWonInCurrentSet[SCORING_SIDE.SIDE_A],
    [SCORING_SIDE.SIDE_B]: draft.gamesWonInCurrentSet[SCORING_SIDE.SIDE_B],
    winnerSide: set.winnerSide,
  });
  draft.setsWon[set.winnerSide] += 1;
  draft.gamesWonInCurrentSet = {
    [SCORING_SIDE.SIDE_A]: 0,
    [SCORING_SIDE.SIDE_B]: 0,
  };
  draft.currentSetIndex += 1;
  draft.currentGameIndex = 0;

  const match = evaluateMatchComplete(draft.setsWon, draft.format);
  if (match.complete && match.winnerSide) {
    hints.push(SCORING_EVENT_TYPE.MATCH_COMPLETED);
    draft.matchComplete = true;
    draft.calculatedWinnerSide = match.winnerSide;
  }

  return hints;
}

/**
 * Snapshot score/serve for event payloads.
 * @param {object} draft
 */
export function captureScoreSnapshot(draft) {
  return {
    points: { ...draft.points },
    gamesWonInCurrentSet: { ...draft.gamesWonInCurrentSet },
    setsWon: { ...draft.setsWon },
    currentGameIndex: draft.currentGameIndex,
    currentSetIndex: draft.currentSetIndex,
    matchComplete: draft.matchComplete,
    calculatedWinnerSide: draft.calculatedWinnerSide,
  };
}

export { oppositeScoringSide };
