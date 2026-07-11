import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPETITION_CONSTRAINT_TYPE,
  CONSTRAINT_SEVERITY,
  COMPETITION_CORE_FLAG_KEYS,
  createRuleSet,
  detectConstraintConflicts,
  evaluateCanonicalRules,
  evaluateHardRules,
  normalizeRuleDefinition,
  preflightRuleSet,
  RULE_ERROR_CODE,
  scoreSoftRules,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
};

test("normalizeRuleDefinition maps legacy avoid_same_group alias", () => {
  const rule = normalizeRuleDefinition({
    type: "avoid_same_group",
    mode: "hard",
    anchorPlayerId: "1",
    targetPlayerIds: ["2"],
  });

  assert.equal(rule?.type, COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION);
  assert.equal(rule?.severity, CONSTRAINT_SEVERITY.HARD);
});

test("detectConstraintConflicts finds contradictory must/must-not", () => {
  const ruleSet = createRuleSet({
    constraints: [
      {
        id: "r1",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
      {
        id: "r2",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
  });

  const conflicts = detectConstraintConflicts(ruleSet);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].code, RULE_ERROR_CODE.CONTRADICTORY_MUST_MUST_NOT);
});

test("detectConstraintConflicts flags unsatisfiable multiple hard must-partner targets", () => {
  const ruleSet = createRuleSet({
    constraints: [
      {
        id: "r1",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
      {
        id: "r2",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["3"] },
      },
    ],
  });

  const conflicts = detectConstraintConflicts(ruleSet);
  assert.equal(conflicts[0].code, RULE_ERROR_CODE.UNSATISFIABLE_MUST_PARTNER);
});

test("evaluateHardRules rejects hard avoid_partner on same team", () => {
  const result = evaluateHardRules(
    [
      {
        id: "avoid-1",
        type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
    {
      scope: "pairing",
      teams: [["1", "2"], ["3", "4"]],
    }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.violations[0].code, RULE_ERROR_CODE.AVOID_PARTNER_VIOLATED);
});

test("evaluateHardRules rejects skill cap breach without negative totalScore hack", () => {
  const result = evaluateHardRules(
    [
      {
        id: "skill-1",
        type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: { maxDiff: 0.5 },
      },
    ],
    {
      scope: "match",
      matchOption: {
        teamA: ["1", "2"],
        teamB: ["3", "4"],
      },
      playersById: {
        1: { skillLevel: 5 },
        2: { skillLevel: 5 },
        3: { skillLevel: 2 },
        4: { skillLevel: 2 },
      },
    }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.violations[0].code, RULE_ERROR_CODE.SKILL_CAP_EXCEEDED);
});

test("scoreSoftRules applies prefer_partner bonus without rejecting candidate", () => {
  const result = scoreSoftRules(
    [
      {
        id: "prefer-1",
        type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
        severity: CONSTRAINT_SEVERITY.SOFT,
        enabled: true,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
    {
      scope: "pairing",
      teams: [["1", "2"], ["3", "4"]],
    }
  );

  assert.ok(result.total > 0);
  assert.equal(result.notes.length, 0);
});

test("evaluateCanonicalRules is no-op when constraints v2 flag off", () => {
  const result = evaluateCanonicalRules(
    createRuleSet({
      constraints: [
        {
          id: "bad",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing", teams: [["1", "2"]] },
    { envSource: {} }
  );

  assert.equal(result.enabled, false);
  assert.equal(result.feasible, true);
});

test("evaluateCanonicalRules returns infeasible on conflict before candidate eval", () => {
  const result = evaluateCanonicalRules(
    createRuleSet({
      constraints: [
        {
          id: "r1",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
        {
          id: "r2",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing", teams: [["1", "3"], ["2", "4"]] },
    { envSource: v2Env }
  );

  assert.equal(result.enabled, true);
  assert.equal(result.feasible, false);
  assert.ok(result.validation.conflicts?.length);
});

test("evaluateCanonicalRules idempotent re-apply on same candidate", () => {
  const ruleSet = createRuleSet({
    constraints: [
      {
        id: "avoid-soft",
        type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
        severity: CONSTRAINT_SEVERITY.SOFT,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
  });

  const context = { scope: "pairing", teams: [["1", "3"], ["2", "4"]] };
  const first = evaluateCanonicalRules(ruleSet, context, { envSource: v2Env });
  const second = evaluateCanonicalRules(ruleSet, context, { envSource: v2Env });

  assert.deepEqual(first.softScore, second.softScore);
  assert.equal(first.feasible, true);
});

test("preflightRuleSet detects conflicts only when flag on", () => {
  const ruleSet = createRuleSet({
    constraints: [
      {
        id: "r1",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
      {
        id: "r2",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
  });

  assert.equal(preflightRuleSet(ruleSet, { envSource: {} }).ok, true);
  assert.equal(preflightRuleSet(ruleSet, { envSource: v2Env }).ok, false);
});

test("gender eligibility hard rule validates mixed doubles teams", () => {
  const result = evaluateHardRules(
    [
      {
        id: "gender-1",
        type: COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY,
        severity: CONSTRAINT_SEVERITY.HARD,
        enabled: true,
        params: { eventType: "mixed_double" },
      },
    ],
    {
      scope: "pairing",
      teams: [
        ["1", "2"],
        ["3", "4"],
      ],
      playersById: {
        1: { gender: "male" },
        2: { gender: "male" },
        3: { gender: "female" },
        4: { gender: "female" },
      },
    }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.violations[0].code, RULE_ERROR_CODE.GENDER_ELIGIBILITY_VIOLATED);
});
