/**
 * CORE-16 adapter — documents semantic reuse of referee-v5 game-complete kernel.
 * Competition Core does not import referee-v5 (product module). Logic is owned
 * locally in winConditions.js with intentional parity.
 */

import { evaluateGameComplete } from "../services/winConditions.js";
import { SCORING_SIDE } from "../enums/scoringSides.js";

/**
 * Adapter shape compatible with referee-v5 checkGameComplete inputs.
 *
 * @param {{ teams?: { teamA?: { score?: number }, teamB?: { score?: number } }, pointsToWin?: number, winBy?: number, maximumScore?: number|null }} state
 * @param {{ pointsToWin?: number, winBy?: number, maximumScore?: number|null }} [config]
 * @returns {boolean}
 */
export function adaptRefereeV5CheckGameComplete(state, config = {}) {
  const points = {
    [SCORING_SIDE.SIDE_A]: Number(state?.teams?.teamA?.score) || 0,
    [SCORING_SIDE.SIDE_B]: Number(state?.teams?.teamB?.score) || 0,
  };
  const format = {
    pointsToWin: config.pointsToWin ?? state?.pointsToWin ?? 11,
    winBy: config.winBy ?? state?.winBy ?? 2,
    maximumScore:
      config.maximumScore !== undefined
        ? config.maximumScore
        : state?.maximumScore ?? null,
  };
  return evaluateGameComplete(points, format).complete;
}

export const REFEREE_V5_WIN_CONDITION_SOURCE =
  "src/features/referee-v5/engines/sideOutScoringEngine.js#checkGameComplete";
