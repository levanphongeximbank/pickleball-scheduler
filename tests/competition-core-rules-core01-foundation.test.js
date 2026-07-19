import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  RULE_SOURCE,
  RULE_SOURCE_PRIORITY,
  RULE_PRIORITY,
  RULE_OPERATION,
  RULE_OPERATION_ALIASES,
  RULE_RESOLUTION_REASON,
  RULE_ERROR_CODE,
  normalizeRuleAuthority,
  compareRuleAuthority,
  matchRuleOperation,
  resolveCanonicalOperation,
  resolveApplicableRules,
  resolveRulesDeterministic,
  buildRuleResolutionTrace,
  normalizeRuleDefinition,
  expandApplicableRules,
  evaluateCandidate,
  createNullParticipantLookupPort,
  createNullEntryLookupPort,
  createNullDivisionLookupPort,
  createInMemoryParticipantLookupPort,
} from "../src/features/competition-core/constraints/index.js";

import {
  PRIVATE_PAIRING_SOURCE,
  PRIVATE_PAIRING_SOURCE_PRIORITY,
  compareRuleAuthority as comparePrivatePairingAuthority,
  resolveRuleSourcePriority as resolvePrivatePairingSourcePriority,
} from "../src/features/private-pairing-rules/runtime/privatePairingSource.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSTRAINTS_ROOT = join(
  __dirname,
  "../src/features/competition-core/constraints"
);

const ENV_ON = {
  VITE_COMPETITION_CORE_ENABLED: "true",
  VITE_COMPETITION_CORE_RULES_V2_ENABLED: "true",
};
const ENV_OFF = {
  VITE_COMPETITION_CORE_ENABLED: "true",
  VITE_COMPETITION_CORE_RULES_V2_ENABLED: "false",
};
const FIXED_AT = "2026-07-19T12:00:00.000Z";

function baseRule(overrides = {}) {
  return normalizeRuleDefinition({
    id: "r1",
    type: "must_not_partner",
    severity: "hard",
    enabled: true,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
    source: RULE_SOURCE.DEFAULT,
    sourcePriority: RULE_SOURCE_PRIORITY.DEFAULT,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Authority values
// ---------------------------------------------------------------------------

test("CORE-01 authority values are exactly 1000/800/600/400/0", () => {
  assert.equal(RULE_SOURCE_PRIORITY[RULE_SOURCE.SUPER_ADMIN], 1000);
  assert.equal(RULE_SOURCE_PRIORITY[RULE_SOURCE.TOURNAMENT], 800);
  assert.equal(RULE_SOURCE_PRIORITY[RULE_SOURCE.CLUB], 600);
  assert.equal(RULE_SOURCE_PRIORITY[RULE_SOURCE.SESSION], 400);
  assert.equal(RULE_SOURCE_PRIORITY[RULE_SOURCE.DEFAULT], 0);
});

test("SUPER_ADMIN beats TOURNAMENT", () => {
  const a = baseRule({ id: "a", source: RULE_SOURCE.SUPER_ADMIN, sourcePriority: 1000 });
  const b = baseRule({ id: "b", source: RULE_SOURCE.TOURNAMENT, sourcePriority: 800 });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("TOURNAMENT beats CLUB", () => {
  const a = baseRule({ id: "a", source: RULE_SOURCE.TOURNAMENT, sourcePriority: 800 });
  const b = baseRule({ id: "b", source: RULE_SOURCE.CLUB, sourcePriority: 600 });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("CLUB beats SESSION", () => {
  const a = baseRule({ id: "a", source: RULE_SOURCE.CLUB, sourcePriority: 600 });
  const b = baseRule({ id: "b", source: RULE_SOURCE.SESSION, sourcePriority: 400 });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("SESSION beats DEFAULT", () => {
  const a = baseRule({ id: "a", source: RULE_SOURCE.SESSION, sourcePriority: 400 });
  const b = baseRule({ id: "b", source: RULE_SOURCE.DEFAULT, sourcePriority: 0 });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("sourcePriority explicit numeric tie-break wins over source label", () => {
  const a = baseRule({ id: "a", source: RULE_SOURCE.DEFAULT, sourcePriority: 900 });
  const b = baseRule({ id: "b", source: RULE_SOURCE.TOURNAMENT, sourcePriority: 800 });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("rule priority tie-break after equal sourcePriority", () => {
  const a = baseRule({
    id: "a",
    source: RULE_SOURCE.CLUB,
    sourcePriority: 600,
    priority: RULE_PRIORITY.CRITICAL,
  });
  const b = baseRule({
    id: "b",
    source: RULE_SOURCE.CLUB,
    sourcePriority: 600,
    priority: RULE_PRIORITY.LOW,
  });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("ruleSetVersion tie-break", () => {
  const a = baseRule({
    id: "a",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "3",
  });
  const b = baseRule({
    id: "b",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "2",
  });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("updatedAt tie-break", () => {
  const a = baseRule({
    id: "a",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });
  const b = baseRule({
    id: "b",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "2026-07-18T10:00:00.000Z",
  });
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("id ASC deterministic final tie-break (lower id wins)", () => {
  const a = baseRule({
    id: "alpha",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });
  const b = baseRule({
    id: "beta",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "2026-07-19T10:00:00.000Z",
  });
  assert.ok(compareRuleAuthority(a, b) > 0);
  assert.equal(normalizeRuleAuthority(a).id, "alpha");
});

test("numeric ruleSetVersion: version 10 beats version 2 (not lexicographic)", () => {
  const v10 = baseRule({
    id: "v10",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "10",
  });
  const v2 = baseRule({
    id: "v2",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "2",
  });
  assert.ok(compareRuleAuthority(v10, v2) > 0);
  assert.equal(normalizeRuleAuthority(v10).ruleSetVersion, 10);
  assert.equal(normalizeRuleAuthority(v2).ruleSetVersion, 2);
});

test("invalid updatedAt normalizes to 0 deterministically (locale-independent)", () => {
  const a = baseRule({
    id: "a",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "not-a-date",
  });
  const b = baseRule({
    id: "b",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: "also-invalid",
  });
  assert.equal(normalizeRuleAuthority(a).updatedAtMs, 0);
  assert.equal(normalizeRuleAuthority(b).updatedAtMs, 0);
  // Falls through to id ASC — lower id wins; not locale-dependent.
  assert.ok(compareRuleAuthority(a, b) > 0);
});

test("null/invalid sourcePriority normalizes deterministically", () => {
  assert.equal(normalizeRuleAuthority({ source: RULE_SOURCE.CLUB }).sourcePriority, 600);
  assert.equal(normalizeRuleAuthority({ sourcePriority: "nope" }).sourcePriority, 0);
  assert.equal(normalizeRuleAuthority({ sourcePriority: NaN }).sourcePriority, 0);
});

test("priority string and numeric ranks are stable", () => {
  const byString = baseRule({
    id: "s",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
  });
  const byNumber = baseRule({
    id: "n",
    sourcePriority: 600,
    priority: 3,
  });
  // Both rank as 3 — id ASC decides (n vs s → n wins? "n" < "s" → n outranks)
  assert.equal(normalizeRuleAuthority(byString).priorityRank, 3);
  assert.equal(normalizeRuleAuthority(byNumber).priorityRank, 3);
  assert.ok(compareRuleAuthority(byNumber, byString) > 0);
});

test("equal authority with distinct ids is NOT ambiguous — lower id wins", () => {
  const must = baseRule({
    id: "aaa-must",
    type: "must_partner",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: FIXED_AT,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  const mustNot = baseRule({
    id: "zzz-must-not",
    type: "must_not_partner",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: FIXED_AT,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  const result = resolveRulesDeterministic(
    [must, mustNot],
    { evaluatedAt: FIXED_AT, teamSize: 2 },
    { envSource: ENV_ON }
  );
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.deepEqual(
    result.selectedRules.map((r) => r.id),
    ["aaa-must"]
  );
  assert.ok(
    result.suppressedRules.some(
      (s) =>
        s.rule.id === "zzz-must-not" &&
        s.reasonCode === RULE_RESOLUTION_REASON.SUPPRESSED_BY_HIGHER_AUTHORITY
    )
  );
});

test("RULE_RESOLUTION_AMBIGUOUS only when identical normalized identity (same id)", () => {
  const twinA = baseRule({
    id: "twin",
    type: "must_partner",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: FIXED_AT,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  const twinB = baseRule({
    id: "twin",
    type: "must_not_partner",
    sourcePriority: 600,
    priority: RULE_PRIORITY.HIGH,
    ruleSetVersion: "1",
    updatedAt: FIXED_AT,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  assert.equal(compareRuleAuthority(twinA, twinB), 0);
  const result = resolveRulesDeterministic(
    [twinA, twinB],
    { evaluatedAt: FIXED_AT, teamSize: 2 },
    { envSource: ENV_ON }
  );
  assert.equal(result.ok, false);
  assert.equal(result.feasible, false);
  assert.ok(
    result.conflicts.some((c) => c.code === RULE_ERROR_CODE.RULE_RESOLUTION_AMBIGUOUS) ||
      result.conflicts.some((c) => c.code === RULE_ERROR_CODE.DUPLICATE_CONSTRAINT_ID)
  );
});

test("alias DIVISION normalizes to GROUP_DRAW and is not canonical alone", () => {
  assert.equal(resolveCanonicalOperation("DIVISION"), RULE_OPERATION.GROUP_DRAW);
  assert.equal(RULE_OPERATION.DIVISION, undefined);
  const rule = baseRule({
    id: "alias-div",
    operations: ["DIVISION"],
  });
  assert.deepEqual(rule.operations, [RULE_OPERATION.GROUP_DRAW]);
  assert.equal(matchRuleOperation(rule, RULE_OPERATION.GROUP_DRAW), true);
});

test("missing tenant/competition does not affect flag-OFF legacy path", () => {
  const result = resolveRulesDeterministic(
    [baseRule({ id: "legacy" })],
    { evaluatedAt: FIXED_AT },
    {
      envSource: ENV_OFF,
      requireTenantIsolation: true,
      requireCompetitionIsolation: true,
    }
  );
  assert.equal(result.enabled, false);
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.equal(result.selectedRules[0].id, "legacy");
});

test("evaluateCandidate without tenant/competition still passthrough when flag OFF", () => {
  const result = evaluateCandidate(
    { teams: [["p1", "p2"], ["p3", "p4"]] },
    [baseRule({ id: "no-iso" })],
    { scope: "pairing", evaluatedAt: FIXED_AT },
    { envSource: ENV_OFF }
  );
  assert.equal(result.enabled, false);
  assert.equal(result.feasible, true);
});

test("comparator ignores CONSTRAINT_SCOPE (scope must not affect authority)", () => {
  const a = baseRule({ id: "a", sourcePriority: 600, scope: "pairing" });
  const b = baseRule({ id: "b", sourcePriority: 600, scope: "draw" });
  // Equal authority except id ASC → a (lower id "a") wins; scope ignored.
  assert.ok(compareRuleAuthority(a, b) > 0);
  const a2 = baseRule({ id: "z", sourcePriority: 600, scope: "pairing" });
  const b2 = baseRule({ id: "a", sourcePriority: 600, scope: "entry" });
  assert.ok(compareRuleAuthority(b2, a2) > 0);
});

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

test("operation exact match", () => {
  const rule = baseRule({ operations: [RULE_OPERATION.LINEUP] });
  assert.equal(matchRuleOperation(rule, RULE_OPERATION.LINEUP), true);
});

test("ALL operation matches every rule", () => {
  const rule = baseRule({ operations: [RULE_OPERATION.SEEDING] });
  assert.equal(matchRuleOperation(rule, RULE_OPERATION.ALL), true);
});

test("operation mismatch is excluded", () => {
  const rule = baseRule({
    id: "op-miss",
    operations: [RULE_OPERATION.STANDINGS],
  });
  const { candidates, suppressed } = resolveApplicableRules(
    [rule],
    { evaluatedAt: FIXED_AT },
    { operation: RULE_OPERATION.LINEUP }
  );
  assert.equal(candidates.length, 0);
  assert.equal(suppressed[0].reasonCode, RULE_RESOLUTION_REASON.OPERATION_MISMATCH);
});

test("explicit aliases map to canonical operations", () => {
  assert.equal(resolveCanonicalOperation("PAIRING"), RULE_OPERATION.PARTNER_PAIRING);
  assert.equal(resolveCanonicalOperation("MATCH_GENERATE"), RULE_OPERATION.MATCHUP);
  assert.equal(resolveCanonicalOperation("TEAM_ROSTER"), RULE_OPERATION.TEAM_FORMATION);
  assert.equal(resolveCanonicalOperation("DIVISION"), RULE_OPERATION.GROUP_DRAW);
  assert.equal(RULE_OPERATION_ALIASES.PAIRING, RULE_OPERATION.PARTNER_PAIRING);
});

test("canonical operation names include Owner-required set", () => {
  for (const name of [
    "TEAM_FORMATION",
    "PARTNER_PAIRING",
    "GROUP_DRAW",
    "SEEDING",
    "LINEUP",
    "MATCHUP",
    "SCHEDULE",
    "COURT_ASSIGNMENT",
    "REFEREE_ASSIGNMENT",
    "SCORING",
    "STANDINGS",
    "TIE_BREAK",
    "ELIGIBILITY",
    "REGISTRATION",
    "ALL",
  ]) {
    assert.equal(RULE_OPERATION[name], name);
  }
});

// ---------------------------------------------------------------------------
// Scope / tenant / competition filtering
// ---------------------------------------------------------------------------

test("scope filtering remains CC-03A compatible via expandApplicableRules", () => {
  const rules = [
    baseRule({ id: "pair", scope: "pairing" }),
    baseRule({ id: "draw", scope: "draw" }),
  ];
  const applicable = expandApplicableRules(rules, {
    scope: "pairing",
    evaluatedAt: FIXED_AT,
  });
  assert.deepEqual(
    applicable.map((r) => r.id),
    ["pair"]
  );
});

test("tenant mismatch is suppressed", () => {
  const rule = baseRule({
    id: "t1",
    applicability: { tenantId: "tenant-a" },
  });
  const { candidates, suppressed } = resolveApplicableRules(
    [rule],
    { tenantId: "tenant-b", evaluatedAt: FIXED_AT }
  );
  assert.equal(candidates.length, 0);
  assert.equal(suppressed[0].reasonCode, RULE_RESOLUTION_REASON.TENANT_MISMATCH);
});

test("competition mismatch is suppressed", () => {
  const rule = baseRule({
    id: "c1",
    applicability: { competitionId: "comp-a" },
  });
  const { candidates, suppressed } = resolveApplicableRules(
    [rule],
    { competitionId: "comp-b", evaluatedAt: FIXED_AT }
  );
  assert.equal(candidates.length, 0);
  assert.equal(suppressed[0].reasonCode, RULE_RESOLUTION_REASON.COMPETITION_MISMATCH);
});

test("missing tenant fail-closed when required", () => {
  const result = resolveRulesDeterministic(
    [baseRule()],
    { evaluatedAt: FIXED_AT },
    { envSource: ENV_ON, requireTenantIsolation: true }
  );
  assert.equal(result.ok, false);
  assert.equal(result.feasible, false);
  assert.equal(result.errors[0].code, RULE_RESOLUTION_REASON.TENANT_CONTEXT_REQUIRED);
  assert.equal(RULE_ERROR_CODE.RULE_TENANT_CONTEXT_REQUIRED, "rule_tenant_context_required");
});

test("missing competition fail-closed when required", () => {
  const result = resolveRulesDeterministic(
    [baseRule()],
    { tenantId: "t1", evaluatedAt: FIXED_AT },
    { envSource: ENV_ON, requireCompetitionIsolation: true }
  );
  assert.equal(result.ok, false);
  assert.equal(result.feasible, false);
  assert.equal(result.errors[0].code, RULE_RESOLUTION_REASON.COMPETITION_CONTEXT_REQUIRED);
});

test("disabled rule is suppressed", () => {
  const rule = baseRule({ id: "off", enabled: false });
  const { candidates, suppressed } = resolveApplicableRules([rule], {
    evaluatedAt: FIXED_AT,
  });
  assert.equal(candidates.length, 0);
  assert.equal(suppressed[0].reasonCode, RULE_RESOLUTION_REASON.DISABLED);
});

test("invalid rule fail-closed when flag ON", () => {
  const result = resolveRulesDeterministic(
    [{ id: "bad", enabled: true }],
    { evaluatedAt: FIXED_AT },
    { envSource: ENV_ON }
  );
  assert.equal(result.ok, false);
  assert.equal(result.feasible, false);
  assert.ok(result.errors.some((e) => e.code === RULE_RESOLUTION_REASON.INVALID));
});

test("unsupported operation fail-closed", () => {
  const result = resolveRulesDeterministic(
    [baseRule()],
    { evaluatedAt: FIXED_AT },
    { envSource: ENV_ON, operation: "NOT_A_REAL_OPERATION" }
  );
  assert.equal(result.ok, false);
  assert.equal(result.feasible, false);
  assert.equal(result.errors[0].code, RULE_RESOLUTION_REASON.OPERATION_UNSUPPORTED);
});

test("empty candidate set returns ok with empty selectedRules", () => {
  const result = resolveRulesDeterministic([], { evaluatedAt: FIXED_AT }, { envSource: ENV_ON });
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.deepEqual(result.selectedRules, []);
});

test("input is not mutated", () => {
  const rule = {
    id: "immutable",
    type: "must_not_partner",
    severity: "hard",
    enabled: true,
    operations: [RULE_OPERATION.LINEUP],
    source: RULE_SOURCE.CLUB,
    sourcePriority: 600,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
    applicability: { tenantId: "t1" },
  };
  const snapshot = JSON.stringify(rule);
  resolveRulesDeterministic([rule], { tenantId: "t1", evaluatedAt: FIXED_AT }, { envSource: ENV_ON });
  assert.equal(JSON.stringify(rule), snapshot);
});

test("same input + evaluatedAt is deterministic", () => {
  const rules = [
    baseRule({ id: "b", sourcePriority: 600 }),
    baseRule({ id: "a", sourcePriority: 800 }),
  ];
  const ctx = { evaluatedAt: FIXED_AT, tenantId: "t1" };
  const r1 = resolveRulesDeterministic(rules, ctx, { envSource: ENV_ON });
  const r2 = resolveRulesDeterministic(rules, ctx, { envSource: ENV_ON });
  assert.deepEqual(
    r1.selectedRules.map((r) => r.id),
    r2.selectedRules.map((r) => r.id)
  );
  assert.deepEqual(r1.trace.steps, r2.trace.steps);
});

test("resolution trace explains winner and suppressed rules", () => {
  const high = baseRule({
    id: "high",
    source: RULE_SOURCE.SUPER_ADMIN,
    sourcePriority: 1000,
    operations: [RULE_OPERATION.LINEUP],
  });
  const low = baseRule({
    id: "low",
    source: RULE_SOURCE.CLUB,
    sourcePriority: 600,
    operations: [RULE_OPERATION.STANDINGS],
  });
  const result = resolveRulesDeterministic(
    [high, low],
    { evaluatedAt: FIXED_AT },
    { envSource: ENV_ON, operation: RULE_OPERATION.LINEUP }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.selectedRules.map((r) => r.id),
    ["high"]
  );
  assert.ok(
    result.suppressedRules.some(
      (s) => s.rule.id === "low" && s.reasonCode === RULE_RESOLUTION_REASON.OPERATION_MISMATCH
    )
  );
  const trace = buildRuleResolutionTrace(result.trace);
  assert.ok(trace.steps.some((s) => s.ruleId === "high" && s.decision === "selected"));
  assert.ok(trace.steps.some((s) => s.ruleId === "low" && s.decision === "suppressed"));
});

test("higher authority suppresses conflicting partner rules", () => {
  const must = baseRule({
    id: "must",
    type: "must_partner",
    source: RULE_SOURCE.SUPER_ADMIN,
    sourcePriority: 1000,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  const mustNot = baseRule({
    id: "must-not",
    type: "must_not_partner",
    source: RULE_SOURCE.CLUB,
    sourcePriority: 600,
    params: { anchorPlayerId: "p1", targetPlayerIds: ["p2"] },
  });
  const result = resolveRulesDeterministic(
    [must, mustNot],
    { evaluatedAt: FIXED_AT, teamSize: 2 },
    { envSource: ENV_ON }
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.selectedRules.map((r) => r.id),
    ["must"]
  );
  assert.ok(
    result.suppressedRules.some(
      (s) =>
        s.rule.id === "must-not" &&
        s.reasonCode === RULE_RESOLUTION_REASON.SUPPRESSED_BY_HIGHER_AUTHORITY
    )
  );
});

test("flag OFF passthrough — no fail-closed, selected copy of input", () => {
  const rule = baseRule({ id: "passthrough" });
  const result = resolveRulesDeterministic(
    [rule],
    { evaluatedAt: FIXED_AT },
    { envSource: ENV_OFF, requireTenantIsolation: true }
  );
  assert.equal(result.enabled, false);
  assert.equal(result.ok, true);
  assert.equal(result.feasible, true);
  assert.equal(result.selectedRules.length, 1);
  assert.equal(result.selectedRules[0].id, "passthrough");
  assert.ok(
    result.trace.steps.every(
      (s) => s.reasonCode === RULE_RESOLUTION_REASON.FLAG_OFF_PASSTHROUGH
    )
  );
});

test("evaluateCandidate flag OFF still passthrough (CC-03A)", () => {
  const result = evaluateCandidate(
    { teams: [["p1", "p2"], ["p3", "p4"]] },
    [baseRule()],
    { scope: "pairing", evaluatedAt: FIXED_AT },
    { envSource: ENV_OFF }
  );
  assert.equal(result.enabled, false);
  assert.equal(result.feasible, true);
});

// ---------------------------------------------------------------------------
// Ports + cross-import guard
// ---------------------------------------------------------------------------

test("ports are null/in-memory stubs only", async () => {
  const nullP = createNullParticipantLookupPort();
  const nullE = createNullEntryLookupPort();
  const nullD = createNullDivisionLookupPort();
  assert.deepEqual(await nullP.getByIds(["x"]), []);
  assert.deepEqual(await nullE.getByCompetition("c1"), []);
  assert.equal(await nullD.getById("d1"), null);

  const mem = createInMemoryParticipantLookupPort([{ id: "p1" }]);
  assert.deepEqual(await mem.getByIds(["p1", "missing"]), [{ id: "p1" }]);
});

test("no cross-imports from Core-02/Core-04 directories in CORE-01 modules", () => {
  const files = [
    "authority/ruleSource.js",
    "authority/rulePriority.js",
    "authority/compareRuleAuthority.js",
    "operations/ruleOperations.js",
    "resolution/resolveApplicableRules.js",
    "resolution/resolveRulesDeterministic.js",
    "resolution/buildRuleResolutionTrace.js",
    "ports/participantLookupPort.js",
    "ports/entryLookupPort.js",
    "ports/divisionLookupPort.js",
  ];
  const forbidden = [
    "participants/",
    "registrations/",
    "divisionCategory",
    "private-pairing-rules",
  ];
  for (const rel of files) {
    const src = readFileSync(join(CONSTRAINTS_ROOT, rel), "utf8");
    for (const needle of forbidden) {
      assert.equal(
        src.includes(needle),
        false,
        `${rel} must not reference ${needle}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Private Pairing parity (values + comparator ladder, no PP cutover)
// ---------------------------------------------------------------------------

test("Private Pairing authority priority values parity", () => {
  assert.equal(
    RULE_SOURCE_PRIORITY.SUPER_ADMIN,
    PRIVATE_PAIRING_SOURCE_PRIORITY[PRIVATE_PAIRING_SOURCE.SUPER_ADMIN]
  );
  assert.equal(
    RULE_SOURCE_PRIORITY.TOURNAMENT,
    PRIVATE_PAIRING_SOURCE_PRIORITY[PRIVATE_PAIRING_SOURCE.TOURNAMENT]
  );
  assert.equal(
    RULE_SOURCE_PRIORITY.CLUB,
    PRIVATE_PAIRING_SOURCE_PRIORITY[PRIVATE_PAIRING_SOURCE.CLUB]
  );
  assert.equal(
    RULE_SOURCE_PRIORITY.SESSION,
    PRIVATE_PAIRING_SOURCE_PRIORITY[PRIVATE_PAIRING_SOURCE.SESSION]
  );
  assert.equal(
    RULE_SOURCE_PRIORITY.DEFAULT,
    PRIVATE_PAIRING_SOURCE_PRIORITY[PRIVATE_PAIRING_SOURCE.DEFAULT]
  );
});

test("Private Pairing comparator parity on sourcePriority / priority / version / updatedAt", () => {
  const coreA = {
    id: "x",
    source: "CLUB",
    sourcePriority: 600,
    priority: "high",
    ruleSetVersion: 2,
    updatedAt: "2026-07-19T10:00:00.000Z",
  };
  const coreB = {
    id: "y",
    source: "SESSION",
    sourcePriority: 400,
    priority: "critical",
    ruleSetVersion: 9,
    updatedAt: "2026-07-20T10:00:00.000Z",
  };
  const coreCmp = compareRuleAuthority(coreA, coreB);
  const ppCmp = comparePrivatePairingAuthority(coreA, coreB);
  assert.equal(Math.sign(coreCmp), Math.sign(ppCmp));
  assert.equal(
    resolvePrivatePairingSourcePriority(coreA),
    normalizeRuleAuthority(coreA).sourcePriority
  );
});
