import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  COMPETITION_CONSTRAINT_TYPE,
  COMPETITION_CORE_FLAG_KEYS,
  CONSTRAINT_SEVERITY,
  RULE_ERROR_CODE,
  RULE_SET_STATUS,
  createRuleSet,
  detectConstraintConflicts,
  evaluateCandidate,
  evaluateCanonicalRules,
  expandApplicableRules,
  selectRuleSetVersion,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const constraintsSource = readFileSync(
  join(moduleDir, "../src/features/competition-core/constraints/evaluateCandidate.js"),
  "utf8"
);

test("1. MUST_NOT_PARTNER reject", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "mn1",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.MUST_NOT_PARTNER_VIOLATED);
});

test("2. MUST_PARTNER pass", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "mp1",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
});

test("3. MUST + MUST_NOT conflict", () => {
  const conflicts = detectConstraintConflicts(
    [
      {
        id: "a",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
      {
        id: "b",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
    ],
    { teamSize: 2 }
  );

  assert.equal(conflicts[0].code, RULE_ERROR_CODE.CONTRADICTORY_MUST_MUST_NOT);
});

test("4. Must-partner component exceeds team size", () => {
  const conflicts = detectConstraintConflicts(
    [
      {
        id: "mp-a",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
      },
      {
        id: "mp-b",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["3"] },
      },
      {
        id: "mp-c",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1", targetPlayerIds: ["4"] },
      },
    ],
    { teamSize: 2 }
  );

  assert.equal(conflicts[0].code, RULE_ERROR_CODE.MUST_PARTNER_COMPONENT_EXCEEDS_TEAM_SIZE);
});

test("5. Mixed composition invalid", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "mix1",
          type: COMPETITION_CONSTRAINT_TYPE.MIXED_TEAM_COMPOSITION,
          severity: CONSTRAINT_SEVERITY.HARD,
        },
      ],
    }),
    {
      scope: "pairing",
      playersById: {
        1: { gender: "male" },
        2: { gender: "male" },
        3: { gender: "female" },
        4: { gender: "female" },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.MIXED_TEAM_COMPOSITION_VIOLATED);
});

test("6. Skill cap exceeded", () => {
  const result = evaluateCandidate(
    {
      matchOption: {
        teamA: ["1", "2"],
        teamB: ["3", "4"],
      },
    },
    createRuleSet({
      constraints: [
        {
          id: "skill1",
          type: COMPETITION_CONSTRAINT_TYPE.SKILL_CAP,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { maxDiff: 0.5 },
        },
      ],
    }),
    {
      scope: "match",
      playersById: {
        1: { skillLevel: 5 },
        2: { skillLevel: 5 },
        3: { skillLevel: 2 },
        4: { skillLevel: 2 },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.SKILL_CAP_EXCEEDED);
});

test("7. Player not checked in", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "check1",
          type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
          severity: CONSTRAINT_SEVERITY.HARD,
        },
      ],
    }),
    {
      scope: "pairing",
      playersById: {
        1: { checkedIn: false },
        2: { checkedIn: true },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.CHECKIN_REQUIRED_MISSING);
});

test("8. Player unavailable", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "avail1",
          type: COMPETITION_CONSTRAINT_TYPE.AVAILABILITY_REQUIRED,
          severity: CONSTRAINT_SEVERITY.HARD,
        },
      ],
    }),
    {
      scope: "pairing",
      playersById: {
        1: { available: false },
        2: { available: true },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.AVAILABILITY_REQUIRED_MISSING);
});

test("9. Player busy", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "busy1",
          type: COMPETITION_CONSTRAINT_TYPE.PLAYER_NOT_BUSY,
          severity: CONSTRAINT_SEVERITY.HARD,
        },
      ],
    }),
    {
      scope: "pairing",
      playersById: {
        1: { busy: true },
        2: { busy: false },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.hardViolations[0].reasonCode, RULE_ERROR_CODE.PLAYER_BUSY);
});

test("10. Prefer partner soft score", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "pref1",
          type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
  assert.ok(result.softScore > 0);
});

test("11. Avoid partner soft score", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "avoid1",
          type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
  assert.ok(result.softScore < 0);
});

test("12. Same club soft penalty", () => {
  const result = evaluateCandidate(
    {
      groups: [{ id: "g1", playerIds: ["1", "2"] }],
    },
    createRuleSet({
      constraints: [
        {
          id: "club1",
          type: COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION,
          severity: CONSTRAINT_SEVERITY.SOFT,
        },
      ],
    }),
    {
      scope: "group",
      playersById: {
        1: { clubId: "club-a" },
        2: { clubId: "club-a" },
      },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
  assert.ok(result.softScore < 0);
});

test("13. Max partner repeat", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "mpr1",
          type: COMPETITION_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { maxRepeat: 1 },
        },
      ],
    }),
    {
      scope: "pairing",
      partnerRepeatCounts: { 1: { 2: 3 } },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
  assert.ok(result.softScore < 0);
});

test("14. Max opponent repeat", () => {
  const result = evaluateCandidate(
    { teams: [["1", "3"], ["2", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "mor1",
          type: COMPETITION_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { maxRepeat: 0 },
        },
      ],
    }),
    {
      scope: "pairing",
      opponentRepeatCounts: { 1: { 2: 2 } },
    },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, true);
  assert.ok(result.softScore < 0);
});

test("15. Invalid parameters", () => {
  const conflicts = detectConstraintConflicts(
    [
      {
        id: "bad1",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1" },
      },
    ],
    { teamSize: 2 }
  );

  assert.equal(conflicts[0].code, RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS);
});

test("16. Context not applicable → rule skipped", () => {
  const applicable = expandApplicableRules(
    [
      {
        id: "club-only",
        type: COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION,
        severity: CONSTRAINT_SEVERITY.SOFT,
        applicability: { clubId: "club-a" },
      },
    ],
    { scope: "group", clubId: "club-b" }
  );

  assert.equal(applicable.length, 0);
});

test("17. Rule set version selection", () => {
  const selected = selectRuleSetVersion(
    [
      {
        id: "rs",
        version: "1",
        status: RULE_SET_STATUS.ACTIVE,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        constraints: [],
      },
      {
        id: "rs",
        version: "2",
        status: RULE_SET_STATUS.ACTIVE,
        effectiveFrom: "2026-06-01T00:00:00.000Z",
        constraints: [],
      },
    ],
    { evaluatedAt: "2026-07-01T00:00:00.000Z" }
  );

  assert.equal(selected?.version, "2");
});

test("18. Hard fail cannot be offset by soft score", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "hard1",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
        {
          id: "soft1",
          type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.equal(result.feasible, false);
  assert.equal(result.softScore, 0);
});

test("19. Same input + same ruleset → same output", () => {
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
  const candidate = { teams: [["1", "3"], ["2", "4"]] };
  const context = { scope: "pairing" };
  const options = { envSource: v2Env };

  const first = evaluateCandidate(candidate, ruleSet, context, options);
  const second = evaluateCandidate(candidate, ruleSet, context, options);

  assert.deepEqual(first.softScore, second.softScore);
  assert.equal(first.feasible, second.feasible);
});

test("20. Pure evaluator does not write database", () => {
  assert.ok(!constraintsSource.includes("supabase"));
  assert.ok(!constraintsSource.includes("@supabase"));
  assert.ok(!constraintsSource.includes("fetch("));
});

test("evaluateCanonicalRules is no-op when flag off", () => {
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

test("explainability includes suggestedResolution", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "mn2",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  assert.ok(result.explanations[0]?.suggestedResolution);
  assert.ok(result.explanations[0]?.title);
});
