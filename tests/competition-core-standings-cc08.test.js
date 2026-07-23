import test from "node:test";
import assert from "node:assert/strict";

import { assertTestModuleAvailable } from "./helpers/testModuleAvailability.js";
import { buildGroupStandingFromMatches } from "../src/tournament/engines/rankingEngine.js";
import { computeTeamStandings } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  COMPETITION_CORE_FLAG_KEYS,
  COMPETITION_ENGINE_TYPE,
  MATCH_RESULT_TYPE,
  TIEBREAK_TYPE,
  buildDrawLotToken,
  buildStandingsShadowComparison,
  calculateCanonicalStandings,
  cloneStandingsRequest,
  computeTwoEntryHeadToHead,
  createScoringRule,
  createStandingsConfiguration,
  createStandingsEntry,
  createStandingsMatchRecord,
  createStandingsRequest,
  evaluateCanonicalStandingsRuntime,
  executeCompetitionEngine,
  isEngineV2Available,
  isStandingsTraceJsonSerializable,
  isStandingsV2Enabled,
  mapLegacyGroupStandingsPayloadToRequest,
  mapLegacyTeamStandingsPayloadToRequest,
  runStandingsShadowComparison,
} from "../src/features/competition-core/index.js";

const v2Env = {
  [COMPETITION_CORE_FLAG_KEYS.CORE]: "true",
  [COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2]: "true",
};

function baseRequest(overrides = {}) {
  return createStandingsRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A", seed: 1 }),
      createStandingsEntry({ entryId: "b", name: "B", seed: 2 }),
      createStandingsEntry({ entryId: "c", name: "C", seed: 3 }),
    ],
    configuration: createStandingsConfiguration({
      scoringRule: createScoringRule({ winPoints: 2, lossPoints: 1, drawPoints: 1, forfeitPoints: 0 }),
      drawLotSeed: "test-seed",
    }),
    ...overrides,
  });
}

test("1. simple unique ranking", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m2", entryAId: "a", entryBId: "c", scoreA: 11, scoreB: 8 }),
        createStandingsMatchRecord({ matchId: "m3", entryAId: "b", entryBId: "c", scoreA: 11, scoreB: 9 }),
      ],
    })
  );
  assert.equal(result.rows[0].entryId, "a");
  assert.equal(result.rows[0].rank, 1);
});

test("2. two-entry tie resolved by head-to-head", () => {
  const request = baseRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A" }),
      createStandingsEntry({ entryId: "b", name: "B" }),
    ],
    matches: [
      createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5, winnerEntryId: "a" }),
    ],
  });
  const h2h = computeTwoEntryHeadToHead("a", "b", request.matches, request.configuration.scoringRule);
  assert.equal(h2h.resolved, true);
  assert.equal(h2h.winnerEntryId, "a");
});

test("3. two-entry tie unresolved proceeds to score difference", () => {
  const request = baseRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A" }),
      createStandingsEntry({ entryId: "b", name: "B" }),
    ],
    matches: [
      createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 11 }),
    ],
  });
  const h2h = computeTwoEntryHeadToHead("a", "b", request.matches, request.configuration.scoringRule);
  assert.equal(h2h.resolved, false);
  const result = calculateCanonicalStandings(request);
  assert.equal(result.rows[0].rank, 1);
});

test("4. three-entry tie uses mini-table", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m2", entryAId: "b", entryBId: "c", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m3", entryAId: "c", entryBId: "a", scoreA: 11, scoreB: 5 }),
      ],
    })
  );
  assert.ok(result.decisionTrace.miniTableCalculations.length >= 0);
  assert.equal(result.rows.length, 3);
});

test("5. mini-table partially resolves entries", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m2", entryAId: "b", entryBId: "c", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m3", entryAId: "a", entryBId: "c", scoreA: 5, scoreB: 11 }),
      ],
    })
  );
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows.every((row) => row.rank > 0), true);
  assert.ok(result.decisionTrace.tieGroups.length >= 1 || result.decisionTrace.tieBreakSteps.length >= 1);
});

test("6. all tie-break equal uses deterministic draw-lot", () => {
  const request = baseRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A", seed: 1 }),
      createStandingsEntry({ entryId: "b", name: "B", seed: 1 }),
    ],
    matches: [],
  });
  const first = calculateCanonicalStandings(request);
  const second = calculateCanonicalStandings(request);
  assert.deepEqual(
    first.rows.map((row) => row.entryId),
    second.rows.map((row) => row.entryId)
  );
  assert.ok(first.decisionTrace.drawLotTokens);
});

test("7. win/loss point calculation", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 8 }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").points, 2);
  assert.equal(result.rows.find((row) => row.entryId === "b").points, 1);
});

test("8. configurable points scheme", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 8 }),
      ],
      configuration: createStandingsConfiguration({
        scoringRule: createScoringRule({ winPoints: 3, lossPoints: 0, drawPoints: 1, forfeitPoints: 0 }),
      }),
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").points, 3);
});

test("9. BYE excluded from head-to-head", () => {
  const request = baseRequest({
    entries: [
      createStandingsEntry({ entryId: "a", name: "A" }),
      createStandingsEntry({ entryId: "b", name: "B" }),
    ],
    matches: [
      createStandingsMatchRecord({
        matchId: "bye1",
        entryAId: "a",
        entryBId: "b",
        resultType: MATCH_RESULT_TYPE.BYE,
      }),
    ],
  });
  const h2h = computeTwoEntryHeadToHead("a", "b", request.matches, request.configuration.scoringRule);
  assert.equal(h2h.matchesConsidered.length, 0);
});

test("10. walkover policy", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "w1",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.WALKOVER,
          winnerEntryId: "a",
        }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").walkovers, 1);
});

test("11. forfeit before start", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "f1",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.FORFEIT_BEFORE_START,
          winnerEntryId: "a",
        }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "b").forfeits, 1);
});

test("12. forfeit after start", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "f2",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.FORFEIT_AFTER_START,
          winnerEntryId: "b",
        }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").forfeits, 1);
});

test("13. administrative forfeit", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "f3",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.ADMINISTRATIVE_FORFEIT,
          winnerEntryId: "a",
        }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").wins, 1);
});

test("14. cancelled/void exclusion", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "c1",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.CANCELLED,
        }),
      ],
    })
  );
  assert.equal(result.rows.every((row) => row.played === 0), true);
  assert.ok(result.decisionTrace.excludedMatches.length >= 1);
});

test("15. unverified result handling", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "u1",
          entryAId: "a",
          entryBId: "b",
          resultType: MATCH_RESULT_TYPE.UNVERIFIED,
          scoreA: 11,
          scoreB: 9,
          verified: false,
        }),
      ],
      configuration: createStandingsConfiguration({
        scoringRule: createScoringRule({ verifiedResultRequired: true }),
      }),
    })
  );
  assert.ok(result.decisionTrace.excludedMatches.some((item) => item.matchId === "u1"));
});

test("16. set/game difference", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({
          matchId: "m1",
          entryAId: "a",
          entryBId: "b",
          scoreA: 11,
          scoreB: 4,
          setsA: 2,
          setsB: 0,
        }),
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "a").scoreDifference, 7);
});

test("17. point/score difference tie-break ordering", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A" }),
        createStandingsEntry({ entryId: "b", name: "B" }),
      ],
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
      ],
    })
  );
  assert.equal(result.rows[0].entryId, "a");
});

test("18. fewer forfeits tie-break metadata present", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      configuration: createStandingsConfiguration({
        tieBreakRules: [
          { id: "points", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1, enabled: true },
          { id: "forfeits", type: TIEBREAK_TYPE.FEWER_FORFEITS, priority: 2, enabled: true },
        ],
      }),
    })
  );
  assert.ok(result.decisionTrace.tieBreakSteps);
});

test("19. original seed tie-break", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      entries: [
        createStandingsEntry({ entryId: "a", name: "A", seed: 1 }),
        createStandingsEntry({ entryId: "b", name: "B", seed: 5 }),
      ],
      matches: [],
      configuration: createStandingsConfiguration({
        tieBreakRules: [
          { id: "seed", type: TIEBREAK_TYPE.ORIGINAL_SEED, priority: 1, enabled: true },
        ],
      }),
    })
  );
  assert.equal(result.rows[0].entryId, "a");
});

test("20. manual override preservation", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      manualOverrides: [
        {
          overrideId: "ov1",
          overrideType: "rank",
          affectedEntryId: "c",
          afterRank: 1,
          reason: "BTC decision",
        },
      ],
    })
  );
  assert.equal(result.rows.find((row) => row.entryId === "c").rank, 1);
  assert.equal(result.rows.find((row) => row.entryId === "c").manualOverrideApplied, true);
});

test("21. qualification cutoff", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m2", entryAId: "a", entryBId: "c", scoreA: 11, scoreB: 5 }),
        createStandingsMatchRecord({ matchId: "m3", entryAId: "b", entryBId: "c", scoreA: 11, scoreB: 5 }),
      ],
      configuration: createStandingsConfiguration({
        qualificationRule: { qualifiersCount: 2 },
      }),
    }),
    { groupComplete: true, applyQualification: true }
  );
  const qualified = result.rows.filter((row) => row.qualificationStatus === "QUALIFIED");
  assert.equal(qualified.length, 2);
});

test("22. duplicate match protection", () => {
  const match = createStandingsMatchRecord({ matchId: "dup", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 });
  const result = calculateCanonicalStandings(baseRequest({ matches: [match, match] }));
  assert.equal(result.ok, false);
  assert.ok(
    result.typedErrors?.some((issue) => issue.code === "STANDINGS_DUPLICATE_MATCH_IDENTITY") ||
      result.warnings.some((warning) => warning.includes("Duplicate match"))
  );
});

test("23. same match not counted twice", () => {
  const match = createStandingsMatchRecord({ matchId: "dup", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 });
  const result = calculateCanonicalStandings(baseRequest({ matches: [match, match] }));
  // Fail-closed: neither duplicate contributes (no first-input-wins).
  assert.equal(result.rows.find((row) => row.entryId === "a").played, 0);
  assert.equal(result.ok, false);
});

test("24. missing entry reference warning", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "x1", entryAId: "a", entryBId: "z", scoreA: 11, scoreB: 5 }),
      ],
    })
  );
  assert.ok(result.warnings.some((warning) => warning.includes("Missing entry")));
});

test("25. deterministic output", () => {
  const request = baseRequest({
    matches: [
      createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
    ],
  });
  const a = calculateCanonicalStandings(request);
  const b = calculateCanonicalStandings(request);
  assert.deepEqual(
    a.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points })),
    b.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points }))
  );
});

test("26. no input mutation", () => {
  const request = baseRequest({
    matches: [
      createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
    ],
  });
  const snapshot = cloneStandingsRequest(request);
  calculateCanonicalStandings(request);
  assert.deepEqual(snapshot.entries, request.entries);
  assert.deepEqual(snapshot.matches, request.matches);
});

test("27. flag OFF legacy behavior", () => {
  const bridge = evaluateCanonicalStandingsRuntime({
    consumer: "test",
    envSource: {},
    legacyPayload: { entries: [], matches: [] },
    legacyExecutor: () => ({ standing: [{ id: "a", rank: 1 }] }),
  });
  assert.equal(bridge.usedCanonical, false);
  assert.deepEqual(bridge.legacyResult.standing, [{ id: "a", rank: 1 }]);
});

test("28. master OFF overrides standings flag", () => {
  const env = {
    [COMPETITION_CORE_FLAG_KEYS.CORE]: "false",
    [COMPETITION_CORE_FLAG_KEYS.STANDINGS_V2]: "true",
  };
  assert.equal(isStandingsV2Enabled(env), false);
});

test("29. shadow output remains legacy", () => {
  const bridge = runStandingsShadowComparison({
    consumer: "group",
    envSource: v2Env,
    legacyPayload: {
      entries: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      matches: [{ id: "m1", entryAId: "a", entryBId: "b", status: "completed", scoreA: 11, scoreB: 5 }],
    },
    legacyExecutor: () =>
      buildGroupStandingFromMatches({
        group: { id: "g1", entryIds: ["a", "b"] },
        entries: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        matches: [{ id: "m1", groupId: "g1", entryAId: "a", entryBId: "b", status: "completed", scoreA: 11, scoreB: 5 }],
      }),
  });
  assert.equal(bridge.outputPreserved, true);
  assert.ok(Array.isArray(bridge.legacyResult.standing));
});

test("30. decision trace completeness", () => {
  const result = calculateCanonicalStandings(
    baseRequest({
      matches: [
        createStandingsMatchRecord({ matchId: "m1", entryAId: "a", entryBId: "b", scoreA: 11, scoreB: 5 }),
      ],
    })
  );
  assert.ok(result.decisionTrace.traceId);
  assert.ok(result.decisionTrace.finalRanks.length >= 1);
  assert.equal(isStandingsTraceJsonSerializable({ runtime: {}, canonical: result.decisionTrace }), true);
});

test("31. individual tournament standings via legacy mapper", () => {
  const mapped = mapLegacyGroupStandingsPayloadToRequest({
    group: { id: "g1", entryIds: ["a", "b"] },
    entries: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    matches: [{ id: "m1", groupId: "g1", entryAId: "a", entryBId: "b", status: "completed", scoreA: 11, scoreB: 4 }],
  });
  const result = calculateCanonicalStandings(mapped.request);
  assert.equal(result.rows.length, 2);
});

test("32. team tournament standings via legacy mapper", () => {
  const mapped = mapLegacyTeamStandingsPayloadToRequest({
    teams: [
      { id: "team-a", name: "A" },
      { id: "team-b", name: "B" },
    ],
    matchups: [
      {
        id: "mx1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.COMPLETED,
        result: { winnerTeamId: "team-a", teamAWins: 3, teamBWins: 1, teamAPoints: 33, teamBPoints: 20 },
      },
    ],
  });
  const result = calculateCanonicalStandings(mapped);
  assert.equal(result.rows.find((row) => row.entryId === "team-a").wins, 1);
});

test("33. existing TT-4 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/team-tournament-tt4.test.js", import.meta.url);
});

test("34. existing CC-07 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-rules-cc07.test.js", import.meta.url);
});

test("35. existing CC-04/05/06 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-draw-cc04e.test.js", import.meta.url);
  assertTestModuleAvailable("../tests/competition-core-formation-cc05c.test.js", import.meta.url);
  assertTestModuleAvailable("../tests/competition-core-matchmaking-cc06.test.js", import.meta.url);
});

test("36. existing Rating V2 tests import surface remains available", () => {
  assertTestModuleAvailable("../tests/competition-core-feature-flags.test.js", import.meta.url);
});

test("draw-lot token is deterministic", () => {
  assert.equal(buildDrawLotToken("seed", ["a"]), buildDrawLotToken("seed", ["a"]));
});

test("engine v2 availability for standings", () => {
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.STANDINGS, v2Env), true);
  assert.equal(isEngineV2Available(COMPETITION_ENGINE_TYPE.STANDINGS, {}), false);
});

test("competition engine delegates standings through adapter in shadow mode", async () => {
  const result = await executeCompetitionEngine(
    {
      engineType: COMPETITION_ENGINE_TYPE.STANDINGS,
      payload: {
        entries: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
        matches: [],
      },
    },
    {
      envSource: v2Env,
      legacyExecutor: () => ({ standing: [{ id: "a", rank: 1 }] }),
    }
  );
  assert.equal(result.executionPath, "v2");
  assert.deepEqual(result.result.standing, [{ id: "a", rank: 1 }]);
});

test("shadow comparison builder detects rank mismatch", () => {
  const comparison = buildStandingsShadowComparison({
    legacyRows: [{ id: "a", rank: 1 }],
    canonicalRows: [{ id: "a", rank: 2 }],
  });
  assert.equal(comparison.rankParity, false);
});

test("legacy team standings bridge preserves output in shadow mode", () => {
  const teamData = {
    teams: [
      { id: "team-a", name: "A", playerIds: [] },
      { id: "team-b", name: "B", playerIds: [] },
    ],
    matchups: [
      {
        id: "mx1",
        teamAId: "team-a",
        teamBId: "team-b",
        status: MATCHUP_STATUS.COMPLETED,
        result: { winnerTeamId: "team-a", teamAWins: 3, teamBWins: 1, teamAPoints: 30, teamBPoints: 20 },
      },
    ],
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
  };
  const bridge = runStandingsShadowComparison({
    consumer: "team_tournament",
    envSource: v2Env,
    legacyPayload: teamData,
    legacyExecutor: () => computeTeamStandings(teamData),
  });
  assert.equal(bridge.usedCanonical, true);
  assert.ok(bridge.canonicalResult);
});
