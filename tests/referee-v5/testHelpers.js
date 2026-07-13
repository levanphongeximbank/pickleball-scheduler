import { COURT_END } from "../../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../../src/features/referee-v5/constants/courtSides.js";
import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import { MATCH_TYPE } from "../../src/features/referee-v5/constants/matchTypes.js";
import { SCORING_FORMAT } from "../../src/features/referee-v5/constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../src/features/referee-v5/constants/scoringStrategy.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";

export function buildDoublesSideOutConfig(overrides = {}) {
  return {
    matchId: "match-1",
    matchType: MATCH_TYPE.DOUBLES,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
    pointsToWin: 11,
    winBy: 2,
    teams: {
      teamA: {
        teamId: "team-a",
        courtEnd: COURT_END.NEAR_END,
        players: [
          { playerId: "A", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
          { playerId: "B", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
        ],
      },
      teamB: {
        teamId: "team-b",
        courtEnd: COURT_END.FAR_END,
        players: [
          { playerId: "C", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
          { playerId: "D", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
        ],
      },
    },
    firstServingTeamId: "team-a",
    firstServingPlayerId: "A",
    ...overrides,
  };
}

export function buildDoublesUsapRallyConfig(overrides = {}) {
  return buildDoublesSideOutConfig({
    scoringFormat: SCORING_FORMAT.RALLY,
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    ruleSetId: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,
    pointsToWin: 11,
    winBy: 2,
    ...overrides,
  });
}

export function initStartedUsapRallyMatch(overrides = {}) {
  return initStartedMatch(buildDoublesUsapRallyConfig(overrides));
}

export function buildSinglesConfig(overrides = {}) {
  return {
    matchId: "match-s1",
    matchType: MATCH_TYPE.SINGLES,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
    pointsToWin: 11,
    winBy: 2,
    teams: {
      teamA: {
        teamId: "team-a",
        courtEnd: COURT_END.NEAR_END,
        players: [{ playerId: "P1", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT }],
      },
      teamB: {
        teamId: "team-b",
        courtEnd: COURT_END.FAR_END,
        players: [{ playerId: "P2", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT }],
      },
    },
    firstServingTeamId: "team-a",
    firstServingPlayerId: "P1",
    ...overrides,
  };
}

export function initStartedMatch(config = buildDoublesSideOutConfig()) {
  const init = initializeMatchState(config);
  if (!init.ok) {
    throw new Error(init.errors.join(", "));
  }

  const start = applyMatchEvent(init.state, {
    eventId: "e-start",
    eventType: MATCH_EVENT_TYPE.START_MATCH,
    sequence: 1,
    expectedVersion: 0,
    actorId: "ref-1",
    payload: {},
  });

  if (!start.ok) {
    throw new Error(start.error);
  }

  return start.nextState;
}

export function applyEvent(state, eventType, sequence, actorId = "ref-1", payload = {}) {
  return applyMatchEvent(state, {
    eventId: `e-${sequence}`,
    eventType,
    sequence,
    expectedVersion: state.version,
    actorId,
    payload,
  });
}
