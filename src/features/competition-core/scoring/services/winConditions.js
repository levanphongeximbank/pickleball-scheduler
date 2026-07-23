/**
 * CORE-16 — game / set / match win detection.
 *
 * Game-complete semantics intentionally mirror referee-v5 `checkGameComplete`
 * (pointsToWin + winBy + optional maximumScore cap) without importing the
 * product module into Competition Core.
 */

import { SCORING_SIDE } from "../enums/scoringSides.js";

/**
 * @param {{ SIDE_A: number, SIDE_B: number }} points
 * @param {{ pointsToWin: number, winBy: number, maximumScore: number|null }} format
 * @returns {{ complete: boolean, winnerSide: string|null }}
 */
export function evaluateGameComplete(points, format) {
  const scoreA = Number(points[SCORING_SIDE.SIDE_A]) || 0;
  const scoreB = Number(points[SCORING_SIDE.SIDE_B]) || 0;
  const pointsToWin = Number(format.pointsToWin) || 11;
  const winBy = Number(format.winBy) || 2;
  const maximumScore = format.maximumScore;

  const leader = Math.max(scoreA, scoreB);
  const trailer = Math.min(scoreA, scoreB);

  if (leader < pointsToWin) {
    return { complete: false, winnerSide: null };
  }

  let complete = false;
  if (maximumScore != null && leader >= maximumScore) {
    complete = true;
  } else {
    complete = leader - trailer >= winBy;
  }

  if (!complete || scoreA === scoreB) {
    return { complete: false, winnerSide: null };
  }

  return {
    complete: true,
    winnerSide:
      scoreA > scoreB ? SCORING_SIDE.SIDE_A : SCORING_SIDE.SIDE_B,
  };
}

/**
 * @param {{ SIDE_A: number, SIDE_B: number }} gamesWon
 * @param {{ gamesToWinSet: number }} format
 * @returns {{ complete: boolean, winnerSide: string|null }}
 */
export function evaluateSetComplete(gamesWon, format) {
  const a = Number(gamesWon[SCORING_SIDE.SIDE_A]) || 0;
  const b = Number(gamesWon[SCORING_SIDE.SIDE_B]) || 0;
  const need = Number(format.gamesToWinSet) || 1;
  if (a >= need && a > b) {
    return { complete: true, winnerSide: SCORING_SIDE.SIDE_A };
  }
  if (b >= need && b > a) {
    return { complete: true, winnerSide: SCORING_SIDE.SIDE_B };
  }
  return { complete: false, winnerSide: null };
}

/**
 * @param {{ SIDE_A: number, SIDE_B: number }} setsWon
 * @param {{ setsToWinMatch: number }} format
 * @returns {{ complete: boolean, winnerSide: string|null }}
 */
export function evaluateMatchComplete(setsWon, format) {
  const a = Number(setsWon[SCORING_SIDE.SIDE_A]) || 0;
  const b = Number(setsWon[SCORING_SIDE.SIDE_B]) || 0;
  const need = Number(format.setsToWinMatch) || 1;
  if (a >= need && a > b) {
    return { complete: true, winnerSide: SCORING_SIDE.SIDE_A };
  }
  if (b >= need && b > a) {
    return { complete: true, winnerSide: SCORING_SIDE.SIDE_B };
  }
  return { complete: false, winnerSide: null };
}
