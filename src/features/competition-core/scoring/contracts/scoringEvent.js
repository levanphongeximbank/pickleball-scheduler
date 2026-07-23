/**
 * CORE-16 — scoring event + projection contracts.
 */

import {
  SCORING_EVENT_SCHEMA_V1,
  SCORING_PROJECTION_SCHEMA_V1,
} from "../constants/versions.js";
import { isScoringEventType } from "../enums/scoringEventTypes.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createScoringEvent(input) {
  const eventType = String(input?.eventType || "").trim();
  if (!isScoringEventType(eventType)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
      "Invalid scoring event type",
      { eventType }
    );
  }

  const eventId = String(input?.eventId || "").trim();
  if (!eventId) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
      "eventId is required",
      {}
    );
  }

  const sequence = Number(input?.sequence);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
      "sequence must be a positive integer",
      { sequence: input?.sequence }
    );
  }

  return Object.freeze({
    schemaVersion: SCORING_EVENT_SCHEMA_V1,
    eventId,
    eventType,
    sequence,
    revision: Number(input?.revision) || sequence,
    scoringSide: input?.scoringSide ?? null,
    occurredAt: input?.occurredAt ?? null,
    formatId: input?.formatId ?? null,
    formatVersion: input?.formatVersion ?? null,
    scoreBefore: input?.scoreBefore
      ? Object.freeze(JSON.parse(JSON.stringify(input.scoreBefore)))
      : null,
    scoreAfter: input?.scoreAfter
      ? Object.freeze(JSON.parse(JSON.stringify(input.scoreAfter)))
      : null,
    serveBefore: input?.serveBefore
      ? Object.freeze({ ...input.serveBefore })
      : null,
    serveAfter: input?.serveAfter
      ? Object.freeze({ ...input.serveAfter })
      : null,
    supersedesEventId: input?.supersedesEventId ?? null,
    supersededByEventId: input?.supersededByEventId ?? null,
    payload: Object.freeze(
      input?.payload && typeof input.payload === "object"
        ? JSON.parse(JSON.stringify(input.payload))
        : {}
    ),
  });
}

/**
 * Calculated projection for CORE-17 consumption — not a validated final result.
 *
 * @param {object} state
 * @returns {Readonly<object>}
 */
export function createScoringProjection(state) {
  return Object.freeze({
    schemaVersion: SCORING_PROJECTION_SCHEMA_V1,
    matchId: state.matchId,
    format: state.format,
    scoringState: state,
    points: state.points,
    completedGames: state.completedGames,
    completedSets: state.completedSets,
    currentGameIndex: state.currentGameIndex,
    currentSetIndex: state.currentSetIndex,
    gamesWonInCurrentSet: state.gamesWonInCurrentSet,
    setsWon: state.setsWon,
    serve: state.serve,
    calculatedMatchComplete: Boolean(state.matchComplete),
    calculatedWinnerSide: state.calculatedWinnerSide,
    revision: state.revision,
    events: state.events,
    correctionLineage: state.correctionLineage,
    /** Calculated scoring output only — not CORE-17 validation/acceptance. */
    projectionKind: "CALCULATED_SCORE_ONLY",
    validatedFinalResult: false,
    acceptedFinalResult: false,
    approvedFinalResult: false,
    certifiedFinalResult: false,
    officialFinalResult: false,
  });
}
