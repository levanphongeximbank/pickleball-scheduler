/**
 * CORE-17 Result Validation — focused certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  createScoringFormat,
  createInitialScoringState,
  createScoringProjection,
  recordPoint,
} from "../src/features/competition-core/scoring/index.js";
import {
  ACCEPTANCE_STATUS,
  ACTOR_TYPE,
  LIFECYCLE_COMPLETION_REASON,
  LIFECYCLE_STATUS,
  LINEAGE_STATUS,
  MATCH_SIDE_KEY,
  OUTCOME,
  RESULT_ERROR_CODE,
  RESULT_TYPE,
  SOURCE_TYPE,
  TECHNICAL_SUBTYPE,
  ResultValidationError,
  EVIDENCE_SEVERITY,
  acceptMatchResult,
  computeValidatedResultFingerprint,
  finalizeNonAcceptedResult,
  finalizeValidatedResult,
  isScoreDifferentialEligible,
  isStandingsSafe,
  validateMatchResult,
} from "../src/features/competition-core/result-validation/index.js";

function clockFactory(start = 0) {
  let t = start;
  return () => {
    t += 1;
    return `2026-07-23T12:00:00.${String(t).padStart(3, "0")}Z`;
  };
}

function idFactory(prefix = "vr") {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

function scoringDeps() {
  let t = 0;
  let n = 0;
  return {
    now: () => {
      t += 1;
      return `2026-07-23T11:00:00.${String(t).padStart(3, "0")}Z`;
    },
    nextId: () => {
      n += 1;
      return `evt-${n}`;
    },
  };
}

function sideBindings() {
  return [
    {
      matchSideKey: MATCH_SIDE_KEY.A,
      scoringSide: SCORING_SIDE.SIDE_A,
      matchSideId: "side-a",
      entryId: "entry-a",
      teamId: null,
      participantIds: ["p-a1", "p-a2"],
    },
    {
      matchSideKey: MATCH_SIDE_KEY.B,
      scoringSide: SCORING_SIDE.SIDE_B,
      matchSideId: "side-b",
      entryId: "entry-b",
      teamId: null,
      participantIds: ["p-b1", "p-b2"],
    },
  ];
}

function baseSubmission(overrides = {}) {
  return {
    matchId: "m-1",
    competitionId: "comp-1",
    contextId: "ctx-1",
    resultType: RESULT_TYPE.COMPLETED,
    outcome: OUTCOME.WIN_LOSS,
    winnerSide: SCORING_SIDE.SIDE_A,
    loserSide: SCORING_SIDE.SIDE_B,
    sideBindings: sideBindings(),
    actor: { actorType: ACTOR_TYPE.REFEREE, actorId: "ref-1" },
    source: { sourceType: SOURCE_TYPE.CORE16_PROJECTION, sourceId: "proj-1" },
    ...overrides,
  };
}

function terminalProjection(winnerSide = SCORING_SIDE.SIDE_A) {
  let state = createInitialScoringState({
    matchId: "m-1",
    format: createScoringFormat({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      winBy: 2,
      bestOfGames: 1,
    }),
  });
  const d = scoringDeps();
  const loser =
    winnerSide === SCORING_SIDE.SIDE_A
      ? SCORING_SIDE.SIDE_B
      : SCORING_SIDE.SIDE_A;
  for (let i = 0; i < 11; i += 1) {
    state = recordPoint(
      state,
      { scoringSide: winnerSide, lifecycleStatus: MATCH_STATUS.IN_PROGRESS },
      d
    ).state;
  }
  assert.equal(state.matchComplete, true);
  assert.equal(state.calculatedWinnerSide, winnerSide);
  assert.equal(state.points[loser], 0);
  return createScoringProjection(state);
}

function nonTerminalProjection() {
  let state = createInitialScoringState({
    matchId: "m-1",
    format: createScoringFormat({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      bestOfGames: 1,
    }),
  });
  const d = scoringDeps();
  state = recordPoint(
    state,
    {
      scoringSide: SCORING_SIDE.SIDE_A,
      lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
    },
    d
  ).state;
  assert.equal(state.matchComplete, false);
  return createScoringProjection(state);
}

function validateCompleted(overrides = {}, projection = terminalProjection()) {
  return validateMatchResult(baseSubmission(overrides), {
    scoringProjection: projection,
    now: clockFactory(),
    nextId: idFactory(),
  });
}

function acceptCompleted(result, lifecycleOverrides = {}) {
  return acceptMatchResult(result, {
    actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
    lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
    completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
    now: clockFactory(10),
    ...lifecycleOverrides,
  });
}

describe("CORE-17 completed validation + acceptance", () => {
  it("1. valid completed submission validates but is not auto-accepted", () => {
    const result = validateCompleted();
    assert.equal(result.acceptanceStatus, ACCEPTANCE_STATUS.PENDING);
    assert.equal(result.lineageStatus, LINEAGE_STATUS.ACTIVE);
    assert.equal(result.resultType, RESULT_TYPE.COMPLETED);
    assert.equal(result.winnerSide, SCORING_SIDE.SIDE_A);
    assert.equal(result.winnerId, "entry-a");
    assert.equal(result.loserId, "entry-b");
    assert.ok(result.scoreSummaryRef);
    assert.equal(result.acceptedAt, null);
    assert.equal(isStandingsSafe(result), false);
  });

  it("2. explicit accept succeeds when lifecycle terminal is compatible", () => {
    const pending = validateCompleted();
    const accepted = acceptCompleted(pending);
    assert.equal(accepted.acceptanceStatus, ACCEPTANCE_STATUS.ACCEPTED);
    assert.ok(accepted.acceptedAt);
    assert.equal(isStandingsSafe(accepted), true);
  });

  it("3. accept blocked when lifecycle is not complete", () => {
    const pending = validateCompleted();
    assert.throws(
      () =>
        acceptMatchResult(pending, {
          actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
          lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
          completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED
    );
  });

  it("4. non-terminal projection is rejected", () => {
    assert.throws(
      () => validateCompleted({}, nonTerminalProjection()),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_PROJECTION_NOT_TERMINAL
    );
  });

  it("5. wrong projection kind is rejected", () => {
    const projection = {
      ...terminalProjection(),
      projectionKind: "OFFICIAL_RESULT",
    };
    assert.throws(
      () => validateCompleted({}, projection),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID
    );
  });

  it("6. matchId mismatch is rejected", () => {
    assert.throws(
      () => validateCompleted({ matchId: "other-match" }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_SCORE_REF_INVALID
    );
  });

  it("7. calculated winner mismatch is rejected", () => {
    assert.throws(
      () =>
        validateCompleted({
          winnerSide: SCORING_SIDE.SIDE_B,
          loserSide: SCORING_SIDE.SIDE_A,
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH
    );
  });

  it("8. loser mapping mismatch is rejected", () => {
    assert.throws(
      () =>
        validateCompleted({
          loserId: "wrong-loser",
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_LOSER_REQUIRED
    );
  });
});

describe("CORE-17 technical results", () => {
  it("9. valid walkover validates as PENDING", () => {
    const result = validateMatchResult(
      baseSubmission({
        resultType: RESULT_TYPE.WALKOVER,
        source: { sourceType: SOURCE_TYPE.MANUAL_TECHNICAL, sourceId: "wo-1" },
        technicalMetadata: {
          reasonCode: "OPPONENT_UNAVAILABLE",
          reasonTextKey: "result.walkover.unavailable",
          affectedSide: SCORING_SIDE.SIDE_B,
          technicalSubtype: null,
          notesExcludedFromFingerprint: "free text note",
        },
      }),
      { now: clockFactory(), nextId: idFactory("wo") }
    );
    assert.equal(result.acceptanceStatus, ACCEPTANCE_STATUS.PENDING);
    assert.equal(result.resultType, RESULT_TYPE.WALKOVER);
    const accepted = acceptMatchResult(result, {
      actor: { actorType: ACTOR_TYPE.ORGANIZER, actorId: "org-1" },
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      completionReason: LIFECYCLE_COMPLETION_REASON.WALKOVER,
      now: clockFactory(5),
    });
    assert.equal(accepted.acceptanceStatus, ACCEPTANCE_STATUS.ACCEPTED);
    assert.equal(isScoreDifferentialEligible(accepted), false);
  });

  it("10. no-show missing affected side is rejected", () => {
    assert.throws(
      () =>
        validateMatchResult(
          baseSubmission({
            resultType: RESULT_TYPE.NO_SHOW,
            source: {
              sourceType: SOURCE_TYPE.MANUAL_TECHNICAL,
              sourceId: "ns-1",
            },
            technicalMetadata: {
              reasonCode: "NO_SHOW",
              affectedSide: null,
            },
          }),
          { now: clockFactory(), nextId: idFactory("ns") }
        ),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_TECHNICAL_METADATA_REQUIRED
    );
  });

  it("11. retirement keeps partial snapshot but is not score-diff eligible", () => {
    const partial = nonTerminalProjection();
    const result = validateMatchResult(
      baseSubmission({
        resultType: RESULT_TYPE.RETIREMENT,
        winnerSide: SCORING_SIDE.SIDE_A,
        loserSide: SCORING_SIDE.SIDE_B,
        source: { sourceType: SOURCE_TYPE.MANUAL_TECHNICAL, sourceId: "ret-1" },
        technicalMetadata: {
          affectedSide: SCORING_SIDE.SIDE_B,
          technicalSubtype: TECHNICAL_SUBTYPE.INJURY,
          reasonCode: "INJURY",
        },
      }),
      {
        scoringProjection: partial,
        now: clockFactory(),
        nextId: idFactory("ret"),
      }
    );
    assert.ok(result.scoreSnapshot);
    assert.equal(result.scoreSnapshot.calculatedMatchComplete, false);
    const accepted = acceptMatchResult(result, {
      actor: { actorType: ACTOR_TYPE.REFEREE, actorId: "ref-1" },
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      completionReason: LIFECYCLE_COMPLETION_REASON.RETIREMENT,
      now: clockFactory(3),
    });
    assert.equal(isStandingsSafe(accepted), true);
    assert.equal(isScoreDifferentialEligible(accepted), false);
    assert.equal(accepted.standingsPolicy.scoreDifferentialEligible, false);
  });

  it("12. forfeit missing subtype is rejected", () => {
    assert.throws(
      () =>
        validateMatchResult(
          baseSubmission({
            resultType: RESULT_TYPE.FORFEIT,
            source: {
              sourceType: SOURCE_TYPE.MANUAL_TECHNICAL,
              sourceId: "ff-1",
            },
            technicalMetadata: {
              reasonCode: "RULE_BREACH",
              affectedSide: SCORING_SIDE.SIDE_B,
            },
          }),
          { now: clockFactory(), nextId: idFactory("ff") }
        ),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_TECHNICAL_SUBTYPE_REQUIRED
    );
  });

  it("13. abandoned/cancelled/void cannot be accepted", () => {
    for (const [resultType, reason] of [
      [RESULT_TYPE.ABANDONED, LIFECYCLE_COMPLETION_REASON.ABANDONED],
      [RESULT_TYPE.CANCELLED, LIFECYCLE_COMPLETION_REASON.CANCELLED],
      [RESULT_TYPE.VOID, LIFECYCLE_COMPLETION_REASON.VOID],
    ]) {
      const pending = validateMatchResult(
        baseSubmission({
          resultType,
          outcome: OUTCOME.NO_WINNER,
          winnerSide: null,
          loserSide: null,
          source: {
            sourceType: SOURCE_TYPE.MANUAL_TECHNICAL,
            sourceId: `${resultType}-1`,
          },
          technicalMetadata: {
            reasonCode: "ADMIN",
            technicalSubtype:
              resultType === RESULT_TYPE.VOID
                ? TECHNICAL_SUBTYPE.NO_CONTEST
                : null,
          },
        }),
        { now: clockFactory(), nextId: idFactory(resultType.toLowerCase()) }
      );
      assert.equal(pending.acceptanceStatus, ACCEPTANCE_STATUS.PENDING);
      assert.throws(
        () =>
          acceptMatchResult(pending, {
            actor: { actorType: ACTOR_TYPE.ADMIN, actorId: "admin-1" },
            lifecycleStatus:
              resultType === RESULT_TYPE.CANCELLED
                ? LIFECYCLE_STATUS.CANCELLED
                : LIFECYCLE_STATUS.COMPLETED,
            completionReason: reason,
          }),
        (err) =>
          err instanceof ResultValidationError &&
          err.code === RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED
      );
    }
  });

  it("14. draw is not supported", () => {
    assert.throws(
      () =>
        validateMatchResult(baseSubmission({ resultType: "DRAW" }), {
          now: clockFactory(),
          nextId: idFactory("draw"),
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_DRAW_NOT_SUPPORTED
    );
    assert.throws(
      () =>
        validateMatchResult(baseSubmission({ outcome: "DRAW" }), {
          scoringProjection: terminalProjection(),
          now: clockFactory(),
          nextId: idFactory("draw2"),
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_DRAW_NOT_SUPPORTED
    );
  });
});

describe("CORE-17 standings-safe gate + correction", () => {
  it("15. rejected/correction-required are not standings-safe", () => {
    const rejected = finalizeNonAcceptedResult(
      baseSubmission({ resultType: RESULT_TYPE.WALKOVER }),
      ACCEPTANCE_STATUS.REJECTED,
      RESULT_ERROR_CODE.RESULT_WINNER_REQUIRED,
      [],
      { now: clockFactory(), nextId: idFactory("rej") }
    );
    const correction = finalizeNonAcceptedResult(
      baseSubmission(),
      ACCEPTANCE_STATUS.CORRECTION_REQUIRED,
      RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH,
      [RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH],
      { now: clockFactory(), nextId: idFactory("corr") }
    );
    assert.equal(isStandingsSafe(rejected), false);
    assert.equal(isStandingsSafe(correction), false);
  });

  it("16-18. correction creates new revision, supersedes old, concurrency conflict", () => {
    const firstPending = validateCompleted();
    const firstAccepted = acceptCompleted(firstPending);
    assert.equal(firstAccepted.revision, 1);

    const correction = validateMatchResult(
      baseSubmission({
        source: { sourceType: SOURCE_TYPE.CORRECTION, sourceId: "c-1" },
      }),
      {
        scoringProjection: terminalProjection(),
        now: clockFactory(20),
        nextId: idFactory("vr2"),
        correction: {
          previousResult: firstAccepted,
          expectedActiveValidatedResultId: firstAccepted.validatedResultId,
          expectedRevision: firstAccepted.revision,
        },
      }
    );
    assert.ok(correction.validatedResult);
    assert.ok(correction.supersededResult);
    assert.equal(correction.validatedResult.revision, 2);
    assert.equal(
      correction.validatedResult.supersedesValidatedResultId,
      firstAccepted.validatedResultId
    );
    assert.equal(
      correction.supersededResult.lineageStatus,
      LINEAGE_STATUS.SUPERSEDED
    );
    assert.equal(
      correction.supersededResult.supersededByValidatedResultId,
      correction.validatedResult.validatedResultId
    );
    assert.equal(isStandingsSafe(correction.supersededResult), false);

    assert.throws(
      () =>
        validateMatchResult(baseSubmission(), {
          scoringProjection: terminalProjection(),
          now: clockFactory(30),
          nextId: idFactory("vr3"),
          correction: {
            previousResult: firstAccepted,
            expectedActiveValidatedResultId: firstAccepted.validatedResultId,
            expectedRevision: 99,
          },
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_CONCURRENT_CORRECTION
    );
  });

  it("27-28. accepted+active is standings-safe; superseded is not", () => {
    const pending = validateCompleted();
    const accepted = acceptCompleted(pending);
    assert.equal(isStandingsSafe(accepted), true);
    const { supersededResult } = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: clockFactory(40),
      nextId: idFactory("vr4"),
      correction: {
        previousResult: accepted,
        expectedActiveValidatedResultId: accepted.validatedResultId,
        expectedRevision: accepted.revision,
      },
    });
    assert.equal(isStandingsSafe(supersededResult), false);
  });
});

describe("CORE-17 immutability + determinism + errors", () => {
  it("19-21. does not mutate caller input, projection, or scoring events", () => {
    const submission = baseSubmission();
    const projection = terminalProjection();
    const submissionBefore = JSON.stringify(submission);
    const projectionBefore = JSON.stringify(projection);
    const eventsBefore = JSON.stringify(projection.events);
    validateMatchResult(submission, {
      scoringProjection: projection,
      now: clockFactory(),
      nextId: idFactory(),
    });
    assert.equal(JSON.stringify(submission), submissionBefore);
    assert.equal(JSON.stringify(projection), projectionBefore);
    assert.equal(JSON.stringify(projection.events), eventsBefore);
  });

  it("22. deterministic evidence ordering by code then path", () => {
    const a = validateCompleted();
    const b = validateCompleted();
    const codesA = a.validationEvidence.map((e) => `${e.code}|${e.path}`);
    const codesB = b.validationEvidence.map((e) => `${e.code}|${e.path}`);
    assert.deepEqual(codesA, codesB);
    const sorted = [...codesA].sort();
    assert.deepEqual(codesA, sorted);
  });

  it("23. deterministic fingerprint for same input", () => {
    const a = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: () => "2026-07-23T12:00:00.001Z",
      nextId: () => "vr-fixed",
    });
    const b = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: () => "2026-07-23T99:00:00.999Z",
      nextId: () => "vr-fixed",
    });
    assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
    assert.equal(
      a.deterministicFingerprint,
      computeValidatedResultFingerprint(a)
    );
    assert.match(a.deterministicFingerprint, /^[0-9a-f]{8}$/);
  });

  it("24-25. idempotent acceptance replay; mismatch typed error", () => {
    const pending = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: () => "2026-07-23T12:00:00.001Z",
      nextId: () => "vr-idem",
    });
    const accepted = acceptMatchResult(pending, {
      actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
      now: () => "2026-07-23T12:00:00.010Z",
    });
    const replay = acceptMatchResult(accepted, {
      actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
      lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
      completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
      currentActiveAccepted: accepted,
      now: () => "2026-07-23T12:00:00.011Z",
    });
    assert.equal(replay.validatedResultId, accepted.validatedResultId);
    assert.equal(
      replay.deterministicFingerprint,
      accepted.deterministicFingerprint
    );

    const tampered = {
      ...accepted,
      deterministicFingerprint: "deadbeef",
    };
    assert.throws(
      () =>
        acceptMatchResult(tampered, {
          actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
          lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
          completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
          currentActiveAccepted: accepted,
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_IDEMPOTENT_REPLAY_MISMATCH
    );
  });

  it("26. errors use RESULT_* namespace", () => {
    try {
      validateMatchResult(baseSubmission({ resultType: "NO_CONTEST" }), {
        now: clockFactory(),
        nextId: idFactory(),
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof ResultValidationError);
      assert.match(err.code, /^RESULT_/);
      assert.equal(
        err.code,
        RESULT_ERROR_CODE.RESULT_UNSUPPORTED_NO_CONTEST_ENUM
      );
      assert.equal(err.code.startsWith("MATCH_"), false);
      assert.equal(err.code.startsWith("SCORING_"), false);
    }
  });

  it("cert. nested returned record is deep-frozen", () => {
    const result = validateCompleted();
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.sideBindings), true);
    assert.equal(Object.isFrozen(result.sideBindings[0]), true);
    assert.equal(Object.isFrozen(result.validationEvidence), true);
    assert.equal(Object.isFrozen(result.validationEvidence[0]), true);
    assert.equal(Object.isFrozen(result.scoreSummaryRef), true);
    assert.equal(Object.isFrozen(result.scoreSnapshot), true);
    assert.equal(Object.isFrozen(result.scoreSnapshot.points), true);
    assert.throws(() => {
      result.winnerSide = SCORING_SIDE.SIDE_B;
    });
    assert.throws(() => {
      result.validationEvidence.push({ code: "X" });
    });
    assert.throws(() => {
      result.scoreSnapshot.points.SIDE_A = 99;
    });
  });

  it("cert. fingerprint ignores key insertion order, timestamps, free-text", () => {
    const projection = terminalProjection();
    const a = validateMatchResult(
      {
        matchId: "m-1",
        competitionId: "comp-1",
        contextId: "ctx-1",
        resultType: RESULT_TYPE.COMPLETED,
        outcome: OUTCOME.WIN_LOSS,
        winnerSide: SCORING_SIDE.SIDE_A,
        loserSide: SCORING_SIDE.SIDE_B,
        sideBindings: sideBindings(),
        actor: { actorType: ACTOR_TYPE.REFEREE, actorId: "ref-1" },
        source: { sourceType: SOURCE_TYPE.CORE16_PROJECTION, sourceId: "proj-1" },
        technicalMetadata: {
          notesExcludedFromFingerprint: "note-A",
          reasonCode: null,
        },
      },
      {
        scoringProjection: projection,
        now: () => "2026-07-23T12:00:00.001Z",
        nextId: () => "vr-fp-order",
      }
    );
    const b = validateMatchResult(
      {
        source: { sourceId: "proj-1", sourceType: SOURCE_TYPE.CORE16_PROJECTION },
        actor: { actorId: "ref-1", actorType: ACTOR_TYPE.REFEREE },
        loserSide: SCORING_SIDE.SIDE_B,
        winnerSide: SCORING_SIDE.SIDE_A,
        outcome: OUTCOME.WIN_LOSS,
        resultType: RESULT_TYPE.COMPLETED,
        contextId: "ctx-1",
        competitionId: "comp-1",
        matchId: "m-1",
        sideBindings: sideBindings(),
        technicalMetadata: {
          reasonCode: null,
          notesExcludedFromFingerprint: "note-B-different",
        },
      },
      {
        scoringProjection: projection,
        now: () => "2026-07-23T23:59:59.999Z",
        nextId: () => "vr-fp-order",
      }
    );
    assert.equal(a.deterministicFingerprint, b.deterministicFingerprint);
  });

  it("cert. fingerprint changes when material field changes", () => {
    const a = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: () => "2026-07-23T12:00:00.001Z",
      nextId: () => "vr-fp-a",
    });
    const b = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: () => "2026-07-23T12:00:00.001Z",
      nextId: () => "vr-fp-b",
    });
    assert.notEqual(a.deterministicFingerprint, b.deterministicFingerprint);
    const accepted = acceptCompleted(a);
    assert.notEqual(a.deterministicFingerprint, accepted.deterministicFingerprint);
  });

  it("cert. ERROR evidence blocks acceptance; already-accepted active conflicts", () => {
    const pending = validateCompleted();
    const withError = finalizeValidatedResult({
      ...pending,
      acceptanceStatus: ACCEPTANCE_STATUS.PENDING,
      acceptedAt: null,
      validationEvidence: [
        {
          code: RESULT_ERROR_CODE.RESULT_WINNER_MISMATCH,
          path: "/winnerSide",
          severity: EVIDENCE_SEVERITY.ERROR,
          messageKey: "result.evidence.winner_mismatch",
          expected: SCORING_SIDE.SIDE_A,
          actual: SCORING_SIDE.SIDE_B,
        },
      ],
    });
    assert.throws(
      () =>
        acceptMatchResult(withError, {
          actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
          lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
          completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_ACCEPTANCE_NOT_ALLOWED
    );

    const accepted = acceptCompleted(pending);
    const otherPending = validateMatchResult(baseSubmission(), {
      scoringProjection: terminalProjection(),
      now: clockFactory(50),
      nextId: idFactory("other"),
    });
    assert.throws(
      () =>
        acceptMatchResult(otherPending, {
          actor: { actorType: ACTOR_TYPE.DIRECTOR, actorId: "dir-1" },
          lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
          completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
          currentActiveAccepted: accepted,
        }),
      (err) =>
        err instanceof ResultValidationError &&
        err.code === RESULT_ERROR_CODE.RESULT_ALREADY_ACCEPTED_ACTIVE
    );
  });

  it("cert. supersession preserves historical fingerprint; identity prefers entryId", () => {
    const pending = validateCompleted();
    const accepted = acceptCompleted(pending);
    const priorFp = accepted.deterministicFingerprint;
    const { supersededResult, validatedResult } = validateMatchResult(
      baseSubmission(),
      {
        scoringProjection: terminalProjection(),
        now: clockFactory(60),
        nextId: idFactory("sup"),
        correction: {
          previousResult: accepted,
          expectedActiveValidatedResultId: accepted.validatedResultId,
          expectedRevision: accepted.revision,
        },
      }
    );
    assert.equal(supersededResult.deterministicFingerprint, priorFp);
    assert.notEqual(
      validatedResult.validatedResultId,
      accepted.validatedResultId
    );
    assert.equal(pending.winnerId, "entry-a");
    assert.equal(pending.loserId, "entry-b");
    assert.notEqual(pending.winnerId, "p-a1");
  });

  it("cert. lifecycle mirrors stay anchored to CORE-15 public constants", async () => {
    const { MATCH_STATUS, MATCH_COMPLETION_REASON } = await import(
      "../src/features/competition-core/matches/index.js"
    );
    assert.equal(LIFECYCLE_STATUS.COMPLETED, MATCH_STATUS.COMPLETED);
    assert.equal(LIFECYCLE_STATUS.CANCELLED, MATCH_STATUS.CANCELLED);
    assert.equal(
      LIFECYCLE_COMPLETION_REASON.WALKOVER,
      MATCH_COMPLETION_REASON.WALKOVER
    );
    assert.equal(
      LIFECYCLE_COMPLETION_REASON.VOID,
      MATCH_COMPLETION_REASON.VOID
    );
  });
});
