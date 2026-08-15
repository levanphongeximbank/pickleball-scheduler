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

function expectAdapterCode(fn, code) {
  try {
    fn();
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

test("1. durable dependency required in production", () => {
  expectAdapterCode(
    () => createCompetitionRefereeProductionRuntime({}),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
  expectAdapterCode(
    () => createLiveRpcCanonicalRefereeDurableDriver({}),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
});

test("2. in-memory rejected as production runtime", () => {
  expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createInMemoryRefereeOperationsStore({ clockIso: CLOCK }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createCanonicalRefereePersistenceRuntime({
          clockIso: CLOCK,
        }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  expectAdapterCode(
    () =>
      createCompetitionRefereeProductionRuntime({
        durableDriver: createSchemaFaithfulCanonicalRefereeDurableDriver({
          clockIso: CLOCK,
        }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
});

test("3. canonical actor identity", () => {
  const { runtime } = createCertified();
  expectAdapterCode(
    () => runtime.assignmentRepository.upsert(SCOPE, { name: "Coach A" }),
    REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
  );
  expectAdapterCode(
    () =>
      runtime.assignmentRepository.upsert(
        { ...SCOPE, refereeUserId: ACTOR.actorId },
        { actorId: ACTOR.actorId, authUid: "other-uid" }
      ),
    REFEREE_ADAPTER_ERROR_CODE.FUZZY_IDENTITY_FORBIDDEN
  );
});

test("4-6. tenant isolation, assignment scope, valid assigned command", () => {
  const { runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  expectAdapterCode(
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
  expectAdapterCode(
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
  const event = runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-ok" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  assert.equal(event.actorId, ACTOR.actorId);
  assert.equal(event.table, CANONICAL_REFEREE_PERSISTENCE_TABLES.EVENTS);
});

test("7-8. expectedVersion success and stale rejection", () => {
  const { runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const first = runtime.matchStateRepository.putLiveState(
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
  expectAdapterCode(
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
  const live = runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(Number(live.stateVersion ?? live.version), 1);
});

test("9-10. idempotent replay and conflicting idempotency rejection", () => {
  const { runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const event = runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  const replay = runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  assert.equal(replay.duplicate, true);
  expectAdapterCode(
    () =>
      runtime.scoringEventLedger.appendEvent(
        { ...SCOPE, payload: { cmd: "UNDO" }, idempotencyKey: "cmd-1" },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("11-13. append-only event, version increment once, atomic commit", () => {
  const { driver, runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const before = runtime.scoringEventLedger.listEvents(SCOPE);
  runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-atom" },
    ACTOR
  );
  const after = runtime.scoringEventLedger.listEvents(SCOPE);
  assert.equal(after.length, before.length + 1);
  const live = runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(Number(live.stateVersion ?? live.version), after.length);
  assert.equal(Number(live.lastEventSequence), after.length);
  expectAdapterCode(
    () => driver.tryUpdateEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  expectAdapterCode(
    () => driver.tryDeleteEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  const versionBeforeStale = Number(live.stateVersion ?? live.version);
  const eventCountBeforeStale = after.length;
  expectAdapterCode(
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
    runtime.scoringEventLedger.listEvents(SCOPE).length,
    eventCountBeforeStale
  );
  assert.equal(
    Number(
      runtime.matchStateRepository.getLiveState(SCOPE).stateVersion ??
        runtime.matchStateRepository.getLiveState(SCOPE).version
    ),
    versionBeforeStale
  );
});

test("14-17. CORE-17 accepted persistence, unaccepted blocked, correction history", () => {
  const { runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  expectAdapterCode(
    () =>
      runtime.resultRevisionRepository.appendRevision(
        { ...SCOPE, acceptanceStatus: "PENDING", payload: { winner: "A" } },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.UNOFFICIAL_RESULT_FORBIDDEN
  );
  const accepted = runtime.resultRevisionRepository.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    ACTOR
  );
  assert.equal(accepted.lineageStatus, "ACTIVE");
  assert.equal(accepted.revision, 1);
  const correction = runtime.resultRevisionRepository.appendRevision(
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
  const active = runtime.resultRevisionRepository.getActive(SCOPE);
  assert.equal(active.payload.winner, "B");
  const { driver } = createCertified();
  driver.upsertAssignment({ ...SCOPE, refereeUserId: ACTOR.actorId }, ACTOR);
  driver.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    ACTOR
  );
  driver.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "B" } },
    ACTOR
  );
  const revisions = driver.listRevisions(SCOPE);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].payload.winner, "A");
  assert.equal(revisions[0].lineageStatus, "SUPERSEDED");
  assert.equal(revisions[1].payload.winner, "B");
  assert.equal(revisions[1].lineageStatus, "ACTIVE");
});

test("18. fresh read equals committed state", () => {
  const { runtime } = createCertified();
  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const committed = runtime.matchStateRepository.putLiveState(
    {
      ...SCOPE,
      expectedVersion: 0,
      idempotencyKey: "fresh-1",
      status: "in_progress",
      statePayload: { canonical: { marker: "durable-ssot" } },
    },
    ACTOR
  );
  const fresh = runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(fresh.statePayload.canonical.marker, "durable-ssot");
  assert.equal(
    Number(fresh.stateVersion ?? fresh.version),
    Number(committed.stateVersion ?? committed.version)
  );
});

test("19-20. no Adapter B dependency and no Team-specific generic permission", async () => {
  const { runtime } = createCertified();
  assert.equal(runtime.usesAdapterB, false);
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
  assert.equal(runtime.inMemoryProductionFallback, false);
  assert.equal(matchesCanonicalRefereeRuntimePorts(runtime), true);

  runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
  const opened = await runtime.facade.openAssignedMatch({
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    matchId: SCOPE.matchId,
    actor: ACTOR,
    commandId: "open-1",
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.match.status, MATCH_STATUS.IN_PROGRESS);
  const fresh = runtime.matchStateRepository.getLiveState(SCOPE);
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
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.NOT_ASSIGNED
  );
});
