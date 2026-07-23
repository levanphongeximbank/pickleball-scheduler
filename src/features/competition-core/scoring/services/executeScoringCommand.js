/**
 * CORE-16 — command execution + deterministic replay.
 *
 * Every score-changing command calls CORE-15 `assertScoringAllowed`.
 * MatchRuntimeError from lifecycle denial is rethrown unchanged.
 */

import {
  assertScoringAllowed,
  evaluateScoringEligibility,
  MatchRuntimeError,
} from "../../matches/index.js";
import { SCORING_COMMAND_TYPE } from "../enums/scoringCommandTypes.js";
import { SCORING_EVENT_TYPE } from "../enums/scoringEventTypes.js";
import { SCORING_SIDE } from "../enums/scoringSides.js";
import {
  SCORING_ERROR_CODE,
  ScoringEngineError,
} from "../errors/index.js";
import {
  assertScoringCommand,
  assertScoringState,
  cloneScoringState,
  createInitialScoringState,
  createRecordPointCommand,
  createReplayProjectionCommand,
  createScoringEvent,
  createScoringProjection,
  createSupersedeEventCommand,
  freezeScoringState,
} from "../contracts/index.js";
import {
  applyRallyOrSideOutPoint,
  captureScoreSnapshot,
  rollupCompletedUnits,
} from "./progression.js";

/**
 * @param {object} [deps]
 * @returns {{ now: () => string, nextId: (prefix: string) => string }}
 */
function resolveDeps(deps = {}) {
  const now =
    typeof deps.now === "function"
      ? deps.now
      : () => {
          throw new ScoringEngineError(
            SCORING_ERROR_CODE.SCORING_CLOCK_REQUIRED,
            "Injected now() is required for deterministic scoring events",
            {}
          );
        };
  const nextId =
    typeof deps.nextId === "function"
      ? deps.nextId
      : () => {
          throw new ScoringEngineError(
            SCORING_ERROR_CODE.SCORING_ID_FACTORY_REQUIRED,
            "Injected nextId() is required for deterministic scoring events",
            {}
          );
        };
  return { now, nextId };
}

/**
 * @param {object} command
 * @returns {unknown}
 */
function resolveLifecycleContext(command) {
  if (command.match != null) return command.match;
  return command.lifecycleStatus;
}

/**
 * Gate score-changing commands through CORE-15.
 * Uses evaluateScoringEligibility then assertScoringAllowed so both contracts
 * are consumed; lifecycle failures remain MatchRuntimeError with CORE-15 codes.
 * @param {object} command
 */
export function requireScoringLifecycleAllowed(command) {
  const ctx = resolveLifecycleContext(command);
  const eligibility = evaluateScoringEligibility(ctx);
  if (eligibility.scoringAllowed === true && eligibility.matchStatus) {
    return { ok: true, matchStatus: eligibility.matchStatus };
  }
  // Fail closed — preserve CORE-15 MatchRuntimeError / codes unchanged.
  return assertScoringAllowed(ctx);
}

/**
 * @param {object} state
 * @param {object} commandInput
 * @param {object} [deps]
 */
export function recordPoint(state, commandInput = {}, deps = {}) {
  assertScoringState(state);
  const command = createRecordPointCommand(commandInput);
  requireScoringLifecycleAllowed(command);

  if (state.matchComplete) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_MATCH_ALREADY_COMPLETE,
      "Scoring is rejected after calculated match completion",
      { calculatedWinnerSide: state.calculatedWinnerSide }
    );
  }

  const { now, nextId } = resolveDeps(deps);
  const draft = cloneScoringState(state);

  if (command.clientEventId) {
    const dup = draft.events.find((e) => e.eventId === command.clientEventId);
    if (dup) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_DUPLICATE_EVENT,
        "Duplicate scoring event id",
        { eventId: command.clientEventId }
      );
    }
  }

  const scoreBefore = captureScoreSnapshot(draft);
  const serveBefore = draft.serve ? { ...draft.serve } : null;
  const progression = applyRallyOrSideOutPoint(draft, command.scoringSide);
  const rollupHints = progression.awardedPoint
    ? rollupCompletedUnits(draft)
    : [];
  const scoreAfter = captureScoreSnapshot(draft);
  const serveAfter = draft.serve ? { ...draft.serve } : null;

  const sequence = draft.events.length + 1;
  if (sequence !== state.revision + 1) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_DUPLICATE_SEQUENCE,
      "Scoring sequence collision",
      { expected: state.revision + 1, sequence }
    );
  }
  if (draft.events.some((e) => e.sequence === sequence)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_DUPLICATE_SEQUENCE,
      "Duplicate scoring sequence number",
      { sequence }
    );
  }

  const primaryType = progression.awardedPoint
    ? SCORING_EVENT_TYPE.POINT_RECORDED
    : SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE;

  const event = createScoringEvent({
    eventId: command.clientEventId || nextId("score"),
    eventType: primaryType,
    sequence,
    revision: sequence,
    scoringSide: command.scoringSide,
    occurredAt: command.occurredAt || now(),
    formatId: draft.format.formatId,
    formatVersion: draft.format.formatVersion,
    scoreBefore,
    scoreAfter,
    serveBefore,
    serveAfter,
    payload: {
      domainHints: [...progression.domainHints, ...rollupHints],
      awardedPoint: progression.awardedPoint,
    },
  });

  draft.events.push(event);
  draft.revision = sequence;

  const nextState = freezeScoringState(draft);
  return {
    state: nextState,
    event,
    projection: createScoringProjection(nextState),
    command,
  };
}

/**
 * Supersede a prior POINT_* event and rebuild projection from remaining active events.
 * History is preserved: original events remain; supersession is appended.
 *
 * @param {object} state
 * @param {object} commandInput
 * @param {object} [deps]
 */
export function supersedeScoringEvent(state, commandInput = {}, deps = {}) {
  assertScoringState(state);
  const command = createSupersedeEventCommand(commandInput);
  requireScoringLifecycleAllowed(command);

  const target = state.events.find((e) => e.eventId === command.targetEventId);
  if (!target) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_CORRECTION_TARGET,
      "Correction target event was not found",
      { targetEventId: command.targetEventId }
    );
  }

  if ((state.supersededEventIds || []).includes(command.targetEventId)) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_EVENT_ALREADY_SUPERSEDED,
      "Correction target was already superseded",
      { targetEventId: command.targetEventId }
    );
  }

  if (
    target.eventType !== SCORING_EVENT_TYPE.POINT_RECORDED &&
    target.eventType !== SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE
  ) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_INVALID_CORRECTION_TARGET,
      "Only point events may be superseded",
      { eventType: target.eventType }
    );
  }

  const { now, nextId } = resolveDeps(deps);
  const sequence = state.events.length + 1;
  const supersedeEvent = createScoringEvent({
    eventId: command.clientEventId || nextId("supersede"),
    eventType: SCORING_EVENT_TYPE.EVENT_SUPERSEDED,
    sequence,
    revision: sequence,
    scoringSide: command.replacementScoringSide,
    occurredAt: command.occurredAt || now(),
    formatId: state.format.formatId,
    formatVersion: state.format.formatVersion,
    supersedesEventId: command.targetEventId,
    payload: {
      reason: command.reason,
      replacementScoringSide: command.replacementScoringSide,
    },
  });

  const supersededIds = new Set([
    ...(state.supersededEventIds || []),
    command.targetEventId,
  ]);

  /** Rebuild active point stream */
  const activePointCommands = [];
  for (const ev of state.events) {
    if (supersededIds.has(ev.eventId)) continue;
    if (
      ev.eventType === SCORING_EVENT_TYPE.POINT_RECORDED ||
      ev.eventType === SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE
    ) {
      activePointCommands.push({
        scoringSide: ev.scoringSide,
        clientEventId: `replay:${ev.eventId}`,
        occurredAt: ev.occurredAt,
      });
    }
  }

  if (command.replacementScoringSide) {
    activePointCommands.push({
      scoringSide: command.replacementScoringSide,
      clientEventId: `replacement:${supersedeEvent.eventId}`,
      occurredAt: supersedeEvent.occurredAt,
    });
  }

  let rebuilt = createInitialScoringState({
    matchId: state.matchId,
    format: state.format,
    trackServe: Boolean(state.serve),
  });

  // Replay without lifecycle gate — correction already gated once.
  for (const point of activePointCommands) {
    rebuilt = applyPointWithoutLifecycleGate(rebuilt, point, {
      now: () => point.occurredAt || now(),
      nextId: () => point.clientEventId,
    }).state;
  }

  const draft = cloneScoringState(rebuilt);
  // Preserve full history + lineage from prior state
  draft.events = [...state.events, supersedeEvent];
  draft.supersededEventIds = [...supersededIds];
  draft.correctionLineage = [
    ...(state.correctionLineage || []),
    {
      targetEventId: command.targetEventId,
      supersedeEventId: supersedeEvent.eventId,
      replacementScoringSide: command.replacementScoringSide,
      reason: command.reason,
      atRevision: sequence,
    },
  ];
  draft.revision = sequence;

  const nextState = freezeScoringState(draft);
  return {
    state: nextState,
    event: supersedeEvent,
    projection: createScoringProjection(nextState),
    command,
  };
}

/**
 * Internal replay helper — does not call assertScoringAllowed.
 * @param {object} state
 * @param {object} point
 * @param {object} deps
 */
function applyPointWithoutLifecycleGate(state, point, deps) {
  if (state.matchComplete) {
    throw new ScoringEngineError(
      SCORING_ERROR_CODE.SCORING_MATCH_ALREADY_COMPLETE,
      "Replay attempted after calculated match completion",
      {}
    );
  }

  const draft = cloneScoringState(state);
  const scoreBefore = captureScoreSnapshot(draft);
  const serveBefore = draft.serve ? { ...draft.serve } : null;
  const progression = applyRallyOrSideOutPoint(draft, point.scoringSide);
  const rollupHints = progression.awardedPoint
    ? rollupCompletedUnits(draft)
    : [];
  const scoreAfter = captureScoreSnapshot(draft);
  const serveAfter = draft.serve ? { ...draft.serve } : null;
  const sequence = draft.events.length + 1;

  const event = createScoringEvent({
    eventId: point.clientEventId || deps.nextId("score"),
    eventType: progression.awardedPoint
      ? SCORING_EVENT_TYPE.POINT_RECORDED
      : SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE,
    sequence,
    revision: sequence,
    scoringSide: point.scoringSide,
    occurredAt: point.occurredAt || deps.now(),
    formatId: draft.format.formatId,
    formatVersion: draft.format.formatVersion,
    scoreBefore,
    scoreAfter,
    serveBefore,
    serveAfter,
    payload: {
      domainHints: [...progression.domainHints, ...rollupHints],
      awardedPoint: progression.awardedPoint,
      replay: true,
    },
  });

  draft.events.push(event);
  draft.revision = sequence;
  return { state: freezeScoringState(draft), event };
}

/**
 * Deterministic projection from format + ordered point sides.
 * @param {object} input
 * @param {object} [deps]
 */
export function replayScoringProjection(input = {}, deps = {}) {
  const command = createReplayProjectionCommand(input);
  const matchId = String(command.matchId || input.matchId || "replay").trim();
  let state = createInitialScoringState({
    matchId,
    format: command.format || input.format || {},
    trackServe: input.trackServe,
  });

  const { now, nextId } = resolveDeps({
    now: deps.now || (() => "1970-01-01T00:00:00.000Z"),
    nextId:
      deps.nextId ||
      ((prefix) => `${prefix}-${state.revision + 1}`),
  });

  const sides = Array.isArray(input.scoringSides)
    ? input.scoringSides
    : (command.events || [])
        .map((e) => e.scoringSide || e)
        .filter(Boolean);

  let seq = 0;
  for (const side of sides) {
    seq += 1;
    const scoringSide = String(side).trim().toUpperCase();
    if (
      scoringSide !== SCORING_SIDE.SIDE_A &&
      scoringSide !== SCORING_SIDE.SIDE_B
    ) {
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_SIDE,
        "Replay scoring side is invalid",
        { scoringSide }
      );
    }
    try {
      const step = applyPointWithoutLifecycleGate(
        state,
        {
          scoringSide,
          clientEventId: `replay-${seq}`,
          occurredAt: now(),
        },
        { now, nextId }
      );
      state = step.state;
    } catch (err) {
      if (err instanceof ScoringEngineError) {
        throw new ScoringEngineError(
          SCORING_ERROR_CODE.SCORING_REPLAY_INCONSISTENT,
          err.message,
          { causeCode: err.code, ...err.details }
        );
      }
      throw err;
    }
  }

  return {
    state,
    projection: createScoringProjection(state),
    command,
  };
}

/**
 * Unified command dispatcher.
 * @param {object} state
 * @param {object} command
 * @param {object} [deps]
 */
export function executeScoringCommand(state, command, deps = {}) {
  assertScoringCommand(command);

  switch (command.commandType) {
    case SCORING_COMMAND_TYPE.RECORD_POINT:
      return recordPoint(state, command, deps);
    case SCORING_COMMAND_TYPE.SUPERSEDE_EVENT:
      return supersedeScoringEvent(state, command, deps);
    case SCORING_COMMAND_TYPE.REPLAY_PROJECTION:
      return replayScoringProjection(
        {
          ...command,
          format: command.format || state?.format,
          matchId: command.matchId || state?.matchId,
        },
        deps
      );
    default:
      throw new ScoringEngineError(
        SCORING_ERROR_CODE.SCORING_INVALID_COMMAND,
        "Unsupported scoring command",
        { commandType: command.commandType }
      );
  }
}

export { MatchRuntimeError };
