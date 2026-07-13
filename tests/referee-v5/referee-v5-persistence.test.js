import test from "node:test";
import assert from "node:assert/strict";

import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../../src/features/referee-v5/constants/eventTypes.js";
import { REFEREE_V5_ERROR } from "../../src/features/referee-v5/persistence/errors.js";
import {
  InMemoryMatchRepository,
  RefereeV5PersistenceService,
} from "../../src/features/referee-v5/persistence/RefereeV5PersistenceService.js";
import {
  assertClientCannotDirectInsert,
  authorizeRefereeAccess,
} from "../../src/features/referee-v5/persistence/refereeV5Authorization.js";
import { validateMatchCommandPayload } from "../../src/features/referee-v5/persistence/validateCommandPayload.js";
import { buildDoublesSideOutConfig, initStartedMatch } from "./testHelpers.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { resolveServeDirection } from "../../src/features/referee-v5/selectors/serveContextSelector.js";
import { RALLY_VARIANT } from "../../src/features/referee-v5/constants/scoringFormats.js";

const TENANT = "tenant-a";
const TOURNAMENT = "tour-1";
const MATCH = "match-1";

function setupService() {
  const repo = new InMemoryMatchRepository();
  const service = new RefereeV5PersistenceService(repo);
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
  return { repo, service, initialState: initial.state };
}

function actor(userId = "ref-1", tenantId = TENANT, role = "REFEREE") {
  return { userId, tenantId, role };
}

function assignment(userId = "ref-1") {
  return {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    userId,
    assignmentRole: "REFEREE",
    status: "active",
  };
}

async function apply(service, overrides = {}) {
  const assign = overrides.assignment ?? assignment(overrides.userId);
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(overrides.userId),
    assignment: assign,
  });
  return service.applyMatchCommand({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    commandType: overrides.commandType || MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: overrides.expectedVersion ?? loaded.stateVersion,
    expectedSequence: overrides.expectedSequence ?? loaded.lastEventSequence,
    clientMutationId: overrides.clientMutationId || overrides.idempotencyKey || `mut-${Math.random()}`,
    idempotencyKey: overrides.idempotencyKey || `idem-${Math.random()}`,
    actor: actor(overrides.userId),
    assignment: assign,
    payload: overrides.payload || {},
  });
}

// ─── Integration 1-15 ────────────────────────────────────────────

test("1 load match state succeeds", async () => {
  const { service } = setupService();
  const result = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.stateVersion, 0);
});

test("2 assigned referee apply rally succeeds", async () => {
  const { service } = setupService();
  await apply(service);
  const rally = await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY });
  assert.equal(rally.ok, true);
  assert.equal(rally.state.teams.teamA.score, 1);
});

test("3 unassigned referee rejected", async () => {
  const { service } = setupService();
  const result = await service.applyMatchCommand({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: 0,
    expectedSequence: 0,
    clientMutationId: "m1",
    idempotencyKey: "i1",
    actor: actor("unknown-ref"),
    assignment: null,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
});

test("4 player role rejected without assignment", async () => {
  const auth = authorizeRefereeAccess({
    actor: { userId: "player-1", tenantId: TENANT, role: "PLAYER" },
    assignment: null,
    tenantId: TENANT,
  });
  assert.equal(auth.ok, false);
});

test("5 other tenant rejected", async () => {
  const { service } = setupService();
  const result = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor("ref-1", "tenant-b"),
    assignment: assignment(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.TENANT_ACCESS_DENIED);
});

test("6 command creates exactly one event", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k-start" });
  const events = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(events.length, 1);
});

test("7 command updates snapshot", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k-start" });
  const live = repo.getLiveState(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(live.stateVersion, 1);
  assert.equal(live.status, MATCH_STATUS.IN_PROGRESS);
});

test("8 event and snapshot committed together", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k-start" });
  const live = repo.getLiveState(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  const events = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(events[0].state_version_after, live.stateVersion);
});

test("9 engine state matches persisted state", async () => {
  const { service } = setupService();
  const started = await apply(service, { idempotencyKey: "k1" });
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(JSON.stringify(started.state), JSON.stringify(loaded.state));
});

test("10 reload restores server", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(loaded.state.servingPlayerId, "A");
});

test("11 reload restores receiver", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(loaded.state.receivingPlayerId, "D");
});

test("12 reload restores serve direction", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(loaded.serveDirection, resolveServeDirection(loaded.state));
});

test("13 switch ends preserves identities", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const before = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  await apply(service, { commandType: MATCH_EVENT_TYPE.SWITCH_ENDS, idempotencyKey: "k2" });
  const after = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(after.state.servingPlayerId, before.state.servingPlayerId);
  assert.equal(after.state.receivingPlayerId, before.state.receivingPlayerId);
});

test("14 undo creates EVENT_REVERTED", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  const undo = await apply(service, { commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT, idempotencyKey: "k3" });
  assert.equal(undo.ok, true);
  assert.ok(undo.generatedEvents.includes(MATCH_EVENT_TYPE.EVENT_REVERTED));
});

test("15 undo does not delete old events", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT, idempotencyKey: "k3" });
  const events = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.ok(events.length >= 3);
});

// ─── Concurrency 16-20 ───────────────────────────────────────────

test("16 concurrent same version: only one succeeds", async () => {
  const { service } = setupService();
  const [a, b] = await Promise.all([
    apply(service, { idempotencyKey: "ka", clientMutationId: "ma", expectedVersion: 0, expectedSequence: 0 }),
    apply(service, { idempotencyKey: "kb", clientMutationId: "mb", expectedVersion: 0, expectedSequence: 0 }),
  ]);
  const successes = [a, b].filter((r) => r.ok).length;
  assert.equal(successes, 1);
});

test("17 loser gets MATCH_STATE_CONFLICT", async () => {
  const { service } = setupService();
  const [a, b] = await Promise.all([
    apply(service, { idempotencyKey: "ka", clientMutationId: "ma" }),
    apply(service, { idempotencyKey: "kb", clientMutationId: "mb" }),
  ]);
  const loser = a.ok ? b : a;
  assert.equal(loser.code, REFEREE_V5_ERROR.MATCH_STATE_CONFLICT);
});

test("18 state not overwritten on conflict", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const stale = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 0,
    expectedSequence: 0,
    idempotencyKey: "stale",
  });
  assert.equal(stale.ok, false);
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(loaded.state.teams.teamA.score, 0);
});

test("19 event sequence never duplicates", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  const events = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  const sequences = events.map((e) => e.event_sequence);
  assert.equal(new Set(sequences).size, sequences.length);
});

test("20 snapshot version increments correctly", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  const live = repo.getLiveState(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(live.stateVersion, 2);
});

// ─── Idempotency 21-25 ───────────────────────────────────────────

test("21 double submit only scores once", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const first = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "same-key",
    clientMutationId: "dup",
  });
  const second = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "same-key",
    clientMutationId: "dup",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  const loaded = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(loaded.state.teams.teamA.score, 1);
});

test("22 retry returns same response shape", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const first = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "retry-key",
  });
  const retry = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "retry-key",
  });
  assert.equal(retry.stateVersion, first.stateVersion);
});

test("23 idempotent retry does not create duplicate events", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "dup-key" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "dup-key" });
  const events = repo.getEvents(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(events.length, 2);
});

test("24 idempotent retry does not double version", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "v-key" });
  const retry = await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "v-key" });
  assert.equal(retry.stateVersion, 2);
});

test("25 finalize twice creates one result", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const f1 = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "fin-1",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  const f2 = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "fin-1",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  assert.equal(f1.ok, true);
  assert.equal(f2.duplicate, true);
});

// ─── RLS / auth 26-35 ────────────────────────────────────────────

test("26 referee reads assigned match", async () => {
  const { service } = setupService();
  const result = await service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actor: actor("ref-1"),
    assignment: assignment("ref-1"),
  });
  assert.equal(result.ok, true);
});

test("27 referee cannot read without assignment", async () => {
  const auth = authorizeRefereeAccess({
    actor: actor("ref-2"),
    assignment: null,
    tenantId: TENANT,
  });
  assert.equal(auth.ok, false);
});

test("28 tenant A cannot access tenant B", async () => {
  const auth = authorizeRefereeAccess({
    actor: { userId: "ref-1", tenantId: "tenant-b" },
    assignment: assignment("ref-1"),
    tenantId: TENANT,
  });
  assert.equal(auth.ok, false);
});

test("29 client cannot insert events directly", () => {
  const result = assertClientCannotDirectInsert("INSERT match_events");
  assert.equal(result.ok, false);
});

test("30 client cannot update live state", () => {
  const result = assertClientCannotDirectInsert("UPDATE match_live_states");
  assert.equal(result.ok, false);
});

test("31 client cannot update official result", () => {
  const result = assertClientCannotDirectInsert("UPDATE match_result_revisions");
  assert.equal(result.ok, false);
});

test("32 revoked assignment rejected", async () => {
  const { repo, service } = setupService();
  const revoked = { ...assignment("ref-1"), status: "revoked" };
  repo.upsertAssignment(revoked);
  const result = await apply(service, { userId: "ref-1", idempotencyKey: "k1", assignment: revoked });
  assert.equal(result.code, REFEREE_V5_ERROR.ASSIGNMENT_REVOKED);
});

test("33 expired assignment rejected", async () => {
  const { repo, service } = setupService();
  const expired = {
    ...assignment("ref-1"),
    expiresAt: new Date(Date.now() - 60000).toISOString(),
  };
  repo.upsertAssignment(expired);
  const result = await apply(service, { userId: "ref-1", idempotencyKey: "k1", assignment: expired });
  assert.equal(result.code, REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED);
});

test("34 super admin bypasses assignment", () => {
  const auth = authorizeRefereeAccess({
    actor: { userId: "admin", tenantId: TENANT, role: "SUPER_ADMIN" },
    assignment: null,
    tenantId: TENANT,
  });
  assert.equal(auth.ok, true);
});

test("35 service role path not exposed to client insert", () => {
  const payload = validateMatchCommandPayload(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, {
    serving_player_id: "spoof",
  });
  assert.equal(payload.ok, false);
});

// ─── Finalize 36-45 ──────────────────────────────────────────────

test("36 incomplete match finalize rejected without force", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const result = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f1",
    actor: actor(),
    assignment: assignment(),
  });
  assert.equal(result.code, REFEREE_V5_ERROR.RESULT_NOT_READY);
});

test("37 force finalize succeeds", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const result = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f2",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  assert.equal(result.ok, true);
});

test("38 winner determined correctly", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  const result = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 2,
    idempotencyKey: "f3",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  assert.equal(result.revision.winnerId, "team-a");
});

test("39 result revision created", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f4",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  assert.equal(repo.results.size, 1);
});

test("40 live state locked after finalize", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f5",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  const live = repo.getLiveState(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(live.status, MATCH_STATUS.LOCKED);
});

test("41 rally after finalize rejected", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f6",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  const rally = await apply(service, {
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    idempotencyKey: "after-lock",
  });
  assert.equal(rally.code, REFEREE_V5_ERROR.MATCH_LOCKED);
});

test("42 override without reason rejected", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const result = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f7",
    actor: actor(),
    assignment: assignment(),
    isOverride: true,
    forceComplete: true,
  });
  assert.equal(result.code, REFEREE_V5_ERROR.OVERRIDE_REASON_REQUIRED);
});

test("43 snapshot replay verification passes", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  const verify = await service.verifySnapshotMatchesReplay(`${TENANT}::${TOURNAMENT}::${MATCH}`);
  assert.equal(verify.ok, true);
});

test("44 bracket hook not invoked in service", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const result = await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f8",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.bracketUpdated, undefined);
});

test("45 rating hook not created", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  await service.finalizeMatchResult({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    expectedVersion: 1,
    idempotencyKey: "f9",
    actor: actor(),
    assignment: assignment(),
    forceComplete: true,
  });
  const revision = [...repo.results.values()][0];
  assert.equal(revision.ratingEvidenceId, undefined);
});

// ─── Regression markers 46-50 ────────────────────────────────────

test("46 V5-B engine init still works", () => {
  const state = initStartedMatch();
  assert.equal(state.servingPlayerId, "A");
});

test("47 MLP config rejected at validation layer", () => {
  const result = validateMatchCommandPayload(MATCH_EVENT_TYPE.START_MATCH, {
    rallyVariant: RALLY_VARIANT.MLP,
  });
  assert.equal(result.ok, false);
});

test("48 persistence service uses shared engine", async () => {
  const { service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  const rally = await apply(service, { commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, idempotencyKey: "k2" });
  assert.equal(rally.state.receivingPlayerId, "C");
});

test("49 audit log written on command", async () => {
  const { repo, service } = setupService();
  await apply(service, { idempotencyKey: "k1" });
  assert.ok(repo.auditLog.length >= 1);
});

test("50 forbidden official payload keys rejected", () => {
  const result = validateMatchCommandPayload(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, {
    team_a_score: 99,
  });
  assert.equal(result.ok, false);
});
