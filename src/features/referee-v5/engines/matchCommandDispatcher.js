import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { createEngineError, normalizeIncomingEvent } from "../domain/matchEvents.js";
import { applyMatchEvent } from "./matchStateEngine.js";
import { undoLastEvent } from "./undoEngine.js";
import { recomputeServeContext } from "./receiverResolver.js";
import { validateEventPreconditions } from "../domain/matchValidation.js";
import { cloneMatchState } from "../domain/matchState.js";

/**
 * Official command dispatcher — UI must use this (or applyMatchEvent with history for undo).
 */
export function dispatchMatchCommand({
  state,
  command,
  history = [],
  config = {},
  initialState,
}) {
  const event = normalizeIncomingEvent(command);
  const baseInitial = initialState ? cloneMatchState(initialState) : null;

  if (event.eventType === MATCH_EVENT_TYPE.UNDO_LAST_EVENT) {
    return dispatchUndoCommand(state, event, history, config, baseInitial);
  }

  const result = applyMatchEvent(state, event, config);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code || result.error,
      error: result.error,
    };
  }

  return {
    ok: true,
    nextState: result.nextState,
    generatedEvents: result.generatedEvents,
    domainWarnings: result.domainWarnings || [],
    eventHistory: [...history, event],
  };
}

function dispatchUndoCommand(state, event, history, config, initialState) {
  const pre = validateEventPreconditions(state, event);
  if (!pre.ok) {
    return createEngineError(pre.error, pre.error);
  }

  if (state.status === MATCH_STATUS.LOCKED) {
    return createEngineError("MATCH_LOCKED", "Trận đã khóa.");
  }

  if (!initialState) {
    return createEngineError("MISSING_INITIAL_STATE", "Thiếu initialState cho undo.");
  }

  const undoResult = undoLastEvent(state, history, {
    initialState,
    baseState: initialState,
    ...config,
  });

  if (!undoResult.ok) {
    return createEngineError(undoResult.error, undoResult.error);
  }

  const context = recomputeServeContext(undoResult.nextState);
  if (!context.ok) {
    return createEngineError(context.error, context.error);
  }

  const nextState = {
    ...context.state,
    version: undoResult.nextState.version,
    lastEventSequence: undoResult.nextState.lastEventSequence,
  };

  return {
    ok: true,
    nextState,
    generatedEvents: [MATCH_EVENT_TYPE.EVENT_REVERTED],
    domainWarnings: [],
    eventHistory: undoResult.eventHistory,
    revertEvent: undoResult.revertEvent,
  };
}

export function applyMatchEventWithUndo(state, rawEvent, config = {}, options = {}) {
  if (rawEvent?.eventType === MATCH_EVENT_TYPE.UNDO_LAST_EVENT) {
    return dispatchMatchCommand({
      state,
      command: rawEvent,
      history: options.eventHistory || [],
      config,
      initialState: options.initialState,
    });
  }
  return applyMatchEvent(state, rawEvent, config, options);
}
