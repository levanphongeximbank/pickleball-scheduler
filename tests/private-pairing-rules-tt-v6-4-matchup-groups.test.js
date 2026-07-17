import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import { assignGroupsWithConstraints } from "../src/features/pairing-constraints/engines/constraintGroupEngine.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import { assignSeededTeamsToGroups } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { buildStructuredRoundRobinMatchups } from "../src/features/team-tournament/engines/teamRoundRobinScheduleEngine.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";
import {
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_SCOPE,
  REASON_CATEGORY,
  RELATION_MODE,
  RULE_VISIBILITY,
  assignGroupsWithPrivatePairingRules,
  createPrivatePairingRule,
  evaluateHardPrivatePairingRules,
  evaluateOpponentMatchupCandidate,
  filterAndRankMatchupsByOpponentRules,
  filterRulesForGroupStage,
  filterRulesForOpponentStage,
  filterRulesForTeamFormation,
  isExcludedFromGroupStage,
  isExcludedFromOpponentStage,
  isExcludedFromTeamFormation,
  loadActiveRulesForLiveScope,
  mapDbRuleSetPayload,
  scoreSoftPrivatePairingRules,
  setPrivatePairingRpcClientForTests,
  splitHardAndSoftRules,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { buildInternalTournamentPlan } from "../src/tournament/engines/internalTournamentEngine.js";
import { buildGroupStageSchedule } from "../src/tournament/engines/scheduleEngine.js";
import { suggestEntriesFromPlayers, suggestTeamsFromPlayers } from "../src/tournament/engines/teamPairingEngine.js";

const FLAGS_ON = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "true",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "true",
};

const FLAGS_OFF = {
  [FEATURE_FLAG_KEYS.PRIVATE_PAIRING_RULES]: "false",
  [FEATURE_FLAG_KEYS.UNIFIED_CONSTRAINT_ENGINE]: "false",
};

function rule(overrides = {}) {
  return createPrivatePairingRule({
    id: overrides.id || "r1",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
    severity: "soft",
    weight: 40,
    primaryPlayerId: "male-1",
    targetPlayerIds: ["male-2"],
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

function buildMixedPlayers(maleCount, femaleCount) {
  const males = Array.from({ length: maleCount }, (_, i) => ({
    id: `male-${i + 1}`,
    name: `M${i + 1}`,
    gender: "Nam",
    rating: 4.2 - i * 0.1,
    level: 4.2 - i * 0.1,
  }));
  const females = Array.from({ length: femaleCount }, (_, i) => ({
    id: `female-${i + 1}`,
    name: `F${i + 1}`,
    gender: "Nữ",
    rating: 3.8 - i * 0.1,
    level: 3.8 - i * 0.1,
  }));
  return [...males, ...females];
}

function mockClient(handler) {
  return { rpc: async (name, args) => handler(name, args) };
}

beforeEach(() => {
  setPrivatePairingRpcClientForTests(null);
});

describe("TT-V6-4 — opponent + group stage wiring", () => {
  it("flags OFF keeps legacy matchup schedule", () => {
    const players = buildMixedPlayers(4, 4);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    const groups = assignGroupsWithConstraints(entries, 2, players, []);
    const schedule = buildGroupStageSchedule(groups.groups, {
      tournamentId: "t1",
      eventId: "e1",
      players,
      envSource: FLAGS_OFF,
      privatePairingRules: [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
          primaryPlayerId: entries[0].playerIds[0],
          targetPlayerIds: [entries[1].playerIds[0]],
        }),
      ],
    });
    assert.equal(schedule.ok, true);
    assert.ok(schedule.matches.length > 0);
    assert.equal(schedule.privatePairingError, null);
  });

  it("flags OFF keeps legacy group division", () => {
    const players = buildMixedPlayers(4, 4);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    const result = assignGroupsWithPrivatePairingRules(entries, 2, players, {
      envSource: FLAGS_OFF,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.usedCanonicalGroupRules, false);
    assert.ok(result.groups.length === 2);
  });

  it("flags ON uses canonical opponent pipeline", () => {
    const evaluated = evaluateOpponentMatchupCandidate(
      {
        teamA: [{ id: "male-1" }, { id: "female-1" }],
        teamB: [{ id: "male-2" }, { id: "female-2" }],
      },
      {
        envSource: FLAGS_ON,
        privatePairingRules: [
          rule({
            severity: "hard",
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
            primaryPlayerId: "male-1",
            targetPlayerIds: ["male-2"],
          }),
        ],
      }
    );
    assert.equal(evaluated.enabled, true);
    assert.equal(evaluated.rejected, true);
    assert.equal(evaluated.usedCanonicalOpponentRules, true);
    assert.ok(
      evaluated.rejectionCodes.includes(PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_MUST_NOT_OPPONENT)
    );
  });

  it("flags ON uses canonical group pipeline", () => {
    const players = buildMixedPlayers(4, 4);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    const result = assignGroupsWithPrivatePairingRules(entries, 2, players, {
      envSource: FLAGS_ON,
      seed: 7,
      tournamentId: "t1",
      clubId: "club-1",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      privatePairingRules: [
        rule({
          id: "g1",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.usedCanonicalGroupRules, true);
    const hard = evaluateHardPrivatePairingRules(
      { groups: result.groups },
      [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ]
    );
    assert.equal(hard.feasible, true);
  });

  it("loads club scope for club activity", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient((name, args) => {
        assert.equal(name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
        assert.equal(args.p_scope_type, PRIVATE_PAIRING_SCOPE.CLUB);
        assert.equal(args.p_scope_id, "club-only");
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs1",
              version: 1,
              scope_type: PRIVATE_PAIRING_SCOPE.CLUB,
              scope_id: "club-only",
              status: "active",
            },
            rules: [
              {
                id: "r-club",
                rule_set_id: "rs1",
                constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
                severity: "soft",
                weight: 30,
                primary_player_id: "male-1",
                target_player_ids: ["male-2"],
                relation_mode: RELATION_MODE.ANY_OF,
                visibility: "private",
                reason_category: "OTHER",
                reason_text: "group",
                active: true,
              },
            ],
          },
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-only",
      tournamentId: null,
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, PRIVATE_PAIRING_SCOPE.CLUB);
    assert.equal(loaded.rules[0].id, "r-club");
  });

  it("loads tournament scope and does not take other tournament rules", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient((_name, args) => {
        assert.equal(args.p_scope_type, PRIVATE_PAIRING_SCOPE.TOURNAMENT);
        assert.equal(args.p_scope_id, "tour-a");
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs-a",
              version: 1,
              scope_type: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
              scope_id: "tour-a",
              status: "active",
            },
            rules: [
              {
                id: "r-a",
                rule_set_id: "rs-a",
                constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
                severity: "soft",
                weight: 40,
                primary_player_id: "male-1",
                target_player_ids: ["male-2"],
                relation_mode: RELATION_MODE.ANY_OF,
                visibility: "private",
                reason_category: "OTHER",
                reason_text: "opp",
                active: true,
              },
            ],
          },
          error: null,
        };
      })
    );

    const loaded = await loadActiveRulesForLiveScope({
      clubId: "club-1",
      tournamentId: "tour-a",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.scopeType, PRIVATE_PAIRING_SCOPE.TOURNAMENT);
    assert.equal(loaded.rules[0].id, "r-a");
  });

  it("does not fetch foreign scope id", async () => {
    const seen = [];
    setPrivatePairingRpcClientForTests(
      mockClient((_name, args) => {
        seen.push(args.p_scope_id);
        return { data: { ok: true, rule_set: { rules: [] } }, error: null };
      })
    );
    await loadActiveRulesForLiveScope({
      clubId: "club-1",
      tournamentId: "tour-expected",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      envSource: FLAGS_ON,
    });
    assert.deepEqual(seen, ["tour-expected"]);
  });

  it("hard avoid_opponent rejects matchup", () => {
    const hard = evaluateHardPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }, { id: "b" }],
          teamB: [{ id: "c" }, { id: "d" }],
        },
      },
      [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
        }),
      ]
    );
    assert.equal(hard.feasible, false);
    assert.equal(hard.violations[0].code, PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_AVOID_OPPONENT);
  });

  it("hard must_not_play_against rejects matchup", () => {
    const ranked = filterAndRankMatchupsByOpponentRules(
      [
        {
          id: "m1",
          matchOption: {
            teamA: [{ id: "a" }, { id: "b" }],
            teamB: [{ id: "c" }, { id: "d" }],
          },
        },
      ],
      (m) => m.matchOption,
      {
        envSource: FLAGS_ON,
        privatePairingRules: [
          rule({
            severity: "hard",
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
            primaryPlayerId: "a",
            targetPlayerIds: ["c"],
          }),
        ],
        requireCompleteSet: false,
      }
    );
    assert.equal(ranked.ok, false);
    assert.equal(ranked.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP);
  });

  it("soft avoid_opponent decreases score", () => {
    const violated = scoreSoftPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }],
          teamB: [{ id: "c" }],
        },
      },
      [
        rule({
          severity: "soft",
          weight: 80,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
        }),
      ]
    );
    const ok = scoreSoftPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }],
          teamB: [{ id: "z" }],
        },
      },
      [
        rule({
          severity: "soft",
          weight: 80,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
        }),
      ]
    );
    assert.ok(violated.constraintScore < ok.constraintScore);
  });

  it("soft prefer_opponent increases score", () => {
    const hit = scoreSoftPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }],
          teamB: [{ id: "c" }],
        },
      },
      [
        rule({
          severity: "soft",
          weight: 90,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
        }),
      ]
    );
    const miss = scoreSoftPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }],
          teamB: [{ id: "z" }],
        },
      },
      [
        rule({
          severity: "soft",
          weight: 90,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
        }),
      ]
    );
    assert.ok(hit.constraintScore > miss.constraintScore);
  });

  it("opponent repeat soft score applies", () => {
    const soft = scoreSoftPrivatePairingRules(
      {
        matchOption: {
          teamA: [{ id: "a" }],
          teamB: [{ id: "c" }],
        },
      },
      [
        rule({
          severity: "soft",
          weight: 50,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
          primaryPlayerId: "a",
          targetPlayerIds: ["c"],
          metadata: { maxCount: 1 },
        }),
      ],
      { opponentRepeatCounts: { a: { c: 3 } } }
    );
    assert.ok(soft.constraintScore < 0);
  });

  it("hard avoid_same_group / different_group rejects group plan", () => {
    const hard = evaluateHardPrivatePairingRules(
      {
        groups: [
          { id: "A", playerIds: ["male-1", "male-2", "female-1"] },
          { id: "B", playerIds: ["male-3", "female-2"] },
        ],
      },
      [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ]
    );
    assert.equal(hard.feasible, false);
    assert.equal(hard.violations[0].code, PRIVATE_PAIRING_RUNTIME_CODE.VIOLATES_DIFFERENT_GROUP);
  });

  it("hard same_group is honored", () => {
    const ok = evaluateHardPrivatePairingRules(
      {
        groups: [
          { id: "A", playerIds: ["male-1", "male-2"] },
          { id: "B", playerIds: ["male-3"] },
        ],
      },
      [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ]
    );
    const bad = evaluateHardPrivatePairingRules(
      {
        groups: [
          { id: "A", playerIds: ["male-1"] },
          { id: "B", playerIds: ["male-2"] },
        ],
      },
      [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ]
    );
    assert.equal(ok.feasible, true);
    assert.equal(bad.feasible, false);
  });

  it("soft group preference changes ranking", () => {
    const softRules = [
      rule({
        severity: "soft",
        weight: 70,
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
        primaryPlayerId: "male-1",
        targetPlayerIds: ["male-2"],
      }),
    ];
    const preferred = scoreSoftPrivatePairingRules(
      {
        groups: [
          { id: "A", playerIds: ["male-1"] },
          { id: "B", playerIds: ["male-2"] },
        ],
      },
      softRules
    );
    const penalized = scoreSoftPrivatePairingRules(
      {
        groups: [{ id: "A", playerIds: ["male-1", "male-2"] }],
      },
      softRules
    );
    assert.ok(preferred.constraintScore > penalized.constraintScore);
  });

  it("does not apply teammate rules in opponent stage", () => {
    const filtered = filterRulesForOpponentStage([
      rule({
        id: "partner",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        severity: "hard",
      }),
      rule({
        id: "opp",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
        severity: "soft",
      }),
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "opp");
    assert.equal(isExcludedFromOpponentStage(PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER), true);
  });

  it("does not apply opponent rules in team formation", () => {
    assert.equal(isExcludedFromTeamFormation(PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT), true);
    const filtered = filterRulesForTeamFormation([
      rule({
        id: "opp",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
        severity: "hard",
      }),
      rule({
        id: "partner",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
        severity: "hard",
      }),
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "partner");
  });

  it("does not apply group rules in matchup stage", () => {
    const filtered = filterRulesForOpponentStage([
      rule({
        id: "group",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
        severity: "hard",
      }),
      rule({
        id: "opp",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
        severity: "soft",
      }),
    ]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "opp");
    assert.equal(isExcludedFromGroupStage(PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT), true);
    assert.equal(filterRulesForGroupStage([rule({ id: "opp" })]).length, 0);
  });

  it("fatalConflicts stop matchup stage", () => {
    const conflictRules = [
      rule({
        id: "must",
        severity: "hard",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
        primaryPlayerId: "a",
        targetPlayerIds: ["b"],
      }),
      rule({
        id: "must-not",
        severity: "hard",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
        primaryPlayerId: "a",
        targetPlayerIds: ["b"],
      }),
    ];
    const ranked = filterAndRankMatchupsByOpponentRules(
      [{ id: "m1", matchOption: { teamA: [{ id: "a" }], teamB: [{ id: "b" }] } }],
      (m) => m.matchOption,
      { envSource: FLAGS_ON, privatePairingRules: conflictRules }
    );
    assert.equal(ranked.ok, false);
    assert.equal(ranked.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT);
  });

  it("fatalConflicts stop group division", () => {
    const players = buildMixedPlayers(4, 4);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    const result = assignGroupsWithPrivatePairingRules(entries, 2, players, {
      envSource: FLAGS_ON,
      privatePairingRules: [
        rule({
          id: "must-same",
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
        rule({
          id: "must-diff",
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT);
    assert.equal(result.groups.length, 0);
  });

  it("opponent personal rules are WRONG_OPERATION for group division", () => {
    const players = buildMixedPlayers(4, 4);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    const result = assignGroupsWithPrivatePairingRules(entries, 2, players, {
      envSource: FLAGS_ON,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      privatePairingRules: [
        rule({
          severity: "soft",
          weight: 40,
          visibility: RULE_VISIBILITY.PRIVATE,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
          reasonCategory: REASON_CATEGORY.PERSONAL_PREFERENCE,
        }),
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.privatePairingError, null);
  });

  it("blockedByPolicy blocks Official partner pairing", () => {
    const players = buildMixedPlayers(4, 4);
    const opts = {
      envSource: FLAGS_ON,
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      forcePrivateRuntime: true,
      privatePairingRules: [
        rule({
          severity: "soft",
          weight: 40,
          visibility: RULE_VISIBILITY.PRIVATE,
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
          reasonCategory: REASON_CATEGORY.PERSONAL_PREFERENCE,
        }),
      ],
    };
    const teams = suggestTeamsFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, opts);
    assert.equal(teams.length, 0);
    assert.equal(
      opts.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("no random fallback when no feasible group plan", () => {
    const players = buildMixedPlayers(2, 2);
    const entries = suggestEntriesFromPlayers(players, EVENT_TYPE.MIXED_DOUBLE, {
      tournamentId: "t1",
      eventId: "e1",
    });
    // Force same_group across every player pair while requiring different_group — conflict may be fatal
    // Or hard different for players that must share a group of size force: one group only → infeasible
    const result = assignGroupsWithPrivatePairingRules(entries, 1, players, {
      envSource: FLAGS_ON,
      seed: 1,
      maxCandidates: 8,
      privatePairingRules: [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          primaryPlayerId: "male-1",
          targetPlayerIds: ["male-2"],
        }),
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN);
    assert.equal(result.groups.length, 0);
  });

  it("soft scoring is single-pass (no double scoring)", () => {
    const softRules = [
      rule({
        severity: "soft",
        weight: 40,
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
        primaryPlayerId: "a",
        targetPlayerIds: ["c"],
      }),
    ];
    const once = scoreSoftPrivatePairingRules(
      { matchOption: { teamA: [{ id: "a" }], teamB: [{ id: "c" }] } },
      softRules
    );
    const { soft } = splitHardAndSoftRules(softRules);
    const twice = scoreSoftPrivatePairingRules(
      { matchOption: { teamA: [{ id: "a" }], teamB: [{ id: "c" }] } },
      soft
    );
    assert.equal(once.constraintScore, twice.constraintScore);
    assert.equal(soft.length, 1);
  });

  it("no valid matchup candidates returns structured error", () => {
    const ranked = filterAndRankMatchupsByOpponentRules(
      [
        {
          id: "m1",
          matchOption: {
            teamA: [{ id: "a" }],
            teamB: [{ id: "b" }],
          },
        },
      ],
      (m) => m.matchOption,
      {
        envSource: FLAGS_ON,
        privatePairingRules: [
          rule({
            severity: "hard",
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
            primaryPlayerId: "a",
            targetPlayerIds: ["b"],
          }),
        ],
      }
    );
    assert.equal(ranked.ok, false);
    assert.equal(ranked.privatePairingError.ok, false);
    assert.equal(ranked.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP);
  });

  it("internal schedule plan still builds with flags off", () => {
    const players = buildMixedPlayers(4, 4);
    const plan = buildInternalTournamentPlan({
      tournament: { id: "t-int" },
      players,
      selectedPlayerIds: players.map((p) => p.id),
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
      envSource: FLAGS_OFF,
    });
    assert.equal(plan.ok, true);
    assert.ok(plan.event.matches.length > 0);
  });

  it("team tournament group assignment respects hard different_group", () => {
    const teams = [
      createTeamRecord({ id: "t1", name: "A", playerIds: ["p1", "p2", "p3", "p4"], avgLevel: 4 }),
      createTeamRecord({ id: "t2", name: "B", playerIds: ["p5", "p6", "p7", "p8"], avgLevel: 3.9 }),
      createTeamRecord({ id: "t3", name: "C", playerIds: ["p9", "p10", "p11", "p12"], avgLevel: 3.8 }),
      createTeamRecord({ id: "t4", name: "D", playerIds: ["p13", "p14", "p15", "p16"], avgLevel: 3.7 }),
    ];
    const teamData = normalizeTeamData({
      formatPreset: FORMAT_PRESET.MLP_4,
      teams,
      groups: [],
      matchups: [],
    });
    const result = assignSeededTeamsToGroups(teamData, {
      envSource: FLAGS_ON,
      groupCount: 2,
      seed: 3,
      privatePairingRules: [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p5"],
        }),
      ],
    });
    assert.equal(result.ok, true);
    const hard = evaluateHardPrivatePairingRules(
      {
        groups: (result.teamData.groups || []).map((group) => ({
          id: group.id,
          playerIds: (group.teamIds || []).flatMap((teamId) => {
            const team = teams.find((item) => item.id === teamId);
            return team?.playerIds || [];
          }),
        })),
      },
      [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p5"],
        }),
      ]
    );
    assert.equal(hard.feasible, true);
  });

  it("team matchup builder filters hard opponent when complete set required", () => {
    const teams = [
      createTeamRecord({ id: "t1", name: "A", playerIds: ["p1", "p2", "p3", "p4"], avgLevel: 4 }),
      createTeamRecord({ id: "t2", name: "B", playerIds: ["p5", "p6", "p7", "p8"], avgLevel: 3.9 }),
      createTeamRecord({ id: "t3", name: "C", playerIds: ["p9", "p10", "p11", "p12"], avgLevel: 3.8 }),
      createTeamRecord({ id: "t4", name: "D", playerIds: ["p13", "p14", "p15", "p16"], avgLevel: 3.7 }),
    ];
    const teamData = normalizeTeamData({
      formatPreset: FORMAT_PRESET.MLP_4,
      teams,
      groups: [
        { id: "g1", name: "A", teamIds: ["t1", "t2", "t3", "t4"] },
      ],
      matchups: [],
    });
    const result = buildStructuredRoundRobinMatchups(teamData, {
      envSource: FLAGS_ON,
      requireCompleteSet: true,
      privatePairingRules: [
        rule({
          severity: "hard",
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p5"],
        }),
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.privatePairingError.code, PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP);
  });

  it("mapDbRuleSetPayload still maps once (TT-V6-1 regression support)", () => {
    const mapped = mapDbRuleSetPayload({
      id: "rs",
      scope_type: PRIVATE_PAIRING_SCOPE.CLUB,
      scope_id: "c1",
      rules: [
        {
          id: "r1",
          constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "soft",
          weight: 20,
          primary_player_id: "a",
          target_player_ids: ["b"],
          relation_mode: RELATION_MODE.ANY_OF,
          active: true,
        },
      ],
    });
    assert.equal(mapped.rules[0].constraintType, PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP);
  });
});
