import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
  isConstraintsV2Enabled,
  selectRuleSetVersion,
  validateRuleSetLifecycle,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "true",
};

const moduleRoot = join(dirname(fileURLToPath(import.meta.url)), "../src/features/competition-core");

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  Object.getOwnPropertyNames(value).forEach((key) => {
    deepFreeze(value[key]);
  });
  return value;
}

function collectJsFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  entries.forEach((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(full));
      return;
    }
    if (entry.name.endsWith(".js")) {
      files.push(full);
    }
  });
  return files;
}

function assertExplanationComplete(explanation) {
  assert.ok(explanation.reasonCode, "reasonCode required");
  assert.ok(explanation.title, "title required");
  assert.ok(explanation.message, "message required");
  assert.ok(explanation.severity, "severity required");
  assert.ok(explanation.suggestedResolution, "suggestedResolution required");
}

// --- Feature flag verification ---

test("feature flag canonical note: implementation uses CONSTRAINTS_V2 key", () => {
  assert.equal(
    COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2,
    "VITE_COMPETITION_CORE_CONSTRAINTS_V2_ENABLED"
  );
});

test("feature flag missing and invalid values resolve to false", () => {
  assert.equal(isConstraintsV2Enabled({}), false);
  assert.equal(
    isConstraintsV2Enabled({
      [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
      [COMPETITION_CORE_FLAG_KEYS.CONSTRAINTS_V2]: "enabled",
    }),
    false
  );
});

test("feature flag OFF preserves legacy feasible behavior", () => {
  const result = evaluateCanonicalRules(
    createRuleSet({
      constraints: [
        {
          id: "hard-block",
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

// --- Import / side-effect verification ---

test("competition-core constraints sources avoid database/network/localStorage", () => {
  const constraintFiles = collectJsFiles(join(moduleRoot, "constraints"));
  const indexSource = readFileSync(join(moduleRoot, "index.js"), "utf8");
  const allSources = [indexSource, ...constraintFiles.map((file) => readFileSync(file, "utf8"))];

  allSources.forEach((source) => {
    assert.ok(!source.includes("@supabase/supabase-js"), "must not import supabase client");
    assert.ok(!source.includes("localStorage"), "must not touch localStorage");
    assert.ok(!source.includes("fetch("), "must not perform fetch");
  });
});

test("importing competition-core index does not throw", async () => {
  const mod = await import("../src/features/competition-core/index.js");
  assert.ok(typeof mod.evaluateCandidate === "function");
});

// --- Mutation verification ---

test("evaluateCandidate does not mutate candidate, context, or ruleSet inputs", () => {
  const candidate = deepClone({
    teams: [["1", "2"], ["3", "4"]],
  });
  const context = deepClone({
    scope: "pairing",
    clubId: "club-a",
    playersById: { 1: { checkedIn: true }, 2: { checkedIn: true } },
  });
  const ruleSet = deepClone(
    createRuleSet({
      constraints: [
        {
          id: "pref",
          type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    })
  );

  const candidateBefore = deepClone(candidate);
  const contextBefore = deepClone(context);
  const ruleSetBefore = deepClone(ruleSet);

  evaluateCandidate(candidate, ruleSet, context, { envSource: v2Env });

  assert.deepEqual(candidate, candidateBefore);
  assert.deepEqual(context, contextBefore);
  assert.deepEqual(ruleSet, ruleSetBefore);
});

test("evaluateCandidate is deterministic for frozen inputs", () => {
  const candidate = deepFreeze(deepClone({ teams: [["1", "3"], ["2", "4"]] }));
  const context = deepFreeze(deepClone({ scope: "pairing" }));
  const ruleSet = deepFreeze(
    deepClone(
      createRuleSet({
        constraints: [
          {
            id: "avoid-soft",
            type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
            severity: CONSTRAINT_SEVERITY.SOFT,
            params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
          },
        ],
      })
    )
  );

  const first = evaluateCandidate(candidate, ruleSet, context, { envSource: v2Env });
  const second = evaluateCandidate(candidate, ruleSet, context, { envSource: v2Env });
  assert.deepEqual(first, second);
});

// --- Hard / soft invariants ---

test("invariant: any hard fail makes feasible false", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "mn",
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
});

test("invariant: high soft score cannot override hard fail", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "hard",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
        {
          id: "soft",
          type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: CONSTRAINT_SEVERITY.SOFT,
          params: { anchorPlayerId: "3", targetPlayerIds: ["4"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );
  assert.equal(result.feasible, false);
  assert.equal(result.softScore, 0);
});

test("invariant: soft-only rules never flip feasible to false", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "avoid-soft",
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

test("invariant: non-applicable rules are skipped", () => {
  const applicable = expandApplicableRules(
    [
      {
        id: "tenant-rule",
        type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
        severity: CONSTRAINT_SEVERITY.HARD,
        applicability: { tenantId: "tenant-a" },
      },
    ],
    { scope: "pairing", tenantId: "tenant-b" }
  );
  assert.equal(applicable.length, 0);

  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({ constraints: applicable }),
    { scope: "pairing", tenantId: "tenant-b", playersById: { 1: { checkedIn: false } } },
    { envSource: v2Env }
  );
  assert.equal(result.feasible, true);
});

test("invariant: invalid hard params produce conflict, not silent skip", () => {
  const conflicts = detectConstraintConflicts(
    [
      {
        id: "bad",
        type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
        severity: CONSTRAINT_SEVERITY.HARD,
        params: { anchorPlayerId: "1" },
      },
    ],
    { teamSize: 2 }
  );
  assert.equal(conflicts[0].code, RULE_ERROR_CODE.INVALID_CONSTRAINT_PARAMS);
});

test("invariant: duplicate constraint id detected deterministically", () => {
  const input = [
    {
      id: "dup",
      type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
      severity: CONSTRAINT_SEVERITY.SOFT,
      params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
    },
    {
      id: "dup",
      type: COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER,
      severity: CONSTRAINT_SEVERITY.SOFT,
      params: { anchorPlayerId: "1", targetPlayerIds: ["3"] },
    },
  ];
  const first = detectConstraintConflicts(input, { teamSize: 2 });
  const second = detectConstraintConflicts(input, { teamSize: 2 });
  assert.deepEqual(first, second);
  assert.equal(first[0].code, RULE_ERROR_CODE.DUPLICATE_CONSTRAINT_ID);
});

// --- Rule-set version tests ---

test("rule-set version selects newest effective active set", () => {
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

test("rule-set version skips archived and future effectiveFrom", () => {
  const selected = selectRuleSetVersion(
    [
      {
        id: "rs",
        version: "archived",
        status: RULE_SET_STATUS.ARCHIVED,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        constraints: [],
      },
      {
        id: "rs",
        version: "future",
        status: RULE_SET_STATUS.ACTIVE,
        effectiveFrom: "2027-01-01T00:00:00.000Z",
        constraints: [],
      },
    ],
    { evaluatedAt: "2026-07-01T00:00:00.000Z" }
  );
  assert.equal(selected, null);
});

test("rule-set lifecycle rejects not-yet-effective set", () => {
  const check = validateRuleSetLifecycle(
    {
      id: "rs",
      version: "future",
      status: RULE_SET_STATUS.ACTIVE,
      effectiveFrom: "2027-01-01T00:00:00.000Z",
      constraints: [],
    },
    { evaluatedAt: "2026-07-01T00:00:00.000Z" }
  );
  assert.equal(check.ok, false);
  assert.equal(check.code, RULE_ERROR_CODE.RULE_SET_NOT_EFFECTIVE);
});

test("rule-set locked status remains readable (mutation service deferred)", () => {
  const check = validateRuleSetLifecycle(
    {
      id: "rs",
      version: "1",
      status: RULE_SET_STATUS.LOCKED,
      lockedAt: "2026-01-01T00:00:00.000Z",
      constraints: [],
    },
    { evaluatedAt: "2026-07-01T00:00:00.000Z" }
  );
  assert.equal(check.ok, true);
});

test("rule-set no match returns null (persistence layer deferred)", () => {
  const selected = selectRuleSetVersion([], { evaluatedAt: "2026-07-01T00:00:00.000Z" });
  assert.equal(selected, null);
});

// --- Context boundary tests ---

test("context boundary skips on tenant/tournament/event/venue mismatch", () => {
  const baseRule = {
    id: "scoped",
    type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
    severity: CONSTRAINT_SEVERITY.HARD,
  };
  assert.equal(
    expandApplicableRules([{ ...baseRule, applicability: { tenantId: "t1" } }], {
      scope: "pairing",
      tenantId: "t2",
    }).length,
    0
  );
  assert.equal(
    expandApplicableRules([{ ...baseRule, applicability: { tournamentId: "tr1" } }], {
      scope: "pairing",
      tournamentId: "tr2",
    }).length,
    0
  );
  assert.equal(
    expandApplicableRules([{ ...baseRule, applicability: { eventId: "e1" } }], {
      scope: "pairing",
      eventId: "e2",
    }).length,
    0
  );
  assert.equal(
    expandApplicableRules([{ ...baseRule, applicability: { venueId: "v1" } }], {
      scope: "pairing",
      venueId: "v2",
    }).length,
    0
  );
});

test("context boundary skips competition type gender age group mismatch", () => {
  const rule = {
    id: "scoped",
    type: COMPETITION_CONSTRAINT_TYPE.CHECKIN_REQUIRED,
    severity: CONSTRAINT_SEVERITY.HARD,
  };
  assert.equal(
    expandApplicableRules([{ ...rule, applicability: { competitionType: "official" } }], {
      scope: "pairing",
      competitionType: "internal",
    }).length,
    0
  );
  assert.equal(
    expandApplicableRules([{ ...rule, applicability: { gender: "female" } }], {
      scope: "pairing",
      gender: "male",
    }).length,
    0
  );
  assert.equal(
    expandApplicableRules([{ ...rule, applicability: { ageGroup: "u40" } }], {
      scope: "pairing",
      ageGroup: "open",
    }).length,
    0
  );
});

test("context boundary skill range and effective time use UTC ISO", () => {
  const rule = {
    id: "time-rule",
    type: COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER,
    severity: CONSTRAINT_SEVERITY.SOFT,
    params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
    applicability: {
      skillMin: 3,
      skillMax: 4,
      effectiveFrom: "2026-06-01T00:00:00.000Z",
      effectiveTo: "2026-12-31T23:59:59.000Z",
    },
  };

  assert.equal(
    expandApplicableRules([rule], {
      scope: "pairing",
      skillMin: 2,
      evaluatedAt: "2026-07-01T00:00:00.000Z",
    }).length,
    0
  );

  assert.equal(
    expandApplicableRules([rule], {
      scope: "pairing",
      skillMin: 3.5,
      evaluatedAt: "2026-07-01T00:00:00.000Z",
    }).length,
    1
  );

  assert.equal(
    expandApplicableRules([rule], {
      scope: "pairing",
      skillMin: 3.5,
      evaluatedAt: "2025-01-01T00:00:00.000Z",
    }).length,
    0
  );
});

// --- Explainability verification ---

test("hard fail explanations include all required fields", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"]] },
    createRuleSet({
      constraints: [
        {
          id: "mn",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
      ],
    }),
    { scope: "pairing" },
    { envSource: v2Env }
  );

  result.explanations.forEach(assertExplanationComplete);
  assert.ok(Array.isArray(result.explanations[0].affectedPlayers));
});

test("soft explanation includes score contribution metadata", () => {
  const result = evaluateCandidate(
    { teams: [["1", "2"], ["3", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "avoid-soft",
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
  assert.ok(result.softBreakdown?.components?.["avoid-soft"] != null);
  assert.ok(result.explanations.length > 0);
  result.explanations.forEach((item) => {
    assert.ok(item.message);
    assert.equal(item.severity, CONSTRAINT_SEVERITY.SOFT);
  });
});

test("conflict explanations are non-empty", () => {
  const result = evaluateCandidate(
    { teams: [["1", "3"], ["2", "4"]] },
    createRuleSet({
      constraints: [
        {
          id: "must",
          type: COMPETITION_CONSTRAINT_TYPE.MUST_PARTNER,
          severity: CONSTRAINT_SEVERITY.HARD,
          params: { anchorPlayerId: "1", targetPlayerIds: ["2"] },
        },
        {
          id: "must-not",
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
  result.explanations.forEach(assertExplanationComplete);
});
