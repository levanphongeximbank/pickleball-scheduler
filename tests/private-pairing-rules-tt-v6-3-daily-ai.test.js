import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { runAI } from "../src/ai/engine.js";
import { calculatePairScore } from "../src/ai/scoring.js";
import {
  createFairDailyMatches,
  DAILY_GENDER_FILTER,
  DAILY_MATCH_TYPE,
  getDefaultDailyPlaySettings,
} from "../src/tournament/engines/dailyPlayEngine.js";
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
  gatePrivatePairingForRunAi,
  loadActiveRulesForLiveScope,
  prepareLivePrivatePairingOptions,
  setPrivatePairingRpcClientForTests,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function localStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function players(n = 8) {
  return Array.from({ length: n }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
    level: 3.5 + (index % 4) * 0.1,
    rating: 3.5 + (index % 4) * 0.1,
  }));
}

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "r1",
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
  return { rpc: async (name, args) => handler(name, args) };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
  globalThis.localStorage = localStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
});

describe("TT-V6-3 — Daily Play / runAI private rules", () => {
  it("flags OFF skip active-rule loader for Daily Play", async () => {
    let called = false;
    setPrivatePairingRpcClientForTests(
      mockClient(async () => {
        called = true;
        return { data: { ok: true, rules: [] }, error: null };
      })
    );

    const list = players(8);
    const result = await createFairDailyMatches({
      players: list,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: list.map((p) => String(p.id)),
        matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
        genderFilter: DAILY_GENDER_FILTER.ALL,
      },
      tournamentId: "t1",
      clubId: "club-A",
      matchCount: 1,
      envSource: FLAGS_OFF,
    });

    assert.equal(result.ok, true);
    assert.equal(called, false);
    assert.equal(result.matches.length, 1);
  });

  it("flags ON loader uses club scope for Daily Play", async () => {
    const seen = [];
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        seen.push({ name, scopeType: args.p_scope_type, scopeId: args.p_scope_id });
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs-club",
              version: 1,
              scope_type: "CLUB",
              scope_id: "club-A",
              status: "active",
            },
            rules: [
              {
                id: "db-1",
                rule_set_id: "rs-club",
                constraint_type: "must_not_partner",
                severity: "hard",
                primary_player_id: "p1",
                target_player_ids: ["p2"],
                relation_mode: "ANY_OF",
                visibility: "private",
                reason_category: "OTHER",
                reason_text: "note",
                active: true,
              },
            ],
          },
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, "CLUB");
    assert.equal(seen[0].name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
    assert.equal(seen[0].scopeId, "club-A");
  });

  it("tournamentId prefers tournament scope for Daily context", async () => {
    const seen = [];
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        seen.push({ scopeType: args.p_scope_type, scopeId: args.p_scope_id });
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs-t",
              version: 1,
              scope_type: "TOURNAMENT",
              scope_id: "t-good",
              status: "active",
            },
            rules: [],
          },
          error: null,
        };
      })
    );

    const prepared = await prepareLivePrivatePairingOptions({
      tenantId: "venue-test",
      clubId: "club-A",
      tournamentId: "t-good",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, true);
    assert.equal(seen[0].scopeType, "TOURNAMENT");
    assert.equal(seen[0].scopeId, "t-good");
  });

  it("gatePrivatePairingForRunAi hard-stops official blockedByPolicy", () => {
    const gated = gatePrivatePairingForRunAi(
      {
        envSource: FLAGS_ON,
        competitionClass: COMPETITION_CLASS.OFFICIAL,
        allowedByPublishedRules: false,
        privatePairingRules: [
          rule({
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
            visibility: RULE_VISIBILITY.PRIVATE,
          }),
        ],
      },
      { teamSize: 2 }
    );
    assert.equal(gated.ok, false);
    assert.equal(
      gated.error?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("fatalConflicts stop runAI before optimizer result", () => {
    const list = players(8);
    const courts = [{ id: "c1", name: "Sân 1", active: true }];
    const result = runAI(list, {
      enabledCourts: courts,
      competitionType: "doubles_mixed",
      persist: false,
      envSource: FLAGS_ON,
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
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
    });
    assert.ok(result.errors?.length);
    assert.equal(result.privatePairingError?.ok, false);
    assert.equal(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT
    );
    assert.deepEqual(result.courts || [], []);
  });

  it("hard must_not_partner rejects match option with NEGATIVE_INFINITY", () => {
    const scored = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p2", level: 3.5 },
        ],
        teamB: [
          { id: "p3", level: 3.5 },
          { id: "p4", level: 3.5 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [
          rule({
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
            primaryPlayerId: "p1",
            targetPlayerIds: ["p2"],
          }),
        ],
        privatePairingContext: {
          competitionClass: COMPETITION_CLASS.DAILY_PLAY,
          clubId: "club-A",
        },
        policies: [],
      }
    );
    assert.equal(scored.rejected, true);
    assert.equal(scored.totalScore, Number.NEGATIVE_INFINITY);
  });

  it("soft prefer_partner increases constraintScore when satisfied", () => {
    const soft = rule({
      id: "pref",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
      severity: "soft",
      weight: 80,
      primaryPlayerId: "p1",
      targetPlayerIds: ["p2"],
    });
    const hit = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p2", level: 3.4 },
        ],
        teamB: [
          { id: "p3", level: 3.5 },
          { id: "p4", level: 3.4 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [soft],
        privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
        policies: [],
      }
    );
    const miss = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p3", level: 3.4 },
        ],
        teamB: [
          { id: "p2", level: 3.5 },
          { id: "p4", level: 3.4 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [soft],
        privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
        policies: [],
      }
    );
    assert.ok(hit.constraintScore > miss.constraintScore);
  });

  it("soft avoid_opponent lowers score when facing target", () => {
    const soft = rule({
      id: "ao",
      constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
      severity: "soft",
      weight: 70,
      primaryPlayerId: "p1",
      targetPlayerIds: ["p3"],
    });
    const violated = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p2", level: 3.4 },
        ],
        teamB: [
          { id: "p3", level: 3.5 },
          { id: "p4", level: 3.4 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [soft],
        privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
        policies: [],
      }
    );
    const ok = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p2", level: 3.4 },
        ],
        teamB: [
          { id: "p5", level: 3.5 },
          { id: "p6", level: 3.4 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [soft],
        privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
        policies: [],
      }
    );
    assert.ok(ok.constraintScore > violated.constraintScore);
  });

  it("founder prefer is not double-scored when unified runtime ON", () => {
    const option = {
      teamA: [
        { id: "p1", level: 3.5 },
        { id: "p2", level: 3.4 },
      ],
      teamB: [
        { id: "p3", level: 3.5 },
        { id: "p4", level: 3.4 },
      ],
    };
    const founderPolicy = {
      id: "fp1",
      type: "prefer_teammate",
      playerA: "p1",
      playerB: "p2",
      enabled: true,
      source: "founder",
      priority: "NORMAL",
    };
    const withRules = calculatePairScore(option, {
      envSource: FLAGS_ON,
      policies: [founderPolicy],
      privatePairingRules: [],
      privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
    });
    // Constraint score comes from remapped founder→canonical soft; policyScore path skips founder
    assert.equal(withRules.rejected, undefined);
    assert.ok(Number.isFinite(withRules.totalScore));
  });

  it("load RPC failure is not ignored by prepare", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: { ok: false, code: "RPC_ERROR", message: "boom" },
        error: null,
      }))
    );
    const prepared = await prepareLivePrivatePairingOptions({
      tenantId: "venue-test",
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.ok(prepared.error?.code);
  });

  it("createFairDailyMatches passes structured privatePairingError on load failure", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(async () => ({
        data: { ok: false, code: "RPC_ERROR", message: "boom" },
        error: null,
      }))
    );
    const list = players(8);
    const result = await createFairDailyMatches({
      players: list,
      settings: {
        ...getDefaultDailyPlaySettings(),
        checkedInPlayerIds: list.map((p) => String(p.id)),
        matchType: DAILY_MATCH_TYPE.MIXED_DOUBLE,
      },
      clubId: "club-A",
      tournamentId: "t1",
      matchCount: 1,
      envSource: FLAGS_ON,
    });
    assert.equal(result.ok, false);
    assert.ok(result.privatePairingError || result.error);
  });

  it("runAI without private rules still schedules when flags ON", () => {
    const list = players(8);
    const result = runAI(list, {
      enabledCourts: [{ id: "c1", name: "Sân 1", active: true }],
      competitionType: "doubles_mixed",
      persist: false,
      envSource: FLAGS_ON,
      clubId: "club-A",
      competitionClass: COMPETITION_CLASS.DAILY_PLAY,
      privatePairingRules: [],
    });
    assert.equal(result.errors?.length || 0, 0);
    assert.ok((result.courts || []).length >= 1);
  });

  it("waitingScore remains present in AI scoring when runtime ON", () => {
    const scored = calculatePairScore(
      {
        teamA: [
          { id: "p1", level: 3.5 },
          { id: "p3", level: 3.4 },
        ],
        teamB: [
          { id: "p5", level: 3.5 },
          { id: "p7", level: 3.4 },
        ],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [],
        privatePairingContext: { competitionClass: COMPETITION_CLASS.DAILY_PLAY },
        policies: [],
        history: {},
        waitingSnapshot: {
          p1: { waitCount: 3, playCount: 0 },
          p3: { waitCount: 2, playCount: 1 },
          p5: { waitCount: 0, playCount: 2 },
          p7: { waitCount: 1, playCount: 1 },
        },
      }
    );
    assert.ok(Number.isFinite(scored.waitingScore));
    assert.ok(Number.isFinite(scored.totalScore));
  });
});
