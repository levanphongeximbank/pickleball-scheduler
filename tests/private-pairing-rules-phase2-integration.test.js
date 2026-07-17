import test from "node:test";
import assert from "node:assert/strict";

import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  COMPETITION_CLASS,
  createPrivatePairingRule,
  resolveActivePrivatePairingRules,
  scopesOverlapInContext,
  PRIVATE_PAIRING_OPERATION,
  compareOptimizationCandidates,
  buildScoreBreakdown,
  assignGroupsWithPrivatePairingRules,
  FEATURE_FLAG_KEYS,
} from "../src/features/private-pairing-rules/index.js";
import { pairTeamsFromSelectedPlayers } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { suggestTeamsFromPlayers } from "../src/tournament/engines/teamPairingEngine.js";
import { EVENT_TYPE } from "../src/models/tournament/constants.js";

const T = PRIVATE_PAIRING_CONSTRAINT_TYPE;
const S = PRIVATE_PAIRING_SCOPE;
const OP = PRIVATE_PAIRING_OPERATION;

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: "r",
    constraintType: T.MUST_NOT_PARTNER,
    severity: "hard",
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: S.GLOBAL,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.EVENT_OPERATION,
    active: true,
    ...overrides,
  });
}

function resolve(rules, context = {}) {
  return resolveActivePrivatePairingRules({ rules, context: { teamSize: 4, ...context } });
}

function players(n = 8) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
    level: 3.5,
    rating: 3.5,
  }));
}

function mlpPlayers(count = 8) {
  const half = count / 2;
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    gender: i < half ? "Nam" : "Nữ",
    level: 3.5,
    rating: 3.5,
  }));
}

// ---------------------------------------------------------------------------
// A. Hierarchical overlap
// ---------------------------------------------------------------------------

test("1. SUPER_ADMIN GLOBAL overlaps and overrides TOURNAMENT in same context", () => {
  const sa = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const tr = rule({
    id: "tr",
    constraintType: T.MUST_PARTNER,
    scopeType: S.TOURNAMENT,
    scopeId: "t1",
  });
  assert.equal(
    scopesOverlapInContext(sa, tr, { tournamentId: "t1", clubId: "c1" }),
    true
  );
  const res = resolve([sa, tr], {
    tournamentId: "t1",
    clubId: "c1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.ok, true);
  assert.equal(res.overriddenRules.some((o) => o.ruleId === "tr"), true);
});

test("2. SUPER_ADMIN GLOBAL overrides CLUB", () => {
  const sa = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  const res = resolve([sa, cl], { clubId: "c1", operation: OP.PARTNER_PAIRING });
  assert.equal(res.ok, true);
  assert.equal(res.overriddenRules[0]?.ruleId, "cl");
});

test("3. TOURNAMENT overrides CLUB in same context", () => {
  const tr = rule({
    id: "tr",
    constraintType: T.MUST_NOT_PARTNER,
    scopeType: S.TOURNAMENT,
    scopeId: "t1",
  });
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  assert.equal(
    scopesOverlapInContext(tr, cl, { tournamentId: "t1", clubId: "c1" }),
    true
  );
  const res = resolve([tr, cl], {
    tournamentId: "t1",
    clubId: "c1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.ok, true);
  assert.equal(res.overriddenRules[0]?.ruleId, "cl");
});

test("4. TOURNAMENT A does not override CLUB in Tournament B context", () => {
  const tr = rule({
    id: "tr",
    constraintType: T.MUST_NOT_PARTNER,
    scopeType: S.TOURNAMENT,
    scopeId: "tA",
  });
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  const res = resolve([tr, cl], {
    tournamentId: "tB",
    clubId: "c1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.ignoredRules.some((i) => i.ruleId === "tr" && i.reason === "OUT_OF_SCOPE"), true);
  assert.equal(res.overriddenRules.length, 0);
});

test("5. CLUB overrides SESSION in same club context", () => {
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_NOT_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  const ses = rule({
    id: "ses",
    constraintType: T.MUST_PARTNER,
    scopeType: S.ROUND,
    scopeId: "r1",
  });
  assert.equal(
    scopesOverlapInContext(cl, ses, { clubId: "c1", roundId: "r1" }),
    true
  );
  const res = resolve([cl, ses], {
    clubId: "c1",
    roundId: "r1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.ok, true);
  assert.equal(res.overriddenRules[0]?.ruleId, "ses");
});

test("6. CLUB A does not override SESSION in Club B context", () => {
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_NOT_PARTNER,
    scopeType: S.CLUB,
    scopeId: "cA",
  });
  const ses = rule({
    id: "ses",
    constraintType: T.MUST_PARTNER,
    scopeType: S.ROUND,
    scopeId: "r1",
  });
  const res = resolve([cl, ses], {
    clubId: "cB",
    roundId: "r1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.ignoredRules.some((i) => i.ruleId === "cl"), true);
  assert.equal(res.overriddenRules.length, 0);
});

test("7. Rule outside context is OUT_OF_SCOPE", () => {
  const out = rule({ id: "out", scopeType: S.CLUB, scopeId: "other" });
  const res = resolve([out], { clubId: "c1", operation: OP.PARTNER_PAIRING });
  assert.ok(res.ignoredRules.some((i) => i.ruleId === "out" && i.reason === "OUT_OF_SCOPE"));
});

// ---------------------------------------------------------------------------
// B. Operation guard
// ---------------------------------------------------------------------------

test("8. TEAM_FORMATION operation excludes group-only rules", () => {
  const teamRule = rule({ id: "team", constraintType: T.MUST_NOT_PARTNER });
  const groupRule = rule({
    id: "grp",
    constraintType: T.DIFFERENT_GROUP,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
  });
  const res = resolve([teamRule, groupRule], { operation: OP.TEAM_FORMATION });
  assert.deepEqual(res.effectiveRules.map((r) => r.id), ["team"]);
  assert.ok(res.ignoredRules.some((i) => i.ruleId === "grp" && i.reason === "WRONG_OPERATION"));
});

test("9. PARTNER_PAIRING includes partner rules", () => {
  const r = rule({ id: "p", constraintType: T.MUST_NOT_PARTNER });
  const res = resolve([r], { operation: OP.PARTNER_PAIRING });
  assert.deepEqual(res.effectiveRules.map((x) => x.id), ["p"]);
});

test("10. GROUP_DRAW includes group rules only", () => {
  const grp = rule({
    id: "g",
    constraintType: T.SAME_GROUP,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
  });
  const partner = rule({ id: "p", constraintType: T.MUST_PARTNER });
  const res = resolve([grp, partner], { operation: OP.GROUP_DRAW });
  assert.deepEqual(res.effectiveRules.map((x) => x.id), ["g"]);
  assert.ok(res.ignoredRules.some((i) => i.ruleId === "p" && i.reason === "WRONG_OPERATION"));
});

test("11. ALL operation applies every rule type", () => {
  const grp = rule({
    id: "g",
    constraintType: T.SAME_GROUP,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
  });
  const partner = rule({ id: "p", constraintType: T.MUST_PARTNER });
  const res = resolve([grp, partner], { operation: OP.ALL });
  assert.equal(res.effectiveRules.length, 2);
});

test("12. Wrong operation recorded as WRONG_OPERATION", () => {
  const grp = rule({
    id: "g",
    constraintType: T.DIFFERENT_GROUP,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
  });
  const res = resolve([grp], { operation: OP.TEAM_FORMATION });
  assert.ok(res.ignoredRules.some((i) => i.reason === "WRONG_OPERATION"));
});

// ---------------------------------------------------------------------------
// C. Call-site integration
// ---------------------------------------------------------------------------

test("13-14. TEAM_FORMATION uses resolved hard/soft rules in engine", () => {
  const pool = mlpPlayers(8);
  const hard = rule({
    id: "hard",
    constraintType: T.MUST_NOT_PARTNER,
    severity: "hard",
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    scopeType: S.GLOBAL,
  });
  const soft = rule({
    id: "soft",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    weight: 80,
    primaryPlayerId: "p3",
    targetPlayerIds: ["p4"],
    scopeType: S.GLOBAL,
  });
  const result = pairTeamsFromSelectedPlayers({
    players: pool,
    selectedPlayerIds: pool.map((p) => p.id),
    teamCount: 2,
    formatPreset: FORMAT_PRESET.MLP_4,
    privatePairingRules: [hard, soft],
    envSource: FLAGS_ON,
    seed: 42,
  });
  assert.equal(result.ok, true);
  assert.ok(result.privatePairingMeta?.ruleResolution);
  assert.equal(result.privatePairingMeta.ruleResolution.operation, OP.TEAM_FORMATION);
  assert.ok(result.privatePairingMeta.ruleResolution.hardRuleCount >= 1);
  assert.ok(result.privatePairingMeta.ruleResolution.softRuleCount >= 1);
  assert.ok(result.privatePairingMeta.scoreBreakdown);
  assert.equal(typeof result.privatePairingMeta.scoreBreakdown.superAdminPenalty, "number");
  assert.equal(typeof result.privatePairingMeta.scoreBreakdown.totalPenalty, "number");
});

test("15-16. PARTNER_PAIRING uses resolved hard/soft via runtime", () => {
  const pool = players(8);
  const opts = {
    privatePairingRules: [
      rule({
        id: "h",
        constraintType: T.MUST_NOT_PARTNER,
        primaryPlayerId: "p1",
        targetPlayerIds: ["p2"],
      }),
    ],
    envSource: FLAGS_ON,
    seed: 3,
    forcePrivateRuntime: true,
  };
  const teams = suggestTeamsFromPlayers(pool, EVENT_TYPE.MEN_DOUBLE, opts);
  assert.ok(teams.length > 0);
  assert.ok(opts.privatePairingRuntime?.meta?.ruleResolution);
  assert.equal(opts.privatePairingRuntime.meta.ruleResolution.operation, OP.PARTNER_PAIRING);
  assert.ok(opts.privatePairingRuntime.meta.scoreBreakdown || opts.scoreBreakdown);
});

test("17-18. GROUP_DRAW uses resolved hard/soft rules", () => {
  const entries = [
    { id: "e1", playerIds: ["p1"] },
    { id: "e2", playerIds: ["p2"] },
    { id: "e3", playerIds: ["p3"] },
    { id: "e4", playerIds: ["p4"] },
    { id: "e5", playerIds: ["p5"] },
    { id: "e6", playerIds: ["p6"] },
    { id: "e7", playerIds: ["p7"] },
    { id: "e8", playerIds: ["p8"] },
  ];
  const pls = players(8);
  const hard = rule({
    id: "hard",
    constraintType: T.DIFFERENT_GROUP,
    severity: "hard",
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    scopeType: S.GLOBAL,
  });
  const soft = rule({
    id: "soft",
    constraintType: T.SAME_GROUP,
    severity: "soft",
    weight: 60,
    primaryPlayerId: "p3",
    targetPlayerIds: ["p4"],
    scopeType: S.GLOBAL,
  });
  const result = assignGroupsWithPrivatePairingRules(entries, 2, pls, {
    privatePairingRules: [hard, soft],
    envSource: FLAGS_ON,
    seed: 11,
    clubId: "c1",
    maxCandidates: 24,
  });
  assert.equal(result.ok, true);
  assert.ok(result.ruleResolution);
  assert.equal(result.ruleResolution.operation, OP.GROUP_DRAW);
  assert.ok(result.scoreBreakdown);
});

// ---------------------------------------------------------------------------
// D. Priority comparator
// ---------------------------------------------------------------------------

test("19. Comparator rejects infeasible (hard violation) candidate first", () => {
  const feasible = {
    id: "a",
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({ balanceScore: 10 }),
  };
  const infeasible = {
    id: "b",
    feasible: false,
    scoreBreakdown: buildScoreBreakdown({ balanceScore: 100 }),
  };
  // Array.sort contract: better candidate returns negative vs worse
  assert.ok(compareOptimizationCandidates(feasible, infeasible) < 0);
});

test("20. Better default score loses when SUPER_ADMIN soft penalty is higher", () => {
  const worseBalance = {
    id: "a",
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({
      penaltyBySource: { SUPER_ADMIN: 50 },
      balanceScore: 30,
    }),
  };
  const betterBalance = {
    id: "b",
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({
      penaltyBySource: { SUPER_ADMIN: 5 },
      balanceScore: 90,
    }),
  };
  assert.ok(compareOptimizationCandidates(betterBalance, worseBalance) < 0);
});

test("21. Tournament soft penalty beats club soft penalty in comparator", () => {
  const clubHeavy = {
    id: "a",
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({
      penaltyBySource: { TOURNAMENT: 5, CLUB: 50 },
      balanceScore: 90,
    }),
  };
  const tourHeavy = {
    id: "b",
    feasible: true,
    scoreBreakdown: buildScoreBreakdown({
      penaltyBySource: { TOURNAMENT: 50, CLUB: 5 },
      balanceScore: 30,
    }),
  };
  // clubHeavy has lower tournament penalty → ranks first
  assert.ok(compareOptimizationCandidates(clubHeavy, tourHeavy) < 0);
});

test("21b. Comparator never ranks by totalPenalty alone", () => {
  const lowTotalHighAdmin = {
    id: "a",
    feasible: true,
    scoreBreakdown: {
      superAdminPenalty: 100,
      tournamentPenalty: 0,
      clubPenalty: 0,
      sessionPenalty: 0,
      defaultPenalty: 0,
      totalPenalty: 100,
    },
  };
  const highTotalLowAdmin = {
    id: "b",
    feasible: true,
    scoreBreakdown: {
      superAdminPenalty: 1,
      tournamentPenalty: 0,
      clubPenalty: 0,
      sessionPenalty: 0,
      defaultPenalty: 200,
      totalPenalty: 201,
    },
  };
  assert.ok(compareOptimizationCandidates(highTotalLowAdmin, lowTotalHighAdmin) < 0);
  assert.equal(highTotalLowAdmin.scoreBreakdown.totalPenalty > lowTotalHighAdmin.scoreBreakdown.totalPenalty, true);
});

test("22. Non-conflicting soft rules accumulate in resolve", () => {
  const s1 = rule({
    id: "s1",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    scopeType: S.GLOBAL,
  });
  const s2 = rule({
    id: "s2",
    constraintType: T.PREFER_PARTNER,
    severity: "soft",
    primaryPlayerId: "p3",
    targetPlayerIds: ["p4"],
    scopeType: S.TOURNAMENT,
    scopeId: "t1",
  });
  const res = resolve([s1, s2], {
    tournamentId: "t1",
    operation: OP.PARTNER_PAIRING,
  });
  assert.equal(res.softRules.length, 2);
});

test("23. Resolve result is independent of DB rule order", () => {
  const a = rule({ id: "a", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const b = rule({
    id: "b",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  const forward = resolve([a, b], { clubId: "c1", operation: OP.PARTNER_PAIRING });
  const reversed = resolve([b, a], { clubId: "c1", operation: OP.PARTNER_PAIRING });
  assert.deepEqual(forward.effectiveRules, reversed.effectiveRules);
});

// ---------------------------------------------------------------------------
// E. Blocking, persistence metadata, legacy
// ---------------------------------------------------------------------------

test("24. fatalConflicts block resolve ok", () => {
  const a = rule({ id: "a", constraintType: T.MUST_PARTNER, scopeType: S.GLOBAL });
  const b = rule({ id: "b", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const res = resolve([a, b], { operation: OP.PARTNER_PAIRING });
  assert.equal(res.ok, false);
  assert.ok(res.fatalConflicts.length >= 1);
});

test("25. blockedByPolicy blocks official class in gate path", () => {
  const personal = rule({
    id: "p",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
    visibility: RULE_VISIBILITY.PRIVATE,
  });
  const res = resolve([personal], {
    clubId: "c1",
    competitionClass: COMPETITION_CLASS.OFFICIAL,
    allowedByPublishedRules: false,
    operation: OP.PARTNER_PAIRING,
  });
  assert.ok(res.blockedByPolicy.length >= 1);
});

test("27. ruleResolution audit includes source buckets and overrides", () => {
  const sa = rule({ id: "sa", constraintType: T.MUST_NOT_PARTNER, scopeType: S.GLOBAL });
  const cl = rule({
    id: "cl",
    constraintType: T.MUST_PARTNER,
    scopeType: S.CLUB,
    scopeId: "c1",
  });
  const res = resolve([sa, cl], { clubId: "c1", operation: OP.PARTNER_PAIRING });
  assert.ok(res.ruleResolution.appliedSuperAdminRuleIds.includes("sa"));
  assert.ok(res.ruleResolution.overriddenRules.length >= 1);
  assert.ok(Array.isArray(res.ruleResolution.ignoredRules));
});

test("28. No private rules yields empty ruleResolution", () => {
  const res = resolve([], { operation: OP.TEAM_FORMATION });
  assert.equal(res.ok, true);
  assert.equal(res.ruleResolution.appliedRuleIds.length, 0);
});

test("29. Legacy rule without source derives SUPER_ADMIN from GLOBAL", () => {
  const legacy = rule({ id: "legacy", scopeType: S.GLOBAL });
  const res = resolve([legacy], { operation: OP.PARTNER_PAIRING });
  assert.equal(res.effectiveRules[0].source, "SUPER_ADMIN");
  assert.ok(res.ruleResolution.appliedSuperAdminRuleIds.includes("legacy"));
});

test("30. ruleResolution exposes operation on all three ops", () => {
  const r = rule({ id: "r" });
  for (const op of [OP.TEAM_FORMATION, OP.PARTNER_PAIRING, OP.GROUP_DRAW]) {
    const res = resolve([r], { operation: op });
    assert.equal(res.ruleResolution.operation, op);
  }
});
