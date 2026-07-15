import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { pairTeamsFromSelectedPlayers } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { runTeamFormationWithCanonicalAdapter } from "../src/features/competition-core/formation/adapters/teamFormationAdapter.js";
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
  filterRulesForTeamFormation,
  isExcludedFromTeamFormation,
  loadActiveRulesForLiveScope,
  mapDbRuleSetPayload,
  setPrivatePairingRpcClientForTests,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function mlpPlayers() {
  // 4M + 4F → 2 teams
  const males = Array.from({ length: 4 }, (_, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    gender: "Nam",
    rating: 4.0 - i * 0.15,
    level: 4.0 - i * 0.15,
  }));
  const females = Array.from({ length: 4 }, (_, i) => ({
    id: `f${i + 1}`,
    name: `F${i + 1}`,
    gender: "Nữ",
    rating: 3.6 - i * 0.1,
    level: 3.6 - i * 0.1,
  }));
  return [...males, ...females];
}

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "r1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    severity: "hard",
    weight: null,
    primaryPlayerId: "m1",
    targetPlayerIds: ["m2"],
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

function teamMembershipKey(teams = []) {
  return teams
    .map((team) => [...(team.playerIds || [])].map(String).sort().join("+"))
    .sort()
    .join("|");
}

function teamsSharePartner(teams, a, b) {
  return (teams || []).some((team) => {
    const ids = new Set((team.playerIds || []).map(String));
    return ids.has(String(a)) && ids.has(String(b));
  });
}

function mockClient(handler) {
  return { rpc: async (name, args) => handler(name, args) };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
});

describe("TT-V6-2 — team MLP canonical rules", () => {
  it("filters opponent and group rules out of team formation", () => {
    const rules = [
      rule({ id: "partner", constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER }),
      rule({
        id: "opp",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
        severity: "soft",
        weight: 40,
        primaryPlayerId: "m1",
        targetPlayerIds: ["f1"],
      }),
      rule({
        id: "group",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
        severity: "soft",
        weight: 40,
        primaryPlayerId: "m1",
        targetPlayerIds: ["f2"],
      }),
    ];
    const filtered = filterRulesForTeamFormation(rules);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "partner");
    assert.equal(isExcludedFromTeamFormation(PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT), true);
    assert.equal(isExcludedFromTeamFormation(PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP), true);
  });

  it("flags OFF keep legacy MLP output shape and membership", () => {
    const players = mlpPlayers();
    const selectedPlayerIds = players.map((p) => p.id);
    const a = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds,
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_OFF,
      seed: 11,
      privatePairingRules: [rule()],
    });
    const b = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds,
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_OFF,
      seed: 11,
    });
    assert.equal(a.ok, true);
    assert.equal(a.teams.length, 2);
    assert.equal(a.privatePairingError, null);
    // Same seed + OFF does not depend on private rules
    assert.equal(teamMembershipKey(a.teams), teamMembershipKey(b.teams));
    for (const team of a.teams) {
      assert.equal((team.playerIds || []).length, 4);
    }
  });

  it("flags ON enter canonical hard filter for must_not_partner", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 7,
      maxCandidates: 32,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "hard-avoid",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.privatePairingMeta?.runtimeEnabled, true);
    assert.equal(teamsSharePartner(result.teams, "m1", "m2"), false);
  });

  it("must_partner is respected on selected candidate", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 3,
      maxCandidates: 40,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "must",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(teamsSharePartner(result.teams, "m1", "f1"), true);
  });

  it("hard gender structure rejects insufficient roster", () => {
    const players = mlpPlayers().filter((p) => p.gender === "Nam");
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      privatePairingRules: [rule()],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.teams, []);
    assert.match(result.warnings.join(" "), /nam|nữ|Nữ|Nam/i);
  });

  it("soft prefer_partner improves ranking vs avoid without removing candidate", () => {
    const players = mlpPlayers();
    const prefer = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 15,
      maxCandidates: 32,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "pref",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: "soft",
          weight: 90,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(prefer.ok, true);
    assert.ok(Number.isFinite(prefer.privatePairingMeta?.constraintScore));
    // Soft path always returns teams when MLP structure is feasible
    assert.equal(prefer.teams.length, 2);
  });

  it("soft avoid_partner does not hard-eliminate all candidates", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 9,
      maxCandidates: 24,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "soft-avoid",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
          severity: "soft",
          weight: 80,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.teams.length, 2);
  });

  it("fatalConflicts stop team formation with structured error", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 1,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "must",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
        rule({
          id: "must-not",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
      ],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.teams, []);
    assert.equal(result.privatePairingError?.ok, false);
    assert.equal(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT
    );
    assert.ok((result.privatePairingError?.fatalConflicts || []).length >= 1);
  });

  it("official blockedByPolicy stops team formation — no legacy fallback", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 2,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      privatePairingRules: [
        rule({
          id: "pers",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.PRIVATE,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.teams, []);
    assert.equal(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("internal does not hard-stop personal preference teammate rules", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 4,
      maxCandidates: 32,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      allowedByPublishedRules: false,
      privatePairingRules: [
        rule({
          id: "pers-int",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
          visibility: RULE_VISIBILITY.PRIVATE,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.notEqual(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
    assert.equal(result.ok, true);
    assert.equal(teamsSharePartner(result.teams, "m1", "f1"), true);
  });

  it("opponent-only rules are ignored during formation (legacy MLP continues)", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 8,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "opp-only",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
          severity: "soft",
          weight: 99,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.teams.length, 2);
    assert.equal(result.privatePairingMeta?.formationRulesApplied, 0);
  });

  it("impossible hard rules return structured error — no random teams", () => {
    const players = mlpPlayers();
    // Force m1 must partner both m2 and m3 while MLP male slots are only 2 → often infeasible
    // Stronger: m1 must_not with every other male and every female except one pattern —
    // Use must_partner m1-m2 AND must_not m1-m2 already covered by fatal.
    // Here: no feasible after search if must_not all same-gender partners required wrongly.
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 1,
      maxCandidates: 16,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "a",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
        rule({
          id: "b",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m3"],
        }),
        rule({
          id: "c",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m4"],
        }),
      ],
    });
    // m1 must be with one of m2/m3/m4 as second male → all forbidden → no feasible
    assert.equal(result.ok, false);
    assert.deepEqual(result.teams, []);
    assert.equal(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_PAIRING
    );
  });

  it("same seed is deterministic for membership", () => {
    const players = mlpPlayers();
    const input = {
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 42,
      maxCandidates: 20,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
      ],
    };
    const a = pairTeamsFromSelectedPlayers(input);
    const b = pairTeamsFromSelectedPlayers(input);
    assert.equal(a.ok, b.ok);
    assert.equal(teamMembershipKey(a.teams), teamMembershipKey(b.teams));
  });

  it("adapter preserves output contract fields", () => {
    const players = mlpPlayers();
    const pairing = runTeamFormationWithCanonicalAdapter({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      teamNames: ["Alpha", "Beta"],
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 5,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
          primaryPlayerId: "m1",
          targetPlayerIds: ["m2"],
        }),
      ],
    });
    assert.ok(Array.isArray(pairing.teams));
    assert.ok(Array.isArray(pairing.waitingPlayerIds));
    assert.ok(Array.isArray(pairing.warnings));
    assert.equal(pairing.ok, true);
    assert.equal(pairing.teams.length, 2);
  });

  it("loads tournament scope for team formation options", async () => {
    const seen = [];
    setPrivatePairingRpcClientForTests(
      mockClient(async (name, args) => {
        seen.push({ name, scopeType: args.p_scope_type, scopeId: args.p_scope_id });
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs-t",
              version: 1,
              scope_type: "TOURNAMENT",
              scope_id: "tour-1",
              status: "active",
            },
            rules: [
              {
                id: "db-1",
                rule_set_id: "rs-t",
                constraint_type: "must_not_partner",
                severity: "hard",
                primary_player_id: "m1",
                target_player_ids: ["m2"],
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
      clubId: "club-X",
      tournamentId: "tour-1",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, "TOURNAMENT");
    assert.equal(loaded.rules[0].constraintType, "must_not_partner");
    assert.equal(seen[0].name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
    assert.equal(seen[0].scopeId, "tour-1");

    const mapped = mapDbRuleSetPayload({
      rule_set: { id: "rs", version: 1, scope_type: "CLUB", scope_id: "c1" },
      rules: [
        {
          id: "x",
          constraint_type: "prefer_partner",
          severity: "soft",
          weight: 50,
          primary_player_id: "m1",
          target_player_ids: ["f1"],
          relation_mode: "ANY_OF",
          visibility: "private",
          reason_category: "OTHER",
          reason_text: "p",
          active: true,
        },
      ],
    });
    assert.equal(mapped.rules[0].constraintType, "prefer_partner");
  });

  it("exposes formationQualityScore separately from canonical constraintScore", () => {
    const players = mlpPlayers();
    const result = pairTeamsFromSelectedPlayers({
      players,
      selectedPlayerIds: players.map((p) => p.id),
      teamCount: 2,
      formatPreset: FORMAT_PRESET.MLP_4,
      envSource: FLAGS_ON,
      seed: 6,
      maxCandidates: 20,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "pref",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
          severity: "soft",
          weight: 60,
          primaryPlayerId: "m1",
          targetPlayerIds: ["f1"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.ok(result.privatePairingMeta?.formationQualityScore != null);
    assert.ok(result.privatePairingMeta?.constraintScore != null);
  });
});
