import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { cloneMatchState } from "../domain/matchState.js";
import { applyMatchEvent } from "./matchStateEngine.js";

/**
 * Replay event list from initial not-started state.
 */
export function rebuildMatchState(initialState, events = [], config = {}) {
  let state = cloneMatchState(initialState);
  const applied = [];

  for (const event of events) {
    if (event.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED) {
      continue;
    }

    const replayEvent = {
      ...event,
      expectedVersion: state.version,
      sequence: state.lastEventSequence + 1,
    };

    const result = applyMatchEvent(state, replayEvent, config, { skipLockedCheck: false });
    if (!result.ok) {
      return { ok: false, error: result.error, appliedCount: applied.length };
    }

    state = result.nextState;
    applied.push(event.eventType);
  }

  return { ok: true, state, appliedCount: applied.length };
}

export function statesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
