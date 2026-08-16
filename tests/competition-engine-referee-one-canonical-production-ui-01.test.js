/**
 * Phase 2C — One Canonical Production Referee UI.
 * Side-loaded from E2E-04 (CORE-08: no new unit-test-files.json rows).
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
  createCompetitionRuntimePorts,
  createDefaultCompetitionRefereeRuntime,
  createSchemaFaithfulCanonicalRefereeDurableDriver,
} from "../src/features/competition-engine/index.js";
import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  createScoringFormat,
} from "../src/features/competition-core/scoring/index.js";
import { createCanonicalRefereeApplicationClient } from "../src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js";
import { createBrowserRefereeApplicationClient } from "../src/features/referee-production-ui/application/createBrowserRefereeApplicationClient.js";
import { assertRefereeUiSecurity } from "../src/features/referee-production-ui/application/assertProductionUiSecurity.js";
import { buildRefereeAssignmentCard } from "../src/features/referee-production-ui/projection/buildRefereeAssignmentCard.js";
import { buildRefereeMatchView } from "../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import { projectCanonicalCourtView } from "../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { projectDreamBreakerRotation } from "../src/features/referee-production-ui/projection/projectDreamBreakerRotation.js";
import { formatCanonicalScoreLine } from "../src/features/referee-production-ui/projection/formatScoringPolicyLabel.js";
import { projectResultStatus } from "../src/features/referee-production-ui/projection/resultStatus.js";
import { RESULT_STATUS, REFEREE_UI_ERROR_CODE } from "../src/features/referee-production-ui/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLOCK = "2026-07-24T00:00:00.000Z";
const ACTOR = Object.freeze({
  actorId: "11111111-1111-4111-8111-111111111111",
  authUid: "11111111-1111-4111-8111-111111111111",
  role: "REFEREE",
  refereeId: "11111111-1111-4111-8111-111111111111",
});

const SIDE_OUT = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.SIDE_OUT,
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 3,
  metadata: {
    openingServiceTurn: 2,
    changeEndPolicyLabel: "Sau mỗi game • G3 tại 6",
  },
});

const RALLY = createScoringFormat({
  scoringSystem: SCORING_SYSTEM.RALLY,
  pointsToWin: 21,
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

function dailyModeState(competitionId, matchId, extras = {}) {
  return {
    tenantId: "tenant-1",
    competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    venueId: "venue-1",
    clubId: "club-1",
    canonicalAssignmentAuthorityAvailable: true,
    participantNames: {
      p1: "An",
      p2: "Bình",
      p3: "Chi",
      p4: "Dũng",
    },
    session: {
      sessionId: competitionId,
      matchType: extras.matchType || "mixed_double",
      skipScore: false,
      checkedInPlayerIds: extras.playerIds || ["p1", "p2", "p3", "p4"],
      enabledCourtIds: ["court-1"],
    },
    matches: {
      [matchId]: {
        matchId,
        status: "ready",
        courtId: "court-1",
        teamAPlayerIds: extras.teamA || ["p1", "p2"],
        teamBPlayerIds: extras.teamB || ["p3", "p4"],
        scoringRules: extras.scoringRules || SIDE_OUT,
        lineupsLocked: true,
      },
    },
  };
}

function individualModeState(mode, competitionId, matchId, extras = {}) {
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
    participantNames: { "p-a": "Lan", "p-b": "Minh" },
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
        participantIdsA: extras.teamA || ["p-a"],
        participantIdsB: extras.teamB || ["p-b"],
        scoringRules: extras.scoringRules || RALLY,
        lineupsLocked: true,
      },
    },
  };
}

function teamModeState(competitionId, matchId, extras = {}) {
  const dbId = extras.dreambreakerMatchId || `db-${matchId}`;
  return {
    tenantId: "tenant-1",
    competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    venueId: "venue-1",
    clubId: "club-1",
    participantNames: { a1: "Hà", a2: "Khoa", b1: "Linh", b2: "Nam" },
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
        scoringRules: extras.scoringRules || SIDE_OUT,
        subMatches: [
          {
            id: "sub-1",
            status: "READY_TO_START",
            lineupA: ["a1", "a2"],
            lineupB: ["b1", "b2"],
            scoringRules: extras.scoringRules || SIDE_OUT,
            lineupsLocked: true,
          },
          {
            id: dbId,
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
          scoringFormat: { targetScore: 21, winBy: 2, rotationPoints: 4 },
          rotation: {
            sideAPlayerId: "a1",
            sideBPlayerId: "b1",
            nextA: "a2",
            nextB: "b2",
            index: 1,
            pointsInRotation: 1,
            rotationPoints: 4,
          },
        },
      },
    },
  };
}

function modeFixture(mode) {
  const competitionId = `${mode.toLowerCase()}-ui-1`;
  const matchId = `${mode.toLowerCase()}-ui-match-1`;
  if (mode === COMPETITION_REFEREE_MODE.DAILY_PLAY) {
    return { mode, competitionId, matchId, modeState: dailyModeState(competitionId, matchId) };
  }
  if (mode === COMPETITION_REFEREE_MODE.TEAM) {
    return { mode, competitionId, matchId, modeState: teamModeState(competitionId, matchId) };
  }
  return {
    mode,
    competitionId,
    matchId,
    modeState: individualModeState(mode, competitionId, matchId),
  };
}

function createClient(runtime, fixtures) {
  const byMatch = Object.fromEntries(fixtures.map((f) => [f.matchId, f]));
  return createCanonicalRefereeApplicationClient({
    runtime,
    actor: ACTOR,
    modeStateResolver: (assignment) => byMatch[assignment.matchId]?.modeState || null,
  });
}

async function seedAssigned(runtime, fixture) {
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      refereeUserId: ACTOR.actorId,
      courtId: "court-1",
    },
    ACTOR
  );
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

test("1. /referee assignment normalization", async () => {
  const { runtime } = createUiRuntime();
  const fixtures = [
    modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY),
    modeFixture(COMPETITION_REFEREE_MODE.INTERNAL),
    modeFixture(COMPETITION_REFEREE_MODE.OFFICIAL),
    modeFixture(COMPETITION_REFEREE_MODE.TEAM),
  ];
  for (const fixture of fixtures) await seedAssigned(runtime, fixture);
  const client = createClient(runtime, fixtures);
  const listed = await client.listMyAssignments({ tenantId: "tenant-1", actor: ACTOR });
  assert.equal(listed.ok, true);
  assert.equal(listed.assignments.length, 4);
  for (const card of listed.assignments) {
    assert.ok(card.matchId);
    assert.ok(card.competitionId);
    assert.ok(card.competitionMode);
    assert.ok(card.actionLabel);
    assert.match(card.href, /^\/referee\/match\//);
    assert.equal(card.href.includes("undefined"), false);
  }
});

test("2+16. deep-link /referee/match/:matchId without location.state", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const result = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(result.ok, true);
  assert.equal(result.locationStateRequired, false);
  assert.equal(result.view.locationStateRequired, false);
  assert.equal(result.view.matchId, fixture.matchId);
  assert.equal(result.view.competitionMode, COMPETITION_REFEREE_MODE.DAILY_PLAY);
});

test("3+4. all four modes resolve the correct Adapter B", async () => {
  const { runtime } = createUiRuntime();
  const fixtures = [
    modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY),
    modeFixture(COMPETITION_REFEREE_MODE.INTERNAL),
    modeFixture(COMPETITION_REFEREE_MODE.OFFICIAL),
    modeFixture(COMPETITION_REFEREE_MODE.TEAM),
  ];
  for (const fixture of fixtures) await seedAssigned(runtime, fixture);
  const client = createClient(runtime, fixtures);
  for (const fixture of fixtures) {
    const result = await client.getMatchView({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
    });
    assert.equal(result.view.competitionMode, fixture.mode);
    assert.equal(result.view.usesAdapterB, true);
    assert.equal(result.view.silentLegacyFallback, false);
    const adapter = runtime.modeAdapterRegistry.resolve(fixture.mode);
    assert.equal(adapter.competitionMode, fixture.mode);
    assert.equal(adapter.contractId, "competition.referee.adapter.v1");
  }
});

test("5. Side-Out doubles rendering + 0-0-2 service turn metadata", () => {
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"] },
        { sideKey: "B", participantIds: ["p3", "p4"] },
      ],
    },
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SIDE_OUT,
    currentScore: {
      points: { SIDE_A: 0, SIDE_B: 0 },
      serve: { servingSide: "SIDE_A", serverNumber: 2 },
      currentGameIndex: 0,
    },
  });
  assert.equal(court.isDoubles, true);
  assert.equal(court.court.leftTop.displayName, "An");
  assert.equal(court.court.leftBottom.displayName, "Bình");
  assert.equal(court.scoreLine.showServiceTurn, true);
  assert.equal(court.scoreLine.serviceTurn, 2);
  assert.equal(court.scoreLine.display, "0 – 0 – 2");
  assert.equal(court.permanentPlayerNumberLabel, false);
  assert.equal(court.court.leftTop.permanentPlayerNumber, null);
});

test("6. Rally doubles rendering hides service-turn metadata", () => {
  const line = formatCanonicalScoreLine({
    scoringSystem: SCORING_SYSTEM.RALLY,
    points: { SIDE_A: 4, SIDE_B: 3 },
    serve: { servingSide: "SIDE_A", serverNumber: 1 },
  });
  assert.equal(line.showServiceTurn, false);
  assert.equal(line.serviceTurn, null);
  assert.equal(line.display, "4 – 3");
});

test("7. singles rendering — one player per side", () => {
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p-a"] },
        { sideKey: "B", participantIds: ["p-b"] },
      ],
    },
    participantNames: { "p-a": "Lan", "p-b": "Minh" },
    scoringRules: RALLY,
    currentScore: { points: { SIDE_A: 1, SIDE_B: 0 }, serve: null },
  });
  assert.equal(court.isSingles, true);
  assert.ok(court.court.leftTop);
  assert.equal(court.court.leftBottom, null);
  assert.ok(court.court.rightTop);
  assert.equal(court.court.rightBottom, null);
});

test("8. DreamBreaker active-player projection stays Team-domain owned", () => {
  const db = projectDreamBreakerRotation({
    matchContext: { isDreambreaker: true, matchupId: "m1" },
    modeState: {
      matchups: {
        m1: {
          dreambreaker: {
            rotation: {
              sideAPlayerId: "a1",
              sideBPlayerId: "b1",
              nextA: "a2",
              nextB: "b2",
              pointsInRotation: 1,
              rotationPoints: 4,
            },
          },
        },
      },
    },
    participantNames: { a1: "Hà", b1: "Linh", a2: "Khoa", b2: "Nam" },
  });
  assert.equal(db.isDreambreaker, true);
  assert.equal(db.rotationOwnedByTeamDomain, true);
  assert.equal(db.sideAActivePlayer.displayName, "Hà");
  assert.equal(db.sideBActivePlayer.displayName, "Linh");
  assert.equal(db.nextPlayerA.displayName, "Khoa");
});

test("9+10. player name on marker; no permanent #1/#2 identity; serviceTurn separate", () => {
  const court = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"] },
        { sideKey: "B", participantIds: ["p3", "p4"] },
      ],
    },
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SIDE_OUT,
    currentScore: {
      points: { SIDE_A: 3, SIDE_B: 2 },
      serve: { servingSide: "SIDE_A", serverNumber: 1 },
    },
  });
  assert.equal(court.court.leftTop.displayName, "An");
  assert.equal(court.court.leftTop.isServing, true);
  assert.equal(court.serving.serviceTurn, 1);
  const marker = read("src/features/referee-production-ui/components/CanonicalCourtView.jsx");
  assert.match(marker, /player\.displayName/);
  assert.doesNotMatch(marker, /VĐV #1|#2 identity|playerNumberLabel/);
  assert.match(marker, /data-permanent-number="false"/);
});

test("11. player position switch is distinct from change ends", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const opened = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    idempotencyKey: "start-1",
  });
  assert.equal(opened.ok, true);
  const ends = await client.confirmChangeEnds({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: opened.view.expectedVersion,
    idempotencyKey: "ends-1",
  });
  assert.equal(ends.ok, true);
  assert.equal(ends.view.courtProjection.courtOrientation, "SWAPPED");
  const pos = await client.switchPositions({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    sideKey: "A",
    expectedVersion: ends.view.expectedVersion,
    idempotencyKey: "pos-1",
  });
  assert.equal(pos.ok, true);
  assert.equal(pos.result.distinctFromChangeEnds, true);
  assert.equal(pos.view.courtProjection.courtOrientation, "SWAPPED");
});

test("12+13+14. expectedVersion + idempotency + duplicate click blocked", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.INTERNAL);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    idempotencyKey: "start-internal",
  });
  assert.equal(started.ok, true);
  const first = client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "point-dup",
  });
  await assert.rejects(
    () =>
      client.submitPoint({
        tenantId: "tenant-1",
        matchId: fixture.matchId,
        actor: ACTOR,
        scoringSide: SCORING_SIDE.SIDE_A,
        expectedVersion: started.view.expectedVersion,
        idempotencyKey: "point-dup",
      }),
    (err) => err.code === REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED
  );
  const scored = await first;
  assert.equal(scored.ok, true);
});

test("14. stale fail-closed UX — no local confirm", async () => {
  const { runtime, driver } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.OFFICIAL);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    idempotencyKey: "start-official",
  });
  await driver.commitTransition(
    {
      tenantId: "tenant-1",
      competitionId: fixture.competitionId,
      matchId: fixture.matchId,
      expectedVersion: started.view.expectedVersion,
      idempotencyKey: "bump-version",
      eventType: "EXTERNAL_BUMP",
      nextState: { status: "in_progress" },
      status: "in_progress",
    },
    ACTOR
  );
  await assert.rejects(
    () =>
      client.submitPoint({
        tenantId: "tenant-1",
        matchId: fixture.matchId,
        actor: ACTOR,
        scoringSide: SCORING_SIDE.SIDE_A,
        expectedVersion: started.view.expectedVersion,
        idempotencyKey: "stale-point",
      }),
    (err) => err.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
  );
});

test("15. F5 durable reconstruction from matchId only", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.TEAM);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    idempotencyKey: "start-team",
  });
  const fresh = createClient(runtime, [fixture]);
  const reconstructed = await fresh.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(reconstructed.view.matchId, fixture.matchId);
  assert.equal(reconstructed.view.competitionMode, COMPETITION_REFEREE_MODE.TEAM);
  assert.ok(reconstructed.view.expectedVersion >= 0);
});

test("17. no fixture fallback in production client", () => {
  const hub = read("src/pages/referee/RefereeHub.jsx");
  const matchPage = read("src/pages/referee/RefereeCanonicalMatchPage.jsx");
  const client = read(
    "src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js"
  );
  assert.doesNotMatch(hub, /REFEREE_V5_FIXTURES|listRefereeAssignments/);
  assert.doesNotMatch(matchPage, /REFEREE_V5_FIXTURES|RefereeSessionScoreboard|location\.state\?\.tournamentId/);
  assert.doesNotMatch(client, /REFEREE_V5_FIXTURES|allowFixtureFallback === true/);
});

test("18. no service role / privileged RPC in browser UI", () => {
  const files = [
    "src/features/referee-production-ui/application/createBrowserRefereeApplicationClient.js",
    "src/features/referee-production-ui/application/createCanonicalRefereeApplicationClient.js",
    "src/pages/referee/RefereeHub.jsx",
    "src/pages/referee/RefereeCanonicalMatchPage.jsx",
  ];
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(text, /VITE_.*SERVICE_ROLE|getSupabaseAdminClient/);
    assert.doesNotMatch(text, /createLiveRpcCanonicalRefereeDurableDriver/);
    assert.doesNotMatch(text, /referee_v5_commit_match_transition/);
  }
  assert.throws(
    () => assertRefereeUiSecurity({ VITE_SUPABASE_SERVICE_ROLE: "secret" }),
    (err) => err.code === REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED
  );
});

test("19. CORE-17 result-status distinction", () => {
  const calculated = projectResultStatus({
    matchStatus: "IN_PROGRESS",
    scoreProjection: { calculatedMatchComplete: true, calculatedWinnerSide: "SIDE_A" },
  });
  assert.equal(calculated.resultStatus, RESULT_STATUS.CALCULATED_SCORE);
  assert.equal(calculated.officialWinner, false);
  const completed = projectResultStatus({
    matchStatus: "COMPLETED",
    validationStatus: "NONE",
    scoreProjection: { calculatedMatchComplete: true, calculatedWinnerSide: "SIDE_A" },
  });
  assert.equal(completed.resultStatus, RESULT_STATUS.MATCH_COMPLETED);
  assert.equal(completed.acceptedOfficialResult, false);
  const accepted = projectResultStatus({
    matchStatus: "COMPLETED",
    validationStatus: "ACCEPTED",
    scoreProjection: { calculatedMatchComplete: true, calculatedWinnerSide: "SIDE_A" },
  });
  assert.equal(accepted.resultStatus, RESULT_STATUS.ACCEPTED_OFFICIAL);
  assert.equal(accepted.officialWinner, true);
});

test("20-23. Team/Daily/Internal/Official UI path + canonical Adapter B", async () => {
  const { runtime } = createUiRuntime();
  assert.equal(runtime.usesAdapterB, true);
  for (const mode of [
    COMPETITION_REFEREE_MODE.DAILY_PLAY,
    COMPETITION_REFEREE_MODE.INTERNAL,
    COMPETITION_REFEREE_MODE.OFFICIAL,
    COMPETITION_REFEREE_MODE.TEAM,
  ]) {
    const fixture = modeFixture(mode);
    await seedAssigned(runtime, fixture);
    const client = createClient(runtime, [fixture]);
    const view = await client.getMatchView({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
    });
    assert.equal(view.view.adapterSelected.includes("adapter") || view.view.competitionMode === mode, true);
    assert.equal(view.silentLegacyFallback, false);
  }
});

test("canonical routes do not silently fall back to legacy token/session scoring", () => {
  const router = read("src/router.jsx");
  assert.match(router, /RefereeCanonicalMatchPage/);
  assert.match(router, /path="\/referee\/match\/:matchId"/);
  assert.doesNotMatch(
    router,
    /path="\/referee\/match\/:matchId" element=\{<RefereeV5TeamMatchPage/
  );
  const matchPage = read("src/pages/referee/RefereeCanonicalMatchPage.jsx");
  assert.doesNotMatch(matchPage, /RefereeSessionScoreboard|RefereeV5Workspace/);
  const hub = read("src/pages/referee/RefereeHub.jsx");
  assert.doesNotMatch(hub, /state=\{\{ refereeToken/);
});

test("browser client without runtime fail-closes commands (no V5/legacy)", async () => {
  const client = createBrowserRefereeApplicationClient({
    actor: ACTOR,
    env: {},
  });
  assert.equal(client.serviceRoleInBrowser, false);
  assert.equal(client.directPrivilegedRpcFromBrowser, false);
  assert.equal(client.productionFixtureFallback, false);
  await assert.rejects(() => client.submitPoint({}), (err) => {
    return err.silentLegacyFallback === false && err.failClosed === true;
  });
});

test("change-end policy label only when canonical policy supplies it", () => {
  const view = buildRefereeMatchView({
    matchId: "m1",
    competitionMode: "DAILY_PLAY",
    adapterSelected: "daily-play-referee-adapter-b",
    scoringRules: SIDE_OUT,
    lifecyclePolicy: { changeEndPolicyLabel: "Sau mỗi game • G3 tại 6" },
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
  });
  assert.equal(view.gameSummary.changeEndPolicy, "Sau mỗi game • G3 tại 6");
  const bare = buildRefereeMatchView({
    matchId: "m2",
    competitionMode: "DAILY_PLAY",
    scoringRules: createScoringFormat({
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
      winBy: 2,
      bestOfGames: 3,
    }),
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
  });
  assert.equal(bare.gameSummary.changeEndPolicy, null);
});

test("assignment card action labels", () => {
  const enter = buildRefereeAssignmentCard({
    assignment: { matchId: "m", competitionId: "c", status: "ASSIGNED" },
    competitionMode: "DAILY_PLAY",
    assignedMatch: { lifecycleState: "READY_TO_START" },
    participants: { sides: [] },
  });
  assert.equal(enter.actionLabel, "Vào trận");
  const cont = buildRefereeAssignmentCard({
    assignment: { matchId: "m", competitionId: "c", status: "READY" },
    competitionMode: "DAILY_PLAY",
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
    participants: { sides: [] },
  });
  assert.equal(cont.actionLabel, "Tiếp tục");
  const done = buildRefereeAssignmentCard({
    assignment: { matchId: "m", competitionId: "c", status: "READY" },
    competitionMode: "DAILY_PLAY",
    assignedMatch: { lifecycleState: "COMPLETED", validationStatus: "ACCEPTED" },
    participants: { sides: [] },
  });
  assert.equal(done.actionLabel, "Xem kết quả");
});
