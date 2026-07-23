/**
 * CORE-18 Standings & Tie-Break — focused Phase 1B certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCEPTANCE_STATUS,
  LINEAGE_STATUS,
  OUTCOME,
  RESULT_TYPE,
  SCORING_SIDE,
  MATCH_SIDE_KEY,
  finalizeValidatedResult,
  isScoreDifferentialEligible,
  isStandingsSafe,
} from "../src/features/competition-core/result-validation/index.js";
import {
  MATCH_RESULT_TYPE,
  TIEBREAK_TYPE,
  STANDINGS_ERROR_CODE,
  STANDINGS_WARNING_CODE,
  STANDINGS_EXPLANATION_CODE,
  adaptValidatedResultToStandingsMatch,
  adaptValidatedResultsToStandingsMatches,
  calculateCanonicalStandings,
  calculateStandingsFromValidatedResults,
  compareRowsByTieBreakRule,
  createScoringRule,
  createStandingsConfiguration,
  createStandingsEntry,
  createStandingsMatchRecord,
  createStandingsRequest,
  createTieBreakRule,
  isRawCore16Projection,
} from "../src/features/competition-core/standings/index.js";

function sideBindings(entryA = "entry-a", entryB = "entry-b") {
  return [
    {
      matchSideKey: MATCH_SIDE_KEY.A,
      scoringSide: SCORING_SIDE.SIDE_A,
      matchSideId: "side-a",
      entryId: entryA,
      teamId: null,
      participantIds: ["p-a"],
    },
    {
      matchSideKey: MATCH_SIDE_KEY.B,
      scoringSide: SCORING_SIDE.SIDE_B,
      matchSideId: "side-b",
      entryId: entryB,
      teamId: null,
      participantIds: ["p-b"],
    },
  ];
}

function makeValidatedResult(overrides = {}) {
  const resultType = overrides.resultType || RESULT_TYPE.COMPLETED;
  const acceptanceStatus =
    overrides.acceptanceStatus !== undefined
      ? overrides.acceptanceStatus
      : ACCEPTANCE_STATUS.ACCEPTED;
  const lineageStatus =
    overrides.lineageStatus !== undefined
      ? overrides.lineageStatus
      : LINEAGE_STATUS.ACTIVE;

  const base = {
    validatedResultId: overrides.validatedResultId || "vr-1",
    matchId: overrides.matchId || "m-1",
    competitionId: "comp-1",
    contextId: "ctx-1",
    revision: 1,
    resultType,
    outcome: overrides.outcome || OUTCOME.WIN_LOSS,
    acceptanceStatus,
    lineageStatus,
    winnerSide: overrides.winnerSide ?? SCORING_SIDE.SIDE_A,
    loserSide: overrides.loserSide ?? SCORING_SIDE.SIDE_B,
    winnerId: overrides.winnerId ?? "entry-a",
    loserId: overrides.loserId ?? "entry-b",
    sideBindings: overrides.sideBindings || sideBindings(),
    scoreSnapshot:
      overrides.scoreSnapshot === undefined
        ? {
            points: { SIDE_A: 11, SIDE_B: 5 },
            setsWon: { SIDE_A: 2, SIDE_B: 0 },
            gamesWon: { SIDE_A: 2, SIDE_B: 1 },
            completedSets: 2,
            completedGames: 3,
            calculatedMatchComplete: true,
            calculatedWinnerSide: SCORING_SIDE.SIDE_A,
          }
        : overrides.scoreSnapshot,
    actor: { actorType: "REFEREE", actorId: "ref-1" },
    source: { sourceType: "MANUAL_TECHNICAL", sourceId: "src-1" },
    validationEvidence: [],
    ...overrides,
  };

  // Strip undefined scoreSnapshot override key pollution
  if (overrides.scoreSnapshot === null) {
    base.scoreSnapshot = null;
  }

  return finalizeValidatedResult(base);
}

function entriesAB() {
  return [
    createStandingsEntry({ entryId: "entry-a", name: "Alpha" }),
    createStandingsEntry({ entryId: "entry-b", name: "Beta" }),
  ];
}

function injectedConfig(tieBreakRules, extra = {}) {
  return createStandingsConfiguration({
    scoringRule: createScoringRule({ winPoints: 2, lossPoints: 1, drawPoints: 1 }),
    tieBreakRules,
    drawLotSeed: "core18-seed",
    ...extra,
  });
}

describe("CORE-18 inclusion / CORE-17 gates", () => {
  it("1. accepted active completed result is included", () => {
    const result = makeValidatedResult();
    assert.equal(isStandingsSafe(result), true);
    const adapted = adaptValidatedResultToStandingsMatch(result);
    assert.equal(adapted.included, true);
    assert.equal(adapted.record.resultType, MATCH_RESULT_TYPE.COMPLETED);
    assert.equal(adapted.explanation.code, STANDINGS_EXPLANATION_CODE.RESULT_INCLUDED);
  });

  it("2. non-accepted result is excluded", () => {
    const result = makeValidatedResult({
      acceptanceStatus: ACCEPTANCE_STATUS.PENDING,
    });
    const adapted = adaptValidatedResultToStandingsMatch(result);
    assert.equal(adapted.included, false);
    assert.equal(adapted.exclusionCode, "not_accepted");
  });

  it("3. non-active result is excluded", () => {
    const result = makeValidatedResult({
      lineageStatus: LINEAGE_STATUS.SUPERSEDED,
    });
    const adapted = adaptValidatedResultToStandingsMatch(result);
    assert.equal(adapted.included, false);
    assert.equal(adapted.exclusionCode, "not_active");
  });

  it("4. isStandingsSafe controls inclusion", () => {
    const safe = makeValidatedResult();
    const unsafe = makeValidatedResult({
      validatedResultId: "vr-unsafe",
      acceptanceStatus: ACCEPTANCE_STATUS.REJECTED,
    });
    assert.equal(isStandingsSafe(safe), true);
    assert.equal(isStandingsSafe(unsafe), false);
    assert.equal(adaptValidatedResultToStandingsMatch(safe).included, true);
    assert.equal(adaptValidatedResultToStandingsMatch(unsafe).included, false);
  });

  it("5. isScoreDifferentialEligible controls differential", () => {
    const completed = makeValidatedResult();
    const retirement = makeValidatedResult({
      validatedResultId: "vr-ret",
      resultType: RESULT_TYPE.RETIREMENT,
      scoreSnapshot: {
        points: { SIDE_A: 7, SIDE_B: 4 },
        setsWon: { SIDE_A: 1, SIDE_B: 0 },
        completedSets: 1,
        completedGames: 1,
        calculatedMatchComplete: false,
        calculatedWinnerSide: SCORING_SIDE.SIDE_A,
      },
    });
    assert.equal(isScoreDifferentialEligible(completed), true);
    assert.equal(isScoreDifferentialEligible(retirement), false);
    assert.equal(adaptValidatedResultToStandingsMatch(completed).differentialEligible, true);
    assert.equal(adaptValidatedResultToStandingsMatch(retirement).differentialEligible, false);
  });
});

describe("CORE-18 differential and special outcomes", () => {
  it("6. completed result applies eligible differential", () => {
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [makeValidatedResult()],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    const a = standings.rows.find((row) => row.entryId === "entry-a");
    assert.equal(a.wins, 1);
    assert.equal(a.scoreDifference, 6);
    assert.equal(a.setDifference, 2);
    assert.equal(a.gameDifference, 1);
  });

  it("7. retirement records win/loss without differential", () => {
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [
        makeValidatedResult({
          validatedResultId: "vr-ret",
          resultType: RESULT_TYPE.RETIREMENT,
          scoreSnapshot: {
            points: { SIDE_A: 7, SIDE_B: 4 },
            setsWon: { SIDE_A: 1, SIDE_B: 0 },
            completedSets: 1,
            completedGames: 1,
            calculatedMatchComplete: false,
            calculatedWinnerSide: SCORING_SIDE.SIDE_A,
          },
        }),
      ],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    const a = standings.rows.find((row) => row.entryId === "entry-a");
    const b = standings.rows.find((row) => row.entryId === "entry-b");
    assert.equal(a.wins, 1);
    assert.equal(b.losses, 1);
    assert.equal(a.scoreDifference, 0);
    assert.equal(a.gameDifference, 0);
    assert.equal(a.setDifference, 0);
    assert.ok(
      standings.typedWarnings.some(
        (w) => w.code === STANDINGS_WARNING_CODE.STANDINGS_DIFFERENTIAL_SKIPPED
      )
    );
  });

  it("8-10. abandoned / cancelled / void are excluded", () => {
    for (const resultType of [
      RESULT_TYPE.ABANDONED,
      RESULT_TYPE.CANCELLED,
      RESULT_TYPE.VOID,
    ]) {
      // These types are never standings-safe even if mistakenly ACCEPTED.
      const result = makeValidatedResult({
        validatedResultId: `vr-${resultType}`,
        resultType,
        outcome: OUTCOME.NO_WINNER,
        winnerSide: null,
        loserSide: null,
        winnerId: null,
        loserId: null,
        scoreSnapshot: null,
      });
      assert.equal(isStandingsSafe(result), false);
      const adapted = adaptValidatedResultToStandingsMatch(result);
      assert.equal(adapted.included, false);
    }
  });

  it("11. CORE-15 completed status alone is not accepted as official", () => {
    const lifecycleOnly = {
      matchId: "m-life",
      status: "COMPLETED",
      lifecycleStatus: "COMPLETED",
      entryAId: "entry-a",
      entryBId: "entry-b",
      scoreA: 11,
      scoreB: 5,
    };
    assert.equal(isStandingsSafe(lifecycleOnly), false);
    const adapted = adaptValidatedResultToStandingsMatch(lifecycleOnly);
    assert.equal(adapted.included, false);
  });

  it("12. raw CORE-16 projection is never used as standings truth", () => {
    const projection = {
      calculatedMatchComplete: true,
      points: { SIDE_A: 11, SIDE_B: 5 },
      setsWon: { SIDE_A: 1, SIDE_B: 0 },
      events: [{ id: "e1" }],
      projectionKind: "CALCULATED_SCORE_ONLY",
    };
    assert.equal(isRawCore16Projection(projection), true);
    assert.equal(isStandingsSafe(projection), false);
    assert.equal(adaptValidatedResultToStandingsMatch(projection).included, false);
  });

  it("13. winner/loser identity comes from validated result", () => {
    const result = makeValidatedResult({
      winnerId: "entry-b",
      loserId: "entry-a",
      winnerSide: SCORING_SIDE.SIDE_B,
      loserSide: SCORING_SIDE.SIDE_A,
      scoreSnapshot: {
        points: { SIDE_A: 11, SIDE_B: 5 },
        setsWon: { SIDE_A: 2, SIDE_B: 0 },
        gamesWon: { SIDE_A: 2, SIDE_B: 0 },
        completedSets: 2,
        completedGames: 2,
        calculatedMatchComplete: true,
        calculatedWinnerSide: SCORING_SIDE.SIDE_A,
      },
    });
    const adapted = adaptValidatedResultToStandingsMatch(result);
    assert.equal(adapted.record.winnerEntryId, "entry-b");
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [result],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    assert.equal(standings.rows.find((row) => row.entryId === "entry-b").wins, 1);
    assert.equal(standings.rows.find((row) => row.entryId === "entry-a").losses, 1);
  });

  it("14. game differential and point differential are distinct", () => {
    const left = {
      entryId: "a",
      scoreDifference: 10,
      gameDifference: 1,
      setDifference: 0,
      points: 2,
      wins: 1,
      forfeits: 0,
      scoreFor: 10,
      seed: 1,
    };
    const right = {
      entryId: "b",
      scoreDifference: 1,
      gameDifference: 5,
      setDifference: 0,
      points: 2,
      wins: 1,
      forfeits: 0,
      scoreFor: 1,
      seed: 2,
    };
    const pointRule = createTieBreakRule({
      id: "pd",
      type: TIEBREAK_TYPE.POINT_DIFFERENCE,
      priority: 1,
    });
    const gameRule = createTieBreakRule({
      id: "gd",
      type: TIEBREAK_TYPE.GAME_DIFFERENCE,
      priority: 1,
    });
    assert.ok(compareRowsByTieBreakRule(left, right, pointRule) < 0);
    assert.ok(compareRowsByTieBreakRule(left, right, gameRule) > 0);
  });

  it("15. missing statistics are not silently invented", () => {
    const result = makeValidatedResult({
      scoreSnapshot: {
        points: { SIDE_A: 11, SIDE_B: 5 },
        setsWon: { SIDE_A: 2, SIDE_B: 0 },
        completedSets: 2,
        completedGames: 0,
        calculatedMatchComplete: true,
        calculatedWinnerSide: SCORING_SIDE.SIDE_A,
      },
    });
    const adapted = adaptValidatedResultToStandingsMatch(result);
    assert.equal(adapted.record.gamesA, undefined);
    assert.equal(adapted.record.gamesB, undefined);
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [result],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    assert.equal(standings.rows.find((row) => row.entryId === "entry-a").gameDifference, 0);
    assert.equal(standings.rows.find((row) => row.entryId === "entry-a").scoreDifference, 6);
  });
});

describe("CORE-18 fail-closed identity and conflicts", () => {
  it("16. duplicate canonical result identity fails closed", () => {
    const a = makeValidatedResult({ validatedResultId: "vr-dup", matchId: "m-dup" });
    const b = makeValidatedResult({ validatedResultId: "vr-dup-2", matchId: "m-dup" });
    const adapted = adaptValidatedResultsToStandingsMatches([a, b]);
    assert.equal(adapted.ok, false);
    assert.ok(
      adapted.errors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_MATCH_IDENTITY
      )
    );
  });

  it("17. conflicting accepted results fail closed", () => {
    const a = makeValidatedResult({
      validatedResultId: "vr-c1",
      matchId: "m-conflict",
      winnerId: "entry-a",
      loserId: "entry-b",
    });
    const b = makeValidatedResult({
      validatedResultId: "vr-c2",
      matchId: "m-conflict",
      winnerId: "entry-b",
      loserId: "entry-a",
      winnerSide: SCORING_SIDE.SIDE_B,
      loserSide: SCORING_SIDE.SIDE_A,
    });
    const adapted = adaptValidatedResultsToStandingsMatches([a, b]);
    assert.equal(adapted.ok, false);
    assert.ok(
      adapted.errors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_CONFLICTING_ACCEPTED_RESULTS
      )
    );
  });
});

describe("CORE-18 tie-break and determinism", () => {
  it("18. two-entry head-to-head", () => {
    const standings = calculateCanonicalStandings(
      createStandingsRequest({
        entries: entriesAB(),
        matches: [
          createStandingsMatchRecord({
            matchId: "h2h-1",
            entryAId: "entry-a",
            entryBId: "entry-b",
            scoreA: 11,
            scoreB: 5,
            winnerEntryId: "entry-a",
          }),
        ],
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
          createTieBreakRule({ id: "h2h", type: TIEBREAK_TYPE.HEAD_TO_HEAD, priority: 2 }),
        ]),
      })
    );
    assert.equal(standings.rows[0].entryId, "entry-a");
  });

  it("19. multi-entry mini-table", () => {
    const standings = calculateCanonicalStandings(
      createStandingsRequest({
        entries: [
          createStandingsEntry({ entryId: "a" }),
          createStandingsEntry({ entryId: "b" }),
          createStandingsEntry({ entryId: "c" }),
        ],
        matches: [
          createStandingsMatchRecord({
            matchId: "m1",
            entryAId: "a",
            entryBId: "b",
            scoreA: 11,
            scoreB: 5,
            winnerEntryId: "a",
          }),
          createStandingsMatchRecord({
            matchId: "m2",
            entryAId: "b",
            entryBId: "c",
            scoreA: 11,
            scoreB: 5,
            winnerEntryId: "b",
          }),
          createStandingsMatchRecord({
            matchId: "m3",
            entryAId: "c",
            entryBId: "a",
            scoreA: 11,
            scoreB: 5,
            winnerEntryId: "c",
          }),
        ],
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
          createTieBreakRule({ id: "mini", type: TIEBREAK_TYPE.MINI_TABLE, priority: 2 }),
        ]),
      })
    );
    assert.equal(standings.rows.length, 3);
    assert.ok(standings.decisionTrace.tieGroups.length >= 1 || standings.decisionTrace.tieBreakSteps.length >= 1);
  });

  it("20. injected tie-break order changes ranking deterministically", () => {
    const entries = [
      createStandingsEntry({ entryId: "a", name: "A" }),
      createStandingsEntry({ entryId: "b", name: "B" }),
    ];
    const matches = [
      createStandingsMatchRecord({
        matchId: "m1",
        entryAId: "a",
        entryBId: "b",
        scoreA: 11,
        scoreB: 9,
        gamesA: 1,
        gamesB: 2,
        winnerEntryId: "a",
      }),
    ];
    const byPoints = calculateCanonicalStandings(
      createStandingsRequest({
        entries,
        matches,
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
          createTieBreakRule({ id: "pd", type: TIEBREAK_TYPE.POINT_DIFFERENCE, priority: 2 }),
        ]),
      })
    );
    const byGames = calculateCanonicalStandings(
      createStandingsRequest({
        entries,
        matches,
        configuration: injectedConfig([
          createTieBreakRule({ id: "gd", type: TIEBREAK_TYPE.GAME_DIFFERENCE, priority: 1 }),
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 2 }),
        ]),
      })
    );
    assert.equal(byPoints.rows[0].entryId, "a");
    assert.equal(byGames.rows[0].entryId, "b");
  });

  it("21. stable canonical identity fallback", () => {
    const standings = calculateCanonicalStandings(
      createStandingsRequest({
        entries: [
          createStandingsEntry({ entryId: "zeta", name: "AAA" }),
          createStandingsEntry({ entryId: "alpha", name: "ZZZ" }),
        ],
        matches: [],
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
        ]),
      })
    );
    assert.deepEqual(
      standings.rows.map((row) => row.entryId),
      ["alpha", "zeta"]
    );
    assert.ok(
      standings.decisionTrace.tieBreakSteps.some(
        (step) => step.ruleId === "canonical-identity-fallback"
      )
    );
  });

  it("22. same input in different array order produces the same output", () => {
    const entries = [
      createStandingsEntry({ entryId: "a" }),
      createStandingsEntry({ entryId: "b" }),
      createStandingsEntry({ entryId: "c" }),
    ];
    const m1 = createStandingsMatchRecord({
      matchId: "m1",
      entryAId: "a",
      entryBId: "b",
      scoreA: 11,
      scoreB: 5,
      winnerEntryId: "a",
    });
    const m2 = createStandingsMatchRecord({
      matchId: "m2",
      entryAId: "b",
      entryBId: "c",
      scoreA: 11,
      scoreB: 8,
      winnerEntryId: "b",
    });
    const cfg = injectedConfig([
      createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      createTieBreakRule({ id: "pd", type: TIEBREAK_TYPE.POINT_DIFFERENCE, priority: 2 }),
    ]);
    const first = calculateCanonicalStandings(
      createStandingsRequest({ entries, matches: [m1, m2], configuration: cfg })
    );
    const second = calculateCanonicalStandings(
      createStandingsRequest({
        entries: [...entries].reverse(),
        matches: [m2, m1],
        configuration: cfg,
      })
    );
    assert.deepEqual(
      first.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points })),
      second.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points }))
    );
    assert.equal(first.decisionTrace.traceId, second.decisionTrace.traceId);
  });

  it("23. no wall-clock or mutable-counter drift in canonical output", () => {
    const request = createStandingsRequest({
      entries: entriesAB(),
      matches: [
        createStandingsMatchRecord({
          matchId: "m1",
          entryAId: "entry-a",
          entryBId: "entry-b",
          scoreA: 11,
          scoreB: 5,
          winnerEntryId: "entry-a",
        }),
      ],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    const a = calculateCanonicalStandings(request);
    const b = calculateCanonicalStandings(request);
    assert.equal(a.decisionTrace.traceId, b.decisionTrace.traceId);
    assert.equal(a.snapshot.snapshotId, b.snapshot.snapshotId);
    assert.equal(a.decisionTrace.timestamp, null);
    assert.equal(a.snapshot.generatedAt, null);
    assert.equal(a.audit.recordedAt, null);
    assert.deepEqual(JSON.stringify(a.rows), JSON.stringify(b.rows));
    assert.deepEqual(JSON.stringify(a.decisionTrace), JSON.stringify(b.decisionTrace));
  });

  it("24. typed errors and warnings", () => {
    const empty = calculateCanonicalStandings(createStandingsRequest({ entries: [] }));
    assert.equal(empty.ok, false);
    assert.ok(
      empty.typedErrors.some((e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_EMPTY_ENTRY_ROSTER)
    );

    const dup = calculateCanonicalStandings(
      createStandingsRequest({
        entries: entriesAB(),
        matches: [
          createStandingsMatchRecord({
            matchId: "dup",
            entryAId: "entry-a",
            entryBId: "entry-b",
            scoreA: 11,
            scoreB: 5,
          }),
          createStandingsMatchRecord({
            matchId: "dup",
            entryAId: "entry-a",
            entryBId: "entry-b",
            scoreA: 11,
            scoreB: 5,
          }),
        ],
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
        ]),
      })
    );
    assert.equal(dup.ok, false);
    assert.ok(
      dup.typedErrors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_MATCH_IDENTITY
      )
    );
  });

  it("25. deterministic explanation trace", () => {
    const result = makeValidatedResult();
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [result],
      configuration: injectedConfig([
        createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      ]),
    });
    assert.ok(
      standings.explanations.some((e) => e.code === STANDINGS_EXPLANATION_CODE.RESULT_INCLUDED)
    );
    assert.ok(standings.explanations.some((e) => e.code === "rank_assigned"));
    assert.match(standings.decisionTrace.traceId, /^standings-trace-/);
    assert.equal(standings.decisionTrace.timestamp, null);
  });

  it("26. existing CC-08 behavior retained where compatible", () => {
    const result = calculateCanonicalStandings(
      createStandingsRequest({
        entries: [
          createStandingsEntry({ entryId: "a", name: "A", seed: 1 }),
          createStandingsEntry({ entryId: "b", name: "B", seed: 2 }),
        ],
        matches: [
          createStandingsMatchRecord({
            matchId: "m1",
            entryAId: "a",
            entryBId: "b",
            scoreA: 11,
            scoreB: 5,
          }),
        ],
      })
    );
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].entryId, "a");
    assert.equal(result.rows.find((row) => row.entryId === "a").points, 2);
    assert.equal(result.rows.find((row) => row.entryId === "b").points, 1);
  });

  it("27. canonical mode does not apply qualification by default", () => {
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [makeValidatedResult()],
      configuration: injectedConfig(
        [createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 })],
        { qualificationRule: { qualifiersCount: 1 } }
      ),
    });
    assert.equal(standings.ok, true);
    assert.equal(
      standings.rows.every((row) => row.qualificationStatus == null),
      true
    );
    assert.equal(standings.legacyQualification, undefined);
  });

  it("28. canonical validated path rejects missing injected tie-break rules", () => {
    const standings = calculateStandingsFromValidatedResults({
      entries: entriesAB(),
      validatedResults: [makeValidatedResult()],
      configuration: { scoringRule: createScoringRule() },
    });
    assert.equal(standings.ok, false);
    assert.ok(
      standings.typedErrors.some((e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_MISSING_RULE_SET)
    );
  });

  it("29. canonicalSource never infers winner from scores", () => {
    const standings = calculateCanonicalStandings(
      createStandingsRequest({
        entries: entriesAB(),
        matches: [
          createStandingsMatchRecord({
            matchId: "m-canon",
            entryAId: "entry-a",
            entryBId: "entry-b",
            scoreA: 11,
            scoreB: 5,
            canonicalSource: true,
            // winner intentionally absent
          }),
        ],
        configuration: injectedConfig([
          createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
        ]),
      })
    );
    assert.equal(standings.ok, false);
    assert.ok(
      standings.typedErrors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER
      )
    );
    assert.equal(standings.rows.find((row) => row.entryId === "entry-a").wins, 0);
  });

  it("30. duplicate/conflict fail-closed independent of input order", () => {
    const a = makeValidatedResult({
      validatedResultId: "vr-c1",
      matchId: "m-conflict",
      winnerId: "entry-a",
      loserId: "entry-b",
    });
    const b = makeValidatedResult({
      validatedResultId: "vr-c2",
      matchId: "m-conflict",
      winnerId: "entry-b",
      loserId: "entry-a",
      winnerSide: SCORING_SIDE.SIDE_B,
      loserSide: SCORING_SIDE.SIDE_A,
    });
    const forward = adaptValidatedResultsToStandingsMatches([a, b]);
    const reverse = adaptValidatedResultsToStandingsMatches([b, a]);
    assert.equal(forward.ok, false);
    assert.equal(reverse.ok, false);
    assert.equal(forward.matches.length, 0);
    assert.equal(reverse.matches.length, 0);
    assert.ok(
      forward.errors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_CONFLICTING_ACCEPTED_RESULTS
      )
    );

    const exactDup = adaptValidatedResultsToStandingsMatches([a, a]);
    assert.equal(exactDup.ok, false);
    assert.equal(exactDup.matches.length, 0);

    const mixed = adaptValidatedResultsToStandingsMatches([
      makeValidatedResult({ validatedResultId: "vr-ok", matchId: "m-ok" }),
      a,
      b,
    ]);
    assert.equal(mixed.ok, false);
    assert.equal(mixed.matches.length, 1);
    assert.equal(mixed.matches[0].matchId, "m-ok");
  });

  it("31. repeated and reordered inputs remain deeply equal", () => {
    const results = [
      makeValidatedResult({ validatedResultId: "vr-1", matchId: "m-1" }),
      makeValidatedResult({
        validatedResultId: "vr-2",
        matchId: "m-2",
        winnerId: "entry-b",
        loserId: "entry-a",
        winnerSide: SCORING_SIDE.SIDE_B,
        loserSide: SCORING_SIDE.SIDE_A,
        sideBindings: sideBindings("entry-b", "entry-a"),
        scoreSnapshot: {
          points: { SIDE_A: 11, SIDE_B: 8 },
          setsWon: { SIDE_A: 2, SIDE_B: 0 },
          gamesWon: { SIDE_A: 2, SIDE_B: 0 },
          completedSets: 2,
          completedGames: 2,
          calculatedMatchComplete: true,
          calculatedWinnerSide: SCORING_SIDE.SIDE_A,
        },
      }),
    ];
    const rules = [
      createTieBreakRule({ id: "pts", type: TIEBREAK_TYPE.TOTAL_POINTS, priority: 1 }),
      createTieBreakRule({ id: "pd", type: TIEBREAK_TYPE.POINT_DIFFERENCE, priority: 2 }),
    ];
    const run = (entryOrder, resultOrder, ruleOrder) =>
      calculateStandingsFromValidatedResults({
        entries: entryOrder,
        validatedResults: resultOrder,
        configuration: injectedConfig(ruleOrder),
      });

    const first = run(entriesAB(), results, rules);
    const second = run([...entriesAB()].reverse(), [...results].reverse(), [...rules].reverse());
    const third = run(entriesAB(), results, rules);
    assert.equal(first.ok, true);
    assert.deepEqual(
      first.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points, pd: row.scoreDifference })),
      second.rows.map((row) => ({ id: row.entryId, rank: row.rank, points: row.points, pd: row.scoreDifference }))
    );
    assert.equal(first.decisionTrace.traceId, second.decisionTrace.traceId);
    assert.equal(first.decisionTrace.traceId, third.decisionTrace.traceId);
    assert.deepEqual(JSON.stringify(first.rows), JSON.stringify(third.rows));
  });

  it("32. unsupported tie-break criterion is typed", () => {
    const standings = calculateCanonicalStandings(
      createStandingsRequest({
        entries: entriesAB(),
        matches: [],
        configuration: injectedConfig([
          createTieBreakRule({ id: "bad", type: "NOT_A_REAL_CRITERION", priority: 1 }),
        ]),
      })
    );
    assert.ok(
      standings.typedErrors.some(
        (e) => e.code === STANDINGS_ERROR_CODE.STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION
      )
    );
  });
});
