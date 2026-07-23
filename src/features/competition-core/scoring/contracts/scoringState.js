/**
 * CORE-16 — immutable scoring state factory.
 */

import { SCORING_STATE_SCHEMA_V1 } from "../constants/versions.js";
import { SCORING_SIDE } from "../enums/scoringSides.js";
import { SCORING_SYSTEM } from "../enums/scoringSystems.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";
import { createScoringFormat } from "./scoringFormat.js";

/**
 * @param {unknown} value
 * @returns {any}
 */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createInitialScoringState(input = {}) {
  const format = createScoringFormat(input.format || {});
  const matchId = String(input.matchId || "").trim();
  if (!matchId) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_STATE,
      "matchId is required for scoring state",
      {}
    );
  }

  const trackServe =
    format.scoringSystem === SCORING_SYSTEM.SIDE_OUT ||
    input.trackServe === true;

  const state = {
    schemaVersion: SCORING_STATE_SCHEMA_V1,
    matchId,
    format,
    points: Object.freeze({
      [SCORING_SIDE.SIDE_A]: 0,
      [SCORING_SIDE.SIDE_B]: 0,
    }),
    completedGames: Object.freeze([]),
    completedSets: Object.freeze([]),
    currentGameIndex: 0,
    currentSetIndex: 0,
    gamesWonInCurrentSet: Object.freeze({
      [SCORING_SIDE.SIDE_A]: 0,
      [SCORING_SIDE.SIDE_B]: 0,
    }),
    setsWon: Object.freeze({
      [SCORING_SIDE.SIDE_A]: 0,
      [SCORING_SIDE.SIDE_B]: 0,
    }),
    serve: trackServe
      ? Object.freeze({
          servingSide: format.initialServingSide,
          serverNumber: 1,
        })
      : null,
    matchComplete: false,
    calculatedWinnerSide: null,
    revision: 0,
    events: Object.freeze([]),
    correctionLineage: Object.freeze([]),
    supersededEventIds: Object.freeze([]),
  };

  return freezeScoringState(state);
}

/**
 * @param {object} state
 * @returns {Readonly<object>}
 */
export function freezeScoringState(state) {
  return Object.freeze({
    ...state,
    format: state.format,
    points: Object.freeze({ ...state.points }),
    completedGames: Object.freeze(
      (state.completedGames || []).map((g) => Object.freeze({ ...g }))
    ),
    completedSets: Object.freeze(
      (state.completedSets || []).map((s) => Object.freeze({ ...s }))
    ),
    gamesWonInCurrentSet: Object.freeze({ ...state.gamesWonInCurrentSet }),
    setsWon: Object.freeze({ ...state.setsWon }),
    serve: state.serve ? Object.freeze({ ...state.serve }) : null,
    events: Object.freeze(
      (state.events || []).map((e) => Object.freeze(cloneJson(e)))
    ),
    correctionLineage: Object.freeze(
      (state.correctionLineage || []).map((c) => Object.freeze(cloneJson(c)))
    ),
    supersededEventIds: Object.freeze([...(state.supersededEventIds || [])]),
  });
}

/**
 * Mutable working copy for internal progression (never returned to callers).
 * @param {object} state
 * @returns {object}
 */
export function cloneScoringState(state) {
  if (!state || typeof state !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_STATE,
      "Scoring state is required",
      {}
    );
  }
  return cloneJson(state);
}

/**
 * @param {unknown} state
 */
export function assertScoringState(state) {
  if (!state || typeof state !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_STATE,
      "Scoring state is required",
      {}
    );
  }
  if (!state.matchId || !state.format) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_STATE,
      "Scoring state is missing matchId or format",
      {}
    );
  }
}
