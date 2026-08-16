/**
 * Phase 2B — Adapter B canonical application-path cutover proofs.
 * Side-loaded from E2E-04 (CORE-08: no new unit-test-files.json rows).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPETITION_REFEREE_ADAPTER_INTEGRATION,
  COMPETITION_REFEREE_MODE,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ERROR_CODE,
  createCompetitionRuntimePorts,
  createDefaultCompetitionRefereeRuntime,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
  createTeamTournamentRefereeAdapter,
  isRefereeAdapterContractError,
  isRefereeOperationsError,
} from "../src/features/competition-engine/index.js";
import {
  SCORING_SIDE,
  createScoringFormat,
} from "../src/features/competition-core/scoring/index.js";

const CLOCK = "2026-07-24T00:00:00.000Z";
const ACTOR = Object.freeze({
  actorId: "11111111-1111-4111-8111-111111111111",
  authUid: "11111111-1111-4111-8111-111111111111",
  role: "REFEREE",
  refereeId: "11111111-1111-4111-8111-111111111111",
});
const OTHER_ACTOR = Object.freeze({
  actorId: "22222222-2222-4222-8222-222222222222",
  authUid: "22222222-2222-4222-8222-222222222222",
  role: "REFEREE",
  refereeId: "22222222-2222-4222-8222-222222222222",
});

const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

function ports() {
  return createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: () => [...GENERIC_REFEREE_ROLE_PERMISSIONS],
    },
  });
}

function createCutoverRuntime() {
  const driver = createSchemaFaithfulCanonicalRefereeDurableDriver({
    clockIso: CLOCK,
    allowTestDoubleDriver: true,
  });
  const runtime = createDefaultCompetitionRefereeRuntime({
    durableDriver: driver,
    allowTestDoubleDriver: true,
    runtimePorts: ports(),
    clockIso: CLOCK,
  });
  return { driver, runtime };
}

function dailyModeState(competitionId, matchId) {
  return {
    tenantId: "tenant-1",
    competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    venueId: "venue-1",
    clubId: "club-1",
    canonicalAssignmentAuthorityAvailable: true,
    session: {
      sessionId: competitionId,
      matchType: "mixed_double",
      skipScore: false,
      checkedInPlayerIds: ["p1", "p2", "p3", "p4"],
      enabledCourtIds: ["court-1"],
    },
    matches: {
      [matchId]: {
        matchId,
        status: "ready",
        courtId: "court-1",
        teamAPlayerIds: ["p1", "p2"],
        teamBPlayerIds: ["p3", "p4"],
        scoringRules: SCORING,
        lineupsLocked: true,
      },
    },
  };
}

function individualModeState(mode, competitionId, matchId) {
  return {
    tenantId: "tenant-1",
    competitionId,
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
      [matchId]: {
        matchId,
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
  };
}

function teamModeState(competitionId, matchId) {
  return {
    tenantId: "tenant-1",
    competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    venueId: "venue-1",
    clubId: "club-1",
    assignments: [
      {
        matchupId: matchId,
        scope: "parent",
        status: "active",
        refereeUserId: ACTOR.actorId,
      },
    ],
    matchups: {
      [matchId]: {
        matchupId: matchId,
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
            id: `db-${matchId}`,
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
  };
}

function modeFixture(mode) {
  const competitionId = `${mode.toLowerCase()}-app-1`;
  const matchId = `${mode.toLowerCase()}-match-1`;
  if (mode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    return {
      mode,
      competitionId,
      matchId,
      modeState: dailyModeState(competitionId, matchId),
    };
  }
  if (mode === COMPETITION_REFEREE_MODE.TEAM) {
    return {
      mode,
      competitionId,
      matchId,
      modeState: teamModeState(competitionId, matchId),
    };
  }
  return {
    mode,
    competitionId,
    matchId,
    modeState: individualModeState(mode, competitionId, matchId),
  };
}

async function runAssignedOpenAndScore(runtime, fixture, actor = ACTOR) {
  const scope = {
    tenantId: "tenant-1",
    competitionId: fixture.competitionId,
    matchId: fixture.matchId,
  };
  await runtime.assignmentRepository.upsert(
    { ...scope, refereeUserId: actor.actorId },
    actor
  );

  const cmdBase = {
    tenantId: scope.tenantId,
    competitionId: scope.competitionId,
    matchId: scope.matchId,
    venueId: "venue-1",
    actor,
    competitionMode: fixture.mode,
    modeState: fixture.modeState,
  };

  const opened = await runtime.facade.openAssignedMatch({
    ...cmdBase,
    commandId: `open-${fixture.mode}`,
  });
  assert.equal(opened.ok, true);

  const session = await runtime.facade.createScoreEntrySession({
    ...cmdBase,
    commandId: `score-session-${fixture.mode}`,
  });
  assert.equal(session.ok, true);
  assert.equal(session.session.state.format.pointsToWin, 11);

  return { scope, cmdBase, opened, session };
}

test("USES_ADAPTER_B_DEFAULT_PATH — default composition reaches all four Adapter B implementations", () => {
  const { runtime } = createCutoverRuntime();
  assert.equal(runtime.usesAdapterB, true);
  assert.equal(runtime.facade.usesAdapterB, true);
  assert.equal(runtime.stagingBackendCertified, false);
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.usesAdapterBProductionCutover,
    true
  );
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.stagingBackendCertified,
    false
  );

  const modes = [
    COMPETITION_REFEREE_MODE.DAILY_PLAY,
    COMPETITION_REFEREE_MODE.INTERNAL,
    COMPETITION_REFEREE_MODE.OFFICIAL,
    COMPETITION_REFEREE_MODE.TEAM,
  ];
  for (const mode of modes) {
    const adapter = runtime.modeAdapterRegistry.resolve(mode);
    assert.equal(adapter.competitionMode, mode);
    assert.equal(typeof adapter.getScoringRules, "function");
    assert.equal(typeof adapter.validatePreStart, "function");
    assert.equal(typeof adapter.resolveResultPropagation, "function");
  }
  assert.equal(runtime.modeAdapterRegistry.size(), 4);
});

for (const mode of [
  COMPETITION_REFEREE_MODE.DAILY_PLAY,
  COMPETITION_REFEREE_MODE.INTERNAL,
  COMPETITION_REFEREE_MODE.OFFICIAL,
  COMPETITION_REFEREE_MODE.TEAM,
]) {
  test(`application-path ${mode}: registry → Adapter B → facade → CORE path`, async () => {
    const { runtime } = createCutoverRuntime();
    const fixture = modeFixture(mode);
    const adapter = runtime.modeAdapterRegistry.resolve(mode);
    assert.equal(adapter.competitionMode, mode);

    const ctx = adapter.getCompetitionContext({
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      modeState: fixture.modeState,
    });
    assert.equal(ctx.competitionMode, mode);
    if (mode === COMPETITION_REFEREE_MODE.OFFICIAL) {
      assert.equal(ctx.eligibilityContext?.requiresRegistration, true);
    }

    const { cmdBase, session } = await runAssignedOpenAndScore(runtime, fixture);
    assert.ok(session.session.state);

    // Non-assigned referee denied (CORE-13)
    await assert.rejects(
      () =>
        runtime.facade.openAssignedMatch({
          ...cmdBase,
          actor: OTHER_ACTOR,
          commandId: `open-denied-${mode}`,
        }),
      (err) =>
        isRefereeOperationsError(err) &&
        err.code === REFEREE_ERROR_CODE.NOT_ASSIGNED
    );

    // Cross-tenant denied via Adapter B (translator boundary)
    assert.throws(
      () =>
        adapter.getCompetitionContext({
          tenantId: "other-tenant",
          competitionId: fixture.competitionId,
          modeState: fixture.modeState,
        }),
      (err) =>
        isRefereeAdapterContractError(err) &&
        err.code === REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
    );

    // Scoring rules reach canonical runtime via Adapter B (not silent Rally invent)
    const rules = adapter.getScoringRules({
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      modeState: fixture.modeState,
    });
    assert.equal(rules.pointsToWin, 11);
    assert.equal(session.session.state.format.pointsToWin, rules.pointsToWin);

    // Result propagation cannot bypass CORE-17
    const propagation = adapter.resolveResultPropagation({
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      modeState: fixture.modeState,
    });
    assert.equal(propagation.propagateOnlyIfAccepted, true);

    // Score to completion then prove force-propagate without accept fails closed
    let scored = session;
    while (!scored.session?.state?.matchComplete) {
      const point = await runtime.facade.submitScoreProjection({
        ...cmdBase,
        scoringSide: SCORING_SIDE.SIDE_A,
        points: 1,
        commandId: `pt-${mode}-${Date.now()}-${Math.random()}`,
      });
      scored = {
        session: {
          ...scored.session,
          state: point.scoreProjection
            ? {
                ...scored.session.state,
                matchComplete: point.matchComplete,
                calculatedWinnerSide: point.calculatedWinnerSide,
              }
            : scored.session.state,
          projection: point.scoreProjection,
        },
      };
      if (point.matchComplete) break;
      // Safety: SIDE_OUT to 11 can take many serves; force enough points
      if (!point.matchComplete) {
        // continue loop
      }
    }

    // Ensure match actually complete by flooding points if needed
    for (let i = 0; i < 30; i += 1) {
      const live = await runtime.opsStore.get("tenant-1", fixture.competitionId);
      if (live.scoreSessions?.[fixture.matchId]?.state?.matchComplete) break;
      await runtime.facade.submitScoreProjection({
        ...cmdBase,
        scoringSide: SCORING_SIDE.SIDE_A,
        points: 1,
        commandId: `flood-${mode}-${i}`,
      });
    }

    const live = await runtime.opsStore.get("tenant-1", fixture.competitionId);
    assert.equal(
      live.scoreSessions?.[fixture.matchId]?.state?.matchComplete,
      true
    );

    await assert.rejects(
      () =>
        runtime.facade.submitMatchResultForValidation({
          ...cmdBase,
          forcePropagateWithoutAccept: true,
          acceptResult: false,
          commandId: `bypass-${mode}`,
        }),
      (err) =>
        isRefereeOperationsError(err) &&
        err.code === REFEREE_ERROR_CODE.VALIDATION_PRECONDITION
    );

    const accepted = await runtime.facade.submitMatchResultForValidation({
      ...cmdBase,
      acceptResult: true,
      commandId: `accept-${mode}`,
    });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.standingsEligible, true);
  });
}

test("canonical actor required on Adapter B application path", async () => {
  const { runtime } = createCutoverRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.INTERNAL);
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      refereeUserId: ACTOR.actorId,
    },
    ACTOR
  );

  await assert.rejects(
    () =>
      runtime.facade.openAssignedMatch({
        tenantId: "tenant-1",
        competitionId: fixture.competitionId,
        matchId: fixture.matchId,
        competitionMode: fixture.mode,
        modeState: fixture.modeState,
        actor: { role: "REFEREE" },
        commandId: "missing-actor",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      (err.code === REFEREE_ERROR_CODE.MISSING_IDENTITY ||
        err.code === REFEREE_ERROR_CODE.FUZZY_IDENTITY_REJECTED ||
        err.code === REFEREE_ERROR_CODE.PERMISSION_DENIED)
  );
});

test("unknown mode and malformed mode state fail closed — no silent legacy fallback", async () => {
  const { runtime } = createCutoverRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.INTERNAL);
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      refereeUserId: ACTOR.actorId,
    },
    ACTOR
  );

  await assert.rejects(
    () =>
      runtime.facade.openAssignedMatch({
        tenantId: "tenant-1",
        competitionId: fixture.competitionId,
        matchId: fixture.matchId,
        actor: ACTOR,
        competitionMode: "UNKNOWN_MODE_X",
        modeState: fixture.modeState,
        commandId: "unknown-mode",
      }),
    (err) =>
      isRefereeAdapterContractError(err) &&
      err.code === REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MODE
  );

  await assert.rejects(
    () =>
      runtime.facade.openAssignedMatch({
        tenantId: "tenant-1",
        competitionId: fixture.competitionId,
        matchId: fixture.matchId,
        actor: ACTOR,
        competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
        // missing modeState
        commandId: "missing-mode-state",
      }),
    (err) =>
      isRefereeAdapterContractError(err) &&
      err.code === REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT
  );

  // Daily Play without canonical assignment authority fails closed (no legacy score path)
  const daily = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  daily.modeState = {
    ...daily.modeState,
    canonicalAssignmentAuthorityAvailable: false,
  };
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-1",
      competitionId: daily.competitionId,
      matchId: daily.matchId,
      refereeUserId: ACTOR.actorId,
    },
    ACTOR
  );
  await assert.rejects(
    () =>
      runtime.facade.openAssignedMatch({
        tenantId: "tenant-1",
        competitionId: daily.competitionId,
        matchId: daily.matchId,
        actor: ACTOR,
        competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
        modeState: daily.modeState,
        commandId: "daily-no-core13",
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.PRECONDITION_FAILED &&
      err.details?.silentLegacyFallback === false
  );
});

test("expectedVersion/CAS remains required on durable Adapter B composition", async () => {
  const { runtime } = createCutoverRuntime();
  const scope = {
    tenantId: "tenant-1",
    competitionId: "cas-comp-1",
    matchId: "cas-match-1",
  };
  await runtime.assignmentRepository.upsert(
    { ...scope, refereeUserId: ACTOR.actorId },
    ACTOR
  );

  await runtime.matchStateRepository.putLiveState(
    {
      ...scope,
      status: "in_progress",
      statePayload: { canonical: { marker: "cas-base" } },
      idempotencyKey: "cas-state-1",
    },
    ACTOR
  );
  const live = await runtime.matchStateRepository.getLiveState(scope);
  assert.ok(live);

  await assert.rejects(() =>
    runtime.matchStateRepository.putLiveState(
      {
        ...scope,
        expectedVersion: 99,
        statePayload: { canonical: { marker: "stale" } },
        idempotencyKey: "cas-stale",
      },
      ACTOR
    )
  );

  const event = await runtime.scoringEventLedger.appendEvent(
    { ...scope, payload: { cmd: "POINT" }, idempotencyKey: "cas-cmd-1" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  const replay = await runtime.scoringEventLedger.appendEvent(
    { ...scope, payload: { cmd: "POINT" }, idempotencyKey: "cas-cmd-1" },
    ACTOR
  );
  assert.equal(replay.duplicate, true);
});

test("Team Adapter B preserves parent SSOT / DreamBreaker inheritance projection", () => {
  const { runtime } = createCutoverRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.TEAM);
  const registryAdapter = runtime.modeAdapterRegistry.resolve(
    COMPETITION_REFEREE_MODE.TEAM
  );
  assert.equal(registryAdapter.competitionMode, COMPETITION_REFEREE_MODE.TEAM);

  const caps = registryAdapter.getCapabilities({
    tenantId: "tenant-1",
    competitionId: fixture.competitionId,
    matchId: fixture.matchId,
    modeState: fixture.modeState,
  });
  assert.equal(caps.dreambreakerInheritsParent, true);
  assert.equal(caps.ownsScoringAuthority, false);
  assert.equal(caps.ownsResultAuthority, false);

  const lifecycle = registryAdapter.getLifecyclePolicy({
    tenantId: "tenant-1",
    competitionId: fixture.competitionId,
    matchId: fixture.matchId,
    modeState: fixture.modeState,
  });
  assert.equal(lifecycle.requiresAssignment, true);
  assert.equal(lifecycle.standingsRequireAcceptedResult, true);

  // projectWritePolicy is a Team translator helper (not End A required method)
  const adapter = createTeamTournamentRefereeAdapter({
    modeState: fixture.modeState,
  });
  const parentPolicy = adapter.projectWritePolicy(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
    },
    { refereeUserId: ACTOR.actorId }
  );
  assert.equal(parentPolicy.allowed, true);
  assert.equal(parentPolicy.authority, false);

  const dbPolicy = adapter.projectWritePolicy(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: `db-${fixture.matchId}`,
    },
    { refereeUserId: ACTOR.actorId }
  );
  assert.equal(dbPolicy.allowed, true);
});
