/**
 * CORE-17 adapter over CORE-16 calculated projections.
 * Read-only: never mutates projection, events, or scoring state.
 * Never treats calculated projection as validated/accepted.
 */

import {
  SCORING_PROJECTION_SCHEMA_V1,
  SCORING_SIDE as CORE16_SCORING_SIDE,
} from "../scoring/index.js";
import {
  CORE16_PROJECTION_KIND,
  CORE16_PROJECTION_SCHEMA_V1,
  SCORING_SIDE,
} from "./resultValidationConstants.js";
import {
  RESULT_ERROR_CODE,
  ResultValidationError,
} from "./resultValidationErrors.js";
import {
  computeProjectionInputDigest,
  deepFreezeClone,
} from "./deterministicResultFingerprint.js";

/**
 * @param {unknown} side
 * @returns {boolean}
 */
function isSide(side) {
  return side === SCORING_SIDE.SIDE_A || side === SCORING_SIDE.SIDE_B;
}

/**
 * Build scoreSummaryRef + optional scoreSnapshot from a CORE-16 projection.
 * Does not mutate the projection.
 *
 * @param {object} projection
 * @param {{ requireTerminal?: boolean, expectedMatchId?: string }} [options]
 * @returns {Readonly<{ scoreSummaryRef: object, scoreSnapshot: object }>}
 */
export function adaptCore16Projection(projection, options = {}) {
  if (!projection || typeof projection !== "object") {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "CORE-16 scoring projection is required",
      {}
    );
  }

  const schemaVersion = String(projection.schemaVersion || "");
  if (
    schemaVersion !== SCORING_PROJECTION_SCHEMA_V1 &&
    schemaVersion !== CORE16_PROJECTION_SCHEMA_V1
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "Invalid CORE-16 projection schemaVersion",
      { schemaVersion }
    );
  }

  if (projection.projectionKind !== CORE16_PROJECTION_KIND.CALCULATED_SCORE_ONLY) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "projectionKind must be CALCULATED_SCORE_ONLY",
      { projectionKind: projection.projectionKind }
    );
  }

  const matchId = String(projection.matchId || "").trim();
  if (!matchId) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "projection.matchId is required",
      {}
    );
  }

  if (
    options.expectedMatchId != null &&
    String(options.expectedMatchId) !== matchId
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "projection.matchId does not match submission matchId",
      { expectedMatchId: options.expectedMatchId, matchId }
    );
  }

  const calculatedMatchComplete = Boolean(projection.calculatedMatchComplete);
  if (options.requireTerminal === true && !calculatedMatchComplete) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_PROJECTION_NOT_TERMINAL,
      "CORE-16 projection is not terminal",
      { calculatedMatchComplete }
    );
  }

  const calculatedWinnerSide = projection.calculatedWinnerSide ?? null;
  if (
    options.requireTerminal === true &&
    !isSide(calculatedWinnerSide)
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_PROJECTION_NOT_TERMINAL,
      "Terminal projection requires calculatedWinnerSide SIDE_A or SIDE_B",
      { calculatedWinnerSide }
    );
  }

  if (
    calculatedWinnerSide != null &&
    calculatedWinnerSide !== CORE16_SCORING_SIDE.SIDE_A &&
    calculatedWinnerSide !== CORE16_SCORING_SIDE.SIDE_B &&
    calculatedWinnerSide !== SCORING_SIDE.SIDE_A &&
    calculatedWinnerSide !== SCORING_SIDE.SIDE_B
  ) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "Invalid calculatedWinnerSide on projection",
      { calculatedWinnerSide }
    );
  }

  const points = projection.points || { SIDE_A: 0, SIDE_B: 0 };
  const setsWon = projection.setsWon || { SIDE_A: 0, SIDE_B: 0 };
  const completedSets = Number(projection.completedSets) || 0;
  const completedGames = Number(projection.completedGames) || 0;
  const projectionRevision = Number(projection.revision);

  if (!Number.isInteger(projectionRevision) || projectionRevision < 0) {
    throw new ResultValidationError(
      RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID,
      "projection.revision must be a non-negative integer",
      { revision: projection.revision }
    );
  }

  const digestInput = {
    schemaVersion: CORE16_PROJECTION_SCHEMA_V1,
    matchId,
    revision: projectionRevision,
    calculatedMatchComplete,
    calculatedWinnerSide,
    points: {
      SIDE_A: Number(points.SIDE_A) || 0,
      SIDE_B: Number(points.SIDE_B) || 0,
    },
    setsWon: {
      SIDE_A: Number(setsWon.SIDE_A) || 0,
      SIDE_B: Number(setsWon.SIDE_B) || 0,
    },
    completedSets,
    completedGames,
  };

  const scoreSummaryRef = Object.freeze({
    projectionSchemaVersion: CORE16_PROJECTION_SCHEMA_V1,
    matchId,
    projectionRevision,
    projectionKind: CORE16_PROJECTION_KIND.CALCULATED_SCORE_ONLY,
    inputDigest: computeProjectionInputDigest(digestInput),
  });

  const scoreSnapshot = Object.freeze({
    points: Object.freeze({ ...digestInput.points }),
    setsWon: Object.freeze({ ...digestInput.setsWon }),
    completedSets,
    completedGames,
    calculatedMatchComplete,
    calculatedWinnerSide,
  });

  return Object.freeze({
    scoreSummaryRef,
    scoreSnapshot,
    /** Owned read-only view of ordered event ids for evidence/reference only. */
    scoringEventRefs: Object.freeze(
      Array.isArray(projection.events)
        ? projection.events.map((evt) =>
            Object.freeze({
              eventId: evt?.eventId ?? null,
              sequence: evt?.sequence ?? null,
              eventType: evt?.eventType ?? null,
              supersedesEventId: evt?.supersedesEventId ?? null,
            })
          )
        : []
    ),
  });
}

/**
 * Assert a caller-supplied scoreSnapshot matches digest inputs from projection.
 * @param {object|null|undefined} snapshot
 * @param {object} adaptedSnapshot
 */
export function assertScoreSnapshotConsistent(snapshot, adaptedSnapshot) {
  if (snapshot == null) return;
  const keys = [
    "completedSets",
    "completedGames",
    "calculatedMatchComplete",
    "calculatedWinnerSide",
  ];
  for (const key of keys) {
    if (snapshot[key] !== undefined && snapshot[key] !== adaptedSnapshot[key]) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SCORE_SNAPSHOT_INCONSISTENT,
        `scoreSnapshot.${key} inconsistent with projection`,
        { key, expected: adaptedSnapshot[key], actual: snapshot[key] }
      );
    }
  }
  for (const side of [SCORING_SIDE.SIDE_A, SCORING_SIDE.SIDE_B]) {
    if (
      snapshot.points &&
      snapshot.points[side] !== undefined &&
      Number(snapshot.points[side]) !== Number(adaptedSnapshot.points[side])
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SCORE_SNAPSHOT_INCONSISTENT,
        "scoreSnapshot.points inconsistent with projection",
        { side }
      );
    }
    if (
      snapshot.setsWon &&
      snapshot.setsWon[side] !== undefined &&
      Number(snapshot.setsWon[side]) !== Number(adaptedSnapshot.setsWon[side])
    ) {
      throw new ResultValidationError(
        RESULT_ERROR_CODE.RESULT_SCORE_SNAPSHOT_INCONSISTENT,
        "scoreSnapshot.setsWon inconsistent with projection",
        { side }
      );
    }
  }
}

/**
 * Clone projection shallowly for tests — never used to mutate originals.
 * @param {object} projection
 * @returns {object}
 */
export function cloneProjectionForRead(projection) {
  return /** @type {object} */ (deepFreezeClone(
    JSON.parse(JSON.stringify(projection))
  ));
}
