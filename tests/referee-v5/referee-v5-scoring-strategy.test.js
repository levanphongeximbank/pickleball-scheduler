import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import { MATCH_TYPE } from "../../src/features/referee-v5/constants/matchTypes.js";
import { SCORING_FORMAT } from "../../src/features/referee-v5/constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../src/features/referee-v5/constants/scoringStrategy.js";
import { ScoringStrategyRegistry } from "../../src/features/referee-v5/engines/scoring/ScoringStrategyRegistry.js";
import { resolveRuleSetId } from "../../src/features/referee-v5/engines/scoring/formatResolution.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import {
  applyEvent,
  buildDoublesSideOutConfig,
  buildSinglesConfig,
  initStartedMatch,
} from "./testHelpers.js";

function legacyDoublesSideOutState(overrides = {}) {
  return {
    matchType: MATCH_TYPE.DOUBLES,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
    ...overrides,
  };
}

test("resolve legacy doubles side-out without scoringSystem", () => {
  const id = resolveRuleSetId(legacyDoublesSideOutState());
  assert.equal(id, RULE_SET_ID.SIDE_OUT_DOUBLES_V1);
  assert.equal(ScoringStrategyRegistry.resolve(legacyDoublesSideOutState()).id, id);
});

test("resolve legacy doubles side-out when scoringFormat omitted", () => {
  const state = { matchType: MATCH_TYPE.DOUBLES };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.SIDE_OUT_DOUBLES_V1);
});

test("resolve legacy doubles rally does not fall back to side-out", () => {
  const state = {
    matchType: MATCH_TYPE.DOUBLES,
    scoringFormat: SCORING_FORMAT.RALLY,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.RALLY_DOUBLES_LEGACY_PROTOTYPE_V1);
  assert.equal(ScoringStrategyRegistry.resolve(state).id, RULE_SET_ID.RALLY_DOUBLES_LEGACY_PROTOTYPE_V1);
});

test("resolve by explicit ruleSetId", () => {
  const state = { ruleSetId: RULE_SET_ID.SIDE_OUT_DOUBLES_V1 };
  assert.equal(ScoringStrategyRegistry.resolve(state).id, RULE_SET_ID.SIDE_OUT_DOUBLES_V1);
});

test("resolve canonical SIDE_OUT doubles", () => {
  const state = {
    matchType: MATCH_TYPE.DOUBLES,
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    scoringVariant: SCORING_VARIANT.SIDE_OUT_DOUBLES_V1,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.SIDE_OUT_DOUBLES_V1);
});

test("resolve canonical SIDE_OUT singles", () => {
  const state = {
    matchType: MATCH_TYPE.SINGLES,
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    scoringVariant: SCORING_VARIANT.SIDE_OUT_SINGLES_V1,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.SIDE_OUT_SINGLES_V1);
  assert.equal(ScoringStrategyRegistry.resolve(state).id, RULE_SET_ID.SIDE_OUT_SINGLES_V1);
});

test("resolve legacy singles side-out", () => {
  const state = {
    matchType: MATCH_TYPE.SINGLES,
    scoringFormat: SCORING_FORMAT.SIDE_OUT,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.SIDE_OUT_SINGLES_V1);
});

test("resolve legacy singles rally", () => {
  const state = {
    matchType: MATCH_TYPE.SINGLES,
    scoringFormat: SCORING_FORMAT.RALLY,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.RALLY_SINGLES_LEGACY_V1);
});

test("USAP 2026 rally variant resolves to canonical strategy", () => {
  const state = {
    matchType: MATCH_TYPE.DOUBLES,
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
  };
  assert.equal(resolveRuleSetId(state), RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
  assert.equal(
    ScoringStrategyRegistry.resolve(state).id,
    RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1
  );
});

test("canonical RALLY without variant throws", () => {
  const state = {
    matchType: MATCH_TYPE.DOUBLES,
    scoringSystem: SCORING_SYSTEM.RALLY,
  };
  assert.throws(
    () => resolveRuleSetId(state),
    (error) => {
      assert.equal(error.code, "SCORING_VARIANT_REQUIRED");
      return true;
    }
  );
});

test("unknown ruleSetId throws", () => {
  assert.throws(
    () => ScoringStrategyRegistry.resolve({ ruleSetId: "unknown_ruleset" }),
    (error) => {
      assert.equal(error.code, "UNKNOWN_RULE_SET");
      return true;
    }
  );
});

test("matchStateEngine side-out doubles behavior unchanged via registry", () => {
  const state = initStartedMatch();
  const result = applyEvent(state, MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, 2);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.teams.teamA.score, 1);
  assert.equal(result.nextState.servingPlayerId, "A");
});

test("legacy rally doubles scores through prototype strategy", () => {
  const started = initStartedMatch(
    buildDoublesSideOutConfig({ scoringFormat: SCORING_FORMAT.RALLY })
  );
  const result = applyEvent(started, MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, 2);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.teams.teamA.score, 1);
});

test("USAP rally apply succeeds at match engine layer", () => {
  const started = initStartedMatch(
    buildDoublesSideOutConfig({
      scoringSystem: SCORING_SYSTEM.RALLY,
      scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
      scoringFormat: SCORING_FORMAT.RALLY,
      ruleSetId: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,
    })
  );
  const result = applyMatchEvent(started, {
    eventId: "e-rally",
    eventType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    sequence: 2,
    expectedVersion: started.version,
    actorId: "ref-1",
    payload: {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.nextState.teams.teamA.score, 1);
  assert.equal(result.nextState.serverNumber, null);
});

test("singles side-out via registry preserves no point on receive win", () => {
  const config = buildSinglesConfig();
  const started = initStartedMatch(config);
  const result = applyEvent(started, MATCH_EVENT_TYPE.TEAM_B_WON_RALLY, 2);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.teams.teamA.score, 0);
  assert.equal(result.nextState.teams.teamB.score, 0);
});
