/**
 * CORE-16 — deterministic serializable scoring format contract.
 */

import { SCORING_FORMAT_SCHEMA_V1 } from "../constants/versions.js";
import { SCORING_SYSTEM, isScoringSystem } from "../enums/scoringSystems.js";
import { SCORING_SIDE, isScoringSide } from "../enums/scoringSides.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";

/**
 * @typedef {Object} ScoringFormat
 * @property {string} schemaVersion
 * @property {string} formatId
 * @property {string} formatVersion
 * @property {string} scoringSystem
 * @property {number} pointsToWin
 * @property {number} winBy
 * @property {number|null} maximumScore
 * @property {number} bestOfGames
 * @property {number} gamesToWinSet
 * @property {number} bestOfSets
 * @property {number} setsToWinMatch
 * @property {number|null} sideSwitchAt
 * @property {number} serversPerSide
 * @property {string} initialServingSide
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
function requirePositiveInt(value, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      `Scoring format field ${field} must be a positive integer`,
      { field, value }
    );
  }
  return n;
}

/**
 * @param {unknown} bestOf
 * @param {string} field
 * @returns {number}
 */
function requireOddBestOf(bestOf, field) {
  const n = requirePositiveInt(bestOf, field);
  if (n % 2 === 0) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      `Scoring format field ${field} must be an odd best-of value`,
      { field, value: n }
    );
  }
  return n;
}

/**
 * Create an immutable scoring format.
 * Defaults mirror common pickleball / referee-v5 side-out (11, win-by 2).
 *
 * @param {Partial<ScoringFormat> & { formatId?: string }} [input]
 * @returns {Readonly<ScoringFormat>}
 */
export function createScoringFormat(input = {}) {
  const scoringSystem = String(
    input.scoringSystem || SCORING_SYSTEM.SIDE_OUT
  ).trim().toUpperCase();
  if (!isScoringSystem(scoringSystem)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "Unknown scoring system",
      { scoringSystem }
    );
  }

  const pointsToWin = requirePositiveInt(
    input.pointsToWin ?? (scoringSystem === SCORING_SYSTEM.RALLY ? 21 : 11),
    "pointsToWin"
  );
  const winBy = requirePositiveInt(input.winBy ?? 2, "winBy");

  let maximumScore = null;
  if (input.maximumScore != null && input.maximumScore !== "") {
    maximumScore = requirePositiveInt(input.maximumScore, "maximumScore");
    if (maximumScore < pointsToWin) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
        "maximumScore must be >= pointsToWin",
        { maximumScore, pointsToWin }
      );
    }
  }

  const bestOfGames = requireOddBestOf(input.bestOfGames ?? 1, "bestOfGames");
  const gamesToWinSet = Math.ceil(bestOfGames / 2);
  const bestOfSets = requireOddBestOf(input.bestOfSets ?? 1, "bestOfSets");
  const setsToWinMatch = Math.ceil(bestOfSets / 2);

  let sideSwitchAt = null;
  if (input.sideSwitchAt != null && input.sideSwitchAt !== "") {
    sideSwitchAt = requirePositiveInt(input.sideSwitchAt, "sideSwitchAt");
  } else if (scoringSystem === SCORING_SYSTEM.RALLY) {
    sideSwitchAt = 11;
  }

  const serversPerSide = requirePositiveInt(
    input.serversPerSide ?? (scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1),
    "serversPerSide"
  );
  if (serversPerSide > 2) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "serversPerSide must be 1 or 2",
      { serversPerSide }
    );
  }

  const initialServingSide = String(
    input.initialServingSide || SCORING_SIDE.SIDE_A
  ).trim().toUpperCase();
  if (!isScoringSide(initialServingSide)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "initialServingSide must be SIDE_A or SIDE_B",
      { initialServingSide }
    );
  }

  const formatId = String(input.formatId || "default").trim();
  if (!formatId) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "formatId is required",
      {}
    );
  }

  let formatVersion = "1";
  if (input.formatVersion != null) {
    formatVersion = String(input.formatVersion).trim();
    if (!formatVersion) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
        "formatVersion must be a non-empty string when provided",
        { formatVersion: input.formatVersion }
      );
    }
  }

  if (input.metadata != null && typeof input.metadata !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "metadata must be a plain object when provided",
      {}
    );
  }
  if (Array.isArray(input.metadata)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "metadata must not be an array",
      {}
    );
  }

  return Object.freeze({
    schemaVersion: SCORING_FORMAT_SCHEMA_V1,
    formatId,
    formatVersion,
    scoringSystem,
    pointsToWin,
    winBy,
    maximumScore,
    bestOfGames,
    gamesToWinSet,
    bestOfSets,
    setsToWinMatch,
    sideSwitchAt,
    serversPerSide,
    initialServingSide,
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? Object.freeze({ ...input.metadata })
        : Object.freeze({}),
  });
}

/**
 * @param {unknown} format
 * @returns {asserts format is ScoringFormat}
 */
export function assertScoringFormat(format) {
  if (!format || typeof format !== "object") {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_FORMAT,
      "Scoring format is required",
      {}
    );
  }
  createScoringFormat(/** @type {Partial<ScoringFormat>} */ (format));
}
