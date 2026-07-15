/**
 * R2-2E — Client domain ↔ Edge/server runtime parity for USAP 2026 Rally Doubles.
 * Uses InMemory repository + EdgeCommandHandler (same path PersistenceService uses).
 * Local HTTP exercises edgeHttpHandler action routing with injected runtime (no staging).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MATCH_EVENT_TYPE, MATCH_STATUS } from "../../src/features/referee-v5/constants/eventTypes.js";
import { MATCH_TYPE } from "../../src/features/referee-v5/constants/matchTypes.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../src/features/referee-v5/constants/scoringStrategy.js";
import { applyMatchEvent } from "../../src/features/referee-v5/engines/matchStateEngine.js";
import { initializeMatchState } from "../../src/features/referee-v5/engines/initializeMatchState.js";
import { ScoringStrategyRegistry } from "../../src/features/referee-v5/engines/scoring/ScoringStrategyRegistry.js";
import { hashMatchStateCanonical } from "../../src/features/referee-v5/persistence/canonicalStateHash.js";
import { RefereeV5AtomicCommitService } from "../../src/features/referee-v5/persistence/RefereeV5AtomicCommitService.js";
import { RefereeV5EdgeCommandHandler } from "../../src/features/referee-v5/persistence/RefereeV5EdgeCommandHandler.js";
import {
  InMemoryMatchRepository,
  RefereeV5PersistenceService,
} from "../../src/features/referee-v5/persistence/RefereeV5PersistenceService.js";
import { REFEREE_V5_ERROR } from "../../src/features/referee-v5/persistence/errors.js";
import { validateMatchCommandPayload } from "../../src/features/referee-v5/persistence/validateCommandPayload.js";
import {
  createRefereeV5EdgeRuntime,
  handleRefereeV5MatchAction,
  mapHttpStatus,
} from "../../src/features/referee-v5/server/edgeHttpHandler.js";
import {
  buildDoublesSideOutConfig,
  buildDoublesUsapRallyConfig,
  buildSinglesConfig,
  initStartedUsapRallyMatch,
} from "./testHelpers.js";

const TENANT = "tenant-r22e";
const TOURNAMENT = "tour-r22e";
const MATCH = "match-r22e";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function actor(userId = "ref-1") {
  return { userId, tenantId: TENANT, role: "REFEREE" };
}

function assignment(matchId = MATCH, userId = "ref-1") {
  return {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId,
    userId,
    assignmentRole: "REFEREE",
    status: "active",
  };
}

function setupServer(matchId = MATCH, config = buildDoublesUsapRallyConfig({ matchId })) {
  const repo = new InMemoryMatchRepository();
  const atomic = new RefereeV5AtomicCommitService(repo);
  const edge = new RefereeV5EdgeCommandHandler(repo, atomic);
  const service = new RefereeV5PersistenceService(repo);
  service.atomicCommit = atomic;
  service.edgeHandler = edge;

  const initial = initializeMatchState(config);
  assert.equal(initial.ok, true, initial.errors?.join(", "));
  repo.initLiveState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId,
    initialState: initial.state,
  });
  repo.upsertAssignment({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId,
    userId: "ref-1",
    assignmentRole: "REFEREE",
    status: "active",
  });
  return { repo, edge, service, atomic, initialState: initial.state, matchId };
}

async function serverApply(edge, overrides = {}) {
  const matchId = overrides.matchId || MATCH;
  return edge.processMatchCommand({
    accessToken: overrides.accessToken || "jwt:ref-1",
    tournamentId: TOURNAMENT,
    matchId,
    commandType: overrides.commandType || MATCH_EVENT_TYPE.START_MATCH,
    expectedVersion: overrides.expectedVersion,
    expectedSequence: overrides.expectedSequence,
    clientMutationId: overrides.clientMutationId || `mut-${Math.random()}`,
    idempotencyKey: overrides.idempotencyKey || `idem-${Math.random()}`,
    payload: overrides.payload || {},
    requestBody: overrides.requestBody || {},
  });
}

async function serverLoad(service, matchId = MATCH) {
  return service.getMatchState({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId,
    actor: actor(),
    assignment: assignment(matchId),
  });
}

function clientApply(state, eventType, sequence, payload = {}) {
  return applyMatchEvent(state, {
    eventId: `c-${sequence}`,
    eventType,
    sequence,
    expectedVersion: state.version,
    actorId: "ref-1",
    payload,
  });
}

function assertDomainParity(clientState, serverState) {
  assert.equal(serverState.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(serverState.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
  assert.equal(serverState.ruleSetId, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
  assert.equal(serverState.pointsToWin, 11);
  assert.equal(serverState.winBy, 2);
  assert.equal(serverState.freezeRule, "NONE");
  assert.equal(serverState.serverNumberRule, "NONE");
  assert.equal(serverState.matchType, MATCH_TYPE.DOUBLES);

  assert.equal(serverState.teams.teamA.score, clientState.teams.teamA.score);
  assert.equal(serverState.teams.teamB.score, clientState.teams.teamB.score);
  assert.equal(serverState.servingPlayerId, clientState.servingPlayerId);
  assert.equal(serverState.receivingPlayerId, clientState.receivingPlayerId);
  assert.equal(serverState.servingTeamId, clientState.servingTeamId);
  assert.equal(serverState.teams.teamA.courtEnd, clientState.teams.teamA.courtEnd);
  assert.equal(serverState.teams.teamB.courtEnd, clientState.teams.teamB.courtEnd);
  assert.equal(serverState.status, clientState.status);
  assert.equal(hashMatchStateCanonical(serverState), hashMatchStateCanonical(clientState));
}

async function playServerSequence(edge, service, matchId, commands) {
  let seq = 0;
  for (const commandType of commands) {
    const loaded = await serverLoad(service, matchId);
    const result = await serverApply(edge, {
      matchId,
      commandType,
      expectedVersion: loaded.stateVersion,
      expectedSequence: loaded.lastEventSequence,
      idempotencyKey: `srv-${matchId}-${seq}`,
    });
    assert.equal(result.ok, true, result.error);
    seq += 1;
  }
  return serverLoad(service, matchId);
}

function playClientSequence(initialState, commands) {
  let state = initialState;
  let sequence = 1;
  for (const commandType of commands) {
    const result = clientApply(state, commandType, sequence);
    assert.equal(result.ok, true, result.error);
    state = result.nextState;
    sequence += 1;
  }
  return state;
}

function createLocalUserClient(userId = "ref-1") {
  return {
    auth: {
      async getUser() {
        return { data: { user: { id: userId } }, error: null };
      },
    },
  };
}

// ─── Bundle / registry ───────────────────────────────────────────

test("R2-2E-01 Edge shared bundle contains ScoringStrategyRegistry and USAP strategy", () => {
  const bundlePath = join(ROOT, "supabase/functions/_shared/refereeV5Server.mjs");
  const bundle = readFileSync(bundlePath, "utf8");
  assert.match(bundle, /ScoringStrategyRegistry/);
  assert.match(bundle, /USAP_2026_PROVISIONAL_RALLY|usap2026ProvisionalRallyDoublesStrategy|rally_usap_2026_provisional_doubles_v1/);
  assert.match(bundle, /SCORING_FORMAT_REQUIRED|UNSUPPORTED_SCORING_VARIANT|SCORING_FORMAT_IMMUTABLE/);
  // No duplicate rally-only apply fork that bypasses registry for doubles.
  assert.ok(!bundle.includes("applyRallyScoringByTeamKey") || bundle.includes("ScoringStrategyRegistry"));
});

test("R2-2E-02 source registry resolves USAP Doubles", () => {
  const strategy = ScoringStrategyRegistry.resolve(initStartedUsapRallyMatch());
  assert.equal(strategy.id, RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1);
});

// ─── Parity ──────────────────────────────────────────────────────

test("R2-2E-03 parity: normal Rally scoring", async () => {
  const { edge, service, initialState, matchId } = setupServer("match-parity-score");
  const commands = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  ];
  const clientState = playClientSequence(initialState, commands);
  const server = await playServerSequence(edge, service, matchId, commands);
  assertDomainParity(clientState, server.state);
});

test("R2-2E-04 parity: service possession change", async () => {
  const { edge, service, initialState, matchId } = setupServer("match-parity-poss");
  const commands = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.TEAM_B_WON_RALLY, // receive win → side-out
  ];
  const clientState = playClientSequence(initialState, commands);
  const server = await playServerSequence(edge, service, matchId, commands);
  assertDomainParity(clientState, server.state);
  assert.equal(server.state.servingTeamId, "team-b");
});

test("R2-2E-05 parity: switch ends", async () => {
  const { edge, service, initialState, matchId } = setupServer("match-parity-switch");
  const commands = [
    MATCH_EVENT_TYPE.START_MATCH,
    MATCH_EVENT_TYPE.SWITCH_ENDS,
  ];
  const clientState = playClientSequence(initialState, commands);
  const server = await playServerSequence(edge, service, matchId, commands);
  assertDomainParity(clientState, server.state);
});

test("R2-2E-06 parity: undo", async () => {
  const { edge, service, initialState, matchId } = setupServer("match-parity-undo");
  await serverApply(edge, { matchId, commandType: MATCH_EVENT_TYPE.START_MATCH, idempotencyKey: "u0" });
  await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "u1",
  });
  await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.UNDO_LAST_EVENT,
    expectedVersion: 2,
    expectedSequence: 2,
    idempotencyKey: "u2",
  });

  const client = playClientSequence(initialState, [MATCH_EVENT_TYPE.START_MATCH]);
  const server = await serverLoad(service, matchId);
  assert.equal(server.state.teams.teamA.score, 0);
  assert.equal(server.state.teams.teamB.score, 0);
  assert.equal(server.state.servingPlayerId, client.servingPlayerId);
  assert.equal(server.state.receivingPlayerId, client.receivingPlayerId);
  assert.equal(server.state.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(server.state.scoringVariant, SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY);
  assert.equal(server.state.teams.teamA.courtEnd, client.teams.teamA.courtEnd);
});

test("R2-2E-07 parity: game completion path (11-0)", async () => {
  const { edge, service, initialState, matchId } = setupServer("match-parity-game");
  const commands = [MATCH_EVENT_TYPE.START_MATCH];
  for (let i = 0; i < 11; i += 1) {
    commands.push(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY);
  }
  const clientState = playClientSequence(initialState, commands);
  const server = await playServerSequence(edge, service, matchId, commands);
  assertDomainParity(clientState, server.state);
  assert.equal(server.state.teams.teamA.score, 11);
});

// ─── Server validation ───────────────────────────────────────────

test("R2-2E-08 missing Rally format rejected with SCORING_FORMAT_REQUIRED", async () => {
  const bare = buildDoublesUsapRallyConfig({
    matchId: "match-bare",
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: undefined,
    ruleSetId: undefined,
  });
  delete bare.scoringVariant;
  delete bare.ruleSetId;
  const { edge, matchId } = setupServer("match-bare", bare);
  const start = await serverApply(edge, { matchId, idempotencyKey: "bare" });
  // Start itself may succeed (format on state); scoring must fail if incomplete.
  if (start.ok) {
    const rally = await serverApply(edge, {
      matchId,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: start.state?.version ?? 1,
      expectedSequence: 1,
      idempotencyKey: "bare-pt",
    });
    assert.equal(rally.ok, false);
    assert.equal(rally.code, REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED);
  } else {
    assert.equal(start.code, REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED);
  }
});

test("R2-2E-09 unsupported variant rejected", async () => {
  const cfg = buildDoublesUsapRallyConfig({
    matchId: "match-bad-var",
    scoringVariant: "DREAMBREAKER_V1",
    ruleSetId: undefined,
  });
  delete cfg.ruleSetId;
  const { edge, matchId } = setupServer("match-bad-var", cfg);
  await serverApply(edge, { matchId, idempotencyKey: "bv0" });
  const result = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "bv1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT);
});

test("R2-2E-10 Singles Rally rejected", async () => {
  const cfg = buildSinglesConfig({
    matchId: "match-singles-rally",
    scoringSystem: SCORING_SYSTEM.RALLY,
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    scoringFormat: "rally",
    freezeRule: "NONE",
    serverNumberRule: "NONE",
  });
  const { edge, matchId } = setupServer("match-singles-rally", cfg);
  const start = await serverApply(edge, { matchId, idempotencyKey: "sr0" });
  if (!start.ok) {
    assert.equal(start.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT);
    return;
  }
  const result = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "sr1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT);
});

test("R2-2E-11 freeze-enabled Rally rejected", async () => {
  const cfg = buildDoublesUsapRallyConfig({
    matchId: "match-freeze",
    freezeRule: "FREEZE_AT_20",
  });
  const { edge, matchId } = setupServer("match-freeze", cfg);
  const start = await serverApply(edge, { matchId, idempotencyKey: "fr0" });
  if (!start.ok) {
    assert.equal(start.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT);
    return;
  }
  const result = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "fr1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT);
});

test("R2-2E-12 format mutation rejected", () => {
  const check = validateMatchCommandPayload(MATCH_EVENT_TYPE.TEAM_A_WON_RALLY, {
    scoringVariant: SCORING_VARIANT.SIDE_OUT_DOUBLES_V1,
  });
  assert.equal(check.ok, false);
  assert.equal(check.code, REFEREE_V5_ERROR.SCORING_FORMAT_IMMUTABLE);
});

test("R2-2E-13 unsupported scoring system rejected", async () => {
  const cfg = buildDoublesUsapRallyConfig({
    matchId: "match-bad-sys",
    scoringSystem: "HYBRID",
    scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
    ruleSetId: undefined,
  });
  delete cfg.ruleSetId;
  const { edge, matchId } = setupServer("match-bad-sys", cfg);
  await serverApply(edge, { matchId, idempotencyKey: "bs0" });
  const result = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "bs1",
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, REFEREE_V5_ERROR.UNSUPPORTED_SCORING_SYSTEM);
});

test("R2-2E-14 assignment authorization preserved on Edge path", async () => {
  const { edge } = setupServer("match-auth");
  const denied = await serverApply(edge, {
    matchId: "match-auth",
    accessToken: "jwt:stranger",
    idempotencyKey: "auth-deny",
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
});

// ─── Finalize via Edge handler ───────────────────────────────────

test("R2-2E-15 Rally finalize: revision once, outbox once, lock, retry idempotent", async () => {
  const { edge, service, repo, matchId } = setupServer("match-fin-edge");
  await serverApply(edge, { matchId, commandType: MATCH_EVENT_TYPE.START_MATCH, idempotencyKey: "f0" });
  for (let i = 0; i < 11; i += 1) {
    const loaded = await serverLoad(service, matchId);
    const ok = await serverApply(edge, {
      matchId,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: loaded.stateVersion,
      expectedSequence: loaded.lastEventSequence,
      idempotencyKey: `f-pt-${i}`,
    });
    assert.equal(ok.ok, true, ok.error);
  }
  const loaded = await serverLoad(service, matchId);
  const fin1 = await edge.processFinalize({
    accessToken: "jwt:ref-1",
    tournamentId: TOURNAMENT,
    matchId,
    expectedVersion: loaded.stateVersion,
    idempotencyKey: "fin-edge",
    forceComplete: true,
  });
  assert.equal(fin1.ok, true, fin1.error);
  assert.equal(fin1.locked, true);
  const revisions = repo.results.size;
  const outbox = repo.outbox.length;
  const fin2 = await edge.processFinalize({
    accessToken: "jwt:ref-1",
    tournamentId: TOURNAMENT,
    matchId,
    expectedVersion: loaded.stateVersion,
    idempotencyKey: "fin-edge",
    forceComplete: true,
  });
  assert.equal(fin2.ok, true);
  assert.equal(fin2.duplicate, true);
  assert.equal(repo.results.size, revisions);
  assert.equal(repo.outbox.length, outbox);

  const blocked = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_B_WON_RALLY,
    idempotencyKey: "after-lock",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, REFEREE_V5_ERROR.MATCH_LOCKED);

  const after = await serverLoad(service, matchId);
  assert.equal(after.state.status, MATCH_STATUS.LOCKED);
  assert.equal(after.state.scoringSystem, SCORING_SYSTEM.RALLY);
});

// ─── Local HTTP (in-memory runtime injection) ─────────────────────

test("R2-2E-16 local HTTP apply-command Rally path", async () => {
  const { repo, edge, atomic, matchId } = setupServer("match-http");
  const runtime = createRefereeV5EdgeRuntime({
    repository: repo,
    atomicCommit: atomic,
    handler: edge,
  });
  const userClient = createLocalUserClient("ref-1");

  const start = await handleRefereeV5MatchAction({
    action: "apply-command",
    body: {
      tournamentId: TOURNAMENT,
      matchId,
      commandType: MATCH_EVENT_TYPE.START_MATCH,
      expectedVersion: 0,
      expectedSequence: 0,
      clientMutationId: "http-mut-1",
      idempotencyKey: "http-start",
      payload: {},
    },
    userClient,
    serviceClient: {},
    runtime,
  });
  assert.equal(start.httpStatus, 200);
  assert.equal(start.body.ok, true);

  const point = await handleRefereeV5MatchAction({
    action: "apply-command",
    body: {
      tournamentId: TOURNAMENT,
      matchId,
      commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
      expectedVersion: 1,
      expectedSequence: 1,
      clientMutationId: "http-mut-2",
      idempotencyKey: "http-pt",
      payload: {},
    },
    userClient,
    serviceClient: {},
    runtime,
  });
  assert.equal(point.httpStatus, 200);
  assert.equal(point.body.ok, true);
  assert.equal(point.body.state.teams.teamA.score, 1);
  assert.equal(point.body.state.scoringSystem, SCORING_SYSTEM.RALLY);
});

test("R2-2E-17 local HTTP rejects unassigned referee", async () => {
  const { repo, edge, atomic, matchId } = setupServer("match-http-deny");
  const runtime = createRefereeV5EdgeRuntime({
    repository: repo,
    atomicCommit: atomic,
    handler: edge,
  });
  const result = await handleRefereeV5MatchAction({
    action: "apply-command",
    body: {
      tournamentId: TOURNAMENT,
      matchId,
      commandType: MATCH_EVENT_TYPE.START_MATCH,
      expectedVersion: 0,
      expectedSequence: 0,
      clientMutationId: "deny-1",
      idempotencyKey: "deny-start",
      payload: {},
    },
    userClient: createLocalUserClient("intruder"),
    serviceClient: {},
    runtime,
  });
  assert.equal(result.httpStatus, 403);
  assert.equal(result.body.code, REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED);
});

test("R2-2E-18 mapHttpStatus keeps scoring format errors as 400", () => {
  assert.equal(mapHttpStatus(REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED), 400);
  assert.equal(mapHttpStatus(REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT), 400);
  assert.equal(mapHttpStatus(REFEREE_V5_ERROR.SCORING_FORMAT_IMMUTABLE), 400);
  assert.equal(mapHttpStatus(REFEREE_V5_ERROR.SCORING_STRATEGY_NOT_FOUND), 400);
  assert.equal(mapHttpStatus(REFEREE_V5_ERROR.MATCH_LOCKED), 409);
});

test("R2-2E-19 legacy Side-Out still works on Edge path", async () => {
  const { edge, service, matchId } = setupServer(
    "match-sideout-edge",
    buildDoublesSideOutConfig({ matchId: "match-sideout-edge" })
  );
  await serverApply(edge, { matchId, idempotencyKey: "so0" });
  const point = await serverApply(edge, {
    matchId,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
    expectedVersion: 1,
    expectedSequence: 1,
    idempotencyKey: "so1",
  });
  assert.equal(point.ok, true, point.error);
  const loaded = await serverLoad(service, matchId);
  assert.notEqual(loaded.state.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(loaded.state.teams.teamA.score, 1);
  assert.equal(loaded.state.serverNumber, 1);
});
