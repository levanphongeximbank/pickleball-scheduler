/**
 * PR #440 CORE-13 reconciliation remediation gates.
 * Side-loaded from E2E-04 (no new unit-test-files.json row — Contract #08 freeze).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_REFEREE_MODE,
  GENERIC_REFEREE_ROLE_PERMISSIONS,
  REFEREE_ADAPTER_ERROR_CODE,
  REFEREE_DURABLE_RUNTIME_ERROR_CODE,
  createCompetitionRuntimePorts,
  createDefaultCompetitionRefereeRuntime,
  createDurableRefereeOperationsStore,
  createLiveRpcCanonicalRefereeDurableDriver,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
  createTeamTournamentRefereeAdapter,
  isRefereeAdapterContractError,
} from "../src/features/competition-engine/index.js";
import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  createScoringFormat,
} from "../src/features/competition-core/scoring/index.js";
import { createCanonicalRefereeApplicationClient } from "../src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js";
import { REFEREE_UI_ERROR_CODE } from "../src/features/referee-production-ui/constants.js";
import {
  TEAM_LEGACY_ASSIGNMENT_TRANSPORT_DENIED,
  assignTeamRefereeViaCore13,
  assignTeamRefereeViaLegacyTeamRpcTransport,
} from "../src/features/team-tournament/services/teamCore13AssignmentTransport.js";
import {
  DAILY_REFEREE_ASSIGNMENT_PROJECTION_META,
  buildDailyMatchRefereeAssignmentPatch,
} from "../src/features/tournament/director/services/dailyRefereeMetadataPatch.js";
import { buildDailyCore13AssignmentProjection } from "../src/features/tournament/director/services/dailyCore13AssignmentTransport.js";
import { LEGACY_REFEREE_TOKEN_ROUTE_STATUS } from "../src/pages/referee/legacyRefereeTokenRouteStatus.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLOCK = "2026-07-24T00:00:00.000Z";
const ACTOR = Object.freeze({
  actorId: "11111111-1111-4111-8111-111111111111",
  authUid: "11111111-1111-4111-8111-111111111111",
  role: "REFEREE",
  refereeId: "11111111-1111-4111-8111-111111111111",
});
const SCOPE = Object.freeze({
  tenantId: "tenant-1",
  competitionId: "comp-1",
  matchId: "m-1",
});

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function ports() {
  return createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: () => [...GENERIC_REFEREE_ROLE_PERMISSIONS],
    },
  });
}

function createUiRuntime() {
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

async function seedAssigned(runtime, fixture) {
  await runtime.assignmentRepository.upsert(
    {
      tenantId: fixture.tenantId || "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      refereeUserId: ACTOR.actorId,
      status: "active",
    },
    ACTOR
  );
  await runtime.matchStateRepository.putLiveState(
    {
      tenantId: fixture.tenantId || "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      expectedVersion: 0,
      idempotencyKey: `seed-${fixture.matchId}`,
      status: "not_started",
      statePayload: {
        canonical: {
          venueId: "venue-1",
          match: { id: fixture.matchId, status: "READY_TO_START" },
        },
      },
    },
    ACTOR
  );
}

function createClient(runtime, fixtures) {
  const byMatch = new Map(fixtures.map((f) => [f.matchId, f]));
  return createCanonicalRefereeApplicationClient({
    runtime,
    actor: ACTOR,
    modeStateResolver: async (assignment) => {
      const row = byMatch.get(String(assignment.matchId));
      return row?.modeState || null;
    },
  });
}

test("RC-A1: LiveRpc product path cannot upsert referee_assignments", async () => {
  const driver = createLiveRpcCanonicalRefereeDurableDriver({
    rpcClient: {
      rpc: async () => ({ data: { ok: true }, error: null }),
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    },
    clockIso: CLOCK,
  });
  await assert.rejects(
    () =>
      driver.upsertAssignment(
        { ...SCOPE, refereeUserId: ACTOR.actorId },
        ACTOR
      ),
    (err) =>
      isRefereeAdapterContractError(err) &&
      err.code ===
        REFEREE_DURABLE_RUNTIME_ERROR_CODE.DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN
  );
});

test("RC-A2: durable store.update does not re-upsert assignments on score/lifecycle", async () => {
  let upsertCalls = 0;
  const base = createSchemaFaithfulCanonicalRefereeDurableDriver({
    clockIso: CLOCK,
    allowTestDoubleDriver: true,
  });
  const driver = {
    ...base,
    async upsertAssignment(row, actor) {
      upsertCalls += 1;
      return base.upsertAssignment(row, actor);
    },
  };
  const store = createDurableRefereeOperationsStore({ driver, clockIso: CLOCK });
  store.setCommandContext({
    actor: ACTOR,
    idempotencyKey: "score-1",
    commandId: "score-1",
  });
  await store.upsertAssignments("tenant-1", "comp-1", [
    { matchId: "m-1", refereeId: ACTOR.actorId },
  ]);
  const afterSeed = upsertCalls;
  assert.ok(afterSeed >= 1);
  await store.update("tenant-1", "comp-1", (draft) => {
    draft.scoreSessions = draft.scoreSessions || {};
    draft.scoreSessions["m-1"] = { state: { points: { SIDE_A: 1, SIDE_B: 0 } } };
    // Attempt to mutate assignment ops status — must not persist via upsert.
    draft.assignments = [
      {
        matchId: "m-1",
        refereeId: ACTOR.actorId,
        status: "ACKNOWLEDGED",
      },
    ];
  });
  assert.equal(upsertCalls, afterSeed);
});

test("RC-B: Daily assignment metadata is projection-only; writer not authority", () => {
  const patch = buildDailyMatchRefereeAssignmentPatch("m-1", {
    name: "Ref",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  });
  assert.equal(patch.dailyRefereeAssignments["m-1"].authority, false);
  assert.equal(patch.dailyRefereeAssignments["m-1"].projectionOnly, true);
  assert.equal(
    patch.dailyRefereeAssignments["m-1"].assignmentAuthority,
    "CORE-13"
  );
  assert.equal(
    DAILY_REFEREE_ASSIGNMENT_PROJECTION_META.dailyWriterAsAssignmentAuthority,
    "DENY"
  );
  const projection = buildDailyCore13AssignmentProjection(
    "m-1",
    { name: "Ref" },
    { assignmentId: "asg-1" }
  );
  assert.equal(projection.dailyRefereeAssignments["m-1"].token, null);
  assert.equal(
    projection.dailyRefereeAssignments["m-1"].assignmentAuthority,
    "CORE-13"
  );
  const director = read(
    "src/features/tournament/director/hooks/useDirectorActions.js"
  );
  assert.match(director, /assignDailyRefereeViaCore13/);
  assert.match(director, /dailyWriterAsAssignmentAuthority: "DENY"/);
});

test("RC-C: forceLegacyTeamTransport cannot restore second product authority", async () => {
  const denied = await assignTeamRefereeViaLegacyTeamRpcTransport();
  assert.deepEqual(denied, TEAM_LEGACY_ASSIGNMENT_TRANSPORT_DENIED);
  const forced = await assignTeamRefereeViaCore13({
    tenantId: "t",
    tournamentId: "tour",
    matchId: "m",
    refereeUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    forceLegacyTeamTransport: true,
  });
  assert.equal(forced.ok, false);
  assert.equal(forced.code, "LEGACY_TEAM_TRANSPORT_DISABLED");
  assert.equal(forced.teamRpcAsAssignmentAuthority, "DENY");
  const src = read(
    "src/features/team-tournament/services/teamCore13AssignmentTransport.js"
  );
  assert.doesNotMatch(src, /rpcTeamTournamentCreateRefereeAssignment/);
  assert.doesNotMatch(src, /rpcTeamTournamentRevokeRefereeAssignment/);
});

test("RC-D: Adapter B translation only — no assignment SSOT/policy authority", () => {
  const adapter = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: "tenant-1",
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      matchups: {
        "mu-1": {
          matchupId: "mu-1",
          teamAId: "a",
          teamBId: "b",
          status: "READY",
          subMatches: [{ id: "sub-1", status: "READY" }],
        },
      },
      assignments: [],
      scoringRules: createScoringFormat({
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: 11,
        winBy: 2,
        bestOfGames: 1,
      }),
    },
  });
  assert.equal(adapter.translationOnly, true);
  assert.equal(adapter.adapterBTranslationOnly, true);
  assert.equal(adapter.assignmentAuthority, "CORE-13");
  const ctx = adapter.getCompetitionContext({
    tenantId: "tenant-1",
    competitionId: "team-1",
  });
  assert.equal(ctx.adapterOwnsAssignmentAuthority, false);
  assert.equal(ctx.parentMatchupAssignmentSsot, undefined);
  assert.equal(ctx.writePolicy, undefined);
  const caps = adapter.getCapabilities({
    tenantId: "tenant-1",
    competitionId: "team-1",
    matchId: "sub-1",
  });
  assert.equal(caps.ownsAssignmentAuthority, false);
  assert.equal(caps.ownsScoringAuthority, false);
  const src = read(
    "src/features/competition-engine/integration/referee/adapters/TeamTournamentRefereeAdapter.js"
  );
  assert.doesNotMatch(src, /parentMatchupAssignmentSsot/);
  assert.doesNotMatch(src, /organizer_can_manage_OR_assigned_canonical_uid/);
  assert.match(src, /ADAPTER_B_TRANSLATION_ONLY=YES/);
});

test("RC-E: forged competitionId / missing CORE-13 assignment denied", async () => {
  const { runtime } = createUiRuntime();
  const fixture = {
    competitionId: "comp-real",
    matchId: "m-1",
    modeState: {
      tenantId: "tenant-1",
      competitionId: "comp-real",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      matches: {
        "m-1": {
          matchId: "m-1",
          status: "READY",
          sides: [
            { sideId: "SIDE_A", participantIds: ["p1", "p2"] },
            { sideId: "SIDE_B", participantIds: ["p3", "p4"] },
          ],
        },
      },
      scoringRules: createScoringFormat({
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: 11,
        winBy: 2,
        bestOfGames: 1,
      }),
      canonicalAssignmentAuthorityAvailable: true,
    },
  };
  const client = createClient(runtime, [fixture]);
  await assert.rejects(
    () =>
      client.getMatchView({
        tenantId: "tenant-1",
        matchId: "m-1",
        competitionId: "forged-comp",
        actor: ACTOR,
      }),
    (err) => err.code === REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED
  );
  await assert.rejects(
    () =>
      client.getMatchView({
        tenantId: "tenant-1",
        matchId: "m-1",
        competitionId: "comp-real",
        actor: ACTOR,
      }),
    (err) => err.code === REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED
  );
  const src = read(
    "src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js"
  );
  assert.doesNotMatch(
    src,
    /competitionId\s*\?\s*\{\s*matchId,\s*tenantId,\s*competitionId/
  );
  assert.match(src, /never invent synthetic ASSIGNED/);
});

test("RC-E2: cross-tenant assignment denied", async () => {
  const { runtime } = createUiRuntime();
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-other",
      competitionId: "comp-1",
      matchId: "m-1",
      refereeUserId: ACTOR.actorId,
      status: "active",
    },
    ACTOR
  );
  // List-by-referee is tenant-scoped on schema-faithful driver; forge via getActive
  // by planting a row then requesting wrong tenant with competitionId.
  const client = createCanonicalRefereeApplicationClient({
    runtime: {
      ...runtime,
      assignmentRepository: {
        ...runtime.assignmentRepository,
        async getActiveForMatch(scope) {
          if (scope.competitionId === "comp-1") {
            return {
              tenantId: "tenant-other",
              competitionId: "comp-1",
              matchId: "m-1",
              refereeUserId: ACTOR.actorId,
              status: "active",
            };
          }
          return null;
        },
        async listByReferee() {
          return [];
        },
      },
    },
    actor: ACTOR,
    modeStateResolver: async () => ({
      tenantId: "tenant-1",
      competitionId: "comp-1",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      matches: { "m-1": { matchId: "m-1", status: "READY" } },
      scoringRules: createScoringFormat({
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: 11,
        winBy: 2,
        bestOfGames: 1,
      }),
      canonicalAssignmentAuthorityAvailable: true,
    }),
  });
  await assert.rejects(
    () =>
      client.getMatchView({
        tenantId: "tenant-1",
        matchId: "m-1",
        competitionId: "comp-1",
        actor: ACTOR,
      }),
    (err) =>
      err.code === REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT ||
      err.code === REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED
  );
});

test("RC-F: CHANGE_ENDS routes through facade authz; unauthorized denied", async () => {
  const { runtime } = createUiRuntime();
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 2,
  });
  const fixture = {
    competitionId: "comp-ce",
    matchId: "m-ce",
    modeState: {
      tenantId: "tenant-1",
      competitionId: "comp-ce",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      matches: {
        "m-ce": {
          matchId: "m-ce",
          status: "READY",
          sides: [
            { sideId: "SIDE_A", participantIds: ["p1", "p2"] },
            { sideId: "SIDE_B", participantIds: ["p3", "p4"] },
          ],
        },
      },
      scoringRules: format,
      canonicalAssignmentAuthorityAvailable: true,
    },
  };
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);

  await assert.rejects(
    () =>
      client.confirmChangeEnds({
        tenantId: "tenant-1",
        matchId: "m-ce",
        competitionId: "comp-ce",
        actor: ACTOR,
        expectedVersion: 1,
        idempotencyKey: "ce-no-due",
      }),
    /sideChangeRequired|PRECONDITION|active match|Score entry/i
  );

  const src = read(
    "src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js"
  );
  assert.match(src, /facade\.confirmChangeEnds\(base\)/);
  assert.doesNotMatch(
    src.split("async function confirmChangeEnds")[1].split("async function switchPositions")[0],
    /putLiveState/
  );

  // Unauthorized actor (no assignment)
  const stranger = createCanonicalRefereeApplicationClient({
    runtime,
    actor: {
      actorId: "22222222-2222-4222-8222-222222222222",
      authUid: "22222222-2222-4222-8222-222222222222",
      role: "REFEREE",
      refereeId: "22222222-2222-4222-8222-222222222222",
    },
    modeStateResolver: async () => fixture.modeState,
  });
  await assert.rejects(
    () =>
      stranger.confirmChangeEnds({
        tenantId: "tenant-1",
        matchId: "m-ce",
        competitionId: "comp-ce",
        expectedVersion: 1,
        idempotencyKey: "ce-unauth",
      }),
    (err) => err.code === REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED
  );
});

test("RC-F2: CHANGE_ENDS durable after due + F5 stable", async () => {
  const { runtime } = createUiRuntime();
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 2,
  });
  const fixture = {
    competitionId: "comp-ce2",
    matchId: "m-ce2",
    modeState: {
      tenantId: "tenant-1",
      competitionId: "comp-ce2",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      competitionName: "CE F5",
      venueId: "venue-1",
      matches: {
        "m-ce2": {
          matchId: "m-ce2",
          status: "READY",
          sides: [
            { sideId: "SIDE_A", participantIds: ["p1", "p2"] },
            { sideId: "SIDE_B", participantIds: ["p3", "p4"] },
          ],
        },
      },
      scoringRules: format,
      canonicalAssignmentAuthorityAvailable: true,
      participantNames: { p1: "A1", p2: "A2", p3: "B1", p4: "B2" },
    },
  };
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const before = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: "m-ce2",
    competitionId: "comp-ce2",
    actor: ACTOR,
  });
  const configured = await client.configureLineup({
    tenantId: "tenant-1",
    matchId: "m-ce2",
    competitionId: "comp-ce2",
    actor: ACTOR,
    expectedVersion: before.view.expectedVersion,
    idempotencyKey: "ce2-lineup",
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: "m-ce2",
    competitionId: "comp-ce2",
    actor: ACTOR,
    expectedVersion: configured.view.expectedVersion,
    idempotencyKey: "ce2-start",
  });
  let version = started.view.expectedVersion;
  let scored = started;
  for (let i = 0; i < 2; i += 1) {
    scored = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: "m-ce2",
      competitionId: "comp-ce2",
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: version,
      idempotencyKey: `ce2-p${i}`,
    });
    version = scored.view.expectedVersion;
  }
  assert.equal(scored.view.courtProjection.sideChangeRequired, true);
  const confirmed = await client.confirmChangeEnds({
    tenantId: "tenant-1",
    matchId: "m-ce2",
    competitionId: "comp-ce2",
    actor: ACTOR,
    expectedVersion: scored.view.expectedVersion,
    idempotencyKey: "ce2-confirm",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(confirmed.view.courtProjection.sideChangeRequired, false);
  const f5 = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: "m-ce2",
    competitionId: "comp-ce2",
    actor: ACTOR,
  });
  assert.equal(f5.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(f5.view.courtProjection.sideChangeRequired, false);
});

test("RC-G: legacy /referee/:token isolated from production authority", () => {
  const router = read("src/router.jsx");
  assert.match(router, /LegacyRefereeTokenRetirementPage/);
  assert.match(router, /path="\/referee\/:token"/);
  assert.doesNotMatch(
    router,
    /path="\/referee\/:token"\s+element=\{<RefereeScoreboard/
  );
  assert.match(router, /path="\/referee"/);
  assert.match(router, /path="\/referee\/match\/:matchId"/);
  assert.equal(LEGACY_REFEREE_TOKEN_ROUTE_STATUS.productionAuthority, false);
  assert.equal(LEGACY_REFEREE_TOKEN_ROUTE_STATUS.scoringAuthority, false);
  assert.equal(LEGACY_REFEREE_TOKEN_ROUTE_STATUS.assignmentAuthority, false);
});

test("RC-LOCKS: CHANGE_COURT not faked; contracts frozen markers", () => {
  const ui = read(
    "src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js"
  );
  assert.doesNotMatch(ui, /CHANGE_COURT|changePhysicalCourt|confirmChangeCourt/);
  assert.equal(
    read("src/features/competition-engine/integration/referee/createLiveRpcCanonicalRefereeDurableDriver.js").includes(
      "DIRECT_ASSIGNMENT_MUTATION_FORBIDDEN"
    ),
    true
  );
});
