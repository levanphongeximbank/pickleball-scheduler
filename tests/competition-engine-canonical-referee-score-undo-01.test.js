/**
 * PICK_VN — Canonical Referee Score Undo Capability 01
 * Shared UNDO_LAST_SCORING_ACTION via E2E-04 → CORE-16 SUPERSEDE_EVENT.
 *
 * Side-loaded from E2E-04 CI entry (CORE-08 registry-addition gate).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import {
  SCORING_EVENT_TYPE,
  SCORING_SIDE,
  SCORING_SYSTEM,
} from "../src/features/competition-core/scoring/index.js";
import {
  CANONICAL_REFEREE_COMMAND,
  COMPETITION_REFEREE_MODE,
  createCompetitionRefereeModeAdapterRegistry,
  createCompetitionRuntimePorts,
  createInMemoryRefereeOperationsStore,
  createRefereeCompetitionOperationsFacade,
  executeCanonicalRefereeCommand,
  isRefereeOperationsError,
  REFEREE_ERROR_CODE,
  REFEREE_VALIDATION_OPS_STATUS,
  resolveCanonicalRefereeFacadeMethod,
} from "../src/features/competition-engine/index.js";

function createPorts(extraPermissions = []) {
  return createCompetitionRuntimePorts({
    permissionResolver: {
      async resolvePermissions() {
        return [
          PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_READ,
          PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_ACKNOWLEDGE,
          PERMISSIONS.COMPETITION_REFEREE_MATCH_CONTROL,
          PERMISSIONS.COMPETITION_REFEREE_SCORE_SUBMIT,
          PERMISSIONS.COMPETITION_REFEREE_RESULT_SUBMIT,
          PERMISSIONS.COMPETITION_REFEREE_RESULT_CORRECT,
          PERMISSIONS.COMPETITION_REFEREE_RESULT_READ,
          ...extraPermissions,
        ];
      },
    },
  });
}

function refereeActor(overrides = {}) {
  return {
    actorId: "ref-1",
    role: "REFEREE",
    refereeId: "ref-1",
    ...overrides,
  };
}

function baseScope(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    venueId: "venue-1",
    ...overrides,
  };
}

function openingCourt(overrides = {}) {
  return {
    playerPositions: {
      sideA: ["a1", "a2"],
      sideB: ["b1", "b2"],
    },
    homePlayerPositions: {
      sideA: ["a1", "a2"],
      sideB: ["b1", "b2"],
    },
    servingSide: SCORING_SIDE.SIDE_A,
    serverNumber: 1,
    serverPlayerId: "a1",
    receiverPlayerId: "b1",
    lineupConfigured: true,
    orientation: "STANDARD",
    sideChangeRequired: false,
    sideChangeAcknowledgedAtThreshold: null,
    sideChangeThreshold: null,
    ...overrides,
  };
}

async function bootReferee(options = {}) {
  const store = createInMemoryRefereeOperationsStore({
    clockIso: "2026-08-17T12:00:00.000Z",
  });
  const modeAdapterRegistry =
    options.modeAdapterRegistry ||
    (options.usesAdapterB
      ? createCompetitionRefereeModeAdapterRegistry()
      : null);
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: createPorts(options.extraPermissions || []),
    clockIso: "2026-08-17T12:00:00.000Z",
    store,
    usesAdapterB: options.usesAdapterB === true,
    modeAdapterRegistry,
    runtime: options.usesAdapterB
      ? {
          usesAdapterB: true,
          modeAdapterRegistry,
          classification: "TEST_DOUBLE_ONLY",
        }
      : undefined,
  });

  const modeFields =
    options.usesAdapterB === true
      ? {
          competitionMode: options.competitionMode || null,
          modeState: options.modeState || null,
        }
      : {};

  await referee.seedAssignments({
    ...baseScope(),
    actor: refereeActor(),
    ...modeFields,
    assignments: [
      {
        matchId: "m-1",
        refereeId: "ref-1",
        courtId: "c1",
        entries: [
          { entryId: "entry-a", participantId: "a1" },
          { entryId: "entry-b", participantId: "b1" },
        ],
      },
    ],
    courtsByMatch: {
      "m-1": openingCourt(options.courtOverrides || {}),
    },
  });

  await referee.openAssignedMatch({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    ...modeFields,
  });

  await referee.createScoreEntrySession({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    scoringSystem: options.scoringSystem || SCORING_SYSTEM.RALLY,
    pointsToWin: options.pointsToWin || 11,
    winBy: options.winBy || 2,
    sideSwitchAt: options.sideSwitchAt ?? null,
    trackServe: options.trackServe !== false,
    serversPerSide: options.serversPerSide || 2,
    initialServingSide: options.initialServingSide || SCORING_SIDE.SIDE_A,
    ...modeFields,
  });

  return { referee, store, modeFields };
}

async function score(referee, scoringSide, points = 1, modeFields = {}) {
  const record = await referee.store.get("tenant-1", "comp-1");
  return referee.submitScoreProjection({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    scoringSide,
    points,
    expectedVersion: record.revision,
    ...modeFields,
  });
}

async function undo(referee, overrides = {}) {
  const record = await referee.store.get("tenant-1", "comp-1");
  return referee.undoLastScoringAction({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    expectedVersion: record.revision,
    idempotencyKey: overrides.idempotencyKey || `undo-${overrides.seq || "1"}`,
    ...overrides,
  });
}

test("canonical command map resolves UNDO_LAST_SCORING_ACTION", () => {
  assert.equal(
    resolveCanonicalRefereeFacadeMethod(
      CANONICAL_REFEREE_COMMAND.UNDO_LAST_SCORING_ACTION
    ),
    "undoLastScoringAction"
  );
});

test("RALLY 1-4: +Point then Undo restores score/serve/server/positions", async () => {
  const { referee, store } = await bootReferee({
    scoringSystem: SCORING_SYSTEM.RALLY,
    trackServe: true,
  });
  const before = await store.get("tenant-1", "comp-1");
  const priorCourt = before.courtsByMatch["m-1"];
  const scored = await score(referee, SCORING_SIDE.SIDE_A, 1);
  assert.equal(scored.scoreProjection.points.SIDE_A, 1);
  assert.equal(scored.court.serverPlayerId, "a1");

  const undone = await undo(referee, { idempotencyKey: "undo-rally-1" });
  assert.equal(undone.ok, true);
  assert.equal(undone.originalEventPreserved, true);
  assert.equal(undone.correctionEventType, SCORING_EVENT_TYPE.EVENT_SUPERSEDED);
  assert.equal(undone.scoreProjection.points.SIDE_A, 0);
  assert.equal(undone.scoreProjection.points.SIDE_B, 0);
  assert.equal(undone.court.serverPlayerId, priorCourt.serverPlayerId);
  assert.deepEqual(
    undone.court.playerPositions.sideA,
    priorCourt.playerPositions.sideA
  );
  assert.deepEqual(
    undone.court.playerPositions.sideB,
    priorCourt.playerPositions.sideB
  );
  assert.equal(undone.court.servingSide, SCORING_SIDE.SIDE_A);
});

test("SIDE_OUT 5-10: serving point / turn1→2 / side-out restore serve+server+positions", async () => {
  const { referee, store } = await bootReferee({
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    trackServe: true,
    serversPerSide: 2,
  });

  // Serving team A scores → point + swap positions, same server.
  const scored = await score(referee, SCORING_SIDE.SIDE_A, 1);
  assert.equal(scored.scoreProjection.points.SIDE_A, 1);
  const afterPoint = await store.get("tenant-1", "comp-1");
  assert.equal(afterPoint.scoreSessions["m-1"].state.serve.serverNumber, 1);

  let undone = await undo(referee, { idempotencyKey: "undo-sideout-point" });
  assert.equal(undone.scoreProjection.points.SIDE_A, 0);
  assert.equal(undone.court.serverPlayerId, "a1");
  assert.deepEqual(undone.court.playerPositions.sideA, ["a1", "a2"]);

  // turn1 → turn2 (receiving wins, no point)
  await score(referee, SCORING_SIDE.SIDE_B, 1);
  const mid = await store.get("tenant-1", "comp-1");
  assert.equal(mid.scoreSessions["m-1"].state.serve.serverNumber, 2);
  assert.equal(mid.scoreSessions["m-1"].state.points.SIDE_A, 0);
  assert.equal(mid.scoreSessions["m-1"].state.points.SIDE_B, 0);
  undone = await undo(referee, { idempotencyKey: "undo-sideout-turn" });
  assert.equal(undone.scoreProjection.serve.serverNumber, 1);
  assert.equal(undone.court.serverPlayerId, "a1");

  // Force side-out possession change: turn2 then receiving wins again.
  await score(referee, SCORING_SIDE.SIDE_B, 1); // → server 2
  await score(referee, SCORING_SIDE.SIDE_B, 1); // → side-out to B
  const afterSideOut = await store.get("tenant-1", "comp-1");
  assert.equal(
    afterSideOut.scoreSessions["m-1"].state.serve.servingSide,
    SCORING_SIDE.SIDE_B
  );
  assert.equal(afterSideOut.scoreSessions["m-1"].state.serve.serverNumber, 1);
  undone = await undo(referee, { idempotencyKey: "undo-sideout-possession" });
  assert.equal(undone.scoreProjection.serve.servingSide, SCORING_SIDE.SIDE_A);
  assert.equal(undone.scoreProjection.serve.serverNumber, 2);
  assert.ok(undone.court.serverPlayerId);
});

test("CHANGE END 11-12: 10:5→11:5 due then Undo clears due; ACK rejects quick undo", async () => {
  const { referee, store } = await bootReferee({
    scoringSystem: SCORING_SYSTEM.RALLY,
    trackServe: true,
    sideSwitchAt: 11,
    pointsToWin: 21,
  });

  for (let i = 0; i < 10; i += 1) await score(referee, SCORING_SIDE.SIDE_A, 1);
  for (let i = 0; i < 5; i += 1) await score(referee, SCORING_SIDE.SIDE_B, 1);
  let record = await store.get("tenant-1", "comp-1");
  assert.equal(record.scoreSessions["m-1"].state.points.SIDE_A, 10);
  assert.equal(record.scoreSessions["m-1"].state.points.SIDE_B, 5);
  assert.equal(record.courtsByMatch["m-1"].sideChangeRequired, false);

  const due = await score(referee, SCORING_SIDE.SIDE_A, 1);
  assert.equal(due.scoreProjection.points.SIDE_A, 11);
  assert.equal(due.court.sideChangeRequired, true);

  const undone = await undo(referee, { idempotencyKey: "undo-change-end-due" });
  assert.equal(undone.scoreProjection.points.SIDE_A, 10);
  assert.equal(undone.scoreProjection.points.SIDE_B, 5);
  assert.equal(undone.court.sideChangeRequired, false);
  assert.equal(undone.court.orientation, "STANDARD");

  // Re-score to due, ACK change ends, then quick undo must fail-closed.
  await score(referee, SCORING_SIDE.SIDE_A, 1);
  record = await store.get("tenant-1", "comp-1");
  assert.equal(record.courtsByMatch["m-1"].sideChangeRequired, true);
  await referee.confirmChangeEnds({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    expectedVersion: record.revision,
    idempotencyKey: "ack-change-ends-1",
  });
  await assert.rejects(
    () => undo(referee, { idempotencyKey: "undo-after-ack" }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.FAIL_CLOSED_UNSUPPORTED_FOR_QUICK_UNDO
  );
});

test("SAFETY 13-20: stale / idempotency / authz / tenant / completed / accepted / latest / F5", async () => {
  const { referee, store } = await bootReferee({
    scoringSystem: SCORING_SYSTEM.RALLY,
    trackServe: true,
  });
  await score(referee, SCORING_SIDE.SIDE_A, 1);
  let record = await store.get("tenant-1", "comp-1");

  await assert.rejects(
    () =>
      referee.undoLastScoringAction({
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-1",
        expectedVersion: Number(record.revision) - 1,
        idempotencyKey: "stale-1",
      }),
    (err) =>
      isRefereeOperationsError(err) && err.code === REFEREE_ERROR_CODE.STALE_WRITE
  );

  const first = await undo(referee, { idempotencyKey: "dup-undo-1" });
  assert.equal(first.idempotent, false);
  record = await store.get("tenant-1", "comp-1");
  const versionAfter = record.revision;
  const second = await referee.undoLastScoringAction({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    expectedVersion: versionAfter,
    idempotencyKey: "dup-undo-1",
  });
  assert.equal(second.idempotent, true);
  assert.equal(second.targetEventId, first.targetEventId);
  const afterDup = await store.get("tenant-1", "comp-1");
  assert.equal(afterDup.revision, versionAfter);
  assert.equal(afterDup.scoreSessions["m-1"].state.points.SIDE_A, 0);

  await assert.rejects(
    () =>
      referee.undoLastScoringAction({
        ...baseScope(),
        actor: refereeActor({ actorId: "intruder", refereeId: "intruder" }),
        matchId: "m-1",
        expectedVersion: afterDup.revision,
        idempotencyKey: "unauth-1",
      }),
    (err) => isRefereeOperationsError(err)
  );

  await assert.rejects(
    () =>
      referee.undoLastScoringAction({
        ...baseScope({ tenantId: "other-tenant" }),
        actor: refereeActor(),
        matchId: "m-1",
        expectedVersion: 0,
        idempotencyKey: "x-tenant-1",
      }),
    (err) => isRefereeOperationsError(err)
  );

  // Latest-only: score twice, undo once → only latest reversed.
  await score(referee, SCORING_SIDE.SIDE_A, 1);
  await score(referee, SCORING_SIDE.SIDE_B, 1);
  record = await store.get("tenant-1", "comp-1");
  assert.equal(record.scoreSessions["m-1"].state.points.SIDE_A, 1);
  assert.equal(record.scoreSessions["m-1"].state.points.SIDE_B, 1);
  const latestUndo = await undo(referee, { idempotencyKey: "latest-only" });
  assert.equal(latestUndo.scoreProjection.points.SIDE_A, 1);
  assert.equal(latestUndo.scoreProjection.points.SIDE_B, 0);

  // F5 / fresh reconstruct from store
  const f5 = await store.get("tenant-1", "comp-1");
  assert.equal(f5.scoreSessions["m-1"].state.points.SIDE_A, 1);
  assert.equal(f5.scoreSessions["m-1"].state.points.SIDE_B, 0);
  assert.equal(
    f5.scoreSessions["m-1"].state.events.some(
      (e) => e.eventType === SCORING_EVENT_TYPE.EVENT_SUPERSEDED
    ),
    true
  );
  assert.ok(
    f5.scoreSessions["m-1"].state.supersededEventIds.length >= 1
  );

  // Accepted result boundary
  for (let i = 0; i < 10; i += 1) await score(referee, SCORING_SIDE.SIDE_A, 1);
  await referee.submitMatchResultForValidation({
    ...baseScope(),
    actor: refereeActor(),
    matchId: "m-1",
    acceptResult: true,
  });
  await assert.rejects(
    () => undo(referee, { idempotencyKey: "after-accepted" }),
    (err) =>
      isRefereeOperationsError(err) &&
      (err.code === REFEREE_ERROR_CODE.RESULT_BOUNDARY_BLOCKED ||
        err.code === REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE ||
        err.code === REFEREE_ERROR_CODE.UNDO_NOT_ELIGIBLE)
  );

  // Completed lifecycle boundary (fresh match)
  const completed = await bootReferee({ scoringSystem: SCORING_SYSTEM.RALLY });
  await score(completed.referee, SCORING_SIDE.SIDE_A, 1);
  await completed.store.update("tenant-1", "comp-1", (draft) => {
    draft.matches["m-1"] = {
      ...draft.matches["m-1"],
      status: MATCH_STATUS.COMPLETED,
    };
  });
  await assert.rejects(
    () => undo(completed.referee, { idempotencyKey: "completed-1" }),
    (err) =>
      isRefereeOperationsError(err) &&
      (err.code === REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE ||
        err.code === REFEREE_ERROR_CODE.LIFECYCLE_BOUNDARY_BLOCKED)
  );
});

test("MODES 21-25: shared undo across Daily/Internal/Official/Team/DreamBreaker scoring", async () => {
  const registry = createCompetitionRefereeModeAdapterRegistry();
  for (const mode of [
    COMPETITION_REFEREE_MODE.DAILY_PLAY,
    COMPETITION_REFEREE_MODE.INTERNAL,
    COMPETITION_REFEREE_MODE.OFFICIAL,
    COMPETITION_REFEREE_MODE.TEAM,
  ]) {
    assert.ok(registry.resolve(mode), mode);
  }

  const modeConfigs = [
    {
      label: "DAILY_PLAY",
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
    },
    {
      label: "INTERNAL",
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
    },
    {
      label: "OFFICIAL",
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
    },
    {
      label: "TEAM",
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 11,
    },
    {
      label: "TEAM_DREAMBREAKER",
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 7,
      winBy: 1,
    },
  ];

  for (const cfg of modeConfigs) {
    const { referee } = await bootReferee({
      scoringSystem: cfg.scoringSystem,
      pointsToWin: cfg.pointsToWin,
      winBy: cfg.winBy || 2,
      trackServe: true,
    });
    await score(referee, SCORING_SIDE.SIDE_A, 1);
    const undone = await executeCanonicalRefereeCommand(
      referee,
      CANONICAL_REFEREE_COMMAND.UNDO_LAST_SCORING_ACTION,
      {
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-1",
        expectedVersion: (await referee.store.get("tenant-1", "comp-1"))
          .revision,
        idempotencyKey: `mode-undo-${cfg.label}`,
      }
    );
    assert.equal(undone.ok, true, cfg.label);
    assert.equal(undone.scoreProjection.points.SIDE_A, 0, cfg.label);
  }
});

test("REGRESSION 26-30: submitPoint path untouched; command executor; no accepted status leak", async () => {
  const { referee, store } = await bootReferee({
    scoringSystem: SCORING_SYSTEM.RALLY,
    trackServe: true,
  });
  const scored = await score(referee, SCORING_SIDE.SIDE_B, 1);
  assert.equal(scored.ok, true);
  assert.equal(scored.scoreProjection.points.SIDE_B, 1);
  assert.equal(scored.winnerInferenceByFacade, false);

  const undone = await executeCanonicalRefereeCommand(
    referee,
    "undoLastScoringAction",
    {
      ...baseScope(),
      actor: refereeActor(),
      matchId: "m-1",
      expectedVersion: (await store.get("tenant-1", "comp-1")).revision,
      idempotencyKey: "reg-undo-1",
    }
  );
  assert.equal(undone.ok, true);
  assert.notEqual(
    undone.command,
    REFEREE_VALIDATION_OPS_STATUS.ACCEPTED
  );

  // Change-end regression: without due flag, confirmChangeEnds rejects.
  const current = await store.get("tenant-1", "comp-1");
  await assert.rejects(
    () =>
      referee.confirmChangeEnds({
        ...baseScope(),
        actor: refereeActor(),
        matchId: "m-1",
        expectedVersion: current.revision,
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.PRECONDITION_FAILED
  );
});
