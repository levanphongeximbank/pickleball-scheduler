import { DOMAIN_EVENT_TYPE, MATCH_EVENT_TYPE, MATCH_STATUS } from "../constants/eventTypes.js";
import { cloneMatchState, incrementVersion } from "../domain/matchState.js";
import {
  createEngineError,
  createEngineSuccess,
  normalizeIncomingEvent,
} from "../domain/matchEvents.js";
import { validateEventPreconditions, validateServeSnapshot } from "../domain/matchValidation.js";
import { startMatchFromInitialized } from "./initializeMatchState.js";
import { ScoringStrategyRegistry } from "./scoring/ScoringStrategyRegistry.js";
import { ScoringFormatError } from "./scoring/scoringFormatError.js";
import { buildRuleConfig } from "./scoring/ruleConfig.js";
import { applySwitchEnds } from "./switchEndsEngine.js";
import { resolveReceivingPlayer, recomputeServeContext } from "./receiverResolver.js";
import { undoLastEvent } from "./undoEngine.js";

export { buildRuleConfig } from "./scoring/ruleConfig.js";

function assertValidServeSnapshot(state) {
  const receiverResult = resolveReceivingPlayer(state);
  return validateServeSnapshot(state, receiverResult);
}

function applyRallyWin(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  const strategy = ScoringStrategyRegistry.resolve(state);
  return strategy.applyRallyResult(state, teamId, config);
}

export function applyMatchEvent(state, rawEvent, config = {}, options = {}) {
  const event = normalizeIncomingEvent(rawEvent);
  const working = cloneMatchState(state);

  if (!options.skipLockedCheck && working.status === MATCH_STATUS.LOCKED) {
    return createEngineError("MATCH_LOCKED", "Trận đã khóa.");
  }

  const pre = validateEventPreconditions(working, event);
  if (!pre.ok) {
    return createEngineError(pre.error, pre.error);
  }

  switch (event.eventType) {
    case MATCH_EVENT_TYPE.START_MATCH: {
      if (working.status !== MATCH_STATUS.NOT_STARTED) {
        return createEngineError("INVALID_EVENT", "START_MATCH invalid.");
      }
      const started = startMatchFromInitialized(working);
      if (!started.ok) {
        return createEngineError("INVALID_EVENT", started.error);
      }
      return createEngineSuccess({
        nextState: incrementVersion(started.state),
        generatedEvents: [MATCH_EVENT_TYPE.START_MATCH],
        domainWarnings: [],
      });
    }

    case MATCH_EVENT_TYPE.TEAM_A_WON_RALLY:
    case MATCH_EVENT_TYPE.TEAM_B_WON_RALLY: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("MATCH_NOT_STARTED", "Trận chưa bắt đầu.");
      }

      const teamKey =
        event.eventType === MATCH_EVENT_TYPE.TEAM_A_WON_RALLY ? "teamA" : "teamB";
      const ruleConfig = buildRuleConfig(working, config);

      let rallyResult;
      try {
        rallyResult = applyRallyWin(working, teamKey, ruleConfig);
      } catch (error) {
        if (error instanceof ScoringFormatError) {
          return createEngineError("VALIDATION_FAILED", error.code);
        }
        throw error;
      }

      if (!rallyResult.ok) {
        return createEngineError("VALIDATION_FAILED", rallyResult.error);
      }

      const snapshotCheck = assertValidServeSnapshot(rallyResult.state);
      if (!snapshotCheck.ok) {
        return createEngineError("VALIDATION_FAILED", snapshotCheck.error);
      }

      return createEngineSuccess({
        nextState: incrementVersion(rallyResult.state),
        generatedEvents: ["RALLY_WON", ...rallyResult.generatedEvents],
        domainWarnings: [],
      });
    }

    case MATCH_EVENT_TYPE.SWITCH_ENDS: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("MATCH_NOT_STARTED", "Chưa thể đổi sân.");
      }

      const switchResult = applySwitchEnds(working);
      if (!switchResult.ok) {
        return createEngineError("VALIDATION_FAILED", switchResult.error);
      }

      return createEngineSuccess({
        nextState: incrementVersion(switchResult.state),
        generatedEvents: switchResult.generatedEvents,
        domainWarnings: [],
      });
    }

    case MATCH_EVENT_TYPE.START_TIMEOUT:
    case MATCH_EVENT_TYPE.END_TIMEOUT:
      return createEngineSuccess({
        nextState: incrementVersion(working),
        generatedEvents: [event.eventType],
        domainWarnings: [],
      });

    case MATCH_EVENT_TYPE.PAUSE_MATCH: {
      if (working.status !== MATCH_STATUS.IN_PROGRESS) {
        return createEngineError("INVALID_EVENT", "PAUSE_MATCH invalid.");
      }
      return createEngineSuccess({
        nextState: { ...incrementVersion(working), status: MATCH_STATUS.PAUSED },
        generatedEvents: [MATCH_EVENT_TYPE.PAUSE_MATCH],
        domainWarnings: [],
      });
    }

    case MATCH_EVENT_TYPE.RESUME_MATCH: {
      if (working.status !== MATCH_STATUS.PAUSED) {
        return createEngineError("INVALID_EVENT", "RESUME_MATCH invalid.");
      }
      return createEngineSuccess({
        nextState: { ...incrementVersion(working), status: MATCH_STATUS.IN_PROGRESS },
        generatedEvents: [MATCH_EVENT_TYPE.RESUME_MATCH],
        domainWarnings: [],
      });
    }

    case MATCH_EVENT_TYPE.UNDO_LAST_EVENT: {
      if (!options.eventHistory || !options.initialState) {
        return createEngineError("MISSING_HISTORY", "UNDO requires eventHistory and initialState.");
      }
      const undoResult = undoLastEvent(working, options.eventHistory, {
        initialState: options.initialState,
        baseState: options.initialState,
        ...config,
      });
      if (!undoResult.ok) {
        return createEngineError(undoResult.error, undoResult.error);
      }
      const context = recomputeServeContext(undoResult.nextState);
      if (!context.ok) {
        return createEngineError(context.error, context.error);
      }
      return createEngineSuccess({
        nextState: {
          ...context.state,
          version: undoResult.nextState.version,
          lastEventSequence: undoResult.nextState.lastEventSequence,
        },
        generatedEvents: [MATCH_EVENT_TYPE.EVENT_REVERTED],
        domainWarnings: [],
        eventHistory: undoResult.eventHistory,
      });
    }

    case MATCH_EVENT_TYPE.DECLARE_FORFEIT:
      return createEngineSuccess({
        nextState: {
          ...incrementVersion(working),
          status: MATCH_STATUS.COMPLETED,
        },
        generatedEvents: [MATCH_EVENT_TYPE.DECLARE_FORFEIT, DOMAIN_EVENT_TYPE.MATCH_COMPLETED],
        domainWarnings: [],
      });

    default:
      return createEngineError("INVALID_EVENT", `Unsupported event: ${event.eventType}`);
  }
}
