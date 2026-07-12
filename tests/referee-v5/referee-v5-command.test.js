import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import { RALLY_VARIANT } from "../../src/features/referee-v5/constants/scoringFormats.js";
import { dispatchMatchCommand } from "../../src/features/referee-v5/engines/matchCommandDispatcher.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { resolveServeDirection } from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import {
  applyEvent,
  buildDoublesSideOutConfig,
  initStartedMatch,
} from "./testHelpers.js";

function buildUndoCommand(state) {
  return {
    eventId: "undo-1",
    eventType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version,
    actorId: "ref-1",
    payload: {},
  };
}

test("UNDO_LAST_EVENT via dispatchMatchCommand restores score", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  let state = initStartedMatch();
  const history = [
    {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    },
  ];

  const rally = applyEvent(state, MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, 2);
  state = rally.nextState;
  history.push({
    eventId: "e2",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: 2,
    expectedVersion: 1,
    actorId: "ref",
    payload: {},
  });

  const undo = dispatchMatchCommand({
    state,
    command: buildUndoCommand(state),
    history,
    initialState: initial,
  });

  assert.equal(undo.ok, true);
  assert.equal(undo.nextState.teams.teamA.score, 0);
  assert.equal(undo.generatedEvents[0], MATCH_EVENT_TYPE.EVENT_REVERTED);
});

test("UNDO_LAST_EVENT via applyMatchEvent with eventHistory", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  let state = initStartedMatch();
  const history = [
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
  state = applyMatchEvent(state, history[1]).nextState;

  const undo = applyMatchEvent(state, buildUndoCommand(state), {}, {
    eventHistory: history,
    initialState: initial,
  });

  assert.equal(undo.ok, true);
  assert.equal(undo.nextState.receivingPlayerId, "D");
  assert.equal(resolveServeDirection(undo.nextState), "NEAR_RIGHT_TO_FAR_LEFT");
});

test("MLP rally config rejected at initialize", () => {
  const result = initializeMatchState({
    ...buildDoublesSideOutConfig(),
    scoringFormat: "rally",
    rallyVariant: RALLY_VARIANT.MLP,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("MLP_RALLY_NOT_SUPPORTED"));
});

test("controller chain three rallies then undo", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  let state = initStartedMatch();
  let history = [];

  for (const [idx, eventType] of [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
  ].entries()) {
    const command = {
      eventId: `r-${idx}`,
      eventType,
      sequence: state.lastEventSequence + 1,
      expectedVersion: state.version,
      actorId: "ref",
      payload: {},
    };
    const result = dispatchMatchCommand({ state, command, history, initialState: initial });
    assert.equal(result.ok, true);
    state = result.nextState;
    history = result.eventHistory;
  }

  assert.equal(state.teams.teamA.score, 1);
  assert.equal(state.serverNumber, 1);
  assert.equal(state.servingTeamId, "team-b");
});

test("server 1 to server 2 to side-out via dispatch", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  let history = [];

  for (const eventType of [MATCH_EVENT_TYPE.TEAM_B_WON_RALLY, MATCH_EVENT_TYPE.TEAM_B_WON_RALLY]) {
    const command = {
      eventId: eventType,
      eventType,
      sequence: state.lastEventSequence + 1,
      expectedVersion: state.version,
      actorId: "ref",
      payload: {},
    };
    const result = dispatchMatchCommand({ state, command, history, initialState: initial });
    state = result.nextState;
    history = result.eventHistory;
  }

  assert.equal(state.serverNumber, 1);
  assert.equal(state.servingTeamId, "team-b");
  assert.equal(state.servingPlayerId, "D");
});

test("switch ends via dispatch preserves server and inverts direction", () => {
  let state = initStartedMatch();
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const beforeDir = resolveServeDirection(state);
  const server = state.servingPlayerId;
  const receiver = state.receivingPlayerId;

  const command = {
    eventId: "sw",
    eventType: MATCH_EVENT_TYPE.SWITCH_ENDS,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version,
    actorId: "ref",
    payload: {},
  };
  const result = dispatchMatchCommand({
    state,
    command,
    history: [
      {
        eventId: "e1",
        eventType: MATCH_EVENT_TYPE.START_MATCH,
        sequence: 1,
        expectedVersion: 0,
        actorId: "ref",
        payload: {},
      },
    ],
    initialState: initial,
  });

  assert.equal(result.ok, true);
  assert.equal(result.nextState.servingPlayerId, server);
  assert.equal(result.nextState.receivingPlayerId, receiver);
  assert.notEqual(resolveServeDirection(result.nextState), beforeDir);
});

test("undo after switch ends restores direction", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  let state = initStartedMatch();
  let history = [
    {
      eventId: "e1",
      eventType: MATCH_EVENT_TYPE.START_MATCH,
      sequence: 1,
      expectedVersion: 0,
      actorId: "ref",
      payload: {},
    },
  ];

  const switchCmd = {
    eventId: "e2",
    eventType: MATCH_EVENT_TYPE.SWITCH_ENDS,
    sequence: 2,
    expectedVersion: 1,
    actorId: "ref",
    payload: {},
  };
  const switched = dispatchMatchCommand({ state, command: switchCmd, history, initialState: initial });
  state = switched.nextState;
  history = switched.eventHistory;

  const beforeUndoDir = resolveServeDirection(state);
  const undo = dispatchMatchCommand({
    state,
    command: buildUndoCommand(state),
    history,
    initialState: initial,
  });

  assert.equal(undo.ok, true);
  assert.equal(resolveServeDirection(undo.nextState), "NEAR_RIGHT_TO_FAR_LEFT");
  assert.notEqual(resolveServeDirection(undo.nextState), beforeUndoDir);
});
