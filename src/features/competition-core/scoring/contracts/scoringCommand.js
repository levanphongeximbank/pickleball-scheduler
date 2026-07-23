/**
 * CORE-16 — scoring command factories.
 */

import { SCORING_COMMAND_SCHEMA_V1 } from "../constants/versions.js";
import {
  SCORING_COMMAND_TYPE,
  isScoringCommandType,
} from "../enums/scoringCommandTypes.js";
import { isScoringSide } from "../enums/scoringSides.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createRecordPointCommand(input = {}) {
  const scoringSide = String(input.scoringSide || "").trim().toUpperCase();
  if (!isScoringSide(scoringSide)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_SIDE,
      "RECORD_POINT requires scoringSide SIDE_A or SIDE_B",
      { scoringSide: input.scoringSide }
    );
  }

  return Object.freeze({
    schemaVersion: SCORING_COMMAND_SCHEMA_V1,
    commandType: SCORING_COMMAND_TYPE.RECORD_POINT,
    scoringSide,
    lifecycleStatus: input.lifecycleStatus ?? null,
    match: input.match ?? null,
    clientEventId: input.clientEventId ?? null,
    occurredAt: input.occurredAt ?? null,
    metadata: Object.freeze(
      input.metadata && typeof input.metadata === "object"
        ? { ...input.metadata }
        : {}
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createSupersedeEventCommand(input = {}) {
  const targetEventId = String(input.targetEventId || "").trim();
  if (!targetEventId) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_CORRECTION_TARGET,
      "SUPERSEDE_EVENT requires targetEventId",
      {}
    );
  }

  let replacementScoringSide = null;
  if (input.replacementScoringSide != null) {
    replacementScoringSide = String(input.replacementScoringSide)
      .trim()
      .toUpperCase();
    if (!isScoringSide(replacementScoringSide)) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_SIDE,
        "replacementScoringSide must be SIDE_A or SIDE_B",
        { replacementScoringSide: input.replacementScoringSide }
      );
    }
  }

  return Object.freeze({
    schemaVersion: SCORING_COMMAND_SCHEMA_V1,
    commandType: SCORING_COMMAND_TYPE.SUPERSEDE_EVENT,
    targetEventId,
    replacementScoringSide,
    reason: input.reason ?? null,
    lifecycleStatus: input.lifecycleStatus ?? null,
    match: input.match ?? null,
    clientEventId: input.clientEventId ?? null,
    occurredAt: input.occurredAt ?? null,
    metadata: Object.freeze(
      input.metadata && typeof input.metadata === "object"
        ? { ...input.metadata }
        : {}
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createReplayProjectionCommand(input = {}) {
  return Object.freeze({
    schemaVersion: SCORING_COMMAND_SCHEMA_V1,
    commandType: SCORING_COMMAND_TYPE.REPLAY_PROJECTION,
    events: Object.freeze([...(input.events || [])]),
    format: input.format ?? null,
    matchId: input.matchId ?? null,
    metadata: Object.freeze(
      input.metadata && typeof input.metadata === "object"
        ? { ...input.metadata }
        : {}
    ),
  });
}

/**
 * @param {unknown} command
 */
export function assertScoringCommand(command) {
  if (!command || typeof command !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
      "Scoring command is required",
      {}
    );
  }
  if (!isScoringCommandType(command.commandType)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
      "Unknown scoring command type",
      { commandType: command.commandType }
    );
  }
}
