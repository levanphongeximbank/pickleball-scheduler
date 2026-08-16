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
  assert.doesNotMatch(marker, /VĐV #1|#2 identity|playerNumberLabel/);
  assert.match(marker, /data-permanent-number="false"/);
  assert.doesNotMatch(marker, />#1<|>#2</);
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
    startMatch: async () => ({ ok: true }),
    acknowledgeAssignment: async () => ({ ok: true }),
    openAssignedMatch: async () => ({ ok: true }),
    startScoreSession: async () => ({ ok: true }),
    suspendMatch: async () => ({ ok: true }),
    resumeMatch: async () => ({ ok: true }),
    confirmChangeEnds: async () => ({ ok: true }),
    switchPositions: async () => ({ ok: true }),
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
  assert.equal(calls[0][0], "getMatchView");
  assert.equal(calls[1][0], "submitPoint");
  assert.equal(calls[1][1].expectedVersion, 3);
  assert.equal(calls[1][1].idempotencyKey, "idem-1");
  assert.doesNotMatch(
    read("src/features/referee-production-ui/application/createBrowserRefereeApplicationClient.js"),
    /Deep-link match view requires canonical Adapter B runtime/
  );
});

test("owner visual acceptance — CORE-13 row enriched without raw UUID/MODE/ASSIGNED", async () => {
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
  assert.match(home, /home-status-filters/);
  assert.match(match, /Điều hành trận/);
  assert.match(match, /match-rules-panel/);
  assert.match(match, /Sắp xếp đội hình/);
  assert.match(match, /ĐỔI SÂN \/ ĐỔI ĐẦU SÂN/);
  assert.match(match, /ĐÃ ĐẾN ĐIỂM ĐỔI SÂN/);
  assert.match(match, /Đổi sân tại/);
  assert.match(match, /rp-score-team-name/);
  assert.match(match, /pointLabel\(/);
  assert.match(match, /Đang ghi…/);
  assert.match(match, /current-game-score/);
  assert.match(match, /games-won/);
  assert.match(match, /serving-status-strip/);
  assert.match(match, /serve-version/);
  assert.doesNotMatch(match, />Điểm A</);
  assert.doesNotMatch(match, /A: \{db\.sideAActivePlayer/);
  assert.match(card, /assignment-meta-row/);
  assert.doesNotMatch(card, /match-status-badge/);
  assert.match(css, /max-height:\s*210px/);
  assert.match(css, /rp-court-kitchen/);
  assert.match(css, /rp-court-baseline/);
});

test("home daily summary + status filters", async () => {
  const {
    buildRefereeHomeSummary,
    filterAssignmentsByHomeStatus,
    normalizeRefereeHomeCard,
    HOME_STATUS_FILTER,
  } = await import(
    "../src/features/referee-production-ui/projection/buildRefereeHomeSummary.js"
  );
  const assignments = [
    { matchId: "1", matchStatus: "READY_TO_START", action: "ENTER" },
    { matchId: "2", matchStatus: "IN_PROGRESS", action: "CONTINUE" },
    { matchId: "3", matchStatus: "COMPLETED", action: "VIEW_RESULT", acceptedOfficialResult: true },
  ];
  const summary = buildRefereeHomeSummary(assignments);
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
  });
  assert.equal(stale.homeStatusBucket, "LIVE");
  assert.equal(stale.homeStatusLabel, "Đang thi đấu");
  const staleSummary = buildRefereeHomeSummary([stale]);
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
    lifecyclePolicy: { changeEndPolicyLabel: "Sau mỗi game • G3 tại 6" },
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
        name: "Đôi nam",
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
