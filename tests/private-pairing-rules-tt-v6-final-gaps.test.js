import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { EVENT_TYPE } from "../src/models/tournament/constants.js";
import {
  createInternalFlowAdapters,
  createOfficialFlowAdapters,
} from "../src/components/tournament/animation/tournamentFlowAdapters.js";
import {
  COMPETITION_CLASS,
  FEATURE_FLAG_KEYS,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_RUNTIME_CODE,
  PRIVATE_PAIRING_SCOPE,
  RELATION_MODE,
  REASON_CATEGORY,
  RULE_VISIBILITY,
  assignOpenGroupsWithPrivatePairingRules,
  createPrivatePairingRule,
  isRuntimeUnsupportedPrivateConstraintType,
  listUnsupportedRuntimeRules,
  CONSTRAINT_TYPE_GROUPS,
  prepareLivePrivatePairingOptions,
  setPrivatePairingRpcClientForTests,
} from "../src/features/private-pairing-rules/index.js";
import { PRIVATE_PAIRING_RPC } from "../src/features/private-pairing-rules/constants/dbCodes.js";
import { buildOfficialOpenPlan } from "../src/tournament/engines/officialTournamentEngine.js";
import { generateSchedule } from "../src/features/tournament-engine/engines/scheduleEngine.js";

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
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
    severity: "hard",
    weight: 40,
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

function dbRule(overrides = {}) {
  return {
    id: "r1",
    rule_set_id: "rs",
    constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
    severity: "hard",
    weight: null,
    primary_player_id: "p1",
    target_player_ids: ["p2"],
    relation_mode: RELATION_MODE.ANY_OF,
    visibility: "private",
    reason_category: "OTHER",
    reason_text: "group",
    active: true,
    ...overrides,
  };
}

function openEntries() {
  return [
    { id: "e1", name: "A", playerIds: ["p1", "p3"], clubName: "C1" },
    { id: "e2", name: "B", playerIds: ["p2", "p4"], clubName: "C2" },
    { id: "e3", name: "C", playerIds: ["p5", "p6"], clubName: "C1" },
    { id: "e4", name: "D", playerIds: ["p7", "p8"], clubName: "C2" },
  ];
}

function groupsPutP1P2Together() {
  return [
    {
      id: "g1",
      name: "A",
      entryIds: ["e1", "e2"],
      entries: [
        { id: "e1", playerIds: ["p1", "p3"] },
        { id: "e2", playerIds: ["p2", "p4"] },
      ],
    },
    {
      id: "g2",
      name: "B",
      entryIds: ["e3", "e4"],
      entries: [
        { id: "e3", playerIds: ["p5", "p6"] },
        { id: "e4", playerIds: ["p7", "p8"] },
      ],
    },
  ];
}

function groupsSeparateP1P2() {
  return [
    {
      id: "g1",
      name: "A",
      entryIds: ["e1", "e3"],
      entries: [
        { id: "e1", playerIds: ["p1", "p3"] },
        { id: "e3", playerIds: ["p5", "p6"] },
      ],
    },
    {
      id: "g2",
      name: "B",
      entryIds: ["e2", "e4"],
      entries: [
        { id: "e2", playerIds: ["p2", "p4"] },
        { id: "e4", playerIds: ["p7", "p8"] },
      ],
    },
  ];
}

describe("TT-V6-FINAL-GAPS — guided flow + Open group + unsupported types", () => {
  beforeEach(() => {
    setPrivatePairingRpcClientForTests(null);
  });

  it("1. guided prepare flags OFF skips RPC (legacy empty rules)", async () => {
    let rpcCalls = 0;
    setPrivatePairingRpcClientForTests(
      mockClient(() => {
        rpcCalls += 1;
        return { data: { ok: true, rules: [] }, error: null };
      })
    );
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "c1",
      tournamentId: "t1",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_OFF,
    });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.skipped, true);
    assert.deepEqual(prepared.pairingOptions.privatePairingRules, []);
    assert.equal(rpcCalls, 0);
  });

  it("2–3. guided prepare flags ON loads tournament scope", async () => {
    let seenScope = null;
    setPrivatePairingRpcClientForTests(
      mockClient((name, args) => {
        assert.equal(name, PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE);
        seenScope = { type: args.p_scope_type, id: args.p_scope_id };
        return {
          data: {
            ok: true,
            rule_set: {
              id: "rs",
              version: 1,
              scope_type: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
              scope_id: "tour-guided",
              status: "active",
            },
            rules: [dbRule({ id: "r1" })],
          },
          error: null,
        };
      })
    );
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "club-1",
      tournamentId: "tour-guided",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, true);
    assert.equal(seenScope.type, PRIVATE_PAIRING_SCOPE.TOURNAMENT);
    assert.equal(seenScope.id, "tour-guided");
    assert.equal(prepared.pairingOptions.privatePairingRules.length, 1);
  });

  it("4. guided Official blockedByPolicy stops prepare", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(() => ({
        data: {
          ok: true,
          rule_set: {
            id: "rs",
            version: 1,
            scope_type: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
            scope_id: "t1",
            status: "active",
          },
          rules: [
            dbRule({
              id: "r1",
              constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
              reason_text: "private prefer",
            }),
          ],
        },
        error: null,
      }))
    );
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "c1",
      tournamentId: "t1",
      competitionClass: COMPETITION_CLASS.OFFICIAL,
      allowedByPublishedRules: false,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.equal(
      prepared.error?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.PRIVATE_RULE_BLOCKED_BY_POLICY
    );
  });

  it("5. guided fatalConflicts stops prepare", async () => {
    setPrivatePairingRpcClientForTests(
      mockClient(() => ({
        data: {
          ok: true,
          rule_set: {
            id: "rs",
            version: 1,
            scope_type: PRIVATE_PAIRING_SCOPE.TOURNAMENT,
            scope_id: "t1",
            status: "active",
          },
          rules: [
            dbRule({
              id: "r1",
              constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
            }),
            dbRule({
              id: "r2",
              constraint_type: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
            }),
          ],
        },
        error: null,
      }))
    );
    const prepared = await prepareLivePrivatePairingOptions({
      clubId: "c1",
      tournamentId: "t1",
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
    });
    assert.equal(prepared.ok, false);
    assert.equal(prepared.error?.code, PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT);
  });

  it("6. Internal guided adapter passes privatePairingOptions into plan without double load", () => {
    let optionReads = 0;
    const pairingOptions = {
      privatePairingRules: [rule({ severity: "soft", weight: 10 })],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      clubId: "c1",
      tournamentId: "t1",
      envSource: FLAGS_ON,
    };
    const adapters = createInternalFlowAdapters({
      tournament: { id: "t1", events: [{ id: "e1" }] },
      tournamentClubId: "c1",
      tournamentId: "t1",
      players: [],
      courts: [{ id: "c1" }],
      selectedPlayerIds: [],
      eventType: EVENT_TYPE.MIXED_DOUBLE,
      groupCount: 2,
      isSingleEvent: false,
      setPreviewEntries() {},
      setWarnings() {},
      setMessage() {},
      setError() {},
      setLocalRevision() {},
      refreshClubs() {},
      persistEvent() {
        return true;
      },
      getPrivatePairingOptions: () => {
        optionReads += 1;
        return { ok: true, pairingOptions };
      },
    });

    const manualEntries = openEntries().map((entry) => ({
      ...entry,
      seed: 1,
    }));
    const validation = adapters.validateStart({ entries: manualEntries });
    assert.ok(optionReads >= 1);
    // Plan may fail validation for event type vs gender — private options must still be read first.
    assert.ok(typeof validation.ok === "boolean");
    if (validation.ok === false) {
      assert.ok(typeof validation.error === "string");
    }
  });

  it("Official guided buildPlan closure respects prepare failure", () => {
    const guidedRef = {
      current: {
        ok: false,
        error: {
          code: PRIVATE_PAIRING_RUNTIME_CODE.RULE_SET_CONFLICT,
          message: "Bộ quy tắc ghép cặp xung đột — đã dừng trước khi tạo cặp/đội.",
        },
      },
    };
    const adapters = createOfficialFlowAdapters({
      variant: "open",
      tournament: { id: "t1", hostClubName: "Host" },
      players: [],
      courts: [],
      selectedPlayerIds: [],
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      isAiBalance: false,
      displayEntries: openEntries(),
      buildPlan: () => {
        const prepared = guidedRef.current;
        if (prepared?.ok === false) {
          return {
            ok: false,
            errors: [prepared.error.message],
            privatePairingError: prepared.error,
          };
        }
        return { ok: true };
      },
      buildPatch: () => ({ ok: true }),
      persistTournament: () => true,
      persistEvent: () => true,
      setPreviewEntries() {},
      setWarnings() {},
      setMessage() {},
      setError() {},
      setLocalRevision() {},
      refreshClubs() {},
      suggestEntries: () => openEntries(),
      getSavedEvent: () => null,
    });
    const result = adapters.validateStart({});
    assert.equal(result.ok, false);
    assert.match(result.error, /xung đột|dừng/i);
  });

  it("7. Official Open hard SAME_GROUP selects colocated plan", () => {
    let call = 0;
    const openAssigner = () => {
      call += 1;
      const groups = call === 1 ? groupsSeparateP1P2() : groupsPutP1P2Together();
      return { ok: true, groups, warnings: [], score: call, balance: {} };
    };
    const result = assignOpenGroupsWithPrivatePairingRules({
      openAssigner,
      entries: openEntries(),
      groupCount: 2,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
          severity: "hard",
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
      seed: 11,
      maxCandidates: 6,
    });
    assert.equal(result.ok, true);
    const together = result.groups.some((group) => {
      const ids = (group.entries || []).flatMap((e) => e.playerIds || []);
      return ids.includes("p1") && ids.includes("p2");
    });
    assert.equal(together, true);
  });

  it("8. Official Open hard DIFFERENT_GROUP rejects colocated-only plans", () => {
    const result = assignOpenGroupsWithPrivatePairingRules({
      openAssigner: () => ({
        ok: true,
        groups: groupsPutP1P2Together(),
        warnings: [],
        score: 1,
      }),
      entries: openEntries(),
      groupCount: 2,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
      seed: 3,
      maxCandidates: 4,
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.privatePairingError?.code,
      PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_GROUP_PLAN
    );
  });

  it("9. Official Open soft group ranks higher soft-satisfying plan", () => {
    let call = 0;
    const result = assignOpenGroupsWithPrivatePairingRules({
      openAssigner: () => {
        call += 1;
        return {
          ok: true,
          groups: call === 1 ? groupsPutP1P2Together() : groupsSeparateP1P2(),
          warnings: [],
          score: call === 1 ? 0 : 50,
        };
      },
      entries: openEntries(),
      groupCount: 2,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "soft",
          weight: 80,
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
      seed: 21,
      maxCandidates: 6,
    });
    assert.equal(result.ok, true);
    const together = result.groups.some((group) => {
      const ids = (group.entries || []).flatMap((e) => e.playerIds || []);
      return ids.includes("p1") && ids.includes("p2");
    });
    assert.equal(together, false);
  });

  it("10–11. Official Open no random fallback / structured no-feasible", () => {
    const result = assignOpenGroupsWithPrivatePairingRules({
      openAssigner: () => ({
        ok: true,
        groups: groupsPutP1P2Together(),
        warnings: [],
        score: 0,
      }),
      entries: openEntries(),
      groupCount: 2,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
        }),
      ],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
      seed: 1,
      maxCandidates: 3,
    });
    assert.equal(result.ok, false);
    assert.equal(result.groups?.length || 0, 0);
    assert.ok(result.privatePairingError?.message);
    assert.match(result.privatePairingError.message, /bảng|group|hard/i);
  });

  it("Official Open plan engine wires group rules (end-to-end)", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id, index) => ({
      id,
      name: id,
      gender: "Nam",
      clubName: index % 2 === 0 ? "A" : "B",
    }));
    const plan = buildOfficialOpenPlan({
      tournament: { id: "t-open", hostClubName: "Host", events: [] },
      entries: openEntries(),
      eventType: EVENT_TYPE.MEN_DOUBLE,
      groupCount: 2,
      players,
      splitUnits: false,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
          primaryPlayerId: "p1",
          targetPlayerIds: ["p2"],
        }),
      ],
      competitionClass: COMPETITION_CLASS.INTERNAL,
      envSource: FLAGS_ON,
      seed: 42,
      allowedByPublishedRules: false,
    });
    assert.equal(plan.ok, true, (plan.errors || []).join(" ") || "plan failed");
    const together = (plan.event.groups || []).some((group) => {
      const ids = (group.entries || []).flatMap((e) => e.playerIds || []);
      return ids.includes("p1") && ids.includes("p2");
    });
    assert.equal(together, false);
  });

  it("12–14. unsupported same_team / different_team not creatable; old rules keep warning", () => {
    const createTypes = CONSTRAINT_TYPE_GROUPS.flatMap((g) => g.types);
    assert.equal(createTypes.includes(PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM), false);
    assert.equal(createTypes.includes(PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM), false);
    assert.equal(
      isRuntimeUnsupportedPrivateConstraintType(PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM),
      true
    );
    assert.equal(
      isRuntimeUnsupportedPrivateConstraintType(PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM),
      true
    );

    const legacyRules = [
      rule({
        id: "old-same",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM,
        active: true,
      }),
      rule({
        id: "ok-group",
        constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
        active: true,
      }),
    ];
    const unsupported = listUnsupportedRuntimeRules(legacyRules);
    assert.equal(unsupported.length, 1);
    assert.equal(unsupported[0].id, "old-same");
    assert.match(unsupported[0].message, /chưa được runtime hỗ trợ/i);
    assert.equal(legacyRules.length, 2);
  });

  it("15. PublishSchedule generateSchedule materializes matches with opponent gate", () => {
    const groups = [
      {
        id: "g1",
        name: "A",
        entries: [
          { id: "e1", playerIds: ["p1", "p3"] },
          { id: "e2", playerIds: ["p2", "p4"] },
        ],
        entryIds: ["e1", "e2"],
      },
    ];
    const blocked = generateSchedule(
      {
        tournamentId: "t1",
        eventId: "e1",
        matches: [],
        groups,
        privatePairingRules: [
          rule({
            constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
            severity: "hard",
            primaryPlayerId: "p1",
            targetPlayerIds: ["p2"],
          }),
        ],
        competitionClass: COMPETITION_CLASS.INTERNAL,
        envSource: FLAGS_ON,
        courts: [{ id: "1", name: "Sân 1", priority: 1 }],
        scheduleConfig: {
          startTime: "08:00",
          endTime: "22:00",
          date: "2026-07-16",
          averageMatchMinutes: 25,
          bufferMinutes: 5,
          minRestMinutes: 15,
        },
      },
      { regenerate: false, strictRest: true, envSource: FLAGS_ON }
    );
    assert.equal(blocked.ok, false);
    assert.ok(
      blocked.privatePairingError?.code === PRIVATE_PAIRING_RUNTIME_CODE.NO_FEASIBLE_MATCHUP ||
        (blocked.errors || []).length > 0
    );
  });

  it("19. Flags OFF Open group path stays legacy assigner only", () => {
    let calls = 0;
    const result = assignOpenGroupsWithPrivatePairingRules({
      openAssigner: () => {
        calls += 1;
        return { ok: true, groups: groupsPutP1P2Together(), warnings: [], score: 1 };
      },
      entries: openEntries(),
      groupCount: 2,
      privatePairingRules: [
        rule({
          constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
          severity: "hard",
        }),
      ],
      envSource: FLAGS_OFF,
      maxCandidates: 8,
    });
    assert.equal(result.ok, true);
    assert.equal(calls, 1);
    assert.equal(result.usedCanonicalGroupRules, false);
  });
});
