/**
 * Phase 2A — Competition Referee Adapter B consolidated mode adoption.
 * Daily / Internal / Official / Team translators + registry + authority guards.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_ADAPTER_INTEGRATION,
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ADAPTER_FORBIDDEN_METHODS,
  createCompetitionRefereeModeAdapterRegistry,
  createCompetitionRefereeModeAdapters,
  createCompetitionRefereeProductionRuntime,
  createDailyPlayRefereeAdapter,
  createDefaultCompetitionRefereeRuntime,
  createInternalTournamentRefereeAdapter,
  createOfficialTournamentRefereeAdapter,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
  createTeamTournamentRefereeAdapter,
  isRefereeAdapterContractError,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/index.js";
import { createScoringFormat } from "../src/features/competition-core/scoring/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ADAPTER_DIR = path.join(
  ROOT,
  "src/features/competition-engine/integration/referee/adapters"
);

const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

function expectCode(fn, code) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isRefereeAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

function baseRequest(competitionId = "comp-1") {
  return {
    tenantId: "tenant-1",
    competitionId,
    matchId: "match-1",
  };
}

function dailyFixtures(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "daily-comp-1",
    competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    venueId: "venue-1",
    clubId: "club-1",
    canonicalAssignmentAuthorityAvailable: true,
    session: {
      sessionId: "daily-comp-1",
      matchType: "mixed_double",
      skipScore: false,
      checkedInPlayerIds: ["p1", "p2", "p3", "p4"],
      enabledCourtIds: ["court-1"],
    },
    matches: {
      "match-1": {
        matchId: "match-1",
        status: "ready",
        courtId: "court-1",
        teamAPlayerIds: ["p1", "p2"],
        teamBPlayerIds: ["p3", "p4"],
        scoringRules: SCORING,
        lineupsLocked: true,
      },
    },
    ...overrides,
  };
}

function individualFixtures(mode, overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: `${mode.toLowerCase()}-comp-1`,
    competitionMode: mode,
    competitionType:
      mode === COMPETITION_REFEREE_MODE.OFFICIAL
        ? "official_tournament"
        : "internal_tournament",
    venueId: "venue-1",
    clubId: "club-1",
    registrationContext:
      mode === COMPETITION_REFEREE_MODE.OFFICIAL
        ? { openEntry: true, eligibility: "open" }
        : undefined,
    eligibilityContext:
      mode === COMPETITION_REFEREE_MODE.OFFICIAL
        ? { requiresRegistration: true }
        : undefined,
    matches: {
      "match-1": {
        matchId: "match-1",
        status: "READY_TO_START",
        courtId: "court-2",
        stage: "POOL",
        round: 1,
        eventId: "event-1",
        entryAId: "entry-a",
        entryBId: "entry-b",
        participantIdsA: ["p-a"],
        participantIdsB: ["p-b"],
        scoringRules: SCORING,
        lineupsLocked: true,
      },
    },
    ...overrides,
  };
}

function teamFixtures(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "team-comp-1",
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    venueId: "venue-1",
    clubId: "club-1",
    assignments: [
      {
        matchupId: "mu-1",
        scope: "parent",
        status: "active",
        refereeUserId: "ref-uid-1",
      },
    ],
    matchups: {
      "mu-1": {
        matchupId: "mu-1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: "READY_TO_START",
        courtId: "court-3",
        stage: "KO",
        round: 1,
        lineupsLocked: true,
        scoringRules: SCORING,
        subMatches: [
          {
            id: "sub-1",
            status: "READY_TO_START",
            lineupA: ["a1", "a2"],
            lineupB: ["b1", "b2"],
            scoringRules: SCORING,
            lineupsLocked: true,
          },
          {
            id: "db-mu-1",
            status: "READY_TO_START",
            isDreambreaker: true,
            discipline: "dreambreaker",
            lineupA: ["a1"],
            lineupB: ["b1"],
          },
        ],
        dreambreaker: {
          status: "pending",
          required: true,
          scoringFormat: {
            targetScore: 21,
            winBy: 2,
            rotationPoints: 4,
          },
        },
      },
    },
    ...overrides,
  };
}

function createAllModeAdapters() {
  return {
    daily: createDailyPlayRefereeAdapter({
      modeState: dailyFixtures(),
    }),
    internal: createInternalTournamentRefereeAdapter({
      modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL),
    }),
    official: createOfficialTournamentRefereeAdapter({
      modeState: individualFixtures(COMPETITION_REFEREE_MODE.OFFICIAL),
    }),
    team: createTeamTournamentRefereeAdapter({
      modeState: teamFixtures(),
    }),
  };
}

test("1. valid context — all four Adapter B modes", () => {
  const adapters = createAllModeAdapters();
  const dailyReq = baseRequest("daily-comp-1");
  const internalReq = baseRequest("internal-comp-1");
  const officialReq = baseRequest("official-comp-1");
  const teamReq = { ...baseRequest("team-comp-1"), matchId: "sub-1" };

  assert.equal(
    adapters.daily.getCompetitionContext(dailyReq).competitionMode,
    "DAILY_PLAY"
  );
  assert.equal(
    adapters.internal.getCompetitionContext(internalReq).competitionMode,
    "INTERNAL"
  );
  assert.equal(
    adapters.official.getCompetitionContext(officialReq).competitionMode,
    "OFFICIAL"
  );
  assert.equal(
    adapters.official.getCompetitionContext(officialReq).registrationContext
      ?.openEntry,
    true
  );
  assert.equal(
    adapters.team.getCompetitionContext(teamReq).competitionMode,
    "TEAM"
  );
  assert.equal(
    adapters.team.getCompetitionContext(teamReq).parentMatchupAssignmentSsot,
    true
  );
});

test("2. participant normalization", () => {
  const adapters = createAllModeAdapters();
  const daily = adapters.daily.getParticipants(baseRequest("daily-comp-1"));
  assert.equal(daily.sides.length, 2);
  assert.deepEqual(daily.sides[0].participantIds, ["p1", "p2"]);

  const internal = adapters.internal.getParticipants(
    baseRequest("internal-comp-1")
  );
  assert.equal(internal.sides[0].entryId, "entry-a");

  const team = adapters.team.getParticipants({
    ...baseRequest("team-comp-1"),
    matchId: "sub-1",
  });
  assert.equal(team.sides[0].teamId, "team-a");
  assert.deepEqual(team.sides[0].participantIds, ["a1", "a2"]);
});

test("3. scoring rules normalization", () => {
  const adapters = createAllModeAdapters();
  for (const [name, adapter, req] of [
    ["daily", adapters.daily, baseRequest("daily-comp-1")],
    ["internal", adapters.internal, baseRequest("internal-comp-1")],
    ["official", adapters.official, baseRequest("official-comp-1")],
    [
      "team",
      adapters.team,
      { ...baseRequest("team-comp-1"), matchId: "sub-1" },
    ],
  ]) {
    const rules = adapter.getScoringRules(req);
    assert.equal(rules.pointsToWin, 11, name);
    assert.ok(rules.formatId, name);
  }

  const dbRules = adapters.team.getScoringRules({
    ...baseRequest("team-comp-1"),
    matchId: "db-mu-1",
  });
  assert.equal(dbRules.pointsToWin, 21);
  assert.equal(dbRules.scoringSystem, "RALLY");
});

test("4. lifecycle policy", () => {
  const adapters = createAllModeAdapters();
  for (const adapter of Object.values(adapters)) {
    const req =
      adapter.competitionMode === "TEAM"
        ? { ...baseRequest("team-comp-1"), matchId: "sub-1" }
        : baseRequest(
            adapter.competitionMode === "DAILY_PLAY"
              ? "daily-comp-1"
              : adapter.competitionMode === "INTERNAL"
                ? "internal-comp-1"
                : "official-comp-1"
          );
    const policy = adapter.getLifecyclePolicy(req);
    assert.equal(policy.requiresAssignment, true);
    assert.equal(policy.standingsRequireAcceptedResult, true);
  }
});

test("5. capabilities — owns*Authority always false", () => {
  const adapters = createAllModeAdapters();
  const teamCaps = adapters.team.getCapabilities({
    ...baseRequest("team-comp-1"),
    matchId: "sub-1",
  });
  assert.equal(teamCaps.childOverrideAssignment, true);
  assert.equal(teamCaps.dreambreakerInheritsParent, true);
  assert.equal(teamCaps.ownsScoringAuthority, false);
  assert.equal(teamCaps.ownsResultAuthority, false);
  assert.equal(teamCaps.ownsRefereeIdentity, false);

  const dailyCaps = adapters.daily.getCapabilities(baseRequest("daily-comp-1"));
  assert.equal(dailyCaps.childOverrideAssignment, false);
  assert.equal(dailyCaps.ownsScoringAuthority, false);
});

test("6. pre-start PASS", () => {
  const adapters = createAllModeAdapters();
  assert.equal(
    adapters.daily.validatePreStart(baseRequest("daily-comp-1")).ok,
    true
  );
  assert.equal(
    adapters.internal.validatePreStart(baseRequest("internal-comp-1")).ok,
    true
  );
  assert.equal(
    adapters.official.validatePreStart(baseRequest("official-comp-1")).ok,
    true
  );
  assert.equal(
    adapters.team.validatePreStart({
      ...baseRequest("team-comp-1"),
      matchId: "sub-1",
    }).ok,
    true
  );
  assert.equal(
    adapters.team.validatePreStart({
      ...baseRequest("team-comp-1"),
      matchId: "db-mu-1",
    }).ok,
    true
  );
});

test("7. pre-start fail-closed", () => {
  const daily = createDailyPlayRefereeAdapter({
    modeState: dailyFixtures({
      canonicalAssignmentAuthorityAvailable: false,
    }),
  });
  const result = daily.validatePreStart(baseRequest("daily-comp-1"));
  assert.equal(result.ok, false);
  assert.equal(
    result.blockers.some(
      (b) => b.code === REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED
    ),
    true
  );

  const closed = createInternalTournamentRefereeAdapter({
    modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL, {
      tournamentClosed: true,
    }),
  });
  assert.equal(
    closed.validatePreStart(baseRequest("internal-comp-1")).ok,
    false
  );
});

test("8. result propagation — accepted only", () => {
  const adapters = createAllModeAdapters();
  for (const adapter of Object.values(adapters)) {
    const req =
      adapter.competitionMode === "TEAM"
        ? { ...baseRequest("team-comp-1"), matchId: "sub-1" }
        : baseRequest(
            adapter.competitionMode === "DAILY_PLAY"
              ? "daily-comp-1"
              : adapter.competitionMode === "INTERNAL"
                ? "internal-comp-1"
                : "official-comp-1"
          );
    const prop = adapter.resolveResultPropagation(req);
    assert.equal(prop.propagateOnlyIfAccepted, true);
    assert.equal(prop.instructions.adapterMustNotAccept, true);
  }
});

test("9. malformed context fail-closed", () => {
  const adapters = createAllModeAdapters();
  for (const adapter of Object.values(adapters)) {
    expectCode(
      () => adapter.getCompetitionContext({}),
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT
    );
  }
});

test("10. unknown/unsupported state fail-closed", () => {
  const adapters = createAllModeAdapters();
  expectCode(
    () =>
      adapters.daily.getMatchContext({
        ...baseRequest("daily-comp-1"),
        matchId: "missing",
      }),
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH
  );
  expectCode(
    () =>
      adapters.team.getMatchContext({
        ...baseRequest("team-comp-1"),
        matchId: "nope",
      }),
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH
  );

  expectCode(
    () =>
      createDailyPlayRefereeAdapter({
        modeState: dailyFixtures({
          treatRosterAsCore13Assignment: true,
        }),
      }).getCompetitionContext(baseRequest("daily-comp-1")),
    REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN
  );

  expectCode(
    () =>
      createInternalTournamentRefereeAdapter({
        modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL, {
          usesTokenAsCanonicalAuthority: true,
        }),
      }).getCompetitionContext(baseRequest("internal-comp-1")),
    REFEREE_ADAPTER_ERROR_CODE.DIRECT_REFEREE_AUTHORITY_FORBIDDEN
  );
});

test("11. no authority leakage — forbidden methods absent + source scan", () => {
  const adapters = createAllModeAdapters();
  for (const adapter of Object.values(adapters)) {
    for (const method of REFEREE_ADAPTER_FORBIDDEN_METHODS) {
      assert.equal(
        typeof adapter[method],
        "undefined",
        `${adapter.adapterId}.${method}`
      );
    }
    assert.equal(adapter.scoringEngine, undefined);
    assert.equal(adapter.assignmentPersistence, undefined);
  }

  const sourceFiles = [
    "DailyPlayRefereeAdapter.js",
    "InternalTournamentRefereeAdapter.js",
    "OfficialTournamentRefereeAdapter.js",
    "TeamTournamentRefereeAdapter.js",
    "shared/individualTournamentMapping.js",
    "shared/policyBuilders.js",
    "shared/scoringRulesMapper.js",
    "shared/modeContext.js",
  ];
  const banned = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /createClient\(/,
    /service_role/,
    /referee_v5_commit_match/,
    /acceptOfficialResult\(/,
    /appendMatchEvent\(/,
    /persistScore\(/,
    /assignReferee\(/,
  ];
  for (const file of sourceFiles) {
    const text = readFileSync(path.join(ADAPTER_DIR, file), "utf8");
    for (const pattern of banned) {
      assert.equal(
        pattern.test(text),
        false,
        `${file} must not match ${pattern}`
      );
    }
  }
});

test("conformance ×4 modes", () => {
  const adapters = createAllModeAdapters();
  const cases = [
    [
      adapters.daily,
      {
        validRequest: baseRequest("daily-comp-1"),
        crossTenantRequest: {
          ...baseRequest("daily-comp-1"),
          tenantId: "other",
        },
      },
    ],
    [
      adapters.internal,
      {
        validRequest: baseRequest("internal-comp-1"),
        crossTenantRequest: {
          ...baseRequest("internal-comp-1"),
          tenantId: "other",
        },
      },
    ],
    [
      adapters.official,
      {
        validRequest: baseRequest("official-comp-1"),
        crossTenantRequest: {
          ...baseRequest("official-comp-1"),
          tenantId: "other",
        },
      },
    ],
    [
      adapters.team,
      {
        validRequest: { ...baseRequest("team-comp-1"), matchId: "sub-1" },
        unknownMatchRequest: {
          ...baseRequest("team-comp-1"),
          matchId: "missing-match",
        },
        crossTenantRequest: {
          tenantId: "other",
          competitionId: "team-comp-1",
          matchId: "sub-1",
        },
      },
    ],
  ];

  for (const [adapter, options] of cases) {
    const report = runCompetitionRefereeAdapterConformance(adapter, options);
    assert.equal(
      report.ok,
      true,
      `${adapter.competitionMode}: ${JSON.stringify(
        report.results.filter((r) => !r.ok)
      )}`
    );
  }
});

test("registry wiring — 4 modes, unknown/version/malformed fail-closed", () => {
  const adapters = createAllModeAdapters();
  const registry = createCompetitionRefereeModeAdapterRegistry({
    adapters: [
      adapters.daily,
      adapters.internal,
      adapters.official,
      adapters.team,
    ],
  });
  assert.equal(registry.size(), 4);
  assert.deepEqual(registry.listModes(), [
    "DAILY_PLAY",
    "INTERNAL",
    "OFFICIAL",
    "TEAM",
  ]);
  assert.equal(registry.resolve("DAILY_PLAY").competitionMode, "DAILY_PLAY");
  assert.equal(registry.resolve("team_tournament").competitionMode, "TEAM");

  expectCode(
    () => registry.resolve("UNKNOWN_MODE"),
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE
  );
  expectCode(
    () =>
      createCompetitionRefereeModeAdapterRegistry({
        adapters: [
          { ...adapters.daily, contractVersion: "9.9.9" },
          adapters.internal,
          adapters.official,
          adapters.team,
        ],
      }),
    REFEREE_ADAPTER_ERROR_CODE.INCOMPATIBLE_CONTRACT_VERSION
  );
  expectCode(
    () =>
      createCompetitionRefereeModeAdapterRegistry({
        adapters: [{}],
      }),
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER
  );
});

test("Team locked behavior preserved — parent SSOT, child override, DB inherit", () => {
  const adapter = createTeamTournamentRefereeAdapter({
    modeState: teamFixtures({
      assignments: [
        {
          matchupId: "mu-1",
          scope: "parent",
          status: "active",
          refereeUserId: "parent-ref",
        },
        {
          matchupId: "mu-1",
          subMatchId: "sub-1",
          scope: "child",
          status: "active",
          refereeUserId: "child-ref",
        },
      ],
    }),
  });

  const child = adapter.getMatchContext({
    ...baseRequest("team-comp-1"),
    matchId: "sub-1",
  });
  assert.equal(child.effectiveRefereeAssignment.refereeUserId, "child-ref");
  assert.equal(child.effectiveRefereeAssignment.inherited, false);

  const db = adapter.getMatchContext({
    ...baseRequest("team-comp-1"),
    matchId: "db-mu-1",
  });
  assert.equal(db.isDreambreaker, true);
  assert.equal(db.effectiveRefereeAssignment.refereeUserId, "parent-ref");
  assert.equal(db.effectiveRefereeAssignment.inherited, true);
  assert.equal(db.dreambreakerProjection.rotationOwnedByTeamDomain, true);

  const write = adapter.projectWritePolicy(
    { ...baseRequest("team-comp-1"), matchId: "db-mu-1" },
    { refereeUserId: "parent-ref", isOrganizer: false }
  );
  assert.equal(write.allowed, true);
  assert.equal(write.authority, false);
  assert.equal(write.projectionOnly, true);

  const denied = adapter.projectWritePolicy(
    { ...baseRequest("team-comp-1"), matchId: "db-mu-1" },
    { refereeUserId: "stranger", isOrganizer: false }
  );
  assert.equal(denied.allowed, false);

  const organizer = adapter.projectWritePolicy(
    { ...baseRequest("team-comp-1"), matchId: "db-mu-1" },
    { refereeUserId: "stranger", isOrganizer: true }
  );
  assert.equal(organizer.allowed, true);
});

test("Official remains separate from Internal", () => {
  const byMode = createCompetitionRefereeModeAdapters({
    dailyPlay: { modeState: dailyFixtures() },
    internal: {
      modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL),
    },
    official: {
      modeState: individualFixtures(COMPETITION_REFEREE_MODE.OFFICIAL),
    },
    team: { modeState: teamFixtures() },
  });
  assert.notEqual(
    byMode.INTERNAL.adapterId,
    byMode.OFFICIAL.adapterId
  );
  assert.equal(byMode.INTERNAL.competitionMode, "INTERNAL");
  assert.equal(byMode.OFFICIAL.competitionMode, "OFFICIAL");
  assert.equal(
    byMode.OFFICIAL.getCompetitionContext(baseRequest("official-comp-1"))
      .eligibilityContext?.requiresRegistration,
    true
  );
  assert.equal(
    byMode.INTERNAL.getCompetitionContext(baseRequest("internal-comp-1"))
      .registrationContext,
    undefined
  );
});

test("no production cutover — usesAdapterB false; stagingBackendCertified unchanged", () => {
  const driver = createSchemaFaithfulCanonicalRefereeDurableDriver({
    allowTestDoubleDriver: true,
  });
  const runtime = createCompetitionRefereeProductionRuntime({
    durableDriver: driver,
    allowTestDoubleDriver: true,
  });
  assert.equal(runtime.usesAdapterB, false);
  assert.equal(runtime.stagingBackendCertified, false);

  const defaultRuntime = createDefaultCompetitionRefereeRuntime({
    durableDriver: driver,
    allowTestDoubleDriver: true,
  });
  assert.equal(defaultRuntime.usesAdapterB, false);
  assert.equal(defaultRuntime.stagingBackendCertified, false);

  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.stagingBackendCertified,
    false
  );
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.usesAdapterBProductionCutover,
    false
  );
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.modeAdaptersImplemented,
    true
  );
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    "competition.referee.adapter.v1"
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
});

test("Daily Play default scoring translation without inventing score authority", () => {
  const adapter = createDailyPlayRefereeAdapter({
    modeState: dailyFixtures({
      matches: {
        "match-1": {
          matchId: "match-1",
          status: "ready",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          // no scoringRules — product default allowed
        },
      },
    }),
  });
  const rules = adapter.getScoringRules(baseRequest("daily-comp-1"));
  assert.equal(rules.pointsToWin, 11);

  expectCode(
    () =>
      createDailyPlayRefereeAdapter({
        modeState: dailyFixtures({
          scoringRulesUnavailable: true,
          matches: {
            "match-1": {
              matchId: "match-1",
              status: "ready",
              teamAPlayerIds: ["p1", "p2"],
              teamBPlayerIds: ["p3", "p4"],
            },
          },
        }),
      }).getScoringRules(baseRequest("daily-comp-1")),
    REFEREE_ADAPTER_ERROR_CODE.MISSING_SCORING_RULES
  );
});
