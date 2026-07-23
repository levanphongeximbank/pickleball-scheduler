/**
 * CORE-16 Scoring Engine — capability-local public surface.
 *
 * Owns point/game/set/match scoring progression, formats, commands, events,
 * corrections, deterministic replay and calculated projections.
 *
 * Does NOT own match lifecycle, result validation (CORE-17), standings,
 * schedule, court/referee assignment, or production wiring.
 *
 * Integrator owns root competition-core/index.js — do not edit that here.
 */

export {
  CORE16_ENGINE_ID,
  CORE16_ENGINE_VERSION,
  SCORING_FORMAT_SCHEMA_V1,
  SCORING_STATE_SCHEMA_V1,
  SCORING_EVENT_SCHEMA_V1,
  SCORING_PROJECTION_SCHEMA_V1,
  SCORING_COMMAND_SCHEMA_V1,
  CORE16_IDENTITY,
} from "./constants/index.js";

export {
  SCORING_SIDE,
  SCORING_SIDE_VALUES,
  isScoringSide,
  oppositeScoringSide,
  SCORING_SYSTEM,
  SCORING_SYSTEM_VALUES,
  isScoringSystem,
  SCORING_EVENT_TYPE,
  SCORING_EVENT_TYPE_VALUES,
  isScoringEventType,
  SCORING_COMMAND_TYPE,
  SCORING_COMMAND_TYPE_VALUES,
  isScoringCommandType,
} from "./enums/index.js";

export {
  SCORING_ERROR_CODE,
  SCORING_ERROR_CODE_VALUES,
  isScoringErrorCode,
  ScoringEngineError,
  isScoringEngineError,
  createScoringEngineError,
} from "./errors/index.js";

export {
  createScoringFormat,
  assertScoringFormat,
  createInitialScoringState,
  freezeScoringState,
  cloneScoringState,
  assertScoringState,
  createScoringEvent,
  createScoringProjection,
  createRecordPointCommand,
  createSupersedeEventCommand,
  createReplayProjectionCommand,
  assertScoringCommand,
} from "./contracts/index.js";

export {
  evaluateGameComplete,
  evaluateSetComplete,
  evaluateMatchComplete,
  applyRallyOrSideOutPoint,
  rollupCompletedUnits,
  captureScoreSnapshot,
  requireScoringLifecycleAllowed,
  recordPoint,
  supersedeScoringEvent,
  replayScoringProjection,
  executeScoringCommand,
} from "./services/index.js";

export {
  adaptRefereeV5CheckGameComplete,
  REFEREE_V5_WIN_CONDITION_SOURCE,
} from "./adapters/index.js";
