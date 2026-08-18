/**
 * Shared Referee Runtime — match execution initialization capability.
 * Contract #08 unchanged. CORE-13 assignment authority unchanged.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createScoringFormat } from "../../src/features/competition-core/scoring/index.js";
import { COMPETITION_REFEREE_MODE } from "../../src/features/competition-engine/integration/referee/constants.js";
import { createDailyPlayRefereeAdapter } from "../../src/features/competition-engine/integration/referee/adapters/DailyPlayRefereeAdapter.js";
import { createInternalTournamentRefereeAdapter } from "../../src/features/competition-engine/integration/referee/adapters/InternalTournamentRefereeAdapter.js";
import { createOfficialTournamentRefereeAdapter } from "../../src/features/competition-engine/integration/referee/adapters/OfficialTournamentRefereeAdapter.js";
import { createTeamTournamentRefereeAdapter } from "../../src/features/competition-engine/integration/referee/adapters/TeamTournamentRefereeAdapter.js";
import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../../src/features/referee-v5/constants/eventTypes.js";
import { STATE_SCHEMA_VERSION } from "../../src/features/referee-v5/constants/stateSchema.js";
import { initializeMatchExecutionState } from "../../src/features/referee-v5/execution/initializeMatchExecutionState.js";
import { authorizeMatchExecutionInit } from "../../src/features/referee-v5/execution/authorizeMatchExecutionInit.js";
import {
  MATCH_EXECUTION_INIT_RPC,
  MATCH_LIVE_STATES_CLASSIFICATION,
  SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
} from "../../src/features/referee-v5/execution/matchExecutionInitPolicy.js";
import { InMemoryMatchRepository } from "../../src/features/referee-v5/persistence/InMemoryMatchRepository.js";
import { REFEREE_V5_ERROR } from "../../src/features/referee-v5/persistence/errors.js";
import { buildMatchStateId } from "../../src/features/referee-v5/persistence/matchStateSerializer.js";
import { RefereeV5PersistenceService } from "../../src/features/referee-v5/persistence/RefereeV5PersistenceService.js";
import { validatePersistedMatchState } from "../../src/features/referee-v5/persistence/validatePersistedState.js";
import { validateStateSchemaVersion } from "../../src/features/referee-v5/persistence/validateStateSchema.js";
import {
  assertInternalRpcAllowed,
  isPublicBrowserRpc,
  refereeV5InitializeMatchExecutionState,
  REFEREE_V5_INTERNAL_RPC_NAMES,
} from "../../src/features/referee-v5/services/refereeV5InternalRpcService.js";
import { findSecretCandidates } from "../../scripts/phase5d-br01-br10/secret-scanner.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SQL_DIR = path.join(
  ROOT,
  "docs/v5/migrations/shared-referee-match-execution-init-capability-01"
);
const EXEC_DIR = path.join(ROOT, "src/features/referee-v5/execution");

const TENANT = "tenant-1";
const TOURNAMENT = "internal-comp-1";
const MATCH = "match-1";

const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

function organizer(tenantId = TENANT) {
  return { actorId: "organizer-1", tenantId, role: "ORGANIZER" };
}

function individualFixtures(mode, overrides = {}) {
  return {
    tenantId: TENANT,
    competitionId: `${mode.toLowerCase()}-comp-1`,
    competitionMode: mode,
    competitionType:
      mode === COMPETITION_REFEREE_MODE.OFFICIAL
        ? "official_tournament"
        : "internal_tournament",
    venueId: "venue-1",
    clubId: "club-1",
    matches: {
      [MATCH]: {
        matchId: MATCH,
        status: "READY_TO_START",
        courtId: "court-2",
        stage: "POOL",
        round: 1,
        eventId: "event-1",
        entryAId: "entry-a",
        entryBId: "entry-b",
        participantIdsA: ["p-a1", "p-a2"],
        participantIdsB: ["p-b1", "p-b2"],
        scoringRules: SCORING,
        lineupsLocked: true,
      },
      "match-singles": {
        matchId: "match-singles",
        status: "READY_TO_START",
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

function dailyFixtures() {
  return {
    tenantId: TENANT,
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
      [MATCH]: {
        matchId: MATCH,
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

function teamFixtures() {
  return {
    tenantId: TENANT,
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
        ],
      },
    },
  };
}

function internalAdapter(overrides) {
  return createInternalTournamentRefereeAdapter({
    modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL, overrides),
  });
}

async function initInternal(overrides = {}) {
  const repository = overrides.repository || new InMemoryMatchRepository();
  const result = await initializeMatchExecutionState({
    tenantId: overrides.tenantId || TENANT,
    tournamentId: overrides.tournamentId || TOURNAMENT,
    matchId: overrides.matchId || MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    actor: overrides.actor || organizer(overrides.tenantId || TENANT),
    idempotencyKey: overrides.idempotencyKey || "init-internal-1",
    adapter: overrides.adapter || internalAdapter(),
    adapterRequest: overrides.adapterRequest,
    repository,
    rpcClient: overrides.rpcClient,
  });
  return { repository, result };
}

async function withGlobalWindow(run) {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previous = hadWindow ? globalThis.window : undefined;
  globalThis.window = { supabaseEdgeExposesWindow: true };
  try {
    return await run();
  } finally {
    if (hadWindow) globalThis.window = previous;
    else delete globalThis.window;
  }
}

test("capability identity is shared referee execution initialization", () => {
  assert.equal(
    SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION,
    "SHARED_REFEREE_MATCH_EXECUTION_INITIALIZATION"
  );
  assert.equal(MATCH_LIVE_STATES_CLASSIFICATION, "REFEREE_MATCH_EXECUTION_STATE");
  assert.equal(MATCH_EXECUTION_INIT_RPC, "referee_v5_initialize_match_execution_state");
});

test("valid canonical INTERNAL match initializes one live execution state", async () => {
  const { repository, result } = await initInternal();
  assert.equal(result.ok, true);
  assert.equal(result.initialized, true);
  assert.equal(result.reset, false);
  assert.equal(result.status, MATCH_STATUS.NOT_STARTED);
  assert.equal(result.stateVersion, 0);
  assert.equal(result.lastEventSequence, 0);
  assert.equal(result.state.matchId, MATCH);
  assert.equal(result.state.stateSchemaVersion, STATE_SCHEMA_VERSION);
  assert.equal(validateStateSchemaVersion(result.state).ok, true);
  assert.equal(validatePersistedMatchState(result.state).ok, true);
  assert.equal(repository.liveStates.size, 1);
  const live = repository.getLiveState(buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH }));
  assert.equal(live.status, MATCH_STATUS.NOT_STARTED);
  assert.equal(repository.getEvents(live.matchId).length, 0);
});

test("unknown match denied", async () => {
  const { result } = await initInternal({ matchId: "missing-match" });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.MATCH_NOT_FOUND);
});

test("wrong tenant denied", async () => {
  const { result } = await initInternal({
    tenantId: "tenant-b",
    actor: organizer("tenant-b"),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
});

test("wrong tournament binding denied", async () => {
  const { result } = await initInternal({ tournamentId: "other-tournament" });
  assert.equal(result.ok, false);
  assert.ok(
    result.code === REFEREE_V5_ERROR.MATCH_STATE_CONFLICT ||
      result.code === REFEREE_V5_ERROR.MATCH_NOT_FOUND ||
      result.code === REFEREE_V5_ERROR.VALIDATION_DENIED
  );
});

test("missing Adapter B context denied", async () => {
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    actor: organizer(),
    idempotencyKey: "k-missing-adapter",
    repository: new InMemoryMatchRepository(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.NOT_CONFIGURED);
});

test("duplicate same idempotency key succeeds deterministically", async () => {
  const repository = new InMemoryMatchRepository();
  const first = await initInternal({ repository, idempotencyKey: "same-key" });
  const second = await initInternal({ repository, idempotencyKey: "same-key" });
  assert.equal(first.result.ok, true);
  assert.equal(second.result.ok, true);
  assert.equal(second.result.duplicate, true);
  assert.equal(second.result.reset, false);
  assert.equal(first.result.stateHash, second.result.stateHash);
  assert.equal(repository.liveStates.size, 1);
});

test("idempotency-key payload mismatch denied", async () => {
  const repository = new InMemoryMatchRepository();
  const first = await initInternal({ repository, idempotencyKey: "payload-key" });
  assert.equal(first.result.ok, true);
  const otherAdapter = createInternalTournamentRefereeAdapter({
    modeState: individualFixtures(COMPETITION_REFEREE_MODE.INTERNAL, {
      matches: {
        [MATCH]: {
          matchId: MATCH,
          status: "READY_TO_START",
          entryAId: "entry-x",
          entryBId: "entry-y",
          participantIdsA: ["x1", "x2"],
          participantIdsB: ["y1", "y2"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    }),
  });
  const second = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    actor: organizer(),
    idempotencyKey: "payload-key",
    adapter: otherAdapter,
    repository,
  });
  assert.equal(second.ok, false);
  assert.equal(second.code, REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
  const live = repository.getLiveState(
    buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH })
  );
  assert.equal(live.statePayload.teams.teamA.players[0].playerId, "p-a1");
});

test("concurrent initialization cannot create two logical states", async () => {
  const repository = new InMemoryMatchRepository();
  const [a, b] = await Promise.all([
    initializeMatchExecutionState({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      actor: organizer(),
      idempotencyKey: "concurrent-key",
      adapter: internalAdapter(),
      repository,
    }),
    initializeMatchExecutionState({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      actor: organizer(),
      idempotencyKey: "concurrent-key",
      adapter: internalAdapter(),
      repository,
    }),
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(repository.liveStates.size, 1);
  assert.equal(a.reset, false);
  assert.equal(b.reset, false);
});

test("already initialized coherent state is not reset", async () => {
  const repository = new InMemoryMatchRepository();
  const first = await initInternal({ repository, idempotencyKey: "k-a" });
  const second = await initInternal({ repository, idempotencyKey: "k-b" });
  assert.equal(first.result.ok, true);
  assert.equal(second.result.ok, true);
  assert.equal(second.result.alreadyInitialized, true);
  assert.equal(second.result.reset, false);
  assert.equal(second.result.state.teams.teamA.score, 0);
  assert.equal(repository.liveStates.size, 1);
});

test("already IN_PROGRESS state is not reset", async () => {
  const { repository, result } = await initInternal();
  assert.equal(result.ok, true);
  const id = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  const live = repository.getLiveState(id);
  live.status = MATCH_STATUS.IN_PROGRESS;
  live.stateVersion = 1;
  live.lastEventSequence = 1;
  live.statePayload = { ...live.statePayload, status: MATCH_STATUS.IN_PROGRESS, version: 1 };
  const again = await initInternal({ repository, idempotencyKey: "k-in-progress" });
  assert.equal(again.result.ok, false);
  assert.equal(again.result.code, REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE);
  assert.equal(repository.getLiveState(id).statePayload.version, 1);
});

test("already SCORING_ACTIVE state is not reset", async () => {
  const { repository } = await initInternal();
  const id = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  const live = repository.getLiveState(id);
  live.status = "SCORING_ACTIVE";
  live.statePayload = { ...live.statePayload, status: "SCORING_ACTIVE" };
  const again = await initInternal({ repository, idempotencyKey: "k-scoring" });
  assert.equal(again.result.ok, false);
  assert.equal(again.result.code, REFEREE_V5_ERROR.MATCH_ALREADY_ACTIVE);
});

test("LOCKED state not reset", async () => {
  const { repository } = await initInternal();
  const id = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  repository.lockLiveState(id, "organizer-1");
  const again = await initInternal({ repository, idempotencyKey: "k-locked" });
  assert.equal(again.result.ok, false);
  assert.equal(again.result.code, REFEREE_V5_ERROR.MATCH_LOCKED);
  assert.equal(repository.getLiveState(id).status, MATCH_STATUS.LOCKED);
});

test("COMPLETED state not reset", async () => {
  const { repository } = await initInternal();
  const id = buildMatchStateId({ tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH });
  const live = repository.getLiveState(id);
  live.status = MATCH_STATUS.COMPLETED;
  live.statePayload = { ...live.statePayload, status: MATCH_STATUS.COMPLETED };
  const again = await initInternal({ repository, idempotencyKey: "k-completed" });
  assert.equal(again.result.ok, false);
  assert.equal(again.result.code, REFEREE_V5_ERROR.TERMINAL_STATE);
});

test("Start, Score, Pause, Change Ends, replay after valid initialization", async () => {
  const { repository, result } = await initInternal();
  assert.equal(result.ok, true);
  repository.upsertAssignment({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    userId: "ref-1",
    assignmentRole: "REFEREE",
    status: "active",
  });
  const service = new RefereeV5PersistenceService(repository);
  const actor = { userId: "ref-1", tenantId: TENANT, role: "REFEREE" };
  const assignment = {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    userId: "ref-1",
    assignmentRole: "REFEREE",
    status: "active",
  };

  async function apply(commandType, extra = {}) {
    const loaded = await service.getMatchState({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      actor,
      assignment,
    });
    return service.applyMatchCommand({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      commandType,
      expectedVersion: extra.expectedVersion ?? loaded.stateVersion,
      expectedSequence: extra.expectedSequence ?? loaded.lastEventSequence,
      clientMutationId: extra.clientMutationId || commandType,
      idempotencyKey: extra.idempotencyKey || `idem-${commandType}`,
      actor,
      assignment,
      payload: extra.payload || {},
    });
  }

  const started = await apply(MATCH_EVENT_TYPE.START_MATCH);
  assert.equal(started.ok, true);
  assert.equal(started.state.status, MATCH_STATUS.IN_PROGRESS);

  const scored = await apply(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);
  assert.equal(scored.ok, true);
  assert.equal(scored.state.teams.teamA.score, 1);

  const switched = await apply(MATCH_EVENT_TYPE.SWITCH_ENDS);
  assert.equal(switched.ok, true);

  const paused = await apply(MATCH_EVENT_TYPE.PAUSE_MATCH);
  assert.equal(paused.ok, true);
  assert.equal(paused.state.status, MATCH_STATUS.PAUSED);

  const matchStateId = buildMatchStateId({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
  });
  const replay = await service.verifySnapshotMatchesReplay(matchStateId);
  assert.equal(replay.ok, true);
  const initial = repository.getInitialState(matchStateId);
  assert.equal(initial.status, MATCH_STATUS.NOT_STARTED);
  assert.equal(initial.version, 0);

  repository.lockLiveState(matchStateId, "ref-1");
  const lockedCmd = await apply(MATCH_EVENT_TYPE.TEAM_B_WON_RALLY, {
    expectedVersion: paused.state.version,
    expectedSequence: paused.state.lastEventSequence,
    idempotencyKey: "idem-locked-score",
    clientMutationId: "locked-score",
  });
  assert.equal(lockedCmd.ok, false);
  assert.equal(lockedCmd.code, REFEREE_V5_ERROR.MATCH_LOCKED);
});

test("REFEREE cannot initialize arbitrary matches", async () => {
  const { result } = await initInternal({
    actor: { actorId: "ref-1", tenantId: TENANT, role: "REFEREE" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
  assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
});

test("PLAYER cannot initialize match execution state", async () => {
  const { result } = await initInternal({
    actor: { actorId: "player-1", tenantId: TENANT, role: "PLAYER" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
  assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
});

test("authorized organizer passes authorizeMatchExecutionInit when globalThis.window exists", async () => {
  await withGlobalWindow(async () => {
    const result = authorizeMatchExecutionInit({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      idempotencyKey: "k-window-organizer",
      actor: organizer(),
      adapter: internalAdapter(),
    });
    assert.equal(result.ok, true);
    assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
  });
});

test("REFEREE remains denied by role policy when globalThis.window exists", async () => {
  await withGlobalWindow(async () => {
    const result = authorizeMatchExecutionInit({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      idempotencyKey: "k-window-ref",
      actor: { actorId: "ref-1", tenantId: TENANT, role: "REFEREE" },
      adapter: internalAdapter(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
    assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
  });
});

test("PLAYER remains denied by role policy when globalThis.window exists", async () => {
  await withGlobalWindow(async () => {
    const result = authorizeMatchExecutionInit({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      idempotencyKey: "k-window-player",
      actor: { actorId: "player-1", tenantId: TENANT, role: "PLAYER" },
      adapter: internalAdapter(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
    assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
  });
});

test("cross-tenant actor is denied even when globalThis.window exists", async () => {
  await withGlobalWindow(async () => {
    const result = authorizeMatchExecutionInit({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      idempotencyKey: "k-window-xtenant",
      actor: { actorId: "org-b", tenantId: "tenant-b", role: "ORGANIZER" },
      adapter: internalAdapter(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  });
});

test("venue is not accepted as tenant fallback even when globalThis.window exists", async () => {
  await withGlobalWindow(async () => {
    const result = authorizeMatchExecutionInit({
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      idempotencyKey: "k-window-venue",
      actor: { actorId: "org-venue", role: "ORGANIZER", venueId: TENANT },
      adapter: internalAdapter(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
  });
});

test("trusted initialize proceeds when globalThis.window is defined", async () => {
  await withGlobalWindow(async () => {
    const { result } = await initInternal({ idempotencyKey: "k-edge-window" });
    assert.equal(result.ok, true);
    assert.equal(result.initialized, true);
    assert.notEqual(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
  });
});

test("browser cannot invoke initializer internal RPC directly", async () => {
  await withGlobalWindow(async () => {
    const guard = assertInternalRpcAllowed();
    assert.equal(guard.ok, false);
    assert.equal(guard.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
    const result = await refereeV5InitializeMatchExecutionState({
      p_tenant_id: TENANT,
      p_tournament_id: TOURNAMENT,
      p_match_id: MATCH,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
  });
});

test("internal init RPC is not a public browser RPC", () => {
  assert.equal(isPublicBrowserRpc(MATCH_EXECUTION_INIT_RPC), false);
  assert.equal(
    REFEREE_V5_INTERNAL_RPC_NAMES.INITIALIZE_MATCH_EXECUTION_STATE,
    MATCH_EXECUTION_INIT_RPC
  );
});

test("rpc client uses shared initializer RPC never Team or Daily writers", async () => {
  const repository = new InMemoryMatchRepository();
  const calls = [];
  const rpcClient = {
    rpc: async (name, payload) => {
      calls.push(name);
      if (name === "team_tournament_provision_referee_match" || name === "daily_play_start_match") {
        return { data: { ok: false, code: "FORBIDDEN_WRITER" }, error: null };
      }
      if (name !== MATCH_EXECUTION_INIT_RPC) {
        return { data: { ok: false, code: "UNKNOWN_RPC" }, error: null };
      }
      const inner = await repository.initializeExecutionState({
        tenantId: payload.p_tenant_id,
        tournamentId: payload.p_tournament_id,
        matchId: payload.p_match_id,
        initialState: payload.p_initial_state,
        teamAId: payload.p_team_a_id,
        teamBId: payload.p_team_b_id,
        idempotencyKey: payload.p_idempotency_key,
        requestHash: payload.p_request_hash,
      });
      return { data: inner, error: null };
    },
  };
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    actor: organizer(),
    idempotencyKey: "k-rpc",
    adapter: internalAdapter(),
    repository,
    rpcClient,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [MATCH_EXECUTION_INIT_RPC]);
});

test("mode-neutral Adapter B: Official can initialize without Team/Daily writers", async () => {
  const repository = new InMemoryMatchRepository();
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: "official-comp-1",
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
    actor: organizer(),
    idempotencyKey: "k-official",
    adapter: createOfficialTournamentRefereeAdapter({
      modeState: individualFixtures(COMPETITION_REFEREE_MODE.OFFICIAL),
    }),
    repository,
  });
  assert.equal(result.ok, true);
  assert.equal(result.initialized, true);
});

test("Daily Play Adapter B is accepted by shared capability without promoting Daily writer", async () => {
  const repository = new InMemoryMatchRepository();
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: "daily-comp-1",
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    actor: organizer(),
    idempotencyKey: "k-daily",
    adapter: createDailyPlayRefereeAdapter({ modeState: dailyFixtures() }),
    repository,
  });
  assert.equal(result.ok, true);
});

test("Team Adapter B can initialize without calling Team provision RPC", async () => {
  const repository = new InMemoryMatchRepository();
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: "team-comp-1",
    matchId: "sub-1",
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    actor: organizer(),
    idempotencyKey: "k-team",
    adapter: createTeamTournamentRefereeAdapter({ modeState: teamFixtures() }),
    repository,
  });
  assert.equal(result.ok, true);
});

test("browser-supplied state snapshot is denied", async () => {
  const result = await initializeMatchExecutionState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    actor: organizer(),
    idempotencyKey: "k-snapshot",
    adapter: internalAdapter(),
    repository: new InMemoryMatchRepository(),
    statePayload: { status: MATCH_STATUS.COMPLETED, version: 99 },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.VALIDATION_DENIED);
});

test("architecture — Contract #08 and CORE-13 assignment sources unchanged", () => {
  const diff = execFileSync(
    "git",
    [
      "diff",
      "origin/main",
      "--",
      "src/features/competition-engine/integration/referee/contract.js",
      "src/features/competition-engine/integration/referee/constants.js",
      "src/features/competition-core/referee-assignment",
      "src/features/daily-play",
      "src/features/team-tournament/repositories/cloudTeamTournamentRepository.js",
    ],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(diff.trim(), "");
});

test("authorizeMatchExecutionInit does not use ambient window as a trust boundary", () => {
  const authz = readFileSync(path.join(EXEC_DIR, "authorizeMatchExecutionInit.js"), "utf8");
  assert.equal(authz.includes("isBrowserRuntime"), false);
  assert.equal(authz.includes("typeof globalThis.window"), false);
  assert.equal(authz.includes('typeof window !== "undefined"'), false);
  const internal = readFileSync(
    path.join(ROOT, "src/features/referee-v5/services/refereeV5InternalRpcService.js"),
    "utf8"
  );
  assert.match(internal, /typeof window !== "undefined"/);
  assert.match(internal, /INTERNAL_RPC_FORBIDDEN/);
});

test("architecture — no Team RPC, Daily writer, browser DML, or service-role in capability", () => {
  const files = readdirSync(EXEC_DIR)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(EXEC_DIR, name));
  files.push(
    path.join(ROOT, "src/features/referee-v5/persistence/InMemoryMatchRepository.js")
  );
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("team_tournament_provision_referee_match"), false, file);
    assert.equal(source.includes("daily_play_start_match"), false, file);
    assert.equal(source.includes("SERVICE_ROLE"), false, file);
    assert.equal(source.includes("service_role"), false, file);
    assert.equal(source.includes("from(\"match_live_states\")"), false, file);
    assert.equal(source.includes("from('match_live_states')"), false, file);
  }
});

test("SQL package is local-only initializer RPC with no schema expansion", () => {
  const apply = readFileSync(path.join(SQL_DIR, "10_APPLY.sql"), "utf8");
  const precheck = readFileSync(path.join(SQL_DIR, "00_PRECHECK.sql"), "utf8");
  const verify = readFileSync(path.join(SQL_DIR, "20_VERIFY.sql"), "utf8");
  const rollback = readFileSync(path.join(SQL_DIR, "90_ROLLBACK.sql"), "utf8");
  assert.match(precheck, /LOCAL AUTHORING ONLY/);
  assert.match(apply, /referee_v5_initialize_match_execution_state/);
  assert.match(apply, /grant execute[\s\S]*to service_role/i);
  assert.match(apply, /revoke all[\s\S]*from public/i);
  assert.match(apply, /revoke all[\s\S]*from anon, authenticated/i);
  assert.equal(/create table/i.test(apply), false);
  assert.equal(/alter table/i.test(apply), false);
  assert.equal(apply.includes("team_tournament_provision_referee_match"), false);
  assert.equal(apply.includes("daily_play_start_match"), false);
  assert.match(verify, /service_role/);
  assert.match(rollback, /drop function if exists public.referee_v5_initialize_match_execution_state/i);
});

test("secret scan on new capability sources", () => {
  const files = [
    ...readdirSync(EXEC_DIR).map((name) => path.join(EXEC_DIR, name)),
    ...readdirSync(SQL_DIR).map((name) => path.join(SQL_DIR, name)),
    path.join(ROOT, "src/features/referee-v5/persistence/errors.js"),
    path.join(ROOT, "src/features/referee-v5/persistence/InMemoryMatchRepository.js"),
  ];
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const found = findSecretCandidates(text);
    if (found.length) hits.push({ file, found });
  }
  assert.deepEqual(hits, []);
});
