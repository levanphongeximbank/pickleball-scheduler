import test from "node:test";
import assert from "node:assert/strict";

import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  createPrivatePairingRule,
  resolveActivePrivatePairingRules,
  PRIVATE_PAIRING_SOURCE,
  PRIVATE_PAIRING_SOURCE_PRIORITY,
  PRIVATE_PAIRING_OPERATION,
  derivePrivatePairingSource,
  resolveRuleSourcePriority,
  derivePrivatePairingOperations,
  ruleMatchesOperation,
  compareRuleAuthority,
} from "../src/features/private-pairing-rules/index.js";

const T = PRIVATE_PAIRING_CONSTRAINT_TYPE;
const S = PRIVATE_PAIRING_SCOPE;
const SRC = PRIVATE_PAIRING_SOURCE;
const OP = PRIVATE_PAIRING_OPERATION;

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: "r",
    constraintType: T.MUST_NOT_PARTNER,
    severity: "hard",
    weight: null,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: S.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.EVENT_OPERATION,
    reasonText: "x",
    active: true,
    ...overrides,
  });
}

function resolve(rules, context = {}) {
  return resolveActivePrivatePairingRules({
    rules,
    context: { teamSize: 4, ...context },
  });
}

// ---------------------------------------------------------------------------
// Source derivation & priority ladder
// ---------------------------------------------------------------------------

test("derivePrivatePairingSource maps scope to authority tier", () => {
  assert.equal(derivePrivatePairingSource(S.GLOBAL), SRC.SUPER_ADMIN);
  assert.equal(derivePrivatePairingSource(S.TENANT), SRC.SUPER_ADMIN);
  assert.equal(derivePrivatePairingSource(S.TOURNAMENT), SRC.TOURNAMENT);
  assert.equal(derivePrivatePairingSource(S.TOURNAMENT_EVENT), SRC.TOURNAMENT);
  assert.equal(derivePrivatePairingSource(S.CLUB), SRC.CLUB);
  assert.equal(derivePrivatePairingSource(S.VENUE), SRC.CLUB);
  assert.equal(derivePrivatePairingSource(S.ROUND), SRC.SESSION);
  assert.equal(derivePrivatePairingSource(S.MATCH_DAY), SRC.SESSION);
  assert.equal(derivePrivatePairingSource("UNKNOWN"), SRC.DEFAULT);
});

test("explicit source overrides scope-derived source", () => {
  assert.equal(
    derivePrivatePairingSource({ source: SRC.SUPER_ADMIN, scopeType: S.CLUB }),
    SRC.SUPER_ADMIN
  );
});

test("resolveRuleSourcePriority honors ladder and explicit override", () => {
  assert.equal(resolveRuleSourcePriority({ scopeType: S.GLOBAL }), 1000);
  assert.equal(resolveRuleSourcePriority({ scopeType: S.CLUB }), 600);
  assert.equal(resolveRuleSourcePriority({ sourcePriority: 555 }), 555);
  assert.equal(PRIVATE_PAIRING_SOURCE_PRIORITY[SRC.SUPER_ADMIN], 1000);
});

test("normalizer attaches source, sourcePriority and operations", () => {
  const r = createPrivatePairingRule({
    constraintType: T.MUST_PARTNER,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    scopeType: S.GLOBAL,
  });
  assert.equal(r.source, SRC.SUPER_ADMIN);
  assert.equal(r.sourcePriority, 1000);
  assert.ok(Array.isArray(r.operations));
  assert.ok(r.operations.includes(OP.TEAM_FORMATION));
});

// ---------------------------------------------------------------------------
// Operation scoping (no cross-operation misapplication)
// ---------------------------------------------------------------------------

test("derivePrivatePairingOperations keeps operations disjoint by intent", () => {
  const teamOps = derivePrivatePairingOperations(T.SAME_TEAM);
  assert.ok(teamOps.includes(OP.TEAM_FORMATION));
  assert.ok(!teamOps.includes(OP.GROUP_DRAW));

  const groupOps = derivePrivatePairingOperations(T.SAME_GROUP);
  assert.ok(groupOps.includes(OP.GROUP_DRAW));
  assert.ok(!groupOps.includes(OP.TEAM_FORMATION));
});

test("ruleMatchesOperation guards against wrong-operation application", () => {
  assert.equal(ruleMatchesOperation({ constraintType: T.SAME_GROUP }, OP.TEAM_FORMATION), false);
  assert.equal(ruleMatchesOperation({ constraintType: T.MUST_PARTNER }, OP.GROUP_DRAW), false);
  assert.equal(ruleMatchesOperation({ constraintType: T.SAME_GROUP }, OP.GROUP_DRAW), true);
  assert.equal(ruleMatchesOperation({ constraintType: T.SAME_GROUP }, OP.ALL), true);
});

// ---------------------------------------------------------------------------
// Cross-source hard override
// ---------------------------------------------------------------------------

test("SUPER_ADMIN hard rule overrides conflicting CLUB hard rule", () => {
  const superRule = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const clubRule = rule({ id: "cl", constraintType: T.MUST_PARTNER, scopeType: S.CLUB, scopeId: "c1" });

  const res = resolve([superRule, clubRule], { clubId: "c1" });

  assert.equal(res.ok, true);
  assert.equal(res.fatalConflicts.length, 0);
  assert.equal(res.overriddenRules.length, 1);
  assert.equal(res.overriddenRules[0].ruleId, "cl");
  assert.equal(res.overriddenRules[0].overriddenByRuleId, "sa");
  assert.deepEqual(res.rules.map((r) => r.id), ["sa"]);
  assert.deepEqual(res.effectiveRules.map((r) => r.id), ["sa"]);
  assert.ok(res.ignoredRules.some((e) => e.ruleId === "cl" && e.reason === "OVERRIDDEN"));
  assert.deepEqual(res.priorityOrder, [
    "SUPER_ADMIN",
    "TOURNAMENT",
    "CLUB",
    "SESSION",
    "DEFAULT",
  ]);
});

test("SUPER_ADMIN hard rule overrides conflicting TOURNAMENT hard rule", () => {
  const superRule = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const tourRule = rule({ id: "tr", constraintType: T.MUST_PARTNER, scopeType: S.TOURNAMENT, scopeId: "t1" });

  const res = resolve([superRule, tourRule], { tournamentId: "t1" });

  assert.equal(res.ok, true);
  assert.equal(res.overriddenRules.length, 1);
  assert.equal(res.overriddenRules[0].ruleId, "tr");
  assert.equal(res.overriddenRules[0].overriddenByRuleId, "sa");
});

test("override result is independent of rule array order (determinism)", () => {
  const superRule = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const clubRule = rule({ id: "cl", constraintType: T.MUST_PARTNER, scopeType: S.CLUB, scopeId: "c1" });

  const forward = resolve([superRule, clubRule], { clubId: "c1" });
  const reversed = resolve([clubRule, superRule], { clubId: "c1" });

  assert.deepEqual(
    forward.effectiveRules.map((r) => r.id),
    reversed.effectiveRules.map((r) => r.id)
  );
  assert.deepEqual(forward.overriddenRules, reversed.overriddenRules);
});

// ---------------------------------------------------------------------------
// Same-tier hard conflict stays fatal (no arbitrary pick)
// ---------------------------------------------------------------------------

test("same-tier opposing hard rules produce fatalConflicts", () => {
  const a = rule({ id: "a", constraintType: T.MUST_PARTNER, scopeType: S.GLOBAL });
  const b = rule({ id: "b", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });

  const res = resolve([a, b]);

  assert.equal(res.ok, false);
  assert.ok(res.fatalConflicts.length >= 1);
  assert.equal(res.overriddenRules.length, 0);
});

// ---------------------------------------------------------------------------
// Soft vs soft override & tie-break
// ---------------------------------------------------------------------------

test("SUPER_ADMIN soft rule wins opposing TOURNAMENT soft rule", () => {
  const superSoft = rule({
    id: "sa",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    weight: 60,
    scopeType: S.GLOBAL,
  });
  const tourSoft = rule({
    id: "tr",
    constraintType: T.AVOID_PARTNER,
    severity: "soft",
    weight: 60,
    scopeType: S.TOURNAMENT,
    scopeId: "t1",
  });

  const res = resolve([superSoft, tourSoft], { tournamentId: "t1" });

  assert.equal(res.overriddenRules.length, 1);
  assert.equal(res.overriddenRules[0].ruleId, "tr");
  assert.equal(res.overriddenRules[0].overriddenByRuleId, "sa");
  assert.deepEqual(res.softRules.map((r) => r.id), ["sa"]);
});

test("same-tier opposing soft rules tie-break by higher ruleSetVersion", () => {
  const older = rule({
    id: "v1",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    weight: 50,
    scopeType: S.GLOBAL,
    ruleSetVersion: "1",
  });
  const newer = rule({
    id: "v2",
    constraintType: T.AVOID_PARTNER,
    severity: "soft",
    weight: 50,
    scopeType: S.GLOBAL,
    ruleSetVersion: "2",
  });

  const res = resolve([older, newer]);

  assert.equal(res.overriddenRules.length, 1);
  assert.equal(res.overriddenRules[0].ruleId, "v1");
  assert.equal(res.overriddenRules[0].overriddenByRuleId, "v2");
  assert.ok(compareRuleAuthority(newer, older) > 0);
});

// ---------------------------------------------------------------------------
// Non-conflicting soft rules accumulate
// ---------------------------------------------------------------------------

test("non-conflicting soft rules from different tiers accumulate", () => {
  const superSoft = rule({
    id: "s1",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    weight: 50,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    scopeType: S.GLOBAL,
  });
  const tourSoft = rule({
    id: "s2",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    weight: 50,
    primaryPlayerId: "p3",
    targetPlayerIds: ["p4"],
    scopeType: S.TOURNAMENT,
    scopeId: "t1",
  });

  const res = resolve([superSoft, tourSoft], { tournamentId: "t1" });

  assert.equal(res.overriddenRules.length, 0);
  assert.deepEqual(res.softRules.map((r) => r.id).sort(), ["s1", "s2"]);
});

// ---------------------------------------------------------------------------
// ignoredRules audit reasons
// ---------------------------------------------------------------------------

test("out-of-scope rule is reported in ignoredRules", () => {
  const inScope = rule({ id: "in", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const outScope = rule({
    id: "out",
    constraintType: T.MUST_NOT_PARTNER,
    primaryPlayerId: "p5",
    targetPlayerIds: ["p6"],
    scopeType: S.CLUB,
    scopeId: "other-club",
  });

  const res = resolve([inScope, outScope], { clubId: "c1" });

  assert.ok(res.ignoredRules.some((e) => e.ruleId === "out" && e.reason === "OUT_OF_SCOPE"));
  assert.deepEqual(res.rules.map((r) => r.id), ["in"]);
});
