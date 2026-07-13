import test from "node:test";
import assert from "node:assert/strict";

import { COURT_END } from "../../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../../src/features/referee-v5/constants/courtSides.js";
import {
  MATCH_EVENT_TYPE,
  MATCH_STATUS,
} from "../../src/features/referee-v5/constants/eventTypes.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../src/features/referee-v5/constants/scoringStrategy.js";
import { findPlayerInState } from "../../src/features/referee-v5/domain/matchState.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import {
  rebuildMatchState,
  statesEqual,
  domainStatesEqual,
} from "../../src/features/referee-v5/engines/stateReplayEngine.js";
import { undoLastEvent } from "../../src/features/referee-v5/engines/undoEngine.js";
import { ScoringStrategyRegistry } from "../../src/features/referee-v5/engines/scoring/ScoringStrategyRegistry.js";
import { resolveRuleSetId } from "../../src/features/referee-v5/engines/scoring/formatResolution.js";
import { extractMatchFormatSnapshot } from "../../src/features/referee-v5/engines/scoring/matchFormatIntegrity.js";
import { hashMatchStateCanonical } from "../../src/features/referee-v5/persistence/canonicalStateHash.js";
import { resolveServeDirection } from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import {
  buildDoublesSideOutConfig,
  buildDoublesUsapRallyConfig,
  initStartedUsapRallyMatch,
} from "./testHelpers.js";

function startEvent() {
  return {
    eventId: "e-start",
    eventType: MATCH_EVENT_TYPE.START_MATCH,
    sequence: 1,
    expectedVersion: 0,
    actorId: "ref-1",
    payload: {},
  };
}

function rallyEvent(state, eventType, eventId) {
  return {
    eventId,
    eventType,
    sequence: state.lastEventSequence + 1,
    expectedVersion: state.version,
    actorId: "ref-1",
    payload: {},
  };
}

function playLive(initialState, eventTypes) {
  const history = [startEvent()];
  let state = applyMatchEvent(initialState, history[0]).nextState;

  for (let i = 0; i < eventTypes.length; i += 1) {
    const event = rallyEvent(state, eventTypes[i], `e-${i + 2}`);
    const result = applyMatchEvent(state, event);
    assert.equal(result.ok, true, `live event ${eventTypes[i]} failed: ${result.error}`);
    state = result.nextState;
    history.push(event);
  }

  return { state, history, initialState };
}

function winToScore(initialState, teamAWins, teamBWins = 0) {
  const types = [];
  for (let i = 0; i < teamAWins; i += 1) {
    types.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);
  }
  for (let i = 0; i < teamBWins; i += 1) {
    types.push(MATCH_EVENT_TYPE.TEAM_B_WON_RALLY);
  }
  return playLive(initialState, types);
}

// ─── Replay ───────────────────────────────────────────────────────

test("1 full Rally doubles replay matches live state", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: live, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  ]);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.ruleSetId, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
  assert.equal(statesEqual(rebuilt.state, live), true);
  assert.equal(domainStatesEqual(rebuilt.state, live), true);
});

test("2 replay with multiple score changes preserves scores", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: live, history } = winToScore(initial, 5, 3);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.teams.teamA.score, 5);
  assert.equal(rebuilt.state.teams.teamB.score, 3);
  assert.equal(rebuilt.state.teams.teamA.score, live.teams.teamA.score);
});

test("3 replay after service possession changes", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: live, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
  ]);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.servingTeamId, "team-b");
  assert.equal(rebuilt.state.servingPlayerId, live.servingPlayerId);
  assert.equal(rebuilt.state.receivingPlayerId, live.receivingPlayerId);
  assert.equal(rebuilt.state.serverNumber, null);
});

test("4 replay after switch ends", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: live, history } = playLive(initial, [
    MATCH_EVENT_TYPE.SWITCH_ENDS,
  ]);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.teams.teamA.courtEnd, COURT_END.FAR_END);
  assert.equal(rebuilt.state.teams.teamB.courtEnd, COURT_END.NEAR_END);
  assert.equal(rebuilt.state.servingPlayerId, live.servingPlayerId);
  assert.equal(rebuilt.state.receivingPlayerId, live.receivingPlayerId);
  assert.equal(statesEqual(rebuilt.state, live), true);
});

test("5 replay game completion at 11-9", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const types = [];
  for (let i = 0; i < 10; i += 1) types.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);
  for (let i = 0; i < 9; i += 1) types.push(MATCH_EVENT_TYPE.TEAM_B_WON_RALLY);
  types.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);

  const { state: live, history } = playLive(initial, types);
  const rebuilt = rebuildMatchState(initial, history);

  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.teams.teamA.score, 11);
  assert.equal(rebuilt.state.teams.teamB.score, 9);
  assert.equal(statesEqual(rebuilt.state, live), true);
});

test("6 replay match completion via forfeit", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: started, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  ]);
  const forfeit = {
    eventId: "e-forfeit",
    eventType: MATCH_EVENT_TYPE.DECLARE_FORFEIT,
    sequence: started.lastEventSequence + 1,
    expectedVersion: started.version,
    actorId: "ref-1",
    payload: {},
  };
  const live = applyMatchEvent(started, forfeit).nextState;
  history.push(forfeit);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.status, MATCH_STATUS.COMPLETED);
  assert.equal(rebuilt.state.teams.teamA.score, 1);
  assert.equal(statesEqual(rebuilt.state, live), true);
});

// ─── Undo ─────────────────────────────────────────────────────────

test("7 undo last Rally point restores score", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state, history } = playLive(initial, [MATCH_EVENT_TYPE.TEAM_A_WON_RALLY]);
  assert.equal(state.teams.teamA.score, 1);

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamA.score, 0);
  assert.equal(undone.nextState.servingPlayerId, "A");
});

test("8 undo service change restores possession", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state, history } = playLive(initial, [MATCH_EVENT_TYPE.TEAM_B_WON_RALLY]);
  assert.equal(state.servingTeamId, "team-b");

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.servingTeamId, "team-a");
  assert.equal(undone.nextState.servingPlayerId, "A");
  assert.equal(undone.nextState.receivingPlayerId, "D");
  assert.equal(
    resolveServeDirection(undone.nextState),
    resolveServeDirection(initStartedUsapRallyMatch())
  );
});

test("9 undo switch ends restores court ends", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state, history } = playLive(initial, [MATCH_EVENT_TYPE.SWITCH_ENDS]);
  assert.equal(state.teams.teamA.courtEnd, COURT_END.FAR_END);

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamA.courtEnd, COURT_END.NEAR_END);
  assert.equal(undone.nextState.teams.teamB.courtEnd, COURT_END.FAR_END);
  assert.equal(undone.nextState.servingPlayerId, "A");
  assert.equal(undone.nextState.receivingPlayerId, "D");
});

test("10 undo game completion restores prior score", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const types = [];
  for (let i = 0; i < 10; i += 1) types.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);
  for (let i = 0; i < 9; i += 1) types.push(MATCH_EVENT_TYPE.TEAM_B_WON_RALLY);
  types.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);

  const { state, history } = playLive(initial, types);
  assert.equal(state.teams.teamA.score, 11);

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamA.score, 10);
  assert.equal(undone.nextState.teams.teamB.score, 9);
});

test("11 original event remains present after undo", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state, history } = playLive(initial, [MATCH_EVENT_TYPE.TEAM_A_WON_RALLY]);
  const originalId = history[1].eventId;

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.ok(undone.eventHistory.some((e) => e.eventId === originalId));
  assert.ok(
    undone.eventHistory.some((e) => e.eventType === MATCH_EVENT_TYPE.EVENT_REVERTED)
  );
});

test("12 EVENT_REVERTED is not applied twice on replay", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
  ]);

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamB.score, 0);
  assert.equal(undone.nextState.teams.teamA.score, 1);

  const rebuilt = rebuildMatchState(initial, undone.eventHistory);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.state.teams.teamA.score, 1);
  assert.equal(rebuilt.state.teams.teamB.score, 0);
  assert.equal(domainStatesEqual(rebuilt.state, undone.nextState), true);
});

// ─── Integrity ────────────────────────────────────────────────────

test("13 snapshot equals replay for Rally match", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state: snapshot, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  ]);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(statesEqual(rebuilt.state, snapshot), true);
});

test("14 canonical hash is stable across key order", () => {
  const state = initStartedUsapRallyMatch();
  const hashA = hashMatchStateCanonical(state);
  const reordered = {
    winBy: state.winBy,
    teams: state.teams,
    scoringVariant: state.scoringVariant,
    scoringSystem: state.scoringSystem,
    ...state,
  };
  const hashB = hashMatchStateCanonical(reordered);
  assert.equal(hashA, hashB);
});

test("15 scoring format participates in state integrity hash", () => {
  const state = initStartedUsapRallyMatch();
  const baseHash = hashMatchStateCanonical(state);
  const withoutVariant = { ...state };
  delete withoutVariant.scoringVariant;
  assert.notEqual(hashMatchStateCanonical(withoutVariant), baseHash);

  const differentRule = {
    ...state,
    ruleSetId: RULE_SET_ID.SIDE_OUT_DOUBLES_V1,
  };
  assert.notEqual(hashMatchStateCanonical(differentRule), baseHash);

  const format = extractMatchFormatSnapshot(state);
  assert.equal(format.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(format.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
  assert.equal(format.freezeRule, "NONE");
  assert.equal(format.serverNumberRule, "NONE");
});

test("16 missing Rally variant fails resolution and replay", () => {
  const incomplete = {
    matchType: "doubles",
    scoringSystem: SCORING_SYSTEM.RALLY,
  };
  assert.throws(() => resolveRuleSetId(incomplete), (error) => {
    assert.equal(error.code, "SCORING_VARIANT_REQUIRED");
    return true;
  });

  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const broken = { ...initial };
  delete broken.scoringVariant;
  delete broken.ruleSetId;

  const rebuilt = rebuildMatchState(broken, [startEvent()]);
  assert.equal(rebuilt.ok, false);
  assert.equal(rebuilt.error, "SCORING_VARIANT_REQUIRED");
});

test("17 unsupported Rally variant fails", () => {
  const state = {
    matchType: "doubles",
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: "MLP_DREAMBREAKER",
  };
  assert.throws(() => resolveRuleSetId(state), (error) => {
    assert.equal(error.code, "UNKNOWN_SCORING_VARIANT");
    return true;
  });

  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const broken = {
    ...initial,
    scoringVariant: "MLP_DREAMBREAKER",
    ruleSetId: undefined,
  };
  delete broken.ruleSetId;
  const rebuilt = rebuildMatchState(broken, []);
  assert.equal(rebuilt.ok, false);
  assert.equal(rebuilt.error, "UNKNOWN_SCORING_VARIANT");
});

test("18 Rally does not fallback to Side-Out", () => {
  const usap = initStartedUsapRallyMatch();
  assert.equal(
    ScoringStrategyRegistry.resolve(usap).id,
    RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1
  );
  assert.notEqual(
    ScoringStrategyRegistry.resolve(usap).id,
    RULE_SET_ID.SIDE_OUT_DOUBLES_V1
  );

  const mutateAttempt = applyMatchEvent(usap, {
    eventId: "bad",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: usap.lastEventSequence + 1,
    expectedVersion: usap.version,
    actorId: "ref",
    payload: {
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      scoringVariant: "SIDE_OUT_DOUBLES_V1",
    },
  });
  assert.equal(mutateAttempt.ok, false);
  assert.equal(mutateAttempt.code, "SCORING_FORMAT_IMMUTABLE");
});

test("19 legacy Side-Out replay still passes", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  assert.equal(initial.scoringSystem, undefined);

  const { state: live, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
  ]);

  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.ruleSetId, RULE_SET_ID.SIDE_OUT_DOUBLES_V1);
  assert.equal(statesEqual(rebuilt.state, live), true);
  assert.equal(live.servingPlayerId, rebuilt.state.servingPlayerId);
});

test("20 Side-Out undo regression still passes", () => {
  const initial = initializeMatchState(buildDoublesSideOutConfig()).state;
  const { state, history } = playLive(initial, [
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  ]);
  assert.equal(state.teams.teamA.score, 1);

  const undone = undoLastEvent(state, history, { initialState: initial });
  assert.equal(undone.ok, true);
  assert.equal(undone.nextState.teams.teamA.score, 0);
  assert.equal(
    findPlayerInState(undone.nextState, "A").logicalServiceSide,
    LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
  );
});

test("format fields survive multi-event Rally play", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const { state } = winToScore(initial, 6, 2);

  assert.equal(state.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(state.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
  assert.equal(state.ruleSetId, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
  assert.equal(state.freezeRule, "NONE");
  assert.equal(state.serverNumberRule, "NONE");
  assert.equal(state.teams.teamA.courtEnd, COURT_END.FAR_END);
});

test("replay rejects format mutation mid-history", () => {
  const initial = initializeMatchState(buildDoublesUsapRallyConfig()).state;
  const history = [
    startEvent(),
    {
      eventId: "e2",
      eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      sequence: 2,
      expectedVersion: 1,
      actorId: "ref",
      payload: { pointsToWin: 21 },
    },
  ];
  const rebuilt = rebuildMatchState(initial, history);
  assert.equal(rebuilt.ok, false);
  assert.equal(rebuilt.error, "SCORING_FORMAT_IMMUTABLE");
});

test("UI presentation fields do not affect domain hash helper equality", () => {
  const a = initStartedUsapRallyMatch();
  const b = {
    ...a,
    connectionStatus: "connected",
    __uiOnly: { label: "ignore me" },
  };
  assert.equal(domainStatesEqual(a, b), true);
  assert.notEqual(hashMatchStateCanonical(a), hashMatchStateCanonical(b));
});
