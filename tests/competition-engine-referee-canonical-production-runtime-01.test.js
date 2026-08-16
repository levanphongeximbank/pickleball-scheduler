/**
 * Canonical durable referee production runtime certification.
 * Side-loaded from E2E-04 so CORE-08 registry-addition is not tripped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  COMPETITION_ENGINE_REFEREE_OPERATIONS,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_ADAPTER_INTEGRATION,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ERROR_CODE,
  createCanonicalRefereePersistenceRuntime,
  createCompetitionRefereeProductionRuntime,
  createCompetitionRuntimePorts,
  createInMemoryRefereeOperationsStore,
  createLiveRpcCanonicalRefereeDurableDriver,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
  isRefereeAdapterContractError,
  isRefereeOperationsError,
  matchesCanonicalRefereeRuntimePorts,
} from "../src/features/competition-engine/index.js";

const CLOCK = "2026-07-24T00:00:00.000Z";
const SCOPE = Object.freeze({
  tenantId: "tenant-1",
  competitionId: "comp-1",
  matchId: "m-1",
});
const ACTOR = Object.freeze({
  actorId: "11111111-1111-4111-8111-111111111111",
  authUid: "11111111-1111-4111-8111-111111111111",
  role: "REFEREE",
  refereeId: "11111111-1111-4111-8111-111111111111",
});

async function expectAdapterCode(fn, code) {
  try {
    await fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isRefereeAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

function createPorts() {
  return createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: () => [...GENERIC_REFEREE_ROLE_PERMISSIONS],
    },
  });
}

function createCertified() {
  const driver = createSchemaFaithfulCanonicalRefereeDurableDriver({
    clockIso: CLOCK,
  });
  const runtime = createCompetitionRefereeProductionRuntime({
    durableDriver: driver,
    allowTestDoubleDriver: true,
    runtimePorts: createPorts(),
    clockIso: CLOCK,
  });
  return { driver, runtime };
}

test("1. durable dependency required in production", async () => {
  await expectAdapterCode(
    () => createCompetitionRefereeProductionRuntime({}),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
  await expectAdapterCode(
    () => createLiveRpcCanonicalRefereeDurableDriver({}),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
});

test("2. in-memory rejected as production runtime", async () => {
  await expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createInMemoryRefereeOperationsStore({ clockIso: CLOCK }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  await expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createCanonicalRefereePersistenceRuntime({
          clockIso: CLOCK,
        }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  await expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createSchemaFaithfulCanonicalRefereeDurableDriver({
          clockIso: CLOCK,
        }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
});

test("3. canonical actor identity", async () => {
  const { runtime } = createCertified();
  await expectAdapterCode(
    () => runtime.assignmentRepository.upsert(SCOPE, { name: "Coach A" }),
    REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
  );
  await expectAdapterCode(
    () =>
      runtime.assignmentRepository.upsert(
        { ...SCOPE, refereeUserId: ACTOR.actorId },
        { actorId: ACTOR.actorId, authUid: "other-uid" }
      ),
    REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
});

test("4-6. tenant isolation, assignment scope, valid assigned command", async () => {
  const { runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  await expectAdapterCode(
    () =>
      runtime.scoringEventLedger.appendEvent(
        {
          tenantId: "tenant-other",
          competitionId: SCOPE.competitionId,
          matchId: SCOPE.matchId,
          payload: { cmd: "POINT" },
          idempotencyKey: "cmd-cross",
        },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED
  );
  await expectAdapterCode(
    () =>
      runtime.scoringEventLedger.appendEvent(
        {
          ...SCOPE,
          payload: { cmd: "POINT" },
          idempotencyKey: "cmd-unassigned",
        },
        { actorId: "22222222-2222-4222-8222-222222222222", role: "REFEREE" }
      ),
    REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED
  );
  const event = await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-ok" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  assert.equal(event.actorId, ACTOR.actorId);
  assert.equal(event.table, CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS);
});

test("7-8. expectedVersion success and stale rejection", async () => {
  const { runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const first = await runtime.matchStateRepository.putLiveState(
    {
      ...SCOPE,
      expectedVersion: 0,
      idempotencyKey: "state-1",
      status: "in_progress",
      statePayload: { canonical: { core15: MATCH_STATUS.IN_PROGRESS } },
    },
    ACTOR
  );
  assert.equal(Number(first.stateVersion ?? first.version), 1);
  await expectAdapterCode(
    () =>
      runtime.matchStateRepository.putLiveState(
        {
          ...SCOPE,
          expectedVersion: 99,
          idempotencyKey: "state-stale",
          statePayload: { stale: true },
        },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
  );
  const live = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(Number(live.stateVersion ?? live.version), 1);
});

test("9-10. idempotent replay and conflicting idempotency rejection", async () => {
  const { runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const event = await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  const replay = await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  assert.equal(replay.duplicate, true);
  await expectAdapterCode(
    () =>
      runtime.scoringEventLedger.appendEvent(
        { ...SCOPE, payload: { cmd: "UNDO" }, idempotencyKey: "cmd-1" },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("11-13. append-only event, version increment once, atomic commit", async () => {
  const { driver, runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const before = await runtime.scoringEventLedger.listEvents(SCOPE);
  await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-atom" },
    ACTOR
  );
  const after = await runtime.scoringEventLedger.listEvents(SCOPE);
  assert.equal(after.length, before.length + 1);
  const live = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(Number(live.stateVersion ?? live.version), after.length);
  assert.equal(Number(live.lastEventSequence), after.length);
  await expectAdapterCode(
    () => driver.tryUpdateEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  await expectAdapterCode(
    () => driver.tryDeleteEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  const versionBeforeStale = Number(live.stateVersion ?? live.version);
  const eventCountBeforeStale = after.length;
  await expectAdapterCode(
    () =>
      runtime.matchStateRepository.putLiveState(
        {
          ...SCOPE,
          expectedVersion: 0,
          idempotencyKey: "stale-atomic",
          statePayload: { broken: true },
        },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
  );
  assert.equal(
    (await runtime.scoringEventLedger.listEvents(SCOPE)).length,
    eventCountBeforeStale
  );
  const liveAfterStale = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(
    Number(liveAfterStale.stateVersion ?? liveAfterStale.version),
    versionBeforeStale
  );
});

test("14-17. CORE-17 accepted persistence, unaccepted blocked, correction history", async () => {
  const { runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  await expectAdapterCode(
    () =>
      runtime.resultRevisionRepository.appendRevision(
        { ...SCOPE, acceptanceStatus: "PENDING", payload: { winner: "A" } },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.UNOFFICIAL_RESULT_FORBIDDEN
  );
  const accepted = await runtime.resultRevisionRepository.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    ACTOR
  );
  assert.equal(accepted.lineageStatus, "ACTIVE");
  assert.equal(accepted.revision, 1);
  const correction = await runtime.resultRevisionRepository.appendRevision(
    {
      ...SCOPE,
      acceptanceStatus: "ACCEPTED",
      payload: { winner: "B" },
      idempotencyKey: "rev-2",
    },
    ACTOR
  );
  assert.equal(correction.revision, 2);
  assert.equal(correction.lineageStatus, "ACTIVE");
  assert.equal(correction.supersedesRevision, 1);
  const active = await runtime.resultRevisionRepository.getActive(SCOPE);
  assert.equal(active.payload.winner, "B");
  const { driver } = createCertified();
  await driver.upsertAssignment({ ...SCOPE, refereeUserId: ACTOR.actorId }, ACTOR);
  await driver.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    ACTOR
  );
  await driver.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "B" } },
    ACTOR
  );
  const revisions = await driver.listRevisions(SCOPE);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].payload.winner, "A");
  assert.equal(revisions[0].lineageStatus, "SUPERSEDED");
  assert.equal(revisions[1].payload.winner, "B");
  assert.equal(revisions[1].lineageStatus, "ACTIVE");
});

test("18. fresh read equals committed state", async () => {
  const { runtime } = createCertified();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const committed = await runtime.matchStateRepository.putLiveState(
    {
      ...SCOPE,
      expectedVersion: 0,
      idempotencyKey: "fresh-1",
      status: "in_progress",
      statePayload: { canonical: { marker: "durable-ssot" } },
    },
    ACTOR
  );
  const fresh = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(fresh.statePayload.canonical.marker, "durable-ssot");
  assert.equal(
    Number(fresh.stateVersion ?? fresh.version),
    Number(committed.stateVersion ?? committed.version)
  );
});

test("19-20. Adapter B wired; no Team-specific generic permission", async () => {
  const { runtime } = createCertified();
  assert.equal(runtime.usesAdapterB, true);
  assert.equal(runtime.modeAdapterRegistry.size(), 4);
  assert.equal(runtime.usesTeamGenericPermission, false);
  assert.equal(
    GENERIC_REFEREE_ROLE_PERMISSIONS.includes(
      PERMISSIONS.TEAM_MATCH_RESULT_MANAGE
    ),
    false
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED, true);
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    "competition.referee.adapter.v1"
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  assert.equal(COMPETITION_REFEREE_ADAPTER_INTEGRATION.wiredToProductionRuntime, true);
  assert.equal(COMPETITION_ENGINE_REFEREE_OPERATIONS.wiredToProductionRuntime, true);
  assert.equal(runtime.wiredToProductionRuntime, true);
  assert.equal(runtime.facade.wiredToProductionRuntime, true);
  assert.equal(runtime.facade.usesAdapterB, true);
  assert.equal(runtime.inMemoryProductionFallback, false);
  assert.equal(matchesCanonicalRefereeRuntimePorts(runtime), true);
  assert.equal(runtime.stagingBackendCertified, true);

  const modeState = {
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    competitionMode: "INTERNAL",
    matches: {
      [SCOPE.matchId]: {
        matchId: SCOPE.matchId,
        status: "READY_TO_START",
        entryAId: "entry-a",
        entryBId: "entry-b",
        participantIdsA: ["p-a"],
        participantIdsB: ["p-b"],
        scoringRules: {
          scoringSystem: "SIDE_OUT",
          pointsToWin: 11,
          winBy: 2,
          bestOfGames: 1,
        },
        lineupsLocked: true,
      },
    },
  };

  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const opened = await runtime.facade.openAssignedMatch({
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    matchId: SCOPE.matchId,
    actor: ACTOR,
    commandId: "open-1",
    competitionMode: "INTERNAL",
    modeState,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.match.status, MATCH_STATUS.IN_PROGRESS);
  const fresh = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(fresh.statePayload.canonical.match.status, MATCH_STATUS.IN_PROGRESS);

  await assert.rejects(
    () =>
      runtime.facade.openAssignedMatch({
        tenantId: SCOPE.tenantId,
        competitionId: SCOPE.competitionId,
        matchId: SCOPE.matchId,
        actor: {
          actorId: "22222222-2222-4222-8222-222222222222",
          role: "REFEREE",
          refereeId: "22222222-2222-4222-8222-222222222222",
        },
        commandId: "open-other",
        competitionMode: "INTERNAL",
        modeState,
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.NOT_ASSIGNED
  );
});

/**
 * In-memory Supabase-shaped rpcClient for live-driver unit proofs.
 * No network. No secrets. Mirrors Staging commit CAS/idempotency gates.
 */
function createMockLiveRpcClient() {
  const assignments = new Map();
  const liveStates = new Map();
  const events = new Map();
  const mutations = new Map();

  function assignmentKey(row) {
    return `${row.tenant_id}::${row.tournament_id}::${row.match_id}::${row.role}::${row.referee_user_id}`;
  }

  function matchFilter(rows, filters) {
    return rows.filter((row) =>
      filters.every(([col, op, val]) => {
        if (op === "eq") return row[col] === val;
        return true;
      })
    );
  }

  function tableApi(table) {
    const filters = [];
    let limitN = null;
    let orderCol = null;
    let ascending = true;
    const api = {
      select() {
        return api;
      },
      eq(col, val) {
        filters.push([col, "eq", val]);
        return api;
      },
      order(col, opts = {}) {
        orderCol = col;
        ascending = opts.ascending !== false;
        return api;
      },
      limit(n) {
        limitN = n;
        return api;
      },
      async maybeSingle() {
        const { data, error } = await api._exec();
        if (error) return { data: null, error };
        return { data: data?.[0] || null, error: null };
      },
      async _exec() {
        let rows = [];
        if (table === "referee_assignments") rows = [...assignments.values()];
        if (table === "match_live_states") rows = [...liveStates.values()];
        if (table === "match_events") rows = [...(events.values())].flat();
        if (table === "match_sync_mutations") rows = [...mutations.values()];
        rows = matchFilter(rows, filters);
        if (orderCol) {
          rows.sort((a, b) =>
            ascending
              ? Number(a[orderCol]) - Number(b[orderCol])
              : Number(b[orderCol]) - Number(a[orderCol])
          );
        }
        if (limitN != null) rows = rows.slice(0, limitN);
        return { data: rows, error: null };
      },
      then(resolve, reject) {
        return api._exec().then(resolve, reject);
      },
      upsert(row) {
        if (table === "referee_assignments") {
          const key = assignmentKey(row);
          const next = { id: key, ...row };
          assignments.set(key, next);
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: next, error: null };
                },
              };
            },
          };
        }
        if (table === "match_live_states") {
          const next = { ...row };
          liveStates.set(row.id, next);
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: next, error: null };
                },
              };
            },
          };
        }
        return {
          select() {
            return {
              async maybeSingle() {
                return { data: row, error: null };
              },
            };
          },
        };
      },
      insert() {
        return {
          select() {
            return {
              async maybeSingle() {
                return { data: null, error: null };
              },
            };
          },
        };
      },
      update() {
        return {
          eq() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      delete() {
        return {
          eq() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
    return api;
  }

  return {
    from(table) {
      return tableApi(table);
    },
    async rpc(name, args) {
      if (name !== "referee_v5_commit_match_transition") {
        return { data: { ok: false, code: "UNKNOWN_RPC" }, error: null };
      }
      const id = `${args.p_tenant_id}::${args.p_tournament_id}::${args.p_match_id}`;
      const assigned = [...assignments.values()].some(
        (row) =>
          row.tenant_id === args.p_tenant_id &&
          row.tournament_id === args.p_tournament_id &&
          row.match_id === args.p_match_id &&
          row.referee_user_id === args.p_actor_id &&
          row.status === "active"
      );
      if (!assigned) {
        return { data: { ok: false, code: "REFEREE_NOT_ASSIGNED" }, error: null };
      }
      const live = liveStates.get(id);
      if (!live) {
        return { data: { ok: false, code: "MATCH_NOT_FOUND" }, error: null };
      }
      const mutationKey = `${id}::${args.p_idempotency_key}`;
      const cached = mutations.get(mutationKey);
      if (cached) {
        if (cached.request_hash !== args.p_request_hash) {
          return {
            data: { ok: false, code: "IDEMPOTENCY_KEY_REUSE_MISMATCH" },
            error: null,
          };
        }
        return {
          data: { ...cached.response_payload, duplicate: true },
          error: null,
        };
      }
      const currentVersion = Number(live.state_version ?? live.version ?? 0);
      const currentSeq = Number(live.last_event_sequence || 0);
      if (Number(args.p_expected_state_version) !== currentVersion) {
        return {
          data: {
            ok: false,
            code: "MATCH_STATE_CONFLICT",
            currentVersion,
            currentSequence: currentSeq,
          },
          error: null,
        };
      }
      if (Number(args.p_expected_event_sequence) !== currentSeq) {
        return {
          data: {
            ok: false,
            code: "EVENT_SEQUENCE_CONFLICT",
            currentVersion,
            currentSequence: currentSeq,
          },
          error: null,
        };
      }
      const nextVersion = currentVersion + 1;
      const nextSeq = currentSeq + 1;
      const nextState = args.p_next_state;
      if (Number(nextState?.version) !== nextVersion) {
        return { data: { ok: false, code: "INVALID_MATCH_STATE" }, error: null };
      }
      if (Number(nextState?.lastEventSequence) !== nextSeq) {
        return { data: { ok: false, code: "EVENT_SEQUENCE_CONFLICT" }, error: null };
      }
      live.state_payload = nextState;
      live.state_version = nextVersion;
      live.version = nextVersion;
      live.last_event_sequence = nextSeq;
      live.status = nextState.status || live.status;
      const response = {
        ok: true,
        state: nextState,
        stateVersion: nextVersion,
        lastEventSequence: nextSeq,
      };
      mutations.set(mutationKey, {
        request_hash: args.p_request_hash,
        response_payload: response,
      });
      const list = events.get(id) || [];
      list.push({
        match_state_id: id,
        event_sequence: nextSeq,
        event_type: args.p_command_type,
        payload: args.p_command_payload,
      });
      events.set(id, list);
      return { data: response, error: null };
    },
  };
}

test("live RPC driver — assignment/CAS/idempotency/stale via mock rpcClient", async () => {
  const rpcClient = createMockLiveRpcClient();
  const driver = createLiveRpcCanonicalRefereeDurableDriver({
    rpcClient,
    clockIso: CLOCK,
  });
  assert.equal(driver.usesLiveRpc, true);
  assert.equal(driver.durable, true);
  assert.equal(driver.usesRefereeV5ScoringEngine, false);

  await driver.upsertAssignment(
    {
      ...SCOPE,
      refereeUserId: ACTOR.actorId,
      status: "active",
    },
    ACTOR
  );
  await driver.ensureLiveState(
    {
      ...SCOPE,
      status: "not_started",
      canonical: { venueId: "venue-1" },
    },
    ACTOR
  );

  const first = await driver.commitTransition(
    {
      ...SCOPE,
      expectedVersion: 0,
      expectedEventSequence: 0,
      idempotencyKey: "cmd-1",
      commandId: "cmd-1",
      eventType: "E2E04_OPS_COMMIT",
      payload: { n: 1 },
      nextState: {
        stateSchemaVersion: 1,
        matchId: SCOPE.matchId,
        status: "in_progress",
        canonical: { marker: "a" },
      },
      status: "in_progress",
    },
    ACTOR
  );
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  assert.equal(first.stateVersion, 1);

  const replay = await driver.commitTransition(
    {
      ...SCOPE,
      expectedVersion: 0,
      expectedEventSequence: 0,
      idempotencyKey: "cmd-1",
      commandId: "cmd-1",
      eventType: "E2E04_OPS_COMMIT",
      payload: { n: 1 },
      nextState: {
        stateSchemaVersion: 1,
        matchId: SCOPE.matchId,
        status: "in_progress",
        canonical: { marker: "a" },
      },
      status: "in_progress",
    },
    ACTOR
  );
  assert.equal(replay.duplicate, true);
  assert.equal(replay.stateVersion, 1);

  await expectAdapterCode(
    () =>
      driver.commitTransition(
        {
          ...SCOPE,
          expectedVersion: 0,
          expectedEventSequence: 0,
          idempotencyKey: "stale-1",
          commandId: "stale-1",
          eventType: "E2E04_OPS_COMMIT",
          payload: { n: 2 },
          nextState: {
            stateSchemaVersion: 1,
            matchId: SCOPE.matchId,
            status: "in_progress",
            canonical: { marker: "b" },
          },
          status: "in_progress",
        },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
  );

  await expectAdapterCode(
    () =>
      driver.commitTransition(
        {
          ...SCOPE,
          expectedVersion: 1,
          expectedEventSequence: 1,
          idempotencyKey: "unassigned",
          commandId: "unassigned",
          eventType: "E2E04_OPS_COMMIT",
          payload: {},
          nextState: {
            stateSchemaVersion: 1,
            matchId: SCOPE.matchId,
            status: "in_progress",
            canonical: {},
          },
          status: "in_progress",
        },
        {
          actorId: "22222222-2222-4222-8222-222222222222",
          authUid: "22222222-2222-4222-8222-222222222222",
          role: "REFEREE",
          refereeId: "22222222-2222-4222-8222-222222222222",
        }
      ),
    REFEREE_ADAPTER_ERROR_CODE.ASSIGNMENT_REQUIRED
  );
});
