import test from "node:test";
import assert from "node:assert/strict";

import { COURT_END } from "../../src/features/referee-v5/constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../../src/features/referee-v5/constants/courtSides.js";
import { DOMAIN_EVENT_TYPE, MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../src/features/referee-v5/constants/scoringStrategy.js";
import { findPlayerInState } from "../../src/features/referee-v5/domain/matchState.js";
import { ScoringStrategyRegistry } from "../../src/features/referee-v5/engines/scoring/ScoringStrategyRegistry.js";
import {
  applyUsap2026ProvisionalRallyDoubles,
  resolveSideSwitchThreshold,
  serviceSideForScore,
} from "../../src/features/referee-v5/engines/scoring/strategies/usap2026ProvisionalRallyDoublesStrategy.js";
import { resolveReceivingPlayer } from "../../src/features/referee-v5/engines/receiverResolver.js";
import {
  applyEvent,
  buildDoublesUsapRallyConfig,
  initStartedMatch,
  initStartedUsapRallyMatch,
} from "./testHelpers.js";

function rally(state, winningTeamId) {
  return applyUsap2026ProvisionalRallyDoubles(state, winningTeamId, {
    pointsToWin: state.pointsToWin,
    winBy: state.winBy,
  });
}

function winRalliesForTeam(state, teamId, count) {
  let next = state;
  for (let i = 0; i < count; i += 1) {
    const result = rally(next, teamId);
    assert.equal(result.ok, true, `rally ${i + 1} failed`);
    next = result.state;
  }
  return next;
}

// ─── Registry & helpers ───────────────────────────────────────────

test("USAP 2026 strategy resolves from canonical format", () => {
  const state = {
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    matchType: "doubles",
  };
  assert.equal(
    ScoringStrategyRegistry.resolve(state).id,
    RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1
  );
});

test("side switch threshold for 11 / 15 / 21", () => {
  assert.equal(resolveSideSwitchThreshold(11), 6);
  assert.equal(resolveSideSwitchThreshold(15), 8);
  assert.equal(resolveSideSwitchThreshold(21), 11);
});

test("service side parity even right odd left", () => {
  assert.equal(serviceSideForScore(0), LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
  assert.equal(serviceSideForScore(1), LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT);
  assert.equal(serviceSideForScore(2), LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
});

// ─── Rally scoring ────────────────────────────────────────────────

test("every rally awards a point including receive win", () => {
  let state = initStartedUsapRallyMatch();
  state = rally(state, "team-a").state;
  assert.equal(state.teams.teamA.score, 1);

  state = rally(state, "team-b").state;
  assert.equal(state.teams.teamB.score, 1);
  assert.equal(state.teams.teamA.score, 1);
});

test("serving team win keeps same server", () => {
  const state = initStartedUsapRallyMatch();
  const result = rally(state, "team-a");
  assert.equal(result.state.servingPlayerId, "A");
  assert.equal(result.state.servingTeamId, "team-a");
});

test("serverNumber is null in USAP rally", () => {
  const state = initStartedUsapRallyMatch();
  const result = rally(state, "team-a");
  assert.equal(result.state.serverNumber, null);
});

test("serve loss causes side-out not server 2", () => {
  let state = initStartedUsapRallyMatch();
  state = rally(state, "team-b").state;
  assert.equal(state.servingTeamId, "team-b");
  assert.equal(state.serverNumber, null);
  assert.notEqual(state.servingPlayerId, "A");
});

test("side-out emits SIDE_OUT and SERVE_CHANGED", () => {
  const state = initStartedUsapRallyMatch();
  const result = rally(state, "team-b");
  assert.ok(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.SIDE_OUT));
  assert.ok(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.SERVE_CHANGED));
  assert.equal(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.SECOND_SERVER_ACTIVATED), false);
});

// ─── Partner rotation / positions ─────────────────────────────────

test("serving team win rotates partners by score parity", () => {
  let state = initStartedUsapRallyMatch();
  assert.equal(findPlayerInState(state, "A").logicalServiceSide, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);

  state = rally(state, "team-a").state;
  assert.equal(findPlayerInState(state, "A").logicalServiceSide, LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT);
  assert.equal(findPlayerInState(state, "B").logicalServiceSide, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT);
});

test("side-out server starts on correct box for team score", () => {
  let state = initStartedUsapRallyMatch();
  state = rally(state, "team-b").state;
  const server = findPlayerInState(state, state.servingPlayerId);
  assert.equal(server.logicalServiceSide, serviceSideForScore(state.teams.teamB.score));
});

test("receiver stays diagonal after serving team point", () => {
  const state = rally(initStartedUsapRallyMatch(), "team-a").state;
  const resolved = resolveReceivingPlayer(state);
  assert.equal(resolved.ok, true);
  assert.equal(state.receivingPlayerId, resolved.receivingPlayerId);
  const server = findPlayerInState(state, state.servingPlayerId);
  const receiver = findPlayerInState(state, state.receivingPlayerId);
  assert.equal(server.logicalServiceSide, receiver.logicalServiceSide);
  assert.notEqual(server.teamId, receiver.teamId);
});

// ─── Side switching (Rule 21.B) ───────────────────────────────────

test("ends switch when leader reaches 6 in game to 11", () => {
  let state = initStartedUsapRallyMatch();
  state = winRalliesForTeam(state, "team-a", 6);
  assert.equal(state.teams.teamA.courtEnd, COURT_END.FAR_END);
  assert.equal(state.teams.teamB.courtEnd, COURT_END.NEAR_END);
  assert.equal(state.servingPlayerId, "A");
});

test("side switch preserves server identity", () => {
  let state = initStartedUsapRallyMatch();
  const before = state.servingPlayerId;
  state = winRalliesForTeam(state, "team-a", 6);
  assert.equal(state.servingPlayerId, before);
});

// ─── Game completion ──────────────────────────────────────────────

test("game completes at 11-9 win by 2", () => {
  let state = initStartedUsapRallyMatch();
  state = winRalliesForTeam(state, "team-a", 10);
  state = winRalliesForTeam(state, "team-b", 9);
  const result = rally(state, "team-a");
  assert.equal(result.state.teams.teamA.score, 11);
  assert.equal(result.state.teams.teamB.score, 9);
  assert.ok(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.GAME_COMPLETED));
});

test("10-10 requires two point margin", () => {
  let state = initStartedUsapRallyMatch();
  state = winRalliesForTeam(state, "team-a", 10);
  state = winRalliesForTeam(state, "team-b", 10);
  assert.equal(state.teams.teamA.score, 10);
  assert.equal(state.teams.teamB.score, 10);

  let result = rally(state, "team-a");
  assert.equal(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.GAME_COMPLETED), false);

  result = rally(result.state, "team-a");
  assert.ok(result.generatedEvents.includes(DOMAIN_EVENT_TYPE.GAME_COMPLETED));
  assert.equal(result.state.teams.teamA.score, 12);
});

// ─── Match engine integration ─────────────────────────────────────

test("matchStateEngine applies USAP rally through registry", () => {
  const state = initStartedUsapRallyMatch();
  const result = applyEvent(state, MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, 2);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.teams.teamA.score, 1);
  assert.equal(result.nextState.serverNumber, null);
});

test("USAP rally init persists canonical format fields", () => {
  const state = initStartedUsapRallyMatch();
  assert.equal(state.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(state.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
  assert.equal(state.ruleSetId, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
});

test("legacy rally format still uses prototype not USAP", () => {
  const state = initStartedMatch(buildDoublesUsapRallyConfig({
    scoringSystem: undefined,
    scoringVariant: undefined,
    ruleSetId: undefined,
    scoringFormat: "rally",
  }));
  assert.equal(
    ScoringStrategyRegistry.resolve(state).id,
    RULE_SET_ID.RALLY_DOUBLES_LEGACY_PROTOTYPE_V1
  );
});
