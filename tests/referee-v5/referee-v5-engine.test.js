import test from "node:test";
import assert from "node:assert/strict";

import { COURT_END } from "../../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../../src/features/referee-v5/constants/courtSides.js";
import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../../src/features/referee-v5/constants/eventTypes.js";
import { SCREEN_POSITION } from "../../src/features/referee-v5/constants/viewModes.js";
import { findPlayerInState } from "../../src/features/referee-v5/domain/matchState.js";
import {
  logicalPositionToScreenPosition,
} from "../../src/features/referee-v5/engines/courtPositionEngine.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import { resolveReceivingPlayer } from "../../src/features/referee-v5/engines/receiverResolver.js";
import {
  SERVE_DIRECTION,
  resolveServeDirection,
} from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import { applySideOutScoringEvent } from "../../src/features/referee-v5/engines/sideOutScoringEngine.js";
import { applySwitchEnds } from "../../src/features/referee-v5/engines/switchEndsEngine.js";
import { serviceSideForScore, applySinglesSideOutEvent } from "../../src/features/referee-v5/engines/singlesScoringEngine.js";
import { rebuildMatchState, statesEqual } from "../../src/features/referee-v5/engines/stateReplayEngine.js";
import { undoLastEvent } from "../../src/features/referee-v5/engines/undoEngine.js";
import {
  applyEvent,
  buildDoublesSideOutConfig,
  buildSinglesConfig,
  initStartedMatch,
} from "./testHelpers.js";

function setServerAt(state, playerId) {
  const player = findPlayerInState(state, playerId);
  return {
    ...state,
    servingPlayerId: playerId,
    servingTeamId: player.teamId,
  };
}

// ─── Receiver & diagonal (1-8) ───────────────────────────────────

test("1 NEAR RIGHT → receiver D and NEAR_RIGHT_TO_FAR_LEFT", () => {
  const state = initStartedMatch();
  assert.equal(state.receivingPlayerId, "D");
  assert.equal(resolveServeDirection(state), SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT);
});

test("2 NEAR LEFT → receiver C and NEAR_LEFT_TO_FAR_RIGHT", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-a", {}).state;
  assert.equal(state.servingPlayerId, "A");
  assert.equal(findPlayerInState(state, "A").logicalServiceSide, LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT);
  assert.equal(state.receivingPlayerId, "C");
  assert.equal(resolveServeDirection(state), SERVE_DIRECTION.NEAR_LEFT_TO_FAR_RIGHT);
});

test("3 FAR RIGHT → receiver A and direction FAR_RIGHT_TO_NEAR_LEFT", () => {
  let state = initStartedMatch();
  state = setServerAt(state, "D");
  state.serverNumber = 1;
  const resolved = resolveReceivingPlayer(state);
  assert.equal(resolved.ok, true);
  state.receivingPlayerId = resolved.receivingPlayerId;
  assert.equal(state.receivingPlayerId, "A");
  assert.equal(resolveServeDirection(state), SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT);
});

test("4 FAR LEFT → receiver B and FAR_LEFT_TO_NEAR_RIGHT", () => {
  let state = initStartedMatch();
  state = setServerAt(state, "C");
  state.serverNumber = 1;
  const resolved = resolveReceivingPlayer(state);
  state.receivingPlayerId = resolved.receivingPlayerId;
  assert.equal(state.receivingPlayerId, "B");
  assert.equal(resolveServeDirection(state), SERVE_DIRECTION.FAR_LEFT_TO_NEAR_RIGHT);
});

test("5 server and receiver never same team", () => {
  const state = initStartedMatch();
  const server = findPlayerInState(state, state.servingPlayerId);
  const receiver = findPlayerInState(state, state.receivingPlayerId);
  assert.notEqual(server.teamId, receiver.teamId);
});

test("6 receiver not determined by array index", () => {
  const config = buildDoublesSideOutConfig({
    teams: {
      teamA: {
        teamId: "team-a",
        courtEnd: COURT_END.NEAR_END,
        players: [
          { playerId: "B", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
          { playerId: "A", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
        ],
      },
      teamB: {
        teamId: "team-b",
        courtEnd: COURT_END.FAR_END,
        players: [
          { playerId: "D", logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT },
          { playerId: "C", logicalServiceSide: LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT },
        ],
      },
    },
  });
  const state = initStartedMatch(config);
  assert.equal(state.receivingPlayerId, "D");
});

test("7 receiver changes when serving team switches logical side", () => {
  let state = initStartedMatch();
  assert.equal(state.receivingPlayerId, "D");
  state = applySideOutScoringEvent(state, "team-a", {}).state;
  assert.equal(state.receivingPlayerId, "C");
});

test("8 receiver identity preserved when only switching ends", () => {
  let state = initStartedMatch();
  const beforeReceiver = state.receivingPlayerId;
  const switched = applySwitchEnds(state);
  assert.equal(switched.state.receivingPlayerId, beforeReceiver);
});

// ─── Side-out doubles (9-16) ───────────────────────────────────────

test("9 serving team wins awards point", () => {
  const state = initStartedMatch();
  const result = applySideOutScoringEvent(state, "team-a", {});
  assert.equal(result.state.teams.teamA.score, 1);
});

test("10 serving team wins switches partner sides", () => {
  const state = initStartedMatch();
  const result = applySideOutScoringEvent(state, "team-a", {});
  assert.equal(findPlayerInState(result.state, "A").logicalServiceSide, LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT);
  assert.equal(findPlayerInState(result.state, "B").logicalServiceSide, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
});

test("11 receiving team holds positions on serving team point", () => {
  const state = initStartedMatch();
  const beforeC = findPlayerInState(state, "C").logicalServiceSide;
  const beforeD = findPlayerInState(state, "D").logicalServiceSide;
  const result = applySideOutScoringEvent(state, "team-a", {});
  assert.equal(findPlayerInState(result.state, "C").logicalServiceSide, beforeC);
  assert.equal(findPlayerInState(result.state, "D").logicalServiceSide, beforeD);
});

test("12 server 1 loss activates server 2", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  assert.equal(state.serverNumber, 2);
  assert.equal(state.servingPlayerId, "B");
});

test("13 server 2 loss causes side-out", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  assert.equal(state.serverNumber, 1);
  assert.equal(state.servingTeamId, "team-b");
});

test("14 side-out picks correct server on new team", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  assert.equal(state.servingPlayerId, "D");
});

test("15 side-out resolves correct receiver", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  assert.equal(state.receivingPlayerId, "A");
});

test("16 receiving team win does not add points in side-out", () => {
  let state = initStartedMatch();
  const scoreBefore = state.teams.teamB.score;
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  assert.equal(state.teams.teamB.score, scoreBefore);
});

// ─── Switch ends (17-23) ─────────────────────────────────────────

test("17 switch ends swaps team court ends", () => {
  const state = initStartedMatch();
  const result = applySwitchEnds(state);
  assert.equal(result.state.teams.teamA.courtEnd, COURT_END.FAR_END);
  assert.equal(result.state.teams.teamB.courtEnd, COURT_END.NEAR_END);
});

test("18 switch ends preserves score", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-a", {}).state;
  const result = applySwitchEnds(state);
  assert.equal(result.state.teams.teamA.score, 1);
});

test("19 switch ends preserves server number", () => {
  let state = initStartedMatch();
  state = applySideOutScoringEvent(state, "team-b", {}).state;
  const result = applySwitchEnds(state);
  assert.equal(result.state.serverNumber, 2);
});

test("20 switch ends preserves server identity", () => {
  let state = initStartedMatch();
  const server = state.servingPlayerId;
  const result = applySwitchEnds(state);
  assert.equal(result.state.servingPlayerId, server);
});

test("21 switch ends preserves receiver identity", () => {
  const state = initStartedMatch();
  const receiver = state.receivingPlayerId;
  const result = applySwitchEnds(state);
  assert.equal(result.state.receivingPlayerId, receiver);
});

test("22 switch ends inverts arrow direction", () => {
  const state = initStartedMatch();
  const before = resolveServeDirection(state);
  const after = resolveServeDirection(applySwitchEnds(state).state);
  assert.equal(before, SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT);
  assert.equal(after, SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT);
});

test("23 switch ends preserves logical service sides", () => {
  const state = initStartedMatch();
  const result = applySwitchEnds(state);
  assert.equal(findPlayerInState(result.state, "A").logicalServiceSide, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
});

// ─── Singles (24-27) ───────────────────────────────────────────────

test("24 singles even score serves right", () => {
  const init = initializeMatchState(buildSinglesConfig());
  assert.equal(init.ok, true);
  const state = { ...init.state, status: MATCH_STATUS.IN_PROGRESS };
  assert.equal(serviceSideForScore(0), LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
  assert.equal(
    findPlayerInState(state, "P1").logicalServiceSide,
    LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
  );
});

test("25 singles odd score serves left", () => {
  let state = initStartedMatch(buildSinglesConfig());
  state = applySinglesSideOutEvent(state, "team-a", {}).state;
  assert.equal(state.teams.teamA.score, 1);
  assert.equal(
    findPlayerInState(state, "P1").logicalServiceSide,
    LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT
  );
});

test("26 singles receiver is only opponent", () => {
  const state = initStartedMatch(buildSinglesConfig());
  assert.equal(state.receivingPlayerId, "P2");
});

test("27 singles has no server number", () => {
  const state = initStartedMatch(buildSinglesConfig());
  assert.equal(state.serverNumber, null);
});

// ─── Event & undo (28-35) ──────────────────────────────────────────

test("28 version conflict rejected", () => {
  const state = initStartedMatch();
  const result = applyMatchEvent(state, {
    eventId: "x",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version - 1,
    actorId: "ref",
    payload: {},
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "VERSION_CONFLICT");
});

test("29 duplicate sequence rejected", () => {
  const state = initStartedMatch();
  const result = applyMatchEvent(state, {
    eventId: "x",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: 3,
    expectedVersion: 1,
    actorId: "ref",
    payload: {},
  });
  assert.equal(result.ok, false);
});

test("30 rebuild from events matches live state", () => {
  const init = initializeMatchState(buildDoublesSideOutConfig());
  const base = init.state;
  const events = [
    {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    },
    {
      eventId: "e2",
      eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      sequence: 2,
      expectedVersion: 1,
      actorId: "ref",
      payload: {},
    },
  ];

  let live = base;
  for (const event of events) {
    live = applyMatchEvent(live, event).nextState;
  }

  const rebuilt = rebuildMatchState(base, events);
  assert.equal(rebuilt.ok, true);
  assert.equal(statesEqual(rebuilt.state, live), true);
});

test("31 undo restores score", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const event = {
    eventId: "e2",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: 2,
    expectedVersion: 1,
    actorId: "ref",
    payload: {},
  };
  state = applyMatchEvent(state, event).nextState;
  const undone = undoLastEvent(state, [event], { initialState: initial, baseState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamA.score, 0);
});

test("32 undo restores positions", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const startEvt = {
    eventId: "e1",
    eventType: MATCH_EVENT_TYPE.START_MATCH,
    sequence: 1,
    expectedVersion: 0,
    actorId: "ref",
    payload: {},
  };
  const rallyEvt = {
    eventId: "e2",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: 2,
    expectedVersion: 1,
    actorId: "ref",
    payload: {},
  };
  state = applyMatchEvent(state, rallyEvt).nextState;
  const undone = undoLastEvent(state, [startEvt, rallyEvt], {
    initialState: initial,
    baseState: initial,
  });
  assert.equal(
    findPlayerInState(undone.nextState, "A").logicalServiceSide,
    LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
  );
});

test("33 undo restores server", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const events = [
    {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    },
    {
      eventId: "e2",
      eventType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
      sequence: 2,
      expectedVersion: 1,
      actorId: "ref",
      payload: {},
    },
  ];
  state = applyMatchEvent(state, events[1]).nextState;
  const undone = undoLastEvent(state, events, { initialState: initial, baseState: initial });
  assert.equal(undone.nextState.servingPlayerId, "A");
});

test("34 undo restores receiver", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const events = [
    {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    },
    {
      eventId: "e2",
      eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      sequence: 2,
      expectedVersion: 1,
      actorId: "ref",
      payload: {},
    },
  ];
  state = applyMatchEvent(state, events[1]).nextState;
  const undone = undoLastEvent(state, events, { initialState: initial, baseState: initial });
  assert.equal(undone.nextState.receivingPlayerId, "D");
});

test("35 locked match cannot apply rally", () => {
  let state = initStartedMatch();
  state.status = MATCH_STATUS.LOCKED;
  const result = applyEvent(state, MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, state.lastEventSequence + 1);
  assert.equal(result.ok, false);
  assert.equal(result.code, "MATCH_LOCKED");
});

test("screen mapping uses diagonal cross for FAR end logical RIGHT", () => {
  const screen = logicalPositionToScreenPosition({
    courtEnd: COURT_END.FAR_END,
    logicalServiceSide: LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT,
  });
  assert.equal(screen, SCREEN_POSITION.SCREEN_TOP_LEFT);
});
