import { MATCH_EVENT_TYPE } from "../constants/eventTypes.js";
import { cloneMatchState } from "../domain/matchState.js";
import { applyMatchEvent } from "./matchStateEngine.js";
import { ScoringStrategyRegistry } from "./scoring/ScoringStrategyRegistry.js";
import { ScoringFormatError } from "./scoring/scoringFormatError.js";
import {
  assertEventDoesNotMutateFormat,
  assertStateFormatUnchanged,
  extractMatchFormatSnapshot,
} from "./scoring/matchFormatIntegrity.js";

/**
 * Collect ids/sequences of events that were explicitly reverted so replay
 * does not re-apply them (EVENT_REVERTED markers stay in the log).
 */
function collectRevertedKeys(events = []) {
  const keys = new Set();
  for (const event of events) {
    if (event.eventType !== MATCH_EVENT_TYPE.EVENT_REVERTED) {
      continue;
    }
    const payload = event.payload || {};
    if (payload.revertedEventId) {
      keys.add(`id:${payload.revertedEventId}`);
    }
    if (payload.revertedSequence != null) {
      keys.add(`seq:${payload.revertedSequence}`);
    }
  }
  return keys;
}

function isRevertedEvent(event, revertedKeys) {
  if (revertedKeys.has(`id:${event.eventId}`)) {
    return true;
  }
  if (event.sequence != null && revertedKeys.has(`seq:${event.sequence}`)) {
    return true;
  }
  return false;
}

/**
 * Replay event list from official initial state.
 * Strategy is resolved once from initial format — never from event payloads.
 * Reverted source events are skipped together with EVENT_REVERTED markers.
 */
export function rebuildMatchState(initialState, events = [], config = {}) {
  let strategy;
  try {
    strategy = ScoringStrategyRegistry.resolve(initialState);
  } catch (error) {
    if (error instanceof ScoringFormatError) {
      return { ok: false, error: error.code, appliedCount: 0 };
    }
    throw error;
  }

  const formatSnapshot = extractMatchFormatSnapshot(initialState);
  const revertedKeys = collectRevertedKeys(events);
  let state = cloneMatchState(initialState);
  const applied = [];

  for (const event of events) {
    if (event.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED) {
      continue;
    }
    if (isRevertedEvent(event, revertedKeys)) {
      continue;
    }

    const immutability = assertEventDoesNotMutateFormat(formatSnapshot, event);
    if (!immutability.ok) {
      return { ok: false, error: immutability.error, appliedCount: applied.length };
    }

    const replayEvent = {
      ...event,
      expectedVersion: state.version,
      sequence: state.lastEventSequence + 1,
    };

    const result = applyMatchEvent(state, replayEvent, config, {
      skipLockedCheck: false,
      formatSnapshot,
      resolvedStrategyId: strategy.id,
    });
    if (!result.ok) {
      return { ok: false, error: result.error || result.code, appliedCount: applied.length };
    }

    const formatCheck = assertStateFormatUnchanged(formatSnapshot, result.nextState);
    if (!formatCheck.ok) {
      return { ok: false, error: formatCheck.error, appliedCount: applied.length };
    }

    state = result.nextState;
    applied.push(event.eventType);
  }

  return {
    ok: true,
    state,
    appliedCount: applied.length,
    ruleSetId: strategy.id,
  };
}

/**
 * Full-state deep equality (order-sensitive JSON). Used by existing Side-Out regression.
 */
export function statesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Domain equality for integrity checks — ignores transient fields.
 */
export function domainStatesEqual(a, b) {
  return JSON.stringify(normalizeDomainState(a)) === JSON.stringify(normalizeDomainState(b));
}

function normalizeDomainState(state) {
  if (!state) {
    return null;
  }
  return {
    matchId: state.matchId,
    matchType: state.matchType,
    status: state.status,
    scoringFormat: state.scoringFormat,
    scoringSystem: state.scoringSystem,
    scoringVariant: state.scoringVariant,
    ruleSetId: state.ruleSetId,
    pointsToWin: state.pointsToWin,
    winBy: state.winBy,
    freezeRule: state.freezeRule,
    serverNumberRule: state.serverNumberRule,
    bestOf: state.bestOf,
    maximumScore: state.maximumScore,
    currentGameNumber: state.currentGameNumber,
    teams: state.teams,
    servingTeamId: state.servingTeamId,
    servingPlayerId: state.servingPlayerId,
    receivingTeamId: state.receivingTeamId,
    receivingPlayerId: state.receivingPlayerId,
    serverNumber: state.serverNumber,
    games: state.games,
  };
}
