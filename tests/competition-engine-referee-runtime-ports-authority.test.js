/**
 * Canonical referee runtime ports, identity authority, and fail-closed writes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  CANONICAL_REFEREE_AUTHORITY,
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  COMPETITION_ENGINE_REFEREE_OPERATIONS,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ERROR_CODE,
  createCanonicalRefereePersistenceRuntime,
  createInMemoryRefereeOperationsStore,
  createRefereeCompetitionOperationsFacade,
  createCompetitionRuntimePorts,
  isRefereeAdapterContractError,
  isRefereeOperationsError,
  matchesCanonicalRefereeRuntimePorts,
  matchesRefereeOperationsStorePort,
} from "../src/features/competition-engine/index.js";

test("in-memory store is classified TEST_DOUBLE_ONLY and implements ops port", () => {
  const store = createInMemoryRefereeOperationsStore();
  assert.equal(store.classification, IN_MEMORY_RUNTIME_CLASSIFICATION);
  assert.equal(store.durable, false);
  assert.equal(matchesRefereeOperationsStorePort(store), true);
  assert.equal(
    COMPETITION_ENGINE_REFEREE_OPERATIONS.wiredToProductionRuntime,
    false
  );
  assert.equal(
    COMPETITION_ENGINE_REFEREE_OPERATIONS.inMemoryRuntimeClassification,
    "TEST_DOUBLE_ONLY"
  );
});

test("canonical persistence runtime maps to V5 tables without V5 scoring engine", () => {
  const runtime = createCanonicalRefereePersistenceRuntime({
    clockIso: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(matchesCanonicalRefereeRuntimePorts(runtime), true);
  assert.equal(runtime.usesRefereeV5ScoringEngine, false);
  assert.equal(runtime.usesCore16Scoring, true);
  assert.equal(runtime.tables.ASSIGNMENTS, "referee_assignments");
  assert.equal(
    runtime.tables.RESULT_REVISIONS,
    CANONICAL_REFEREE_PERSISTENCE_TABLES.RESULT_REVISIONS
  );
  assert.equal(CANONICAL_REFEREE_AUTHORITY.SCORING, "CORE-16");
  assert.equal(CANONICAL_REFEREE_AUTHORITY.RESULT, "CORE-17 accepted active result");
  assert.equal(runtime.wiredToProductionRuntime, false);
});

test("durable ports require canonical auth.uid, expectedVersion, idempotency", () => {
  const runtime = createCanonicalRefereePersistenceRuntime();
  const actor = { actorId: "user-1" };
  const scope = {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "m-1",
  };

  try {
    runtime.assignmentRepository.upsert(scope, {});
    assert.fail("expected identity failure");
  } catch (err) {
    assert.equal(isRefereeAdapterContractError(err), true);
    assert.equal(
      err.code,
      REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
    );
  }

  runtime.assignmentRepository.upsert(
    { ...scope, refereeUserId: "user-1" },
    actor
  );
  const first = runtime.matchStateRepository.putLiveState(
    { ...scope, status: "in_progress", statePayload: { core: "15" } },
    actor
  );
  try {
    runtime.matchStateRepository.putLiveState(
      { ...scope, expectedVersion: 99, statePayload: { stale: true } },
      actor
    );
    assert.fail("expected stale write");
  } catch (err) {
    assert.equal(err.code, REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE);
  }

  try {
    runtime.scoringEventLedger.appendEvent({ ...scope, payload: {} }, actor);
    assert.fail("expected idempotency");
  } catch (err) {
    assert.equal(err.code, REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY);
  }

  const event = runtime.scoringEventLedger.appendEvent(
    { ...scope, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    actor
  );
  assert.equal(event.duplicate, false);
  const replay = runtime.scoringEventLedger.appendEvent(
    { ...scope, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    actor
  );
  assert.equal(replay.duplicate, true);
  assert.equal(first.version, 0);

  const accepted = runtime.resultRevisionRepository.appendRevision(
    { ...scope, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    actor
  );
  assert.equal(accepted.lineageStatus, "ACTIVE");
  runtime.resultRevisionRepository.appendRevision(
    { ...scope, acceptanceStatus: "ACCEPTED", payload: { winner: "B" } },
    actor
  );
  const active = runtime.resultRevisionRepository.getActive(scope);
  assert.equal(active.payload.winner, "B");
  assert.equal(active.revision, 2);
});

test("fuzzy refereeId alias is rejected; result submit does not need TEAM permission", async () => {
  const ports = createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: () => [...GENERIC_REFEREE_ROLE_PERMISSIONS],
    },
  });
  const facade = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
    clockIso: "2026-07-24T12:00:00.000Z",
  });
  assert.equal(facade.runtimeClassification, "TEST_DOUBLE_ONLY");
  assert.equal(facade.wiredToProductionRuntime, false);

  await assert.rejects(
    () =>
      facade.getRefereeAssignmentQueue({
        tenantId: "tenant-1",
        competitionId: "comp-e2e04",
        actor: {
          actorId: "ref-1",
          role: "REFEREE",
          refereeId: "other-person",
        },
      }),
    (err) =>
      isRefereeOperationsError(err) &&
      err.code === REFEREE_ERROR_CODE.FUZZY_IDENTITY_REJECTED
  );

  facade.seedAssignments({
    tenantId: "tenant-1",
    competitionId: "comp-e2e04",
    assignments: [{ matchId: "m-1", refereeId: "ref-1" }],
  });
  const queue = await facade.getRefereeAssignmentQueue({
    tenantId: "tenant-1",
    competitionId: "comp-e2e04",
    actor: { actorId: "ref-1", role: "REFEREE", refereeId: "ref-1" },
  });
  assert.equal(queue.ok, true);
  assert.equal(
    GENERIC_REFEREE_ROLE_PERMISSIONS.includes(
      PERMISSIONS.TEAM_MATCH_RESULT_MANAGE
    ),
    false
  );
});
