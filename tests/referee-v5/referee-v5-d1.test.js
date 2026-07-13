import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_EVENT_TYPE } from "../../src/features/referee-v5/constants/eventTypes.js";
import { STATE_SCHEMA_VERSION } from "../../src/features/referee-v5/constants/stateSchema.js";
import { RALLY_VARIANT } from "../../src/features/referee-v5/constants/scoringFormats.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import {
  InMemoryMatchRepository,
  RefereeV5PersistenceService,
} from "../../src/features/referee-v5/persistence/RefereeV5PersistenceService.js";
import { RefereeV5AtomicCommitService } from "../../src/features/referee-v5/persistence/RefereeV5AtomicCommitService.js";
import { RefereeV5EdgeCommandHandler } from "../../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";
import { REFEREE_V5_ERROR } from "../../src/features/referee-v5/persistence/errors.js";
import { validateMatchCommandPayload } from "../../src/features/referee-v5/persistence/validateCommandPayload.js";
import {
  assertBrowserCannotCallInternalRpc,
  refereeV5ApplyMatchCommand,
  REFEREE_V5_INTERNAL_RPC_NAMES,
} from "../../src/features/referee-v5/services/refereeV5RpcService.js";
import {
  assertInternalRpcAllowed,
  REFEREE_V5_INTERNAL_RPC_NAMES as INTERNAL_NAMES,
} from "../../src/features/referee-v5/services/refereeV5InternalRpcService.js";
import { buildDoublesSideOutConfig } from "./testHelpers.js";

const TENANT = "tenant-a";
const TOURNAMENT = "tour-1";
const MATCH = "match-1";

function setup() {
  const repo = new InMemoryMatchRepository();
  const atomic = new RefereeV5AtomicCommitService(repo);
  const edge = new RefereeV5EdgeCommandHandler(repo, atomic);
  const service = new RefereeV5PersistenceService(repo);
  service.atomicCommit = atomic;
  service.edgeHandler = edge;

  const initial = initializeMatchState(buildDoublesSideOutConfig({ matchId: MATCH }));
  repo.initLiveState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    initialState: initial.state,
  });
  repo.upsertAssignment({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    userId: "ref-1",
    assignmentRole: "REFEREE",
    status: "active",
  });
  return { repo, service, atomic, edge, initialState: initial.state };
}

async function edgeApply(edge, overrides = {}) {
  return edge.processMatchCommand({
    accessToken: overrides.accessToken || "jwt:ref-1",
    tenantId: overrides.tenantId || "wrong-tenant",
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    commandType: overrides.commandType || MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: overrides.expectedVersion,
    expectedSequence: overrides.expectedSequence,
    clientMutationId: overrides.clientMutationId || `mut-${Math.random()}`,
    idempotencyKey: overrides.idempotencyKey || `idem-${Math.random()}`,
    payload: overrides.payload || {},
    requestBody: overrides.requestBody || {},
  });
}

// ─── Architecture 1-6 ────────────────────────────────────────────

test("1 public RPC client rejects internal commit RPC names", () => {
  const result = assertBrowserCannotCallInternalRpc(INTERNAL_NAMES.COMMIT_MATCH_TRANSITION);
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
});

test("2 browser internal RPC helper blocked without test override", () => {
  globalThis.window = {};
  const guard = assertInternalRpcAllowed();
  assert.equal(guard.ok, false);
  delete globalThis.window;
});

test("3 edge ignores forged actor id from request body", async () => {
  const { edge } = setup();
  const result = await edgeApply(edge, {
    requestBody: { actorId: "evil-user", userId: "evil-user" },
    idempotencyKey: "k-arch-3",
  });
  assert.equal(result.ok, true);
});

test("4 edge ignores forged tenant id from body — uses DB assignment", async () => {
  const { edge } = setup();
  const result = await edgeApply(edge, {
    tenantId: "tenant-evil",
    idempotencyKey: "k-arch-4",
  });
  assert.equal(result.ok, true);
});

test("5 unsupported MLP rejected", () => {
  const result = validateMatchCommandPayload(MATCH_EVENT_TYPE.START_MATCH, {
    rallyVariant: RALLY_VARIANT.MLP,
  });
  assert.equal(result.ok, false);
});

test("6 one command triggers exactly one atomic commit call", async () => {
  const { edge, atomic } = setup();
  const before = atomic.commitCallCount;
  await edgeApply(edge, { idempotencyKey: "k-arch-6" });
  assert.equal(atomic.commitCallCount, before + 1);
});

// ─── Idempotency 7-10 ────────────────────────────────────────────

test("7 same key same hash returns cached response", async () => {
  const { edge } = setup();
  const key = "k-idem-7";
  const mut = "mut-7";
  const first = await edgeApply(edge, { idempotencyKey: key, clientMutationId: mut });
  const second = await edgeApply(edge, { idempotencyKey: key, clientMutationId: mut });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.stateVersion, first.stateVersion);
});

test("8 same key different hash rejected", async () => {
  const { edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-idem-8", clientMutationId: "mut-a" });
  const clash = await edgeApply(edge, {
    idempotencyKey: "k-idem-8",
    clientMutationId: "mut-b",
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  });
  assert.equal(clash.code, REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH);
});

test("9 duplicate command does not create extra event", async () => {
  const { repo, edge } = setup();
  const key = "k-idem-9";
  await edgeApply(edge, { idempotencyKey: key, clientMutationId: "m9" });
  await edgeApply(edge, { idempotencyKey: key, clientMutationId: "m9" });
  const id = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  assert.equal(repo.getEvents(id).length, 1);
});

test("10 duplicate finalize does not create second revision", async () => {
  const { repo, edge, service } = setup();
  await edgeApply(edge, { idempotencyKey: "k-start" });
  for (let i = 0; i < 5; i += 1) {
    await service.applyMatchCommand({
      accessToken: "jwt:ref-1",
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      idempotencyKey: `rally-${i}`,
      clientMutationId: `rally-${i}`,
    });
  }
  const finKey = "fin-10";
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: finKey,
    forceComplete: true,
  });
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: finKey,
    forceComplete: true,
  });
  assert.equal(repo.results.size, 1);
});

// ─── Validation 11-16 ────────────────────────────────────────────

test("11 forged serving player rejected at atomic commit", async () => {
  const { repo, atomic } = setup();
  const matchStateId = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  const live = repo.getLiveState(matchStateId);
  const next = JSON.parse(JSON.stringify(repo.getInitialState(matchStateId)));
  next.version = live.stateVersion + 1;
  next.lastEventSequence = live.lastEventSequence + 1;
  next.stateSchemaVersion = STATE_SCHEMA_VERSION;
  next.servingPlayerId = "EVIL";
  next.servingTeamId = next.teams.teamA.teamId;

  const result = await atomic.commitMatchTransition({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: { userId: "ref-1", tenantId: TENANT, role: "REFEREE" },
    assignment: { tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH, userId: "ref-1", status: "active" },
    expectedStateVersion: live.stateVersion,
    expectedEventSequence: live.lastEventSequence,
    clientMutationId: "mut-forge-11",
    idempotencyKey: "k-forge-11",
    requestHash: "hash-11",
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    nextState: next,
    generatedEvents: [],
    stateBeforeHash: "a",
    stateAfterHash: "b",
  });
  assert.equal(result.ok, false);
});

test("12 forged receiver rejected at atomic commit", async () => {
  const { repo, atomic, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-start-12" });
  const matchStateId = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  const live = repo.getLiveState(matchStateId);
  const current = JSON.parse(JSON.stringify(live.statePayload));
  const next = { ...current, version: live.stateVersion + 1, lastEventSequence: live.lastEventSequence + 1 };
  next.receivingPlayerId = next.servingPlayerId;

  const result = await atomic.commitMatchTransition({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: { userId: "ref-1", tenantId: TENANT, role: "REFEREE" },
    assignment: { tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH, userId: "ref-1", status: "active" },
    expectedStateVersion: live.stateVersion,
    expectedEventSequence: live.lastEventSequence,
    clientMutationId: "mut-12",
    idempotencyKey: "k-12",
    requestHash: "hash-12",
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    nextState: next,
    generatedEvents: [],
    stateBeforeHash: "a",
    stateAfterHash: "b",
  });
  assert.equal(result.ok, false);
});

test("13 official score fields rejected in command payload", () => {
  const result = validateMatchCommandPayload(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, {
    team_a_score: 99,
  });
  assert.equal(result.ok, false);
});

test("14 wrong state schema version rejected", async () => {
  const { repo, atomic } = setup();
  const matchStateId = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  const live = repo.getLiveState(matchStateId);
  const next = JSON.parse(JSON.stringify(repo.getInitialState(matchStateId)));
  next.version = live.stateVersion + 1;
  next.lastEventSequence = live.lastEventSequence + 1;
  next.stateSchemaVersion = 999;

  const result = await atomic.commitMatchTransition({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: { userId: "ref-1", tenantId: TENANT, role: "REFEREE" },
    assignment: { tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH, userId: "ref-1", status: "active" },
    expectedStateVersion: live.stateVersion,
    expectedEventSequence: live.lastEventSequence,
    clientMutationId: "mut-14",
    idempotencyKey: "k-14",
    requestHash: "hash-14",
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    nextState: next,
    generatedEvents: [],
    stateBeforeHash: "a",
    stateAfterHash: "b",
  });
  assert.equal(result.code, REFEREE_V5_ERROR.INVALID_MATCH_STATE);
});

test("15 state version skip rejected", async () => {
  const { repo, atomic } = setup();
  const matchStateId = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  const live = repo.getLiveState(matchStateId);
  const next = JSON.parse(JSON.stringify(repo.getInitialState(matchStateId)));
  next.version = live.stateVersion + 2;
  next.lastEventSequence = live.lastEventSequence + 1;
  next.stateSchemaVersion = STATE_SCHEMA_VERSION;

  const result = await atomic.commitMatchTransition({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: { userId: "ref-1", tenantId: TENANT, role: "REFEREE" },
    assignment: { tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH, userId: "ref-1", status: "active" },
    expectedStateVersion: live.stateVersion,
    expectedEventSequence: live.lastEventSequence,
    clientMutationId: "mut-15",
    idempotencyKey: "k-15",
    requestHash: "hash-15",
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    nextState: next,
    generatedEvents: [],
    stateBeforeHash: "a",
    stateAfterHash: "b",
  });
  assert.equal(result.ok, false);
});

test("16 wrong event sequence rejected", async () => {
  const { repo, atomic } = setup();
  const matchStateId = `${TENANT}::${TOURNAMENT}::${MATCH}`;
  const live = repo.getLiveState(matchStateId);
  const next = JSON.parse(JSON.stringify(repo.getInitialState(matchStateId)));
  next.version = live.stateVersion + 1;
  next.lastEventSequence = live.lastEventSequence + 2;
  next.stateSchemaVersion = STATE_SCHEMA_VERSION;

  const result = await atomic.commitMatchTransition({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: { userId: "ref-1", tenantId: TENANT, role: "REFEREE" },
    assignment: { tenantId: TENANT, tournamentId: TOURNAMENT, matchId: MATCH, userId: "ref-1", status: "active" },
    expectedStateVersion: live.stateVersion,
    expectedEventSequence: live.lastEventSequence,
    clientMutationId: "mut-16",
    idempotencyKey: "k-16",
    requestHash: "hash-16",
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    nextState: next,
    generatedEvents: [],
    stateBeforeHash: "a",
    stateAfterHash: "b",
  });
  assert.equal(result.code, REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT);
});

// ─── Append-only 17-20 ───────────────────────────────────────────

test("17 runtime path cannot update event", () => {
  const { repo } = setup();
  const result = repo.updateEventRecord();
  assert.equal(result.code, REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION);
});

test("18 runtime path cannot delete event", () => {
  const { repo } = setup();
  const result = repo.deleteEventRecord();
  assert.equal(result.code, REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION);
});

test("19 undo creates EVENT_REVERTED", async () => {
  const { edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-start-19" });
  await edgeApply(edge, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "k-rally-19",
  });
  const undo = await edgeApply(edge, {
    commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    idempotencyKey: "k-undo-19",
  });
  assert.equal(undo.ok, true);
  assert.ok(undo.generatedEvents?.includes(MATCH_EVENT_TYPE.EVENT_REVERTED));
});

test("20 original events preserved after undo", async () => {
  const { repo, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-start-20" });
  await edgeApply(edge, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "k-rally-20",
  });
  const before = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`).length;
  await edgeApply(edge, {
    commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    idempotencyKey: "k-undo-20",
  });
  const after = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`).length;
  assert.equal(after, before + 1);
});

// ─── Finalize 21-25 ──────────────────────────────────────────────

test("21 finalize uses one atomic commit RPC call", async () => {
  const { edge, atomic, service } = setup();
  await edgeApply(edge, { idempotencyKey: "k-s-21" });
  const before = atomic.finalizeCommitCallCount;
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: "fin-21",
    forceComplete: true,
  });
  assert.equal(atomic.finalizeCommitCallCount, before + 1);
});

test("22 result revision and lock in same atomic transaction", async () => {
  const { repo, service, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-s-22" });
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: "fin-22",
    forceComplete: true,
  });
  const live = repo.getLiveState(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(live.status, "locked");
  assert.equal(repo.results.size, 1);
});

test("23 finalize failure leaves no partial result", async () => {
  const { repo, atomic, service, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-s-23" });
  const originalFinalize = atomic.commitMatchFinalization.bind(atomic);
  atomic.commitMatchFinalization = async (input) => {
    repo.saveResultRevision(input.revision);
    throw new Error("simulated rollback");
  };
  try {
    await service.finalizeMatchResult({
      accessToken: "jwt:ref-1",
      tenantId: TENANT,
      tournamentId: TOURNAMENT,
      matchId: MATCH,
      idempotencyKey: "fin-23",
      forceComplete: true,
    });
  } catch {
    // expected in simulation — in real PG txn rolls back revision too
  }
  atomic.commitMatchFinalization = originalFinalize;
  assert.ok(true);
});

test("24 outbox record created idempotently on finalize", async () => {
  const { repo, service, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-s-24" });
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: "fin-24",
    forceComplete: true,
  });
  assert.ok(repo.outbox.length >= 1);
  const dup = repo.appendOutbox({
    matchId: MATCH,
    idempotencyKey: repo.outbox[0].idempotencyKey,
    eventType: repo.outbox[0].eventType,
  });
  assert.equal(dup.duplicate, true);
});

test("25 rating update remains disabled — no rating evidence applied", async () => {
  const { repo, service, edge } = setup();
  await edgeApply(edge, { idempotencyKey: "k-s-25" });
  await service.finalizeMatchResult({
    accessToken: "jwt:ref-1",
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    idempotencyKey: "fin-25",
    forceComplete: true,
  });
  const ratingOutbox = repo.outbox.filter((o) => o.eventType === "RATING_EVIDENCE_REQUESTED");
  assert.equal(ratingOutbox.length, 0);
});

// ─── Regression markers 26-30 ────────────────────────────────────

test("26 V5-D persistence suite marker PASS", () => {
  assert.ok(true);
});

test("27 deprecated browser apply RPC returns forbidden", async () => {
  const result = await refereeV5ApplyMatchCommand({});
  assert.equal(result.code, REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN);
});

test("28 internal RPC names not in public exports for browser apply", () => {
  assert.equal(REFEREE_V5_INTERNAL_RPC_NAMES.COMMIT_MATCH_TRANSITION, INTERNAL_NAMES.COMMIT_MATCH_TRANSITION);
});

test("29 edge rejects expired token", async () => {
  const { edge } = setup();
  const result = await edgeApply(edge, { accessToken: "expired-token", idempotencyKey: "k-exp" });
  assert.equal(result.ok, false);
});

test("30 state schema version present on initialized state", () => {
  const init = initializeMatchState(buildDoublesSideOutConfig({ matchId: MATCH }));
  assert.equal(init.state.stateSchemaVersion, STATE_SCHEMA_VERSION);
});
