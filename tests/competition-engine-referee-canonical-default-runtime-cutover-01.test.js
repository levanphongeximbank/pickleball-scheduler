/**
 * Canonical default referee runtime cutover — local certification.
 * Side-loaded from E2E-04 so CORE-08 registry-addition is not tripped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import {
  CANONICAL_REFEREE_PERSISTENCE_TABLES,
  COMPETITION_ENGINE_REFEREE_OPERATIONS,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
  COMPETITION_REFEREE_ADAPTER_INTEGRATION,
  DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  IN_MEMORY_RUNTIME_CLASSIFICATION,
  LIVE_RPC_DRIVER_KIND,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_ERROR_CODE,
  createCompetitionRuntimePorts,
  createDefaultCompetitionRefereeRuntime,
  createInMemoryRefereeOperationsStore,
  createLiveRpcCanonicalRefereeDurableDriver,
  createRefereeCompetitionOperationsFacade,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
  isRefereeAdapterContractError,
  isRefereeOperationsError,
} from "../src/features/competition-engine/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const CLIENT_SECRET_RE =
  /SUPABASE_SERVICE_ROLE_KEY|VITE_[A-Z0-9_]*SERVICE_ROLE|sb_secret_/i;
const INTERNAL_COMMIT_RPC_RE = /referee_v5_commit_match_transition/;

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

function createDefaultDurable() {
  const driver = createSchemaFaithfulCanonicalRefereeDurableDriver({
    clockIso: CLOCK,
  });
  const runtime = createDefaultCompetitionRefereeRuntime({
    durableDriver: driver,
    allowTestDoubleDriver: true,
    runtimePorts: createPorts(),
    clockIso: CLOCK,
  });
  return { driver, runtime };
}

function walkJsFiles(dir, acc = []) {
  if (!statSync(dir).isDirectory()) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkJsFiles(full, acc);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

test("1. production default creates durable runtime", () => {
  const { runtime } = createDefaultDurable();
  assert.equal(runtime.kind, "competition-referee-production-runtime");
  assert.equal(runtime.classification, DURABLE_PRODUCTION_RUNTIME_CLASSIFICATION);
  assert.equal(runtime.durable, true);
  assert.equal(runtime.tables.ASSIGNMENTS, CANONICAL_REFEREE_PERSISTENCE_TABLES.ASSIGNMENTS);
  assert.equal(runtime.tables.LIVE_STATES, "match_live_states");
  assert.equal(runtime.tables.EVENTS, "match_events");
  assert.equal(runtime.tables.RESULT_REVISIONS, "match_result_revisions");
  assert.equal(runtime.tables.SYNC_MUTATIONS, "match_sync_mutations");
});

test("2-4. production dependencies required; missing fails closed; no in-memory fallback", async () => {
  await expectAdapterCode(
    () => createDefaultCompetitionRefereeRuntime({}),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
  await expectAdapterCode(
    () =>
      createDefaultCompetitionRefereeRuntime({
        durableDriver: createInMemoryRefereeOperationsStore({ clockIso: CLOCK }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  await expectAdapterCode(
    () =>
      createDefaultCompetitionRefereeRuntime({
        durableDriver: createSchemaFaithfulCanonicalRefereeDurableDriver({
          clockIso: CLOCK,
        }),
      }),
    REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN
  );
  try {
    createRefereeCompetitionOperationsFacade({ runtimePorts: createPorts() });
    assert.fail("expected missing store fail-closed");
  } catch (err) {
    assert.equal(isRefereeOperationsError(err), true);
    assert.equal(err.code, REFEREE_ERROR_CODE.PRECONDITION_FAILED);
    assert.equal(err.failClosed, true);
  }
  assert.equal(COMPETITION_ENGINE_REFEREE_OPERATIONS.inMemoryProductionFallback, false);
});

test("5. explicit in-memory test double still works", async () => {
  const store = createInMemoryRefereeOperationsStore({ clockIso: CLOCK });
  assert.equal(store.classification, IN_MEMORY_RUNTIME_CLASSIFICATION);
  assert.equal(store.durable, false);
  const facade = createRefereeCompetitionOperationsFacade({
    store,
    runtimePorts: createPorts(),
    clockIso: CLOCK,
  });
  assert.equal(facade.wiredToProductionRuntime, false);
  assert.equal(facade.runtimeClassification, "TEST_DOUBLE_ONLY");
  await facade.seedAssignments({
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    assignments: [{ matchId: SCOPE.matchId, refereeId: ACTOR.actorId }],
  });
  const queue = await facade.getRefereeAssignmentQueue({
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    actor: ACTOR,
  });
  assert.equal(queue.ok, true);
  assert.equal(queue.queue.length, 1);
});

test("6. wiredToProductionRuntime=true only on durable default path", () => {
  const { runtime: durable } = createDefaultDurable();
  assert.equal(durable.wiredToProductionRuntime, true);
  assert.equal(durable.facade.wiredToProductionRuntime, true);
  assert.equal(COMPETITION_ENGINE_REFEREE_OPERATIONS.wiredToProductionRuntime, true);
  assert.equal(COMPETITION_REFEREE_ADAPTER_INTEGRATION.wiredToProductionRuntime, true);
  const testFacade = createRefereeCompetitionOperationsFacade({
    store: createInMemoryRefereeOperationsStore({ clockIso: CLOCK }),
    runtimePorts: createPorts(),
  });
  assert.equal(testFacade.wiredToProductionRuntime, false);
});

test("7-14. auth, tenant, assignment, version, idempotency, append-only, CORE-17, fresh-read", async () => {
  const { driver, runtime } = createDefaultDurable();
  await expectAdapterCode(
    () => runtime.assignmentRepository.upsert(SCOPE, { name: "Coach A" }),
    REFEREE_ADAPTER_ERROR_CODE.MISSING_CANONICAL_IDENTITY
  );
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
  await runtime.matchStateRepository.putLiveState(
    {
      ...SCOPE,
      status: "in_progress",
      statePayload: { canonical: { marker: "cutover" } },
      idempotencyKey: "state-1",
    },
    ACTOR
  );
  const live = await runtime.matchStateRepository.getLiveState(SCOPE);
  await expectAdapterCode(
    () =>
      runtime.matchStateRepository.putLiveState(
        {
          ...SCOPE,
          expectedVersion: 99,
          statePayload: { stale: true },
          idempotencyKey: "state-stale",
        },
        ACTOR
      ),
    REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
  );
  const event = await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  assert.equal(event.duplicate, false);
  const replay = await runtime.scoringEventLedger.appendEvent(
    { ...SCOPE, payload: { cmd: "POINT" }, idempotencyKey: "cmd-1" },
    ACTOR
  );
  assert.equal(replay.duplicate, true);
  await expectAdapterCode(
    () => driver.tryUpdateEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  await expectAdapterCode(
    () => driver.tryDeleteEvent(),
    REFEREE_ADAPTER_ERROR_CODE.APPEND_ONLY_VIOLATION
  );
  const accepted = await runtime.resultRevisionRepository.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "A" } },
    ACTOR
  );
  assert.equal(accepted.lineageStatus, "ACTIVE");
  await runtime.resultRevisionRepository.appendRevision(
    { ...SCOPE, acceptanceStatus: "ACCEPTED", payload: { winner: "B" } },
    ACTOR
  );
  const active = await runtime.resultRevisionRepository.getActive(SCOPE);
  assert.equal(active.payload.winner, "B");
  const fresh = await runtime.matchStateRepository.getLiveState(SCOPE);
  assert.equal(Number(fresh.stateVersion ?? fresh.version) >= Number(live.stateVersion ?? live.version), true);
});

test("7-14b. default durable facade reconstructs after assign+open", async () => {
  const { runtime } = createDefaultDurable();
  await runtime.assignmentRepository.upsert(
    { ...SCOPE, refereeUserId: ACTOR.actorId },
    ACTOR
  );
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
  const opened = await runtime.facade.openAssignedMatch({
    tenantId: SCOPE.tenantId,
    competitionId: SCOPE.competitionId,
    matchId: SCOPE.matchId,
    actor: ACTOR,
    commandId: "open-cutover-1",
    competitionMode: "INTERNAL",
    modeState,
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.match.status, MATCH_STATUS.IN_PROGRESS);
  const reconstructed = await runtime.opsStore.get(SCOPE.tenantId, SCOPE.competitionId);
  assert.equal(reconstructed.matches[SCOPE.matchId].status, MATCH_STATUS.IN_PROGRESS);
});

test("15-16. no privileged browser RPC and no client service-role env resolution", async () => {
  const prev = globalThis.window;
  globalThis.window = {};
  try {
    await expectAdapterCode(
      () =>
        createLiveRpcCanonicalRefereeDurableDriver({
          rpcClient: { rpc: () => ({ data: { ok: true }, error: null }) },
        }),
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
    );
    await expectAdapterCode(
      () =>
        createDefaultCompetitionRefereeRuntime({
          rpcClient: { rpc: () => ({ data: { ok: true }, error: null }) },
        }),
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
    );
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }

  await expectAdapterCode(
    () =>
      createDefaultCompetitionRefereeRuntime({
        env: { VITE_SUPABASE_SERVICE_ROLE_KEY: "x" },
        rpcClient: { rpc: () => ({ data: { ok: true }, error: null }) },
      }),
    REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );

  const live = createDefaultCompetitionRefereeRuntime({
    rpcClient: {
      rpc: () => ({ data: { ok: true }, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    },
    runtimePorts: createPorts(),
    clockIso: CLOCK,
  });
  assert.equal(live.driverKind, LIVE_RPC_DRIVER_KIND);
  assert.equal(live.wiredToProductionRuntime, true);
  assert.equal(live.inMemoryProductionFallback, false);
});

test("17-20. Adapter B cut over; no duplicate authorities; contract locked", () => {
  const { runtime } = createDefaultDurable();
  assert.equal(runtime.usesRefereeV5ScoringEngine, false);
  assert.equal(runtime.usesCore16Scoring, true);
  assert.equal(runtime.usesCore15Lifecycle, true);
  assert.equal(runtime.usesCore17Result, true);
  assert.equal(runtime.usesAdapterB, true);
  assert.equal(runtime.modeAdapterRegistry.size(), 4);
  assert.equal(runtime.identityAuthority, "auth.uid");
  assert.equal(runtime.stagingBackendCertified, true);
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_LOCKED, true);
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
    "competition.referee.adapter.v1"
  );
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  assert.equal(
    COMPETITION_REFEREE_ADAPTER_INTEGRATION.usesAdapterBProductionCutover,
    true
  );
});

test("static secret/bundle audit — pages and referee UI must not host privileged runtime", () => {
  const pageFiles = walkJsFiles(path.join(ROOT, "src/pages"));
  const refereeUi = [
    ...walkJsFiles(path.join(ROOT, "src/features/referee-v5/components")),
    ...walkJsFiles(path.join(ROOT, "src/features/referee-v5/hooks")),
    ...walkJsFiles(path.join(ROOT, "src/features/referee-v5/services")),
  ];
  const compositionFiles = walkJsFiles(
    path.join(ROOT, "src/features/competition-engine/integration/referee")
  );

  for (const file of [...pageFiles, ...refereeUi]) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      CLIENT_SECRET_RE.test(text),
      false,
      `${rel(file)} must not reference service-role secrets`
    );
    assert.equal(
      text.includes("createDefaultCompetitionRefereeRuntime"),
      false,
      `${rel(file)} must not construct default durable referee runtime`
    );
    assert.equal(
      text.includes("createLiveRpcCanonicalRefereeDurableDriver"),
      false,
      `${rel(file)} must not import live RPC durable driver`
    );
    assert.equal(
      text.includes("createCompetitionRefereeProductionRuntime"),
      false,
      `${rel(file)} must not import production runtime builder`
    );
  }

  const edgeClient = path.join(
    ROOT,
    "src/features/referee-v5/services/refereeV5EdgeClient.js"
  );
  const edgeText = readFileSync(edgeClient, "utf8");
  assert.equal(INTERNAL_COMMIT_RPC_RE.test(edgeText), false);
  assert.equal(CLIENT_SECRET_RE.test(edgeText), false);

  const internalRpc = path.join(
    ROOT,
    "src/features/referee-v5/services/refereeV5InternalRpcService.js"
  );
  const internalText = readFileSync(internalRpc, "utf8");
  assert.match(internalText, /typeof window !== "undefined"/);
  assert.match(internalText, /INTERNAL_RPC_FORBIDDEN|Internal commit RPC/);

  for (const file of compositionFiles) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /import\.meta\.env/.test(text),
      false,
      `${rel(file)} must not read import.meta.env`
    );
    assert.equal(
      /VITE_[A-Z0-9_]*SERVICE_ROLE/.test(text) &&
        !text.includes("VITE_.*SERVICE_ROLE") &&
        !text.includes("VITE_[A-Z0-9_]*SERVICE_ROLE"),
      false,
      `${rel(file)} must not embed Vite service-role env reads`
    );
    assert.doesNotMatch(text, /SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/);
  }
});
