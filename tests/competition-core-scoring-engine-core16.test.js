/**
 * CORE-16 Scoring Engine — focused certification tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MATCH_STATUS,
  MATCH_RUNTIME_ERROR_CODE,
  MatchRuntimeError,
  assertScoringAllowed,
} from "../src/features/competition-core/matches/index.js";
import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  SCORING_ERROR_CODE,
  SCORING_EVENT_TYPE,
  ScoringEngineError,
  createScoringFormat,
  createInitialScoringState,
  createRecordPointCommand,
  createSupersedeEventCommand,
  createScoringProjection,
  recordPoint,
  supersedeScoringEvent,
  replayScoringProjection,
  executeScoringCommand,
  evaluateGameComplete,
  adaptRefereeV5CheckGameComplete,
  requireScoringLifecycleAllowed,
} from "../src/features/competition-core/scoring/index.js";

function clockFactory(start = 0) {
  let t = start;
  return () => {
    t += 1;
    return `2026-07-23T00:00:00.${String(t).padStart(3, "0")}Z`;
  };
}

function idFactory(prefix = "evt") {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${n}`;
  };
}

function deps() {
  return { now: clockFactory(), nextId: idFactory() };
}

function inProgressState(formatOverrides = {}) {
  return createInitialScoringState({
    matchId: "m-1",
    format: createScoringFormat(formatOverrides),
  });
}

function record(state, side, lifecycleStatus = MATCH_STATUS.IN_PROGRESS, d = deps()) {
  return recordPoint(
    state,
    { scoringSide: side, lifecycleStatus },
    d
  );
}

describe("CORE-16 scoring format + win conditions", () => {
  it("rejects invalid format and supports rally defaults", () => {
    assert.throws(
      () => createScoringFormat({ scoringSystem: "UNKNOWN" }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    const rally = createScoringFormat({ scoringSystem: SCORING_SYSTEM.RALLY });
    assert.equal(rally.pointsToWin, 21);
    assert.equal(rally.winBy, 2);
    assert.equal(rally.sideSwitchAt, 11);
  });

  it("rejects invalid format configurations", () => {
    assert.throws(
      () => createScoringFormat({ formatId: "   " }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ formatVersion: "  " }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ pointsToWin: 0 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ winBy: -1 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ pointsToWin: 11, maximumScore: 10 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ bestOfGames: 2 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ bestOfSets: 4 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ serversPerSide: 3 }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ initialServingSide: "SIDE_C" }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
    assert.throws(
      () => createScoringFormat({ metadata: ["x"] }),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_INVALID_FORMAT
    );
  });

  it("does not mutate input format object and freezes public enums", () => {
    const input = {
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      metadata: { source: "test" },
    };
    const before = JSON.stringify(input);
    const format = createScoringFormat(input);
    assert.equal(JSON.stringify(input), before);
    assert.ok(Object.isFrozen(format));
    assert.ok(Object.isFrozen(SCORING_SIDE));
    assert.ok(Object.isFrozen(SCORING_SYSTEM));
    assert.ok(Object.isFrozen(SCORING_ERROR_CODE));
  });

  it("mirrors referee-v5 checkGameComplete semantics via adapter", () => {
    const points = {
      [SCORING_SIDE.SIDE_A]: 11,
      [SCORING_SIDE.SIDE_B]: 9,
    };
    assert.equal(
      evaluateGameComplete(points, { pointsToWin: 11, winBy: 2, maximumScore: null })
        .complete,
      true
    );
    assert.equal(
      adaptRefereeV5CheckGameComplete(
        { teams: { teamA: { score: 10 }, teamB: { score: 9 } } },
        { pointsToWin: 11, winBy: 2 }
      ),
      false
    );
    assert.equal(
      adaptRefereeV5CheckGameComplete(
        { teams: { teamA: { score: 15 }, teamB: { score: 14 } } },
        { pointsToWin: 11, winBy: 2, maximumScore: 15 }
      ),
      true
    );
  });
});

describe("CORE-16 point / deuce / cap / game / set / match progression", () => {
  it("records valid rally point progression without mutating input", () => {
    const state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      bestOfGames: 1,
    });
    const before = JSON.stringify(state);
    const result = record(state, SCORING_SIDE.SIDE_A);
    assert.equal(result.state.points[SCORING_SIDE.SIDE_A], 1);
    assert.equal(result.event.eventType, SCORING_EVENT_TYPE.POINT_RECORDED);
    assert.equal(JSON.stringify(state), before);
  });

  it("handles deuce / win-by progression", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      winBy: 2,
      bestOfGames: 1,
    });
    const d = deps();
    for (let i = 0; i < 10; i += 1) {
      state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
      state = record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d).state;
    }
    // 10-10
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.matchComplete, false);
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    // 12-10
    assert.equal(state.matchComplete, true);
    assert.equal(state.calculatedWinnerSide, SCORING_SIDE.SIDE_A);
  });

  it("supports game cap via maximumScore", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      winBy: 2,
      maximumScore: 15,
      bestOfGames: 1,
    });
    const d = deps();
    const sides = [];
    for (let i = 0; i < 14; i += 1) {
      sides.push(SCORING_SIDE.SIDE_A, SCORING_SIDE.SIDE_B);
    }
    sides.push(SCORING_SIDE.SIDE_A); // 15-14 capped
    for (const side of sides) {
      state = record(state, side, MATCH_STATUS.IN_PROGRESS, d).state;
    }
    assert.equal(state.matchComplete, true);
    assert.equal(state.calculatedWinnerSide, SCORING_SIDE.SIDE_A);
  });

  it("detects game win and best-of-3 match win", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 2,
      winBy: 1,
      bestOfGames: 3,
      bestOfSets: 1,
    });
    const d = deps();
    // Game 1: A wins 2-0
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.completedGames.length, 1);
    assert.equal(state.matchComplete, false);
    // Game 2: A wins 2-0 → match
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.matchComplete, true);
    assert.equal(state.setsWon[SCORING_SIDE.SIDE_A], 1);
  });

  it("detects set win when bestOfSets > 1", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 2,
      winBy: 1,
      bestOfGames: 1,
      bestOfSets: 3,
    });
    const d = deps();
    // Set 1
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.completedSets.length, 1);
    assert.equal(state.matchComplete, false);
    // Set 2
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.matchComplete, true);
  });

  it("rejects scoring after calculated match completion", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 2,
      winBy: 1,
      bestOfGames: 1,
    });
    const d = deps();
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.matchComplete, true);
    assert.throws(
      () => record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d),
      (err) =>
        err instanceof ScoringEngineError &&
        err.code === SCORING_ERROR_CODE.SCORING_MATCH_ALREADY_COMPLETE
    );
  });

  it("supports side-out no-score and side-out transfer", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
      serversPerSide: 2,
      initialServingSide: SCORING_SIDE.SIDE_A,
    });
    const d = deps();
    // Receiver wins → server 2, no point
    let result = record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d);
    state = result.state;
    assert.equal(state.points[SCORING_SIDE.SIDE_A], 0);
    assert.equal(state.points[SCORING_SIDE.SIDE_B], 0);
    assert.equal(state.serve.serverNumber, 2);
    assert.equal(result.event.eventType, SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE);
    // Receiver wins again → side out to B
    result = record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d);
    state = result.state;
    assert.equal(state.serve.servingSide, SCORING_SIDE.SIDE_B);
    assert.equal(state.serve.serverNumber, 1);
    // B scores while serving
    state = record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d).state;
    assert.equal(state.points[SCORING_SIDE.SIDE_B], 1);
  });
});

describe("CORE-16 lifecycle gating via CORE-15", () => {
  it("allows scoring only in IN_PROGRESS and uses assertScoringAllowed", () => {
    const state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
    });
    assert.doesNotThrow(() =>
      requireScoringLifecycleAllowed({
        lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
      })
    );
    assert.equal(
      assertScoringAllowed(MATCH_STATUS.IN_PROGRESS).ok,
      true
    );
    const result = record(state, SCORING_SIDE.SIDE_A);
    assert.equal(result.state.revision, 1);
  });

  it("denies PAUSED and SUSPENDED distinctly via CORE-15 codes", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    for (const status of [MATCH_STATUS.PAUSED, MATCH_STATUS.SUSPENDED]) {
      assert.throws(
        () => record(state, SCORING_SIDE.SIDE_A, status),
        (err) =>
          err instanceof MatchRuntimeError &&
          err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_SCORING_NOT_ALLOWED
      );
    }
    assert.notEqual(MATCH_STATUS.PAUSED, MATCH_STATUS.SUSPENDED);
  });

  it("denies all other non-IN_PROGRESS and terminal states; fails closed on missing", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const denied = [
      MATCH_STATUS.DRAFT,
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.READY_TO_START,
      MATCH_STATUS.POSTPONED,
      MATCH_STATUS.COMPLETED,
      MATCH_STATUS.CANCELLED,
    ];
    for (const status of denied) {
      assert.throws(() => record(state, SCORING_SIDE.SIDE_A, status), (err) => {
        return err instanceof MatchRuntimeError;
      });
    }
    assert.throws(
      () =>
        recordPoint(
          state,
          { scoringSide: SCORING_SIDE.SIDE_A, lifecycleStatus: null },
          deps()
        ),
      (err) =>
        err instanceof MatchRuntimeError &&
        err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT
    );
    assert.throws(
      () =>
        recordPoint(
          state,
          { scoringSide: SCORING_SIDE.SIDE_A },
          deps()
        ),
      (err) =>
        err instanceof MatchRuntimeError &&
        err.code === MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT
    );
  });
});

describe("CORE-16 correction, replay, events, errors", () => {
  it("preserves history on supersede and rebuilds projection", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
      bestOfGames: 1,
    });
    const d = deps();
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    state = record(state, SCORING_SIDE.SIDE_B, MATCH_STATUS.IN_PROGRESS, d).state;
    const targetId = state.events[0].eventId;
    const historyLen = state.events.length;
    const corrected = supersedeScoringEvent(
      state,
      {
        targetEventId: targetId,
        replacementScoringSide: SCORING_SIDE.SIDE_B,
        lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
        reason: "mis-attributed point",
      },
      d
    );
    assert.equal(corrected.state.events.length, historyLen + 1);
    assert.ok(corrected.state.supersededEventIds.includes(targetId));
    assert.equal(corrected.state.correctionLineage.length, 1);
    // Active points: B (original #2) + replacement B => 0-2
    assert.equal(corrected.state.points[SCORING_SIDE.SIDE_A], 0);
    assert.equal(corrected.state.points[SCORING_SIDE.SIDE_B], 2);
  });

  it("rejects invalid correction target", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    assert.throws(
      () =>
        supersedeScoringEvent(
          state,
          {
            targetEventId: "missing",
            lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
          },
          deps()
        ),
      (err) =>
        err.code === SCORING_ERROR_CODE.SCORING_INVALID_CORRECTION_TARGET
    );
  });

  it("rejects already-superseded correction target deterministically", () => {
    let state = inProgressState({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
    });
    const d = deps();
    state = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d).state;
    const targetId = state.events[0].eventId;
    state = supersedeScoringEvent(
      state,
      {
        targetEventId: targetId,
        lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
      },
      d
    ).state;
    assert.throws(
      () =>
        supersedeScoringEvent(
          state,
          {
            targetEventId: targetId,
            lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
          },
          d
        ),
      (err) =>
        err instanceof ScoringEngineError &&
        err.code === SCORING_ERROR_CODE.SCORING_EVENT_ALREADY_SUPERSEDED
    );
  });

  it("rejects duplicate sequence when revision is desynchronized", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const broken = Object.freeze({
      ...state,
      revision: 99,
      events: state.events,
    });
    assert.throws(
      () => record(broken, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, deps()),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_DUPLICATE_SEQUENCE
    );
  });

  it("does not mutate prior events or commands", () => {
    let state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const d = deps();
    const first = record(state, SCORING_SIDE.SIDE_A, MATCH_STATUS.IN_PROGRESS, d);
    state = first.state;
    const eventBefore = JSON.stringify(state.events[0]);
    const command = createRecordPointCommand({
      scoringSide: SCORING_SIDE.SIDE_B,
      lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
    });
    const commandBefore = JSON.stringify(command);
    state = recordPoint(state, command, d).state;
    assert.equal(JSON.stringify(state.events[0]), eventBefore);
    assert.equal(JSON.stringify(command), commandBefore);
    assert.equal(JSON.stringify(state.events), JSON.stringify(JSON.parse(JSON.stringify(state.events))));
  });

  it("deterministic replay and event ordering", () => {
    const sides = [
      SCORING_SIDE.SIDE_A,
      SCORING_SIDE.SIDE_B,
      SCORING_SIDE.SIDE_A,
      SCORING_SIDE.SIDE_A,
    ];
    const a = replayScoringProjection({
      matchId: "r1",
      format: {
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: 11,
      },
      scoringSides: sides,
    });
    const b = replayScoringProjection({
      matchId: "r1",
      format: {
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: 11,
      },
      scoringSides: sides,
    });
    assert.deepEqual(a.projection.points, b.projection.points);
    assert.equal(a.state.events[0].sequence, 1);
    assert.equal(a.state.events[1].sequence, 2);
    assert.equal(a.state.events[3].sequence, 4);
  });

  it("handles duplicate event id", () => {
    let state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const d = deps();
    state = recordPoint(
      state,
      {
        scoringSide: SCORING_SIDE.SIDE_A,
        lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
        clientEventId: "same-id",
      },
      d
    ).state;
    assert.throws(
      () =>
        recordPoint(
          state,
          {
            scoringSide: SCORING_SIDE.SIDE_B,
            lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
            clientEventId: "same-id",
          },
          d
        ),
      (err) => err.code === SCORING_ERROR_CODE.SCORING_DUPLICATE_EVENT
    );
  });

  it("uses injected clock and id factory deterministically", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const result = recordPoint(
      state,
      {
        scoringSide: SCORING_SIDE.SIDE_A,
        lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
      },
      {
        now: () => "FIXED_TS",
        nextId: () => "FIXED_ID",
      }
    );
    assert.equal(result.event.occurredAt, "FIXED_TS");
    assert.equal(result.event.eventId, "FIXED_ID");
  });

  it("requires injected clock/id when not provided", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    assert.throws(
      () =>
        recordPoint(state, {
          scoringSide: SCORING_SIDE.SIDE_A,
          lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
        }),
      (err) =>
        err.code === SCORING_ERROR_CODE.SCORING_CLOCK_REQUIRED ||
        err.code === SCORING_ERROR_CODE.SCORING_ID_FACTORY_REQUIRED
    );
  });

  it("exposes typed scoring errors and non-accepted projection", () => {
    assert.throws(
      () => createRecordPointCommand({ scoringSide: "X" }),
      (err) =>
        err instanceof ScoringEngineError &&
        err.code === SCORING_ERROR_CODE.SCORING_INVALID_SIDE
    );
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const projection = createScoringProjection(state);
    assert.equal(projection.validatedFinalResult, false);
    assert.equal(projection.acceptedFinalResult, false);
    assert.equal(projection.approvedFinalResult, false);
    assert.equal(projection.certifiedFinalResult, false);
    assert.equal(projection.officialFinalResult, false);
    assert.equal(projection.projectionKind, "CALCULATED_SCORE_ONLY");
    assert.equal(projection.calculatedMatchComplete, false);
  });

  it("executeScoringCommand dispatches RECORD_POINT", () => {
    const state = inProgressState({ scoringSystem: SCORING_SYSTEM.RALLY });
    const command = createRecordPointCommand({
      scoringSide: SCORING_SIDE.SIDE_A,
      lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
    });
    const result = executeScoringCommand(state, command, deps());
    assert.equal(result.state.points[SCORING_SIDE.SIDE_A], 1);
  });

  it("createSupersedeEventCommand validates target", () => {
    assert.throws(
      () => createSupersedeEventCommand({}),
      (err) =>
        err.code === SCORING_ERROR_CODE.SCORING_INVALID_CORRECTION_TARGET
    );
  });
});
