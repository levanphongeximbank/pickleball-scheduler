/**
 * Phase 2C â One Canonical Production Referee UI.
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
import { resolveSideChangeRequiredAfterScoring } from "../src/features/competition-engine/integration/referee/deriveCanonicalCourtAfterScoring.js";
import {
  formatAssignmentStatusLabel,
  formatCompetitionDisplayName,
  formatCompetitionModeLabel,
  formatCourtLabel,
  formatLocalScheduledTime,
} from "../src/features/referee-production-ui/projection/formatRefereeUiLabels.js";
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
    changeEndPolicyLabel: "Sau mỗi game â¢ G3 tại 6",
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
    competitionName: extras.competitionName || "Daily Club Night",
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
        courtLabel: "Sân 1",
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
    competitionName:
      extras.competitionName ||
      (mode === COMPETITION_REFEREE_MODE.OFFICIAL ? "Open Official Cup" : "Internal Club Cup"),
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
        courtLabel: "Sân 2",
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
    competitionName: extras.competitionName || "Giải đồng đội UI",
    venueId: "venue-1",
    clubId: "club-1",
    participantNames: { a1: "Hà", a2: "Khoa", b1: "Linh", b2: "Nam", "team-a": "Đội A", "team-b": "Đội B" },
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
        teamAName: "Đội A",
        teamBName: "Đội B",
        status: "READY_TO_START",
        courtId: "court-3",
        courtLabel: "Sân 3",
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

test("7. singles rendering â one player per side", () => {
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
  assert.equal(db.hasActiveRotation, true);
  assert.equal(db.rotationOwnedByTeamDomain, true);
  assert.equal(db.sideAActivePlayer.displayName, "Hà");
  assert.equal(db.sideBActivePlayer.displayName, "Linh");
  assert.equal(db.nextPlayerA.displayName, "Khoa");
});

test("8b. DreamBreaker requires genuine matchContext flag (no leftover blob UI)", () => {
  const db = projectDreamBreakerRotation({
    matchContext: { isDreambreaker: false },
    modeState: {
      dreambreaker: {
        rotation: { sideAPlayerId: "a1", sideBPlayerId: "b1" },
      },
    },
    participantNames: { a1: "Hà", b1: "Linh" },
  });
  assert.equal(db.isDreambreaker, false);
  assert.equal(db.hasActiveRotation, false);
  assert.equal(db.sideAActivePlayer, null);
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
  assert.match(marker, /player\.displayName|shortName\(/);
  assert.doesNotMatch(marker, /VÄV #1|#2 identity|playerNumberLabel/);
  assert.match(marker, /data-permanent-number="false"/);
  assert.doesNotMatch(marker, />#1<|>#2</);
});

test("11. player position switch is distinct from change ends", async () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 2,
  });
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  fixture.modeState = dailyModeState(fixture.competitionId, fixture.matchId, {
    scoringRules: format,
  });
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  let version = started.view.expectedVersion;
  let scored = started;
  for (let i = 0; i < 2; i += 1) {
    scored = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: version,
      idempotencyKey: `ends-due-${i}`,
    });
    version = scored.view.expectedVersion;
  }
  assert.equal(scored.view.courtProjection.sideChangeRequired, true);
  const ends = await client.confirmChangeEnds({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: scored.view.expectedVersion,
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

test("11b. configureLineup sets server + LÆ°á»£t giao and unlocks start/score gate", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const before = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(before.view.lineupRequired, true);
  assert.equal(before.view.canStart, false);
  const configured = await client.configureLineup({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: before.view.expectedVersion,
    idempotencyKey: "lineup-1",
    playerPositions: {
      sideA: ["p1", "p2"],
      sideB: ["p3", "p4"],
    },
    serverPlayerId: "p2",
    serverNumber: 2,
    servingSide: "SIDE_A",
  });
  assert.equal(configured.ok, true);
  assert.equal(configured.view.lineupConfigured, true);
  assert.equal(configured.view.lineupRequired, false);
  assert.equal(configured.view.canStart, true);
  assert.equal(configured.view.servingStatus.servingPlayerName, "Bình");
  assert.equal(configured.view.servingStatus.serviceTurn, 2);
  assert.equal(configured.view.courtProjection.court.leftBottom.isServing, true);
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: configured.view.expectedVersion,
    idempotencyKey: "start-after-lineup",
  });
  assert.equal(started.ok, true);
  assert.equal(started.view.canScore, true);
  assert.equal(started.view.servingStatus.servingPlayerName, "Bình");
});

async function startSideOutWithLineup(client, fixture, lineup) {
  const before = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  const configured = await client.configureLineup({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: before.view.expectedVersion,
    idempotencyKey: `lineup-${Date.now()}-${Math.random()}`,
    ...lineup,
  });
  assert.equal(configured.ok, true);
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: configured.view.expectedVersion,
    idempotencyKey: `start-${Date.now()}-${Math.random()}`,
  });
  assert.equal(started.ok, true);
  return started;
}

test("side-out proof 1: 0-0-2 receiving win â opponent serves turn 1 + star", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 2,
    servingSide: "SIDE_A",
  });
  assert.equal(started.view.currentScore.points.SIDE_A, 0);
  assert.equal(started.view.currentScore.serve.serverNumber, 2);
  const changed = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_B,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "so-002-recv",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.view.currentScore.points.SIDE_A, 0);
  assert.equal(changed.view.currentScore.points.SIDE_B, 0);
  assert.equal(changed.view.currentScore.serve.servingSide, "SIDE_B");
  assert.equal(changed.view.currentScore.serve.serverNumber, 1);
  assert.equal(changed.view.servingStatus.serviceTurn, 1);
  assert.equal(changed.view.courtProjection.serving.servingSide, "SIDE_B");
  assert.equal(changed.view.courtProjection.serving.serverPlayerId, "p3");
  assert.equal(changed.view.courtProjection.court.rightTop.isServing, true);
  assert.equal(changed.latency?.networkPostCount, 1);
  assert.equal(changed.latency?.postCommitRefetch, false);
  assert.equal(changed.latency?.ackReturnsFullView, true);
  assert.ok(Number(changed.latency?.totalMs) >= 0);
  process.stdout.write(
    `LATENCY_PROOF ${JSON.stringify({
      NETWORK_POST_COUNT: changed.latency.networkPostCount,
      POST_COMMIT_REFETCH: changed.latency.postCommitRefetch,
      ACK_RETURNS_FULL_VIEW: changed.latency.ackReturnsFullView,
      AUTH_MS: "N/A_LOCAL_INPROCESS",
      CONTEXT_RESOLUTION_MS: changed.latency.contextResolutionMs,
      CORE_WRITE_MS: changed.latency.coreWriteMs,
      DURABLE_COMMIT_MS: changed.latency.durableCommitMs,
      POST_COMMIT_PROJECTION_MS: changed.latency.postCommitProjectionMs,
      TOTAL_MS_LOCAL: changed.latency.totalMs,
      NOTE: "Local schema-faithful driver; browser AUTH_MS requires Preview",
    })}\n`
  );
});

test("side-out proof 2: turn 1 receiving win â same team turn 2 + partner star", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  const changed = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_B,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "so-t1-recv",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.view.currentScore.points.SIDE_A, 0);
  assert.equal(changed.view.currentScore.points.SIDE_B, 0);
  assert.equal(changed.view.currentScore.serve.servingSide, "SIDE_A");
  assert.equal(changed.view.currentScore.serve.serverNumber, 2);
  assert.equal(changed.view.servingStatus.serviceTurn, 2);
  assert.equal(changed.view.courtProjection.serving.serverPlayerId, "p2");
  assert.equal(changed.view.courtProjection.court.leftBottom.isServing, true);
});

test("side-out proof 3: turn 2 receiving win â opponent turn 1 + star", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p2",
    serverNumber: 2,
    servingSide: "SIDE_A",
  });
  const changed = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_B,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "so-t2-recv",
  });
  assert.equal(changed.ok, true);
  assert.equal(changed.view.currentScore.points.SIDE_A, 0);
  assert.equal(changed.view.currentScore.points.SIDE_B, 0);
  assert.equal(changed.view.currentScore.serve.servingSide, "SIDE_B");
  assert.equal(changed.view.currentScore.serve.serverNumber, 1);
  assert.equal(changed.view.courtProjection.serving.serverPlayerId, "p3");
  assert.equal(changed.view.courtProjection.court.rightTop.isServing, true);
});

test("side-out proof 4: serving scores â +1, serving positions swap, same server, star follows", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  assert.equal(started.view.courtProjection.court.leftTop.playerId, "p1");
  assert.equal(started.view.courtProjection.court.leftBottom.playerId, "p2");
  const scored = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "so-serve-point",
  });
  assert.equal(scored.ok, true);
  assert.equal(scored.view.currentScore.points.SIDE_A, 1);
  assert.equal(scored.view.currentScore.points.SIDE_B, 0);
  assert.equal(scored.view.currentScore.serve.servingSide, "SIDE_A");
  assert.equal(scored.view.courtProjection.serving.serverPlayerId, "p1");
  assert.equal(scored.view.courtProjection.court.leftTop.playerId, "p2");
  assert.equal(scored.view.courtProjection.court.leftBottom.playerId, "p1");
  assert.equal(scored.view.courtProjection.court.rightTop.playerId, "p3");
  assert.equal(scored.view.courtProjection.court.rightBottom.playerId, "p4");
  assert.equal(scored.view.courtProjection.court.leftBottom.isServing, true);
});

test("rally: winner gets point + serve; no change-serve control; no service turn", async () => {
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.INTERNAL);
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await client.startMatch({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    idempotencyKey: "rally-start",
  });
  assert.equal(started.ok, true);
  assert.equal(started.view.isRally, true);
  assert.equal(started.view.canChangeServe, false);
  assert.equal(started.view.servingStatus.showServiceTurn, false);
  const scored = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_B,
    expectedVersion: started.view.expectedVersion,
    idempotencyKey: "rally-point-b",
  });
  assert.equal(scored.ok, true);
  assert.equal(scored.view.currentScore.points.SIDE_B, 1);
  assert.equal(scored.view.currentScore.serve?.servingSide || scored.view.courtProjection.serving.servingSide, "SIDE_B");
  assert.equal(scored.view.servingStatus.showServiceTurn, false);
  assert.equal(scored.view.canChangeServe, false);
});

test("OWNER RALLY 6:2â6:3 receiving win moves serve/star + odd parity on B", async () => {
  const { runtime } = createUiRuntime();
  const competitionId = "daily-rally-parity";
  const matchId = "daily-rally-parity-match";
  const modeState = dailyModeState(competitionId, matchId);
  modeState.matches[matchId].scoringRules = RALLY;
  const fixture = {
    mode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
    competitionId,
    matchId,
    modeState,
  };
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);

  const before = await client.getMatchView({
    tenantId: "tenant-1",
    matchId,
    actor: ACTOR,
  });
  const lined = await client.configureLineup({
    tenantId: "tenant-1",
    matchId,
    actor: ACTOR,
    expectedVersion: before.view.expectedVersion,
    idempotencyKey: "rally-lineup",
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  let cur = await client.startMatch({
    tenantId: "tenant-1",
    matchId,
    actor: ACTOR,
    expectedVersion: lined.view.expectedVersion,
    idempotencyKey: "rally-start-6-2",
  });
  assert.equal(cur.ok, true);

  async function point(side, key) {
    cur = await client.submitPoint({
      tenantId: "tenant-1",
      matchId,
      actor: ACTOR,
      scoringSide: side,
      expectedVersion: cur.view.expectedVersion,
      idempotencyKey: key,
    });
    assert.equal(cur.ok, true, key);
  }

  // Reach 5-0 (A), then 5-2 (B), then 6-2 (A serving).
  for (let i = 1; i <= 5; i += 1) await point(SCORING_SIDE.SIDE_A, `a-${i}`);
  await point(SCORING_SIDE.SIDE_B, "b-1");
  await point(SCORING_SIDE.SIDE_B, "b-2");
  await point(SCORING_SIDE.SIDE_A, "a-6");

  assert.equal(cur.view.currentScore.points.SIDE_A, 6);
  assert.equal(cur.view.currentScore.points.SIDE_B, 2);
  assert.equal(cur.view.courtProjection.serving.servingSide, "SIDE_A");
  assert.ok(cur.view.courtProjection.serving.serverPlayerId === "p1" || cur.view.courtProjection.serving.serverPlayerId === "p2");

  // Owner sequence: B wins rally â 6:3, B serves, odd parity, star on B.
  await point(SCORING_SIDE.SIDE_B, "owner-6-2-to-6-3");
  assert.equal(cur.view.currentScore.points.SIDE_A, 6);
  assert.equal(cur.view.currentScore.points.SIDE_B, 3);
  assert.equal(cur.view.courtProjection.serving.servingSide, "SIDE_B");
  assert.equal(cur.view.servingStatus.showServiceTurn, false);
  // B score 3 = odd â LEFT court (index 1) from home [p3,p4] swapped â [p4,p3], server = p3
  assert.deepEqual(cur.view.courtProjection.sides.right.activePlayers.map((p) => p.playerId), [
    "p4",
    "p3",
  ]);
  assert.equal(cur.view.courtProjection.serving.serverPlayerId, "p3");
  assert.equal(cur.view.courtProjection.court.rightBottom.isServing, true);
  assert.equal(cur.view.courtProjection.court.leftTop?.isServing || false, false);
  assert.equal(cur.view.courtProjection.court.leftBottom?.isServing || false, false);

  // F5 reconstruct
  const refreshed = await client.getMatchView({
    tenantId: "tenant-1",
    matchId,
    actor: ACTOR,
  });
  assert.equal(refreshed.view.currentScore.points.SIDE_B, 3);
  assert.equal(refreshed.view.courtProjection.serving.servingSide, "SIDE_B");
  assert.equal(refreshed.view.courtProjection.serving.serverPlayerId, "p3");
});

test("RALLY parity matrix: evenâodd for keep-serve and side-change", async () => {
  const { deriveCanonicalCourtAfterScoring } = await import(
    "../src/features/competition-engine/integration/referee/deriveCanonicalCourtAfterScoring.js"
  );
  const home = {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    homePlayerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    servingSide: "SIDE_A",
    lineupConfigured: true,
  };

  // A evenâodd keep serve
  const aOdd = deriveCanonicalCourtAfterScoring({
    priorCourt: home,
    priorServe: { servingSide: "SIDE_A", serverNumber: 1 },
    nextServe: { servingSide: "SIDE_A", serverNumber: 1 },
    priorPoints: { SIDE_A: 4, SIDE_B: 2 },
    nextPoints: { SIDE_A: 5, SIDE_B: 2 },
    scoringSystem: "RALLY",
    awardedPoint: true,
    rallyWinnerSide: "SIDE_A",
  });
  assert.deepEqual(aOdd.playerPositions.sideA, ["p2", "p1"]);
  assert.equal(aOdd.serverPlayerId, "p1");
  assert.equal(aOdd.servingSide, "SIDE_A");

  // A oddâeven keep serve
  const aEven = deriveCanonicalCourtAfterScoring({
    priorCourt: aOdd,
    priorServe: { servingSide: "SIDE_A", serverNumber: 1 },
    nextServe: { servingSide: "SIDE_A", serverNumber: 1 },
    priorPoints: { SIDE_A: 5, SIDE_B: 2 },
    nextPoints: { SIDE_A: 6, SIDE_B: 2 },
    scoringSystem: "RALLY",
    awardedPoint: true,
    rallyWinnerSide: "SIDE_A",
  });
  assert.deepEqual(aEven.playerPositions.sideA, ["p1", "p2"]);
  assert.equal(aEven.serverPlayerId, "p1");

  // B wins: A6 B2 â A6 B3, B odd serve
  const bOdd = deriveCanonicalCourtAfterScoring({
    priorCourt: aEven,
    priorServe: { servingSide: "SIDE_A", serverNumber: 1 },
    nextServe: { servingSide: "SIDE_B", serverNumber: 1 },
    priorPoints: { SIDE_A: 6, SIDE_B: 2 },
    nextPoints: { SIDE_A: 6, SIDE_B: 3 },
    scoringSystem: "RALLY",
    awardedPoint: true,
    rallyWinnerSide: "SIDE_B",
  });
  assert.equal(bOdd.servingSide, "SIDE_B");
  assert.deepEqual(bOdd.playerPositions.sideB, ["p4", "p3"]);
  assert.equal(bOdd.serverPlayerId, "p3");
  assert.deepEqual(bOdd.playerPositions.sideA, ["p1", "p2"]);

  // B oddâeven keep serve
  const bEven = deriveCanonicalCourtAfterScoring({
    priorCourt: bOdd,
    priorServe: { servingSide: "SIDE_B", serverNumber: 1 },
    nextServe: { servingSide: "SIDE_B", serverNumber: 1 },
    priorPoints: { SIDE_A: 6, SIDE_B: 3 },
    nextPoints: { SIDE_A: 6, SIDE_B: 4 },
    scoringSystem: "RALLY",
    awardedPoint: true,
    rallyWinnerSide: "SIDE_B",
  });
  assert.deepEqual(bEven.playerPositions.sideB, ["p3", "p4"]);
  assert.equal(bEven.serverPlayerId, "p3");
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

test("14. stale fail-closed UX â no local confirm", async () => {
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

test("browser client without transport fail-closes commands (no V5/legacy)", async () => {
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
  await assert.rejects(() => client.getMatchView({ matchId: "x" }), (err) => {
    return (
      err.failClosed === true &&
      err.silentLegacyFallback === false &&
      !/Deep-link match view requires canonical Adapter B runtime/i.test(err.message)
    );
  });
});

test("browser client authenticated transport invoked with expectedVersion + idempotency", async () => {
  const calls = [];
  const transport = {
    listMyAssignments: async () => ({ ok: true, assignments: [] }),
    getMatchView: async (payload) => {
      calls.push(["getMatchView", payload]);
      return {
        ok: true,
        view: { matchId: payload.matchId, expectedVersion: 3, competitionMode: "TEAM" },
      };
    },
    submitPoint: async (payload) => {
      calls.push(["submitPoint", payload]);
      return {
        ok: true,
        view: { matchId: payload.matchId, expectedVersion: 4 },
      };
    },
    undoLastScoringAction: async (payload) => {
      calls.push(["undoLastScoringAction", payload]);
      return {
        ok: true,
        view: { matchId: payload.matchId, expectedVersion: 5, canUndo: false },
      };
    },
    startMatch: async () => ({ ok: true }),
    acknowledgeAssignment: async () => ({ ok: true }),
    openAssignedMatch: async () => ({ ok: true }),
    startScoreSession: async () => ({ ok: true }),
    suspendMatch: async () => ({ ok: true }),
    resumeMatch: async () => ({ ok: true }),
    confirmChangeEnds: async () => ({ ok: true }),
    switchPositions: async () => ({ ok: true }),
    configureLineup: async () => ({ ok: true }),
    submitResult: async () => ({ ok: true }),
    correctResult: async () => ({ ok: true }),
  };
  const client = createBrowserRefereeApplicationClient({
    actor: ACTOR,
    env: {},
    transport,
  });
  assert.equal(client.commandTransport, "authenticated-api-referee-command");
  assert.equal(client.readOnly, false);
  const view = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: "matchup-7t58gnjq",
  });
  assert.equal(view.view.matchId, "matchup-7t58gnjq");
  await client.submitPoint({
    tenantId: "tenant-1",
    matchId: "matchup-7t58gnjq",
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: 3,
    idempotencyKey: "idem-1",
  });
  await client.undoLastScoringAction({
    tenantId: "tenant-1",
    matchId: "matchup-7t58gnjq",
    expectedVersion: 4,
    idempotencyKey: "idem-undo-1",
  });
  assert.equal(calls[0][0], "getMatchView");
  assert.equal(calls[1][0], "submitPoint");
  assert.equal(calls[1][1].expectedVersion, 3);
  assert.equal(calls[1][1].idempotencyKey, "idem-1");
  assert.equal(calls[2][0], "undoLastScoringAction");
  assert.equal(calls[2][1].expectedVersion, 4);
  assert.equal(calls[2][1].idempotencyKey, "idem-undo-1");
  assert.doesNotMatch(
    read("src/features/referee-production-ui/application/createBrowserRefereeApplicationClient.js"),
    /Deep-link match view requires canonical Adapter B runtime/
  );
  assert.match(
    read(
      "src/features/referee-production-ui/application/createAuthenticatedRefereeCommandTransport.js"
    ),
    /UNDO_LAST_SCORING_ACTION/
  );
  assert.match(
    read("src/features/referee-production-ui/constants.js"),
    /UNDO_LAST_SCORING_ACTION/
  );
  assert.match(
    read("src/features/referee-production-ui/components/RefereeMatchScreen.jsx"),
    /↶ Hoàn tác lần ghi gần nhất/
  );
  assert.match(
    read("src/features/referee-production-ui/components/RefereeMatchScreen.jsx"),
    /Đang hoàn tác\.\.\./
  );
  assert.doesNotMatch(
    read("src/features/referee-production-ui/components/RefereeMatchScreen.jsx"),
    /- Điểm|Giảm điểm/
  );
});

test("owner visual acceptance â CORE-13 row enriched without raw UUID/MODE/ASSIGNED", async () => {
  const { runtime } = createUiRuntime();
  const competitionId = "b5cd6975-3a7f-4c11-8006-2ac14e7bef5b";
  const matchId = "matchup-7t58gnjq";
  const modeState = {
    tenantId: "tenant-1",
    competitionId,
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    competitionName: "Giải đồng đội 13/8/2026",
    participantNames: {
      "team-biqspqe9": "Đội 4",
      "team-sg9nd5xj": "Đội 2",
    },
    matchups: {
      [matchId]: {
        matchupId: matchId,
        teamAId: "team-biqspqe9",
        teamBId: "team-sg9nd5xj",
        teamAName: "Đội 4",
        teamBName: "Đội 2",
        courtLabel: "Sân 1",
        courtId: null,
        scheduledAt: "2026-08-15T17:02:00.000Z",
        status: "READY_TO_START",
        stage: "KO",
        round: 1,
        lineupsLocked: true,
        scoringRules: RALLY,
        subMatches: [],
        sides: [
          {
            sideKey: "A",
            teamId: "team-biqspqe9",
            displayName: "Đội 4",
            participantIds: [],
          },
          {
            sideKey: "B",
            teamId: "team-sg9nd5xj",
            displayName: "Đội 2",
            participantIds: [],
          },
        ],
      },
    },
  };
  await runtime.assignmentRepository.upsert(
    {
      tenantId: "tenant-1",
      competitionId,
      matchId,
      refereeUserId: ACTOR.actorId,
    },
    ACTOR
  );
  const client = createCanonicalRefereeApplicationClient({
    runtime,
    actor: ACTOR,
    modeStateResolver: () => modeState,
  });
  const listed = await client.listMyAssignments({ tenantId: "tenant-1", actor: ACTOR });
  const card = listed.assignments.find((row) => row.matchId === matchId);
  assert.ok(card);
  assert.equal(card.competitionName, "Giải đồng đội 13/8/2026");
  assert.equal(card.participantA, "Đội 4");
  assert.equal(card.participantB, "Đội 2");
  assert.equal(card.courtLabel, "Sân 1");
  assert.ok(card.scheduledTime);
  assert.equal(String(card.scheduledTime).includes("T"), false);
  assert.equal(card.competitionModeLabel, "Giải đồng đội");
  assert.equal(card.assignmentStatusLabel, "Đã phân công");
  assert.notEqual(card.competitionName, competitionId);
  assert.notEqual(card.courtLabel, "Sân ?");
  assert.notEqual(card.competitionModeLabel, "MODE");
  assert.notEqual(card.assignmentStatusLabel, "ASSIGNED");
  assert.notEqual(card.participantA, "—");
  assert.notEqual(card.participantB, "—");

  const deep = await client.getMatchView({
    tenantId: "tenant-1",
    matchId,
    actor: ACTOR,
  });
  assert.equal(deep.view.competitionMode, COMPETITION_REFEREE_MODE.TEAM);
  assert.equal(deep.view.competitionName, "Giải đồng đội 13/8/2026");
  assert.equal(deep.locationStateRequired, false);
});

test("assignment card formatting helpers reject raw technical labels", () => {
  assert.equal(
    formatCourtLabel({ courtId: "b5cd6975-3a7f-4c11-8006-2ac14e7bef5b" }),
    "Sân chưa xác định"
  );
  assert.equal(formatCourtLabel({ courtLabel: "Sân 1" }), "Sân 1");
  assert.equal(
    formatCompetitionDisplayName({
      competitionName: null,
      competitionId: "b5cd6975-3a7f-4c11-8006-2ac14e7bef5b",
    }),
    "Giải chưa xác định tên"
  );
  assert.equal(formatCompetitionModeLabel("DAILY_PLAY"), "Vui chơi hằng ngày");
  assert.equal(formatAssignmentStatusLabel("ASSIGNED"), "Đã phân công");
  assert.equal(formatAssignmentStatusLabel("IN_PROGRESS"), "Đang thi đấu");
  assert.equal(formatAssignmentStatusLabel("COMPLETED"), "Đã hoàn tất");
  const local = formatLocalScheduledTime("2026-08-15T17:02:00.000Z", "UTC");
  assert.ok(local);
  assert.equal(local.includes("T17:02:00"), false);
});

test("authenticated API host exists and blocks browser privileged composition", () => {
  const api = read("api/referee/command.js");
  assert.match(api, /createTrustedRefereeBackend/);
  assert.match(api, /authorizeRefereeActor/);
  assert.doesNotMatch(api, /VITE_SUPABASE_SERVICE_ROLE/);
  const browser = read(
    "src/features/referee-production-ui/application/createBrowserRefereeApplicationClient.js"
  );
  assert.match(browser, /createAuthenticatedRefereeCommandTransport/);
  assert.doesNotMatch(browser, /createLiveRpcCanonicalRefereeDurableDriver/);
  assert.doesNotMatch(browser, /createDefaultCompetitionRefereeRuntime/);
  const hub = read("src/pages/referee/RefereeHub.jsx");
  assert.doesNotMatch(hub, /Quét QR trận/);
  assert.match(hub, /Quét QR \(tuỳ chọn\)/);
});

test("owner visual remediation — chrome suppress + participant-aware controls", () => {
  const layout = read("src/layouts/MainLayout.jsx");
  const shell = read("src/features/canonical-shell/components/CanonicalAppShell.jsx");
  const bottomNav = read("src/features/mobile/layout/MobileBottomNav.jsx");
  const match = read("src/features/referee-production-ui/components/RefereeMatchScreen.jsx");
  const home = read("src/features/referee-production-ui/components/RefereeHome.jsx");
  const card = read("src/features/referee-production-ui/components/RefereeAssignmentCard.jsx");
  const css = read("src/features/referee-production-ui/styles/referee-production.css");
  assert.match(layout, /isRefereeWorkspaceRoute/);
  assert.match(shell, /isRefereeWorkspaceRoute/);
  assert.match(bottomNav, /isRefereeWorkspaceRoute/);
  assert.match(home, /Trọng tài của tôi/);
  assert.match(home, /home-daily-summary/);
  assert.match(home, /home-date-range/);
  assert.match(home, /home-date-from/);
  assert.match(home, /home-date-to/);
  assert.match(home, /home-status-filters/);
  assert.match(match, /deriveCourtPresentation/);
  assert.match(match, /Điều hành trận/);
  assert.match(match, /match-rules-panel/);
  assert.match(match, /Sắp xếp đội hình/);
  assert.match(match, /ĐỔI SÂN \/ ĐỔI ĐẦU SÂN/);
  assert.match(match, /ĐÃ ĐẾN ĐIỂM ĐỔI SÂN/);
  assert.match(match, /Điểm đổi sân/);
  assert.match(match, /XÁC NHẬN ĐỔI SÂN/);
  assert.match(match, /rp-score-team-name/);
  assert.match(match, /pointLabel\(/);
  assert.match(match, /leftPointHandler/);
  assert.match(match, /data-display-end/);
  assert.match(match, /Đang xác nhận\.\.\./);
  assert.match(match, /btn-undo-last-scoring-action/);
  assert.match(match, /↶ Hoàn tác lần ghi gần nhất/);
  assert.match(match, /Đang hoàn tác\.\.\./);
  assert.match(match, /score-pending-hint|changeEndConfirmBlocked|isOptimisticPresentation/);
  assert.match(
    read("src/features/referee-production-ui/hooks/useCanonicalRefereeMatch.js"),
    /authoritativeView|optimisticView|deriveOptimisticSubmitPointView|undoLastScoringAction/
  );
  assert.match(
    read("src/features/referee-production-ui/projection/deriveOptimisticSubmitPointView.js"),
    /PURE|isOptimisticPresentation|changeEndConfirmBlocked/
  );
  assert.match(match, /current-game-score/);
  assert.match(match, /games-won/);
  assert.match(match, /serving-status-strip/);
  assert.match(match, /serve-version/);
  assert.doesNotMatch(match, />Điểm A</);
  assert.doesNotMatch(match, /A: \{db\.sideAActivePlayer/);
  assert.match(card, /assignment-meta-row/);
  assert.doesNotMatch(card, /match-status-badge/);
  assert.match(css, /max-height:\s*220px/);
  assert.match(css, /rp-court-kitchen/);
  assert.match(css, /rp-court-baseline/);
  assert.match(css, /rp-home-date-range/);
  assert.match(css, /left:\s*50%/); // landscape net is vertical at center
});

test("home daily summary + status filters", async () => {
  const {
    buildRefereeHomeSummary,
    filterAssignmentsByHomeStatus,
    filterAssignmentsByDateRange,
    normalizeRefereeHomeCard,
    resolveAssignmentLocalDayKey,
    localDayKey,
    HOME_STATUS_FILTER,
  } = await import(
    "../src/features/referee-production-ui/projection/buildRefereeHomeSummary.js"
  );
  const today = new Date("2026-08-17T12:00:00+07:00");
  const todayKey = localDayKey(today);
  const assignments = [
    {
      matchId: "1",
      matchStatus: "READY_TO_START",
      action: "ENTER",
      scheduledTimeRaw: "2026-08-17T08:00:00+07:00",
    },
    {
      matchId: "2",
      matchStatus: "IN_PROGRESS",
      action: "CONTINUE",
      scheduledTimeRaw: "2026-08-17T09:00:00+07:00",
    },
    {
      matchId: "3",
      matchStatus: "COMPLETED",
      action: "VIEW_RESULT",
      acceptedOfficialResult: true,
      scheduledTimeRaw: "2026-08-17T10:00:00+07:00",
    },
  ];
  const summary = buildRefereeHomeSummary(assignments, today);
  assert.equal(summary.totalToday, 3);
  assert.equal(summary.counters.upcoming, 1);
  assert.equal(summary.counters.live, 1);
  assert.equal(summary.counters.done, 1);
  assert.match(summary.headline, /Hôm nay: 3 trận/);
  assert.equal(
    filterAssignmentsByHomeStatus(assignments, HOME_STATUS_FILTER.LIVE).length,
    1
  );

  // Screenshot regression: TIẾP TỤC must count as LIVE even if stale bucket says DONE.
  const stale = normalizeRefereeHomeCard({
    matchId: "sub-syysofdv",
    matchStatus: "COMPLETED",
    action: "CONTINUE",
    actionLabel: "TIẾP TỤC",
    homeStatusBucket: "DONE",
    homeStatusLabel: "Hoàn tất",
    acceptedOfficialResult: true,
    scheduledTimeRaw: "2026-08-17T09:11:00+07:00",
  });
  assert.equal(stale.homeStatusBucket, "LIVE");
  assert.equal(stale.homeStatusLabel, "Đang thi đấu");
  const staleSummary = buildRefereeHomeSummary([stale], today);
  assert.equal(staleSummary.counters.live, 1);
  assert.equal(staleSummary.counters.done, 0);
  assert.equal(
    filterAssignmentsByHomeStatus([stale], HOME_STATUS_FILTER.LIVE).length,
    1
  );
  assert.equal(
    filterAssignmentsByHomeStatus([stale], HOME_STATUS_FILTER.DONE).length,
    0
  );

  // Live matchStatus wins over stale VIEW_RESULT action.
  const liveStatus = normalizeRefereeHomeCard({
    matchId: "live-1",
    matchStatus: "IN_PROGRESS",
    action: "VIEW_RESULT",
    actionLabel: "XEM KẾT QUẢ",
    scheduledTimeRaw: "2026-08-17T11:00:00+07:00",
  });
  assert.equal(liveStatus.homeStatusBucket, "LIVE");

  // Summary board must NOT fall back to historical when today is empty.
  const mixedDays = [
    {
      matchId: "today-live",
      matchStatus: "IN_PROGRESS",
      action: "CONTINUE",
      scheduledTimeRaw: "2026-08-16T10:00:00.000Z",
    },
    {
      matchId: "old-done",
      matchStatus: "COMPLETED",
      action: "VIEW_RESULT",
      scheduledTimeRaw: "2026-08-12T10:00:00.000Z",
    },
  ];
  const daySummary = buildRefereeHomeSummary(
    mixedDays,
    new Date("2026-08-16T15:00:00+07:00")
  );
  assert.equal(daySummary.totalToday, 1);
  assert.equal(daySummary.counters.live, 1);
  assert.equal(daySummary.board.length, 1);
  assert.equal(
    filterAssignmentsByHomeStatus(daySummary.board, HOME_STATUS_FILTER.ALL).length,
    1
  );

  const emptyToday = buildRefereeHomeSummary(
    mixedDays.filter((row) => row.matchId === "old-done"),
    today
  );
  assert.equal(emptyToday.totalToday, 0);
  assert.match(emptyToday.headline, /Hôm nay: 0 trận/);
  assert.match(emptyToday.emptyMessage, /hôm nay/);

  const historicalDay = buildRefereeHomeSummary(mixedDays, {
    fromDate: "2026-08-12",
    toDate: "2026-08-12",
    now: today,
  });
  assert.equal(historicalDay.totalInRange, 1);
  assert.match(historicalDay.headline, /Ngày 12\/08\/2026: 1 trận/);

  const multiDay = buildRefereeHomeSummary(mixedDays, {
    fromDate: "2026-08-12",
    toDate: "2026-08-16",
    now: today,
  });
  assert.equal(multiDay.totalInRange, 2);
  assert.equal(multiDay.counters.live, 1);
  assert.equal(multiDay.counters.done, 1);
  assert.match(multiDay.headline, /12\/08\/2026 – 16\/08\/2026: 2 trận/);

  const undated = {
    matchId: "undated",
    matchStatus: "READY_TO_START",
    action: "ENTER",
  };
  assert.equal(resolveAssignmentLocalDayKey(undated), null);
  const undatedSummary = buildRefereeHomeSummary([undated, ...assignments], today);
  assert.equal(undatedSummary.totalToday, 3);
  assert.equal(undatedSummary.undatedCount, 1);
  assert.equal(
    filterAssignmentsByDateRange([undated], { fromDate: todayKey, toDate: todayKey }).length,
    0
  );

  // Timezone boundary: UTC evening that is next local Vietnam morning.
  const boundary = {
    matchId: "boundary",
    matchStatus: "READY_TO_START",
    action: "ENTER",
    scheduledTimeRaw: "2026-08-16T17:30:00.000Z", // 00:30+07 on 17/08
  };
  const boundaryDay = resolveAssignmentLocalDayKey(boundary);
  // Local day depends on runtime timezone; assert consistency with localDayKey.
  assert.equal(boundaryDay, localDayKey(new Date(boundary.scheduledTimeRaw)));
  const boundaryOnLocalDay = buildRefereeHomeSummary([boundary], {
    fromDate: boundaryDay,
    toDate: boundaryDay,
    now: today,
  });
  assert.equal(boundaryOnLocalDay.totalInRange, 1);
});

test("remediation09: scoreboard presentation follows physical ends", async () => {
  const { deriveCourtPresentation } = await import(
    "../src/features/referee-production-ui/projection/deriveCourtPresentation.js"
  );
  const before = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Team A", teamId: "ta" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Team B", teamId: "tb" },
      ],
    },
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SIDE_OUT,
    currentScore: {
      points: { SIDE_A: 11, SIDE_B: 5 },
      serve: { servingSide: "SIDE_A", serverPlayerId: "p1", serverNumber: 2 },
    },
    courtState: {
      courtOrientation: "STANDARD",
      serverPlayerId: "p1",
    },
  });
  const after = projectCanonicalCourtView({
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Team A", teamId: "ta" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Team B", teamId: "tb" },
      ],
    },
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SIDE_OUT,
    currentScore: {
      points: { SIDE_A: 11, SIDE_B: 5 },
      serve: { servingSide: "SIDE_A", serverPlayerId: "p1", serverNumber: 2 },
    },
    courtState: {
      courtOrientation: "SWAPPED",
      serverPlayerId: "p1",
    },
  });

  const beforePres = deriveCourtPresentation({
    courtProjection: before,
    currentScore: { points: { SIDE_A: 11, SIDE_B: 5 } },
  });
  assert.equal(beforePres.leftTeam, "Team A");
  assert.equal(beforePres.rightTeam, "Team B");
  assert.equal(beforePres.leftScore, 11);
  assert.equal(beforePres.rightScore, 5);
  assert.equal(beforePres.leftScoringSide, "SIDE_A");
  assert.equal(beforePres.rightScoringSide, "SIDE_B");

  const afterPres = deriveCourtPresentation({
    courtProjection: after,
    currentScore: { points: { SIDE_A: 11, SIDE_B: 5 } },
  });
  assert.equal(after.courtOrientation, "SWAPPED");
  assert.equal(afterPres.leftTeam, "Team B");
  assert.equal(afterPres.rightTeam, "Team A");
  assert.equal(afterPres.leftScore, 5);
  assert.equal(afterPres.rightScore, 11);
  assert.equal(afterPres.leftScoringSide, "SIDE_B");
  assert.equal(afterPres.rightScoringSide, "SIDE_A");
  assert.equal(afterPres.leftTeamId, "tb");
  assert.equal(afterPres.rightTeamId, "ta");
  assert.deepEqual([...afterPres.leftParticipants], ["Chi", "Dũng"]);
  assert.deepEqual([...afterPres.rightParticipants], ["An", "Bình"]);
  // Score ownership unchanged in canonical points; server identity stays on Team A player.
  assert.equal(after.serving.serverPlayerId, "p1");
  assert.equal(after.sides.right.activePlayers[0].playerId, "p1");
  assert.equal(after.sides.left.scoringSide, "SIDE_B");
  assert.equal(after.sides.right.scoringSide, "SIDE_A");
});

test("match rules panel + game history derive from canonical policy/state", () => {
  const view = buildRefereeMatchView({
    matchId: "m1",
    competitionMode: "DAILY_PLAY",
    adapterSelected: "daily-play-referee-adapter-b",
    competitionContext: { competitionName: "Club Night", competitionId: "c1" },
    matchContext: { courtLabel: "Sân 3", stage: "Tứ kết", round: 1 },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"], displayName: "Đội 4" },
        { sideKey: "B", participantIds: ["p3", "p4"], displayName: "Đội 3" },
      ],
    },
    participantNames: { p1: "An", p2: "Bình", p3: "Chi", p4: "Dũng" },
    scoringRules: SIDE_OUT,
    lifecyclePolicy: { changeEndPolicyLabel: "Sau mỗi game â¢ G3 tại 6" },
    capabilities: { changeEnds: true, switchPositions: true },
    assignedMatch: {
      lifecycleState: "IN_PROGRESS",
      scoreProjection: {
        points: { SIDE_A: 6, SIDE_B: 4 },
        serve: { servingSide: "SIDE_A", serverNumber: 1, serverPlayerId: "p1" },
        gamesWonInCurrentSet: { SIDE_A: 1, SIDE_B: 0 },
        currentGameIndex: 1,
        completedGames: [{ gameIndex: 0, SIDE_A: 11, SIDE_B: 7, winnerSide: "SIDE_A" }],
        format: SIDE_OUT,
      },
    },
  });
  assert.equal(view.rulesPanel.scoringMethod, "SIDE-OUT");
  assert.equal(view.rulesPanel.targetScore, 11);
  assert.equal(view.rulesPanel.winBy, 2);
  assert.equal(view.rulesPanel.capLabel, "Không");
  assert.match(view.rulesPanel.changeEndAt, /Sau mỗi game/);
  assert.equal(view.rulesPanel.bestOf, 3);
  assert.match(view.contextRow, /Sân 3/);
  assert.equal(view.participantDisplay.sideA.playerNames.includes("An"), true);
  assert.equal(view.gameSummary.previousGames.length, 1);
  assert.equal(view.gameSummary.previousGames[0].sideA, 11);
  assert.equal(view.canChangeEnds, true);
  assert.equal(view.canSwitchPositions, true);
});

test("mode-state resolver enriches CORE-13-shaped Team assignment row", async () => {
  const { resolveCanonicalRefereeModeState, detectCompetitionModeHint } =
    await import(
      "../src/features/referee-production-ui/application/resolveCanonicalRefereeModeState.js"
    );
  const assignment = {
    tenantId: "venue-staging-a",
    competitionId: "b5cd6975-3a7f-4c11-8006-2ac14e7bef5b",
    matchId: "matchup-7t58gnjq",
    matchupId: "7a474b76-adeb-4e1e-92cc-17195d11c6e4",
    externalMatchupId: "matchup-7t58gnjq",
    refereeUserId: ACTOR.actorId,
  };
  assert.equal(detectCompetitionModeHint(assignment, null), "TEAM");

  const tables = {
    team_tournaments: [
      {
        id: "2feb193a-0bd4-4852-9091-904d4ca40c29",
        tenant_id: "venue-staging-a",
        club_id: "club-1",
        tournament_id: "b5cd6975-3a7f-4c11-8006-2ac14e7bef5b",
        name: "Giải đồng đội 13/8/2026",
        status: "draft",
        settings: {},
      },
    ],
    team_tournament_matchups: [
      {
        id: "7a474b76-adeb-4e1e-92cc-17195d11c6e4",
        team_tournament_id: "2feb193a-0bd4-4852-9091-904d4ca40c29",
        external_matchup_id: "matchup-7t58gnjq",
        team_a_id: "team-biqspqe9",
        team_b_id: "team-sg9nd5xj",
        court_label: "Sân 1",
        court_id: null,
        scheduled_at: "2026-08-15T17:02:00.000Z",
        status: "completed",
        schedule_meta: { stage: "KO", round: 1 },
      },
    ],
    team_tournament_sub_matches: [],
    team_tournament_teams: [
      {
        team_tournament_id: "2feb193a-0bd4-4852-9091-904d4ca40c29",
        external_team_id: "team-biqspqe9",
        name: "Đội 4",
      },
      {
        team_tournament_id: "2feb193a-0bd4-4852-9091-904d4ca40c29",
        external_team_id: "team-sg9nd5xj",
        name: "Đội 2",
      },
    ],
    team_tournament_disciplines: [
      {
        team_tournament_id: "2feb193a-0bd4-4852-9091-904d4ca40c29",
        external_discipline_id: "mlp-md",
        name: "ÄÃ´i nam",
        scoring_format: {
          scoringSystem: "rally",
          targetScore: 21,
          winBy: 2,
        },
      },
    ],
    team_tournament_lineup_entries: [],
    canonical_tournaments: [],
  };

  function mockFrom(table) {
    const rows = tables[table] || [];
    const state = { filters: [], ord: null, lim: null };
    const filterRows = () =>
      rows.filter((row) =>
        state.filters.every(([col, val]) => String(row[col]) === String(val))
      );
    const api = {
      select() {
        return api;
      },
      eq(col, val) {
        state.filters.push([col, val]);
        return api;
      },
      or() {
        return api;
      },
      in() {
        return api;
      },
      order() {
        return api;
      },
      limit(n) {
        state.lim = n;
        return api;
      },
      maybeSingle: async () => ({ data: filterRows()[0] || null, error: null }),
      then(resolve, reject) {
        try {
          let data = filterRows();
          if (state.lim != null) data = data.slice(0, state.lim);
          resolve({ data, error: null });
        } catch (err) {
          reject(err);
        }
      },
    };
    return api;
  }

  const modeState = await resolveCanonicalRefereeModeState(
    { from: mockFrom },
    assignment
  );
  assert.ok(modeState);
  assert.equal(modeState.competitionMode, "TEAM");
  assert.equal(modeState.competitionName, "Giải đồng đội 13/8/2026");
  assert.equal(modeState.participantNames["team-biqspqe9"], "Đội 4");
  assert.equal(modeState.matchups["matchup-7t58gnjq"].courtLabel, "Sân 1");
});

test("change-end policy label only when canonical policy supplies it", () => {
  const view = buildRefereeMatchView({
    matchId: "m1",
    competitionMode: "DAILY_PLAY",
    adapterSelected: "daily-play-referee-adapter-b",
    scoringRules: SIDE_OUT,
    lifecyclePolicy: { changeEndPolicyLabel: "Sau mỗi game â¢ G3 tại 6" },
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
  });
  assert.equal(view.gameSummary.changeEndPolicy, "Sau mỗi game â¢ G3 tại 6");
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
  assert.equal(enter.actionLabel, "VÀO TRẬN");
  const cont = buildRefereeAssignmentCard({
    assignment: { matchId: "m", competitionId: "c", status: "READY" },
    competitionMode: "DAILY_PLAY",
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
    participants: { sides: [] },
  });
  assert.equal(cont.actionLabel, "TIẾP TỤC");
  const done = buildRefereeAssignmentCard({
    assignment: { matchId: "m", competitionId: "c", status: "READY" },
    competitionMode: "DAILY_PLAY",
    assignedMatch: { lifecycleState: "COMPLETED", validationStatus: "ACCEPTED" },
    participants: { sides: [] },
  });
  assert.equal(done.actionLabel, "XEM KẾT QUẢ");
});

test("remediation05: score ACK never regresses IN_PROGRESS â READY (adapter status ignored)", () => {
  const scoreProjection = {
    points: { SIDE_A: 8, SIDE_B: 3 },
    serve: { servingSide: "SIDE_A", serverNumber: 1, serverPlayerId: "p1" },
    format: SIDE_OUT,
  };
  const view = buildRefereeMatchView({
    matchId: "m-regress",
    competitionMode: "DAILY_PLAY",
    scoringRules: SIDE_OUT,
    matchContext: { status: "READY", courtLabel: "Sân 1" },
    live: {
      status: "in_progress",
      statePayload: {
        canonical: {
          match: { status: "IN_PROGRESS" },
          scoreSession: { points: { SIDE_A: 8, SIDE_B: 3 } },
        },
      },
    },
    assignedMatch: {
      lifecycleState: null,
      scoreProjection,
      match: { status: null },
    },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p1", "p2"] },
        { sideKey: "B", participantIds: ["p3", "p4"] },
      ],
    },
  });
  assert.equal(view.matchStatus, "IN_PROGRESS");
  assert.equal(view.canStart, false);
  assert.equal(view.canScore, true);
  assert.equal(view.currentScore.points.SIDE_A, 8);
  assert.equal(view.currentScore.points.SIDE_B, 3);
});

test("remediation05: scoreProjection alone blocks READY/canStart even if adapter says READY", () => {
  const view = buildRefereeMatchView({
    matchId: "m-score-only",
    competitionMode: "INTERNAL",
    scoringRules: SIDE_OUT,
    matchContext: { status: "READY" },
    assignedMatch: {
      lifecycleState: "READY",
      scoreProjection: {
        points: { SIDE_A: 1, SIDE_B: 0 },
        serve: { servingSide: "SIDE_A", serverNumber: 2, serverPlayerId: "p1" },
        format: SIDE_OUT,
      },
    },
  });
  assert.equal(view.matchStatus, "IN_PROGRESS");
  assert.equal(view.canStart, false);
});

for (const mode of [
  COMPETITION_REFEREE_MODE.DAILY_PLAY,
  COMPETITION_REFEREE_MODE.INTERNAL,
  COMPETITION_REFEREE_MODE.OFFICIAL,
  COMPETITION_REFEREE_MODE.TEAM,
]) {
  test(`remediation05: ${mode} startâsubmitPointâACK stays IN_PROGRESS; F5 reload same`, async () => {
    const { runtime } = createUiRuntime();
    const fixture = modeFixture(mode);
    await seedAssigned(runtime, fixture);
    const client = createClient(runtime, [fixture]);
    const started = await startSideOutWithLineup(client, fixture, {
      playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
      serverPlayerId: "p1",
      serverNumber: 2,
      servingSide: "SIDE_A",
    });
    assert.equal(started.view.matchStatus, "IN_PROGRESS");
    assert.equal(started.view.canStart, false);
    assert.equal(started.view.canScore, true);

    const scored = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: started.view.expectedVersion,
      idempotencyKey: `r05-score-${mode}`,
    });
    assert.equal(scored.ok, true);
    assert.equal(scored.view.matchStatus, "IN_PROGRESS");
    assert.equal(scored.view.canStart, false);
    assert.equal(scored.view.canScore, true);
    assert.notEqual(scored.view.matchStatus, "READY");
    assert.notEqual(scored.view.matchStatus, "READY_TO_START");
    assert.ok(Number(scored.view.currentScore.points.SIDE_A) >= 1);

    const reloaded = await client.getMatchView({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
    });
    assert.equal(reloaded.ok, true);
    assert.equal(reloaded.view.matchStatus, "IN_PROGRESS");
    assert.equal(reloaded.view.canStart, false);
    assert.equal(reloaded.view.canScore, true);
    assert.equal(
      reloaded.view.currentScore.points.SIDE_A,
      scored.view.currentScore.points.SIDE_A
    );
  });
}


test("remediation06: change-end policy from sideSwitchAt (not hardcoded 11)", () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 6,
  });
  const view = buildRefereeMatchView({
    matchId: "m-ce-policy",
    competitionMode: "DAILY_PLAY",
    scoringRules: format,
    assignedMatch: { lifecycleState: "IN_PROGRESS" },
  });
  assert.equal(view.rulesPanel.changeEndAt, "6");
  assert.equal(
    view.rulesPanel.rows.find((r) => r.key === "changeEnd")?.label,
    "Điểm đổi sân"
  );
  assert.equal(view.courtProjection.sideChangeRequired, false);
});

test("remediation06: threshold sticky until ACK; confirm swaps ends; F5 keeps swap", async () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 3,
  });
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  fixture.modeState = dailyModeState(fixture.competitionId, fixture.matchId, {
    scoringRules: format,
  });
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  assert.equal(started.view.courtProjection.sideChangeRequired, false);

  let version = started.view.expectedVersion;
  let scored = started;
  for (let i = 0; i < 3; i += 1) {
    scored = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: version,
      idempotencyKey: `ce-p${i + 1}`,
    });
    version = scored.view.expectedVersion;
  }
  assert.equal(scored.view.currentScore.points.SIDE_A, 3);
  assert.equal(scored.view.courtProjection.sideChangeRequired, true);
  assert.equal(scored.view.canScore, false);
  assert.equal(scored.view.canPointSideA, false);

  await assert.rejects(
    () =>
      client.submitPoint({
        tenantId: "tenant-1",
        matchId: fixture.matchId,
        actor: ACTOR,
        scoringSide: SCORING_SIDE.SIDE_A,
        expectedVersion: version,
        idempotencyKey: "ce-blocked-while-due",
      }),
    /[Cc]hange ends|PRECONDITION|Äá»i sÃ¢n/
  );

  const positionsBefore = {
    a: [
      ...(scored.view.courtProjection.sides?.left?.scoringSide === "SIDE_A"
        ? scored.view.courtProjection.sides.left.activePlayers
        : scored.view.courtProjection.sides.right.activePlayers
      ).map((p) => p.playerId),
    ],
    b: [
      ...(scored.view.courtProjection.sides?.left?.scoringSide === "SIDE_B"
        ? scored.view.courtProjection.sides.left.activePlayers
        : scored.view.courtProjection.sides.right.activePlayers
      ).map((p) => p.playerId),
    ],
  };
  const serverBefore = scored.view.courtProjection.serving?.serverPlayerId;

  const confirmed = await client.confirmChangeEnds({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: scored.view.expectedVersion,
    idempotencyKey: "ce-confirm-1",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.view.courtProjection.sideChangeRequired, false);
  assert.equal(confirmed.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(confirmed.view.currentScore.points.SIDE_A, 3);
  assert.equal(confirmed.view.currentScore.points.SIDE_B, 0);
  assert.equal(confirmed.view.matchStatus, "IN_PROGRESS");
  assert.equal(confirmed.view.courtProjection.serving?.serverPlayerId, serverBefore);
  assert.equal(confirmed.view.canScore, true);
  assert.equal(confirmed.view.courtPresentation.leftScoringSide, "SIDE_B");
  assert.equal(confirmed.view.courtPresentation.rightScoringSide, "SIDE_A");
  assert.equal(confirmed.view.courtPresentation.leftScore, 0);
  assert.equal(confirmed.view.courtPresentation.rightScore, 3);
  assert.equal(
    confirmed.view.courtPresentation.courtOrientation,
    confirmed.view.courtProjection.courtOrientation
  );

  const positionsAfter = {
    a: [
      ...(confirmed.view.courtProjection.sides?.left?.scoringSide === "SIDE_A"
        ? confirmed.view.courtProjection.sides.left.activePlayers
        : confirmed.view.courtProjection.sides.right.activePlayers
      ).map((p) => p.playerId),
    ],
    b: [
      ...(confirmed.view.courtProjection.sides?.left?.scoringSide === "SIDE_B"
        ? confirmed.view.courtProjection.sides.left.activePlayers
        : confirmed.view.courtProjection.sides.right.activePlayers
      ).map((p) => p.playerId),
    ],
  };
  assert.deepEqual(positionsAfter.a, positionsBefore.a);
  assert.deepEqual(positionsAfter.b, positionsBefore.b);

  const reloaded = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(reloaded.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(reloaded.view.courtProjection.sideChangeRequired, false);
  assert.equal(reloaded.view.courtProjection.serving?.serverPlayerId, serverBefore);
});

test("remediation06: stale expectedVersion does not swap ends", async () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 2,
  });
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  fixture.modeState = dailyModeState(fixture.competitionId, fixture.matchId, {
    scoringRules: format,
  });
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  let version = started.view.expectedVersion;
  let view = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: version,
    idempotencyKey: "ce-stale-p1",
  });
  version = view.view.expectedVersion;
  view = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: version,
    idempotencyKey: "ce-stale-p2",
  });
  assert.equal(view.view.currentScore.points.SIDE_A, 2);
  assert.equal(view.view.courtProjection.sideChangeRequired, true);
  const staleVersion = Number(view.view.expectedVersion) - 1;
  await assert.rejects(
    () =>
      client.confirmChangeEnds({
        tenantId: "tenant-1",
        matchId: fixture.matchId,
        actor: ACTOR,
        expectedVersion: staleVersion,
        idempotencyKey: "ce-stale-confirm",
      }),
    /stale|expectedVersion|STALE/i
  );
  const reloaded = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(reloaded.view.courtProjection.courtOrientation, "STANDARD");
  assert.equal(reloaded.view.courtProjection.sideChangeRequired, true);
});

test("remediation07: Owner exact 10:5 â 11:5 triggers due on same ACK", async () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 11,
  });
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  fixture.modeState = dailyModeState(fixture.competitionId, fixture.matchId, {
    scoringRules: format,
  });
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p1",
    serverNumber: 1,
    servingSide: "SIDE_A",
  });
  let version = started.view.expectedVersion;
  for (let i = 0; i < 10; i += 1) {
    const row = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: version,
      idempotencyKey: `r07-a-${i}`,
    });
    version = row.view.expectedVersion;
    assert.equal(row.view.courtProjection.sideChangeRequired, false);
  }
  for (let i = 0; i < 5; i += 1) {
    const row = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_B,
      expectedVersion: version,
      idempotencyKey: `r07-b-${i}`,
    });
    version = row.view.expectedVersion;
    assert.equal(row.view.courtProjection.sideChangeRequired, false);
  }

  const atThreshold = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_A,
    expectedVersion: version,
    idempotencyKey: "r07-10-to-11",
  });
  assert.equal(atThreshold.view.currentScore.points.SIDE_A, 11);
  assert.equal(atThreshold.view.currentScore.points.SIDE_B, 5);
  assert.equal(atThreshold.view.courtProjection.sideChangeRequired, true);
  assert.equal(atThreshold.view.canScore, false);
  assert.equal(atThreshold.view.canPointSideA, false);
  assert.equal(atThreshold.view.canPointSideB, false);

  const serverBefore = atThreshold.view.courtProjection.serving?.serverPlayerId;
  const servingSideBefore = atThreshold.view.courtProjection.serving?.servingSide;
  const leftBefore = atThreshold.view.courtProjection.sides.left.scoringSide;
  const slotABefore = (
    atThreshold.view.courtProjection.sides.left.scoringSide === "SIDE_A"
      ? atThreshold.view.courtProjection.sides.left.activePlayers
      : atThreshold.view.courtProjection.sides.right.activePlayers
  ).map((p) => p.playerId);
  const slotBBefore = (
    atThreshold.view.courtProjection.sides.left.scoringSide === "SIDE_B"
      ? atThreshold.view.courtProjection.sides.left.activePlayers
      : atThreshold.view.courtProjection.sides.right.activePlayers
  ).map((p) => p.playerId);

  const confirmed = await client.confirmChangeEnds({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    expectedVersion: atThreshold.view.expectedVersion,
    idempotencyKey: "r07-confirm",
  });
  assert.equal(confirmed.view.currentScore.points.SIDE_A, 11);
  assert.equal(confirmed.view.currentScore.points.SIDE_B, 5);
  assert.equal(confirmed.view.matchStatus, "IN_PROGRESS");
  assert.equal(confirmed.view.courtProjection.sideChangeRequired, false);
  assert.equal(confirmed.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(confirmed.view.courtProjection.serving?.serverPlayerId, serverBefore);
  assert.equal(confirmed.view.courtProjection.serving?.servingSide, servingSideBefore);
  assert.notEqual(confirmed.view.courtProjection.sides.left.scoringSide, leftBefore);
  const slotAAfter = (
    confirmed.view.courtProjection.sides.left.scoringSide === "SIDE_A"
      ? confirmed.view.courtProjection.sides.left.activePlayers
      : confirmed.view.courtProjection.sides.right.activePlayers
  ).map((p) => p.playerId);
  const slotBAfter = (
    confirmed.view.courtProjection.sides.left.scoringSide === "SIDE_B"
      ? confirmed.view.courtProjection.sides.left.activePlayers
      : confirmed.view.courtProjection.sides.right.activePlayers
  ).map((p) => p.playerId);
  assert.deepEqual(slotAAfter, slotABefore);
  assert.deepEqual(slotBAfter, slotBBefore);
  assert.equal(confirmed.view.canScore, true);

  const f5 = await client.getMatchView({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
  });
  assert.equal(f5.view.courtProjection.courtOrientation, "SWAPPED");
  assert.equal(f5.view.courtProjection.sideChangeRequired, false);
  assert.equal(f5.view.currentScore.points.SIDE_A, 11);
  assert.equal(f5.view.courtProjection.serving?.serverPlayerId, serverBefore);
});

test("remediation07: Owner opposite 5:10 â 5:11 triggers due on same ACK", async () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.RALLY,
    pointsToWin: 21,
    winBy: 2,
    bestOfGames: 1,
    sideSwitchAt: 11,
  });
  const { runtime } = createUiRuntime();
  const fixture = modeFixture(COMPETITION_REFEREE_MODE.DAILY_PLAY);
  fixture.modeState = dailyModeState(fixture.competitionId, fixture.matchId, {
    scoringRules: format,
  });
  await seedAssigned(runtime, fixture);
  const client = createClient(runtime, [fixture]);
  const started = await startSideOutWithLineup(client, fixture, {
    playerPositions: { sideA: ["p1", "p2"], sideB: ["p3", "p4"] },
    serverPlayerId: "p3",
    serverNumber: 1,
    servingSide: "SIDE_B",
  });
  let version = started.view.expectedVersion;
  for (let i = 0; i < 5; i += 1) {
    const row = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_A,
      expectedVersion: version,
      idempotencyKey: `r07b-a-${i}`,
    });
    version = row.view.expectedVersion;
  }
  for (let i = 0; i < 10; i += 1) {
    const row = await client.submitPoint({
      tenantId: "tenant-1",
      matchId: fixture.matchId,
      actor: ACTOR,
      scoringSide: SCORING_SIDE.SIDE_B,
      expectedVersion: version,
      idempotencyKey: `r07b-b-${i}`,
    });
    version = row.view.expectedVersion;
    assert.equal(row.view.courtProjection.sideChangeRequired, false);
  }
  const atThreshold = await client.submitPoint({
    tenantId: "tenant-1",
    matchId: fixture.matchId,
    actor: ACTOR,
    scoringSide: SCORING_SIDE.SIDE_B,
    expectedVersion: version,
    idempotencyKey: "r07b-10-to-11",
  });
  assert.equal(atThreshold.view.currentScore.points.SIDE_A, 5);
  assert.equal(atThreshold.view.currentScore.points.SIDE_B, 11);
  assert.equal(atThreshold.view.courtProjection.sideChangeRequired, true);
  assert.equal(atThreshold.view.canScore, false);
});

test("remediation07: over-threshold unacked sticky; acked not retriggered", () => {
  const unacked = resolveSideChangeRequiredAfterScoring({
    priorCourt: { sideChangeRequired: false, sideChangeAcknowledgedAtThreshold: null },
    priorPoints: { SIDE_A: 11, SIDE_B: 5 },
    nextPoints: { SIDE_A: 12, SIDE_B: 5 },
    sideSwitchAt: 11,
    domainHints: [],
  });
  assert.equal(unacked.sideChangeRequired, true);

  const restoredUnacked = resolveSideChangeRequiredAfterScoring({
    priorCourt: { sideChangeRequired: false, sideChangeAcknowledgedAtThreshold: null },
    priorPoints: { SIDE_A: 12, SIDE_B: 5 },
    nextPoints: { SIDE_A: 12, SIDE_B: 5 },
    sideSwitchAt: 11,
    domainHints: [],
  });
  assert.equal(restoredUnacked.sideChangeRequired, true);

  const acked = resolveSideChangeRequiredAfterScoring({
    priorCourt: {
      sideChangeRequired: false,
      sideChangeAcknowledgedAtThreshold: 11,
      sideChangeThreshold: 11,
    },
    priorPoints: { SIDE_A: 11, SIDE_B: 5 },
    nextPoints: { SIDE_A: 12, SIDE_B: 5 },
    sideSwitchAt: 11,
    domainHints: [],
  });
  assert.equal(acked.sideChangeRequired, false);

  const crossing = resolveSideChangeRequiredAfterScoring({
    priorCourt: {},
    priorPoints: { SIDE_A: 10, SIDE_B: 5 },
    nextPoints: { SIDE_A: 11, SIDE_B: 5 },
    sideSwitchAt: 11,
    domainHints: ["ENDS_SWITCH_MILESTONE"],
  });
  assert.equal(crossing.sideChangeRequired, true);
});
