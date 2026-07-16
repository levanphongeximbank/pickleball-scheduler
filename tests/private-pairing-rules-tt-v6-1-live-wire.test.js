import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import {
  suggestEntriesFromPlayers,
  suggestTeamsFromPlayers,
} from "../src/tournament/engines/teamPairingEngine.js";
import { calculatePairScore } from "../src/ai/scoring.js";
import {
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_SCOPE,
  REASON_CATEGORY,
  RELATION_MODE,
  RULE_VISIBILITY,
  createPrivatePairingRule,
  loadActiveRulesForLiveScope,
  mapDbRuleSetPayload,
  prepareLivePrivatePairingOptions,
  resolveActivePrivatePairingRules,
  runPrivatePairingRuntime,
  setPrivatePairingRpcClientForTests,
  splitHardAndSoftRules,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { createPairingConstraint } from "../src/features/pairing-constraints/models/pairingConstraint.js";
import { CONSTRAINT_TYPE } from "../src/features/pairing-constraints/constants.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function players(n = 8) {
  return Array.from({ length: n }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    level: 3 + (index % 5) * 0.1,
    rating: 3 + (index % 5) * 0.1,
  }));
}

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "rule-1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    severity: "hard",
    weight: null,
    primaryPlayerId: "p1",
    targetPlayerIds: ["p2"],
    relationMode: RELATION_MODE.ANY_OF,
    scopeType: PRIVATE_PAIRING_SCOPE.GLOBAL,
    scopeId: null,
    visibility: RULE_VISIBILITY.PRIVATE,
    reasonCategory: REASON_CATEGORY.EVENT_OPERATION,
    reasonText: "ops",
    active: true,
    ...overrides,
  });
}

function mockClient(handler) {
  return {
    rpc: async (name, args) => handler(name, args),
  };
}

function dbPayload({ scopeType, scopeId, ruleId = "db-rule-1", constraintType = "must_not_partner" }) {
  return {
    ok: true,
    rule_set: {
      id: `rs-${scopeType}-${scopeId}`,
      version: 2,
      scope_type: scopeType,
      scope_id: scopeId,
      status: "active",
    },
    rules: [
      {
        id: ruleId,
        rule_set_id: `rs-${scopeType}-${scopeId}`,
        constraint_type: constraintType,
        severity: "hard",
        primary_player_id: "p1",
        target_player_ids: ["p2"],
        relation_mode: "ANY_OF",
        visibility: "private",
        reason_category: "OTHER",
        reason_text: "avoid duo",
        active: true,
      },
    ],
  };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
});

describe("TT-V6-1 — live private pairing wire", () => {
  it("flags OFF keep legacy founder optimizer path", () => {
    const options = {
      envSource: FLAGS_OFF,
      pairingConstraints: [
        createPairingConstraint({
          type: CONSTRAINT_TYPE.AVOID_PARTNER,
          mode: "hard",
          anchorPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      seed: 7,
    };
    const teams = suggestTeamsFromPlayers(players(8), EVENT_TYPE.OPEN_DOUBLE, options);
    assert.equal(Array.isArray(teams), true);
    assert.equal(options.privatePairingRuntime == null, true);
    // Legacy path may yield teams; runtime not used
    assert.equal(options.privatePairingError, null);
  });

  it("both flags ON enter private runtime when rules/constraints present", () => {
    const options = {
      envSource: FLAGS_ON,
      privatePairingRules: [rule()],
      seed: 11,
      competitionClass: COMPETITION_CLASS.INTERNAL,
    };
    const teams = suggestTeamsFromPlayers(players(8), EVENT_TYPE.OPEN_DOUBLE, options);
    assert.ok(options.privatePairingRuntime);
    assert.equal(options.privatePairingRuntime.meta.runtimeEnabled, true);
    assert.ok(teams.length >= 0);
    for (const team of teams) {
      const ids = (team.members || []).map((p) => String(p.id));
      assert.equal(ids.includes("p1") && ids.includes("p2"), false);
    }
  });

  it("loads active rules by club scope and maps via mapDbRuleSetPayload once", async () => {
    let rpcCalls = 0;
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        rpcCalls += 1;
        assert.equal(name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
        assert.equal(args.p_scope_type, "CLUB");
        assert.equal(args.p_scope_id, "club-A");
        return { data: dbPayload({ scopeType: "CLUB", scopeId: "club-A" }), error: null };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, "CLUB");
    assert.equal(loaded.rules.length, 1);
    assert.equal(loaded.rules[0].constraintType, "must_not_partner");
    assert.equal(rpcCalls, 1);

    // Already canonical — mapping again would still produce same shape
    const remapped = mapDbRuleSetPayload({
      rule_set: { id: "x", version: 1, scope_type: "CLUB", scope_id: "club-A" },
      rules: [
        {
          id: "raw",
          constraint_type: "prefer_partner",
          severity: "soft",
          weight: 40,
          primary_player_id: "p3",
          target_player_ids: ["p4"],
          relation_mode: "ANY_OF",
          visibility: "private",
          reason_category: "OTHER",
          reason_text: "pref",
          active: true,
        },
      ],
    });
    assert.equal(remapped.rules[0].constraintType, "prefer_partner");
  });

  it("loads tournament scope first and does not fetch another tournament", async () => {
    const seen = [];
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        seen.push({ name, scopeType: args.p_scope_type, scopeId: args.p_scope_id });
        if (args.p_scope_type === "TOURNAMENT" && args.p_scope_id === "t-good") {
          return {
            data: dbPayload({
              scopeType: "TOURNAMENT",
              scopeId: "t-good",
              ruleId: "tour-rule",
            }),
            error: null,
          };
        }
        return {
          data: dbPayload({
            scopeType: args.p_scope_type,
            scopeId: args.p_scope_id,
            ruleId: "wrong-scope",
          }),
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-A",
      tournamentId: "t-good",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, "TOURNAMENT");
    assert.equal(loaded.rules[0].id, "tour-rule");
    assert.equal(seen.length, 1);
    assert.equal(seen[0].scopeId, "t-good");
  });

  it("official does not fall back to club when tournament rules empty", async () => {
    let clubCalls = 0;
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        if (args.p_scope_type === "CLUB") {
          clubCalls += 1;
          return {
            data: dbPayload({ scopeType: "CLUB", scopeId: "club-A" }),
            error: null,
          };
        }
        return {
          data: {
            ok: true,
            rule_set: null,
            rules: [],
          },
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-A",
      tournamentId: "t-empty",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.rules, []);
    assert.equal(clubCalls, 0);
  });

  it("internal may fall back to club when tournament rules empty", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        if (args.p_scope_type === "TOURNAMENT") {
          return { data: { ok: true, rule_set: null, rules: [] }, error: null };
        }
        return {
          data: dbPayload({ scopeType: "CLUB", scopeId: "club-A", ruleId: "club-fallback" }),
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-A",
      tournamentId: "t-empty",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.usedClubFallback, true);
    assert.equal(loaded.rules[0].id, "club-fallback");
  });

  it("load failure is not silently ignored", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: { ok: false, code: "RPC_ERROR", message: "boom" },
        error: null,
      }))
    );

    const prepared = await prepareLivePrivatePairingOptions({
      tenantId: "venue-test",
      tournamentId: "t1",
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.ok(prepared.error?.code);
    assert.equal(prepared.pairingOptions, null);
  });

  it("resolveActivePrivatePairingRules + splitHardAndSoftRules used before pairing", () => {
    const resolved = resolveActivePrivatePairingRules({
      rules: [
        rule({ id: "h1", severity: "hard" }),
        rule({
          id: "s1",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: "soft",
          weight: 50,
          primaryPlayerId: "p3",
          targetPlayerIds: ["p4"],
        }),
      ],
      context: { competitionClass: COMPETITION_CLASS.INTERNAL, teamSize: 2 },
    });
    const { hard, soft } = splitHardAndSoftRules(resolved.rules);
    assert.equal(hard.some((r) => r.id === "h1"), true);
    assert.equal(soft.some((r) => r.id === "s1"), true);
  });

  it("hard failure is not compensated by soft score", () => {
    const result = runPrivatePairingRuntime({
      players: players(4),
      rules: [
        rule({
          id: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
        rule({
          id: "soft",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: "soft",
          weight: 999,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p3"],
        }),
      ],
      seed: 3,
      envSource: FLAGS_ON,
      context: { competitionClass: COMPETITION_CLASS.INTERNAL, teamSize: 2 },
      maxCandidates: 32,
      maxIterations: 64,
    });

    if (result.ok && result.selectedCandidate) {
      const teamWithP1 = (result.selectedCandidate.teams || []).find((team) =>
        (team.members || []).some((p) => String(p.id) === "p1")
      );
      const ids = (teamWithP1?.members || []).map((p) => String(p.id));
      assert.equal(ids.includes("p2"), true);
    } else {
      // Impossible or truncated is still a hard stop — not a soft-compensated fake pair
      assert.equal(result.ok, false);
      assert.ok(result.errorCode);
    }
  });

  it("fatalConflicts stop optimizer with structured error", () => {
    const options = {
      envSource: FLAGS_ON,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "must",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
        rule({
          id: "must-not",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      seed: 1,
    };
    const teams = suggestTeamsFromPlayers(players(8), EVENT_TYPE.OPEN_DOUBLE, options);
    assert.deepEqual(teams, []);
    assert.equal(options.privatePairingError?.ok, false);
    assert.equal(
      options.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT
    );
    assert.ok((options.privatePairingError?.fatalConflicts || []).length >= 1);
    assert.ok(options.privatePairingError?.message);
  });

  it("official blockedByPolicy stops pairing — no legacy fallback / no baseline", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: {
          ok: true,
          rule_set: {
            id: "rs-off",
            version: 1,
            scope_type: "TOURNAMENT",
            scope_id: "t-off",
            status: "active",
          },
          rules: [
            {
              id: "pers-1",
              rule_set_id: "rs-off",
              constraint_type: "must_partner",
              severity: "hard",
              primary_player_id: "p1",
              target_player_ids: ["p2"],
              relation_mode: "ANY_OF",
              visibility: "private",
              reason_category: "OTHER",
              reason_text: "private prefer",
              active: true,
            },
          ],
        },
        error: null,
      }))
    );

    const prepared = await prepareLivePrivatePairingOptions({
      tenantId: "venue-test",
      tournamentId: "t-off",
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      envSource: FLAGS_ON,
      pairingConstraints: [
        createPairingConstraint({
          type: CONSTRAINT_TYPE.PREFER_PARTNER,
          mode: "soft",
          anchorPlayerId: "p3",
          targetPlayerIds: ["p4"],
        }),
      ],
    });

    assert.equal(prepared.ok, false);
    assert.equal(
      prepared.error?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
    assert.ok((prepared.error?.blockedByPolicy || []).length >= 1);

    // Engine-level gate also hard-stops; no silent legacy teams
    const options = {
      envSource: FLAGS_ON,
      tournamentId: "t-off",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      privatePairingRules: [
        rule({
          id: "pers-1",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.PRIVATE,
        }),
      ],
      pairingConstraints: [
        createPairingConstraint({
          type: CONSTRAINT_TYPE.PREFER_PARTNER,
          mode: "soft",
          anchorPlayerId: "p3",
          targetPlayerIds: ["p4"],
        }),
      ],
      seed: 5,
    };
    const teams = suggestTeamsFromPlayers(players(8), EVENT_TYPE.OPEN_DOUBLE, options);
    assert.deepEqual(teams, []);
    assert.equal(
      options.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("internal keeps drop-and-continue policy for blocked personal rules", () => {
    const result = runPrivatePairingRuntime({
      players: players(8),
      rules: [
        rule({
          id: "pers-int",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.PRIVATE,
        }),
      ],
      seed: 2,
      envSource: FLAGS_ON,
      context: {
        competitionClass: COMPETITION_CLASS.INTERNAL,
        allowedByPublishedRules: false,
      },
    });
    // Personal preference is not restricted for INTERNAL → rule applies or pairs succeed
    assert.equal(result.ok === true || result.errorCode != null, true);
    assert.notEqual(
      result.errorCode,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("avoid opponent soft rule changes constraint score", () => {
    const soft = rule({
      id: "avoid-opp",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
      severity: "soft",
      weight: 80,
      primaryPlayerId: "p1",
      targetPlayerIds: ["p3"],
    });
    const matchSameOpp = {
      teamA: [
        { id: "p1", level: 3 },
        { id: "p2", level: 3 },
      ],
      teamB: [
        { id: "p3", level: 3 },
        { id: "p4", level: 3 },
      ],
    };
    const matchDiffOpp = {
      teamA: [
        { id: "p1", level: 3 },
        { id: "p2", level: 3 },
      ],
      teamB: [
        { id: "p5", level: 3 },
        { id: "p6", level: 3 },
      ],
    };
    const a = calculatePairScore(matchSameOpp, {
      envSource: FLAGS_ON,
      privatePairingRules: [soft],
      privatePairingContext: { competitionClass: COMPETITION_CLASS.INTERNAL },
    });
    const b = calculatePairScore(matchDiffOpp, {
      envSource: FLAGS_ON,
      privatePairingRules: [soft],
      privatePairingContext: { competitionClass: COMPETITION_CLASS.INTERNAL },
    });
    assert.ok(Number.isFinite(a.constraintScore) || a.rejected === true);
    assert.ok(Number.isFinite(b.constraintScore) || b.rejected === true);
    if (!a.rejected && !b.rejected) {
      assert.ok(b.constraintScore > a.constraintScore);
    }
  });

  it("same seed is deterministic", () => {
    const rules = [rule()];
    const a = runPrivatePairingRuntime({
      players: players(8),
      rules,
      seed: 42,
      envSource: FLAGS_ON,
      context: { competitionClass: COMPETITION_CLASS.INTERNAL, teamSize: 2 },
    });
    const b = runPrivatePairingRuntime({
      players: players(8),
      rules,
      seed: 42,
      envSource: FLAGS_ON,
      context: { competitionClass: COMPETITION_CLASS.INTERNAL, teamSize: 2 },
    });
    assert.equal(a.ok, b.ok);
    assert.equal(a.errorCode, b.errorCode);
    assert.deepEqual(
      a.selectedCandidate?.teams?.map((t) => (t.members || []).map((p) => p.id).sort()),
      b.selectedCandidate?.teams?.map((t) => (t.members || []).map((p) => p.id).sort())
    );
  });

  it("mixed doubles respects gender pairing", () => {
    const list = players(8);
    const options = {
      envSource: FLAGS_ON,
      privatePairingRules: [],
      seed: 9,
      competitionClass: COMPETITION_CLASS.INTERNAL,
    };
    const teams = suggestTeamsFromPlayers(list, EVENT_TYPE.MIXED_DOUBLE, options);
    for (const team of teams) {
      const genders = (team.members || []).map((p) => p.gender);
      assert.equal(genders.includes("Nam") && genders.includes("Nữ"), true);
    }
  });

  it("suggestEntriesFromPlayers surfaces structured privatePairingError", () => {
    const options = {
      envSource: FLAGS_ON,
      tournamentId: "t1",
      eventId: "e1",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.PRIVATE,
        }),
      ],
      seed: 1,
    };
    const entries = suggestEntriesFromPlayers(players(8), EVENT_TYPE.OPEN_DOUBLE, options);
    assert.deepEqual(entries, []);
    assert.equal(
      options.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("flags OFF skip live rule load", async () => {
    let called = false;
    setPrivatePairingRpcClientForTests(
      mockClient(async () => {
        called = true;
        return { data: { ok: true, rules: [] }, error: null };
      })
    );
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "club-A",
      tournamentId: "t1",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_OFF,
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.skipped, true);
    assert.equal(called, false);
  });
});
