import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { cloneMatchState } from "../domain/matchState.js";
import { rebuildMatchState } from "./stateReplayEngine.js";

export function undoLastEvent(state, eventHistory = [], config = {}) {
  if (state.status === MATCH_STATUS.LOCKED) {
    return { ok: false, error: "MATCH_LOCKED" };
  }

  const applicable = eventHistory.filter(
    (event) => event.eventType !== MATCH_EVENT_TYPE.EVENT_REVERTED
  );

  if (applicable.length === 0) {
    return { ok: false, error: "UNDO_NOT_ALLOWED" };
  }

  const initialState = cloneMatchState(config.initialState || config.baseState);
  if (!initialState) {
    return { ok: false, error: "MISSING_INITIAL_STATE" };
  }

  const withoutLast = applicable.slice(0, -1);
  const revertedEvent = applicable[applicable.length - 1];

  const rebuild = rebuildMatchState(initialState, withoutLast, config);
  if (!rebuild.ok) {
    return rebuild;
  }

  const revertRecord = {
    eventId: `revert-${revertedEvent.eventId || revertedEvent.sequence}`,
    eventType: MATCH_EVENT_TYPE.EVENT_REVERTED,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version,
    actorId: revertedEvent.actorId || "",
    payload: {
      revertedEventId: revertedEvent.eventId,
      revertedEventType: revertedEvent.eventType,
      revertedSequence: revertedEvent.sequence,
    },
  };

  const nextHistory = [...eventHistory, revertRecord];

  return {
    ok: true,
    nextState: {
      ...rebuild.state,
      version: state.version + 1,
      lastEventSequence: state.lastEventSequence + 1,
    },
    revertEvent: revertRecord,
    eventHistory: nextHistory,
  };
}
