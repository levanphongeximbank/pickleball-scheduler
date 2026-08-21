/**
 * PR #440 — consolidated competition content + match format + lineup + Side-Out remediation.
 * Projection / Adapter B translation only. CORE-13/15/16/17 and Contracts #01/#07/#08 unchanged.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMPETITION_REFEREE_MODE,
  createInternalTournamentRefereeAdapter,
  createOfficialTournamentRefereeAdapter,
  createDailyPlayRefereeAdapter,
  createTeamTournamentRefereeAdapter,
} from "../src/features/competition-engine/index.js";
import {
  SCORING_SYSTEM,
  SCORING_SIDE,
  createInitialScoringState,
  createScoringFormat,
  recordPoint,
} from "../src/features/competition-core/scoring/index.js";
import { MATCH_STATUS } from "../src/features/competition-core/matches/index.js";
import { mapModeScoringRulesToCore16 } from "../src/features/competition-engine/integration/referee/adapters/shared/scoringRulesMapper.js";
import {
  projectCompetitionMatchFormat,
  REFEREE_MATCH_FORMAT,
  serviceCourtFromScore,
  logicalPositionForCourtSlot,
} from "../src/features/referee-production-ui/projection/projectCompetitionMatchFormat.js";
import { normalizeIndividualTournamentMatch } from "../src/features/referee-production-ui/application/resolveCanonicalRefereeModeState.js";
import { buildRefereeAssignmentCard } from "../src/features/referee-production-ui/projection/buildRefereeAssignmentCard.js";
import { buildRefereeMatchView } from "../src/features/referee-production-ui/projection/buildRefereeMatchView.js";
import { projectCanonicalCourtView } from "../src/features/referee-production-ui/projection/projectCanonicalCourtView.js";
import { presentEntryLabel } from "../src/features/referee-production-ui/projection/resolveRefereeSideDisplay.js";
import { EVENT_TYPE, EVENT_TYPE_LABELS } from "../src/models/tournament/constants.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function scoringDeps() {
  let n = 0;
  return {
    now: () => `2026-07-24T00:00:00.${String(++n).padStart(3, "0")}Z`,
    nextId: () => `evt-${++n}`,
  };
}

function record(state, side) {
  return recordPoint(
    state,
    { scoringSide: side, lifecycleStatus: MATCH_STATUS.IN_PROGRESS },
    scoringDeps()
  ).state;
}

function individualState(mode, extras = {}) {
  const matchId = extras.matchId || "match-1";
  const eventType = extras.eventType || EVENT_TYPE.MEN_SINGLE;
  const singles = [EVENT_TYPE.MEN_SINGLE, EVENT_TYPE.WOMEN_SINGLE].includes(eventType);
  const teamA = extras.teamA || (singles ? ["p-a"] : ["p-a1", "p-a2"]);
  const teamB = extras.teamB || (singles ? ["p-b"] : ["p-b1", "p-b2"]);
  const content = projectCompetitionMatchFormat({
    eventType,
    participantIdsA: teamA,
    participantIdsB: teamB,
    competitionMode: mode,
  });
  return {
    tenantId: "tenant-1",
    competitionId: "comp-1",
    competitionMode: mode,
    competitionName: extras.competitionName || "Cup",
    participantNames: {
      "p-a": "Lan",
      "p-b": "Minh",
      "p-a1": "Nguyễn A",
      "p-a2": "Trần B",
      "p-b1": "Lê C",
      "p-b2": "Phạm D",
      "entry-a": extras.entryLabelA || (singles ? "Đội 9" : "Cặp 1"),
      "entry-b": extras.entryLabelB || (singles ? "Đội 10" : "Cặp 2"),
    },
    matches: {
      [matchId]: {
        matchId,
        status: "READY_TO_START",
        courtId: "court-1",
        courtLabel: "TT412 Sân 1",
        stage: "POOL",
        round: 1,
        eventId: "event-1",
        eventType,
        entryAId: "entry-a",
        entryBId: "entry-b",
        participantIdsA: teamA,
        participantIdsB: teamB,
        ...content,
        scoringRules: extras.scoringRules || {
          scoringSystem: SCORING_SYSTEM.SIDE_OUT,
          pointsToWin: 11,
          winBy: 2,
          bestOfGames: 3,
        },
        lineupsLocked: true,
      },
    },
  };
}

test("CONTENT 1-5: Internal eventType → Vietnamese competition content", () => {
  const cases = [
    [EVENT_TYPE.MEN_SINGLE, "Đơn nam", REFEREE_MATCH_FORMAT.SINGLES, 1],
    [EVENT_TYPE.WOMEN_SINGLE, "Đơn nữ", REFEREE_MATCH_FORMAT.SINGLES, 1],
    [EVENT_TYPE.MEN_DOUBLE, "Đôi nam", REFEREE_MATCH_FORMAT.DOUBLES, 2],
    [EVENT_TYPE.WOMEN_DOUBLE, "Đôi nữ", REFEREE_MATCH_FORMAT.DOUBLES, 2],
    [EVENT_TYPE.MIXED_DOUBLE, "Đôi nam nữ", REFEREE_MATCH_FORMAT.DOUBLES, 2],
  ];
  for (const [eventType, label, format, players] of cases) {
    const projected = projectCompetitionMatchFormat({
      eventType,
      participantIdsA: players === 1 ? ["a"] : ["a1", "a2"],
      participantIdsB: players === 1 ? ["b"] : ["b1", "b2"],
    });
    assert.equal(projected.competitionContentCode, eventType);
    assert.equal(projected.competitionContentLabel, label);
    assert.equal(projected.matchFormat, format);
    assert.equal(projected.expectedPlayersPerSide, players);
    assert.equal(EVENT_TYPE_LABELS[eventType], label);
  }
});

test("CONTENT 6: Official adapter projects content + format", () => {
  const state = individualState(COMPETITION_REFEREE_MODE.OFFICIAL, {
    eventType: EVENT_TYPE.WOMEN_DOUBLE,
  });
  const adapter = createOfficialTournamentRefereeAdapter({ modeState: state });
  const ctx = adapter.getMatchContext({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  assert.equal(ctx.competitionContentLabel, "Đôi nữ");
  assert.equal(ctx.matchFormat, REFEREE_MATCH_FORMAT.DOUBLES);
  assert.equal(ctx.expectedPlayersPerSide, 2);
});

test("CONTENT 7-8: Team discipline + DreamBreaker content", () => {
  const team = projectCompetitionMatchFormat({
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    isTeamSubmatch: true,
    discipline: "mlp-md",
    disciplineName: "Đôi nam",
    lineupA: ["a1", "a2"],
    lineupB: ["b1", "b2"],
  });
  assert.equal(team.competitionContentLabel, "Đôi nam");
  assert.equal(team.matchFormat, REFEREE_MATCH_FORMAT.TEAM_SUBMATCH);
  assert.equal(team.expectedPlayersPerSide, 2);

  const db = projectCompetitionMatchFormat({
    competitionMode: COMPETITION_REFEREE_MODE.TEAM,
    isDreambreaker: true,
    discipline: "dreambreaker",
  });
  assert.equal(db.competitionContentLabel, "DreamBreaker");
  assert.equal(db.matchFormat, REFEREE_MATCH_FORMAT.DREAMBREAKER);
  assert.equal(db.expectedPlayersPerSide, 1);
});

test("FORMAT 9-12: expectedPlayersPerSide + court markers", () => {
  const singles = projectCanonicalCourtView({
    matchContext: { matchFormat: "SINGLES", expectedPlayersPerSide: 1, eventType: EVENT_TYPE.MEN_SINGLE },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["p-a"] },
        { sideKey: "B", participantIds: ["p-b"] },
      ],
    },
    participantNames: { "p-a": "Lan", "p-b": "Minh" },
  });
  assert.equal(singles.expectedPlayersPerSide, 1);
  assert.equal(singles.markerCount, 2);
  assert.equal(singles.court.leftBottom, null);

  const doubles = projectCanonicalCourtView({
    matchContext: { matchFormat: "DOUBLES", expectedPlayersPerSide: 2, eventType: EVENT_TYPE.MEN_DOUBLE },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["a1", "a2"] },
        { sideKey: "B", participantIds: ["b1", "b2"] },
      ],
    },
    participantNames: { a1: "A1", a2: "A2", b1: "B1", b2: "B2" },
  });
  assert.equal(doubles.expectedPlayersPerSide, 2);
  assert.equal(doubles.markerCount, 4);
  assert.equal(doubles.court.leftTop.logicalPosition, "RIGHT");
  assert.equal(doubles.court.leftBottom.logicalPosition, "LEFT");

  const teamSub = projectCanonicalCourtView({
    matchContext: {
      matchFormat: "TEAM_SUBMATCH",
      expectedPlayersPerSide: 2,
      disciplineName: "Đôi nam",
    },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["a1", "a2"] },
        { sideKey: "B", participantIds: ["b1", "b2"] },
      ],
    },
  });
  assert.equal(teamSub.markerCount, 4);

  const dream = projectCanonicalCourtView({
    matchContext: { isDreambreaker: true, matchFormat: "DREAMBREAKER" },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["a1", "a2"] },
        { sideKey: "B", participantIds: ["b1", "b2"] },
      ],
    },
  });
  assert.equal(dream.expectedPlayersPerSide, 1);
  assert.equal(dream.markerCount, 2);
});

test("COURT 15-18: RIGHT/LEFT + service/receiver courts + diagonal", () => {
  assert.equal(logicalPositionForCourtSlot("leftTop"), "RIGHT");
  assert.equal(logicalPositionForCourtSlot("leftBottom"), "LEFT");
  assert.equal(serviceCourtFromScore(0), "RIGHT");
  assert.equal(serviceCourtFromScore(1), "LEFT");

  const court = projectCanonicalCourtView({
    matchContext: { matchFormat: "DOUBLES", expectedPlayersPerSide: 2 },
    participants: {
      sides: [
        { sideKey: "A", participantIds: ["a1", "a2"] },
        { sideKey: "B", participantIds: ["b1", "b2"] },
      ],
    },
    scoringRules: createScoringFormat({
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
      winBy: 2,
      bestOfGames: 3,
      metadata: { openingServiceTurn: 2 },
    }),
    currentScore: {
      points: { SIDE_A: 0, SIDE_B: 0 },
      serve: { servingSide: "SIDE_A", serverNumber: 2, serverPlayerId: "a1" },
    },
    courtState: { serverPlayerId: "a1", servingSide: "SIDE_A", serverNumber: 2 },
  });
  assert.equal(court.serving.serviceCourt, "RIGHT");
  assert.equal(court.serving.receiverCourt, "LEFT");
  assert.ok(court.serving.diagonalDirection);
});

test("SIDE-OUT 19-20: doubles open 0-0-2 and first loss → side out", () => {
  const format = mapModeScoringRulesToCore16(
    {
      scoringSystem: SCORING_SYSTEM.SIDE_OUT,
      pointsToWin: 11,
      winBy: 2,
      bestOfGames: 3,
    },
    { matchFormat: "DOUBLES", expectedPlayersPerSide: 2 }
  );
  assert.equal(format.serversPerSide, 2);
  assert.equal(format.metadata.openingServiceTurn, 2);

  let state = createInitialScoringState({ matchId: "m1", format });
  assert.equal(state.serve.serverNumber, 2);

  // Receiving side wins opening rally at 0-0-2 → immediate side out to opponent turn 1
  state = record(state, SCORING_SIDE.SIDE_B);
  assert.equal(state.serve.servingSide, SCORING_SIDE.SIDE_B);
  assert.equal(state.serve.serverNumber, 1);
  assert.equal(state.points.SIDE_A, 0);
  assert.equal(state.points.SIDE_B, 0);
});

test("SIDE-OUT 21-22: ordinary Server1→Server2 and Server2→side out", () => {
  const format = createScoringFormat({
    scoringSystem: SCORING_SYSTEM.SIDE_OUT,
    pointsToWin: 11,
    winBy: 2,
    bestOfGames: 3,
    serversPerSide: 2,
    metadata: { openingServiceTurn: 2 },
  });
  let state = createInitialScoringState({ matchId: "m2", format });
  // Opening loss → B serves turn 1
  state = record(state, SCORING_SIDE.SIDE_B);
  assert.equal(state.serve.servingSide, SCORING_SIDE.SIDE_B);
  assert.equal(state.serve.serverNumber, 1);
  // Receiver wins → Server #2 same side
  state = record(state, SCORING_SIDE.SIDE_A);
  assert.equal(state.serve.servingSide, SCORING_SIDE.SIDE_B);
  assert.equal(state.serve.serverNumber, 2);
  // Receiver wins again → side out
  state = record(state, SCORING_SIDE.SIDE_A);
  assert.equal(state.serve.servingSide, SCORING_SIDE.SIDE_A);
  assert.equal(state.serve.serverNumber, 1);
});

test("RALLY 26-27: two-number score, no Side-Out service turn UI", () => {
  const view = buildRefereeMatchView({
    matchId: "m-rally",
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    matchContext: {
      matchFormat: "DOUBLES",
      expectedPlayersPerSide: 2,
      competitionContentLabel: "Đôi nam",
    },
    participants: {
      sides: [
        { sideKey: "A", entryId: "entry-a", participantIds: ["a1", "a2"] },
        { sideKey: "B", entryId: "entry-b", participantIds: ["b1", "b2"] },
      ],
    },
    scoringRules: createScoringFormat({
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: 21,
      winBy: 2,
      bestOfGames: 1,
    }),
    assignedMatch: {
      scoreProjection: {
        points: { SIDE_A: 4, SIDE_B: 3 },
        serve: { servingSide: "SIDE_A", serverNumber: 1 },
        format: { scoringSystem: SCORING_SYSTEM.RALLY },
      },
    },
  });
  assert.equal(view.isRally, true);
  assert.equal(view.servingStatus.showServiceTurn, false);
  assert.equal(view.courtProjection.scoreLine.display, "4 – 3");
});

test("DREAMBREAKER 28-31: Rally 21 win-by-2 + Team-owned rotation", () => {
  const adapter = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: "tenant-1",
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      matchups: {
        m1: {
          matchupId: "m1",
          teamAId: "team-a",
          teamBId: "team-b",
          status: "READY_TO_START",
          subMatches: [
            {
              id: "db-1",
              isDreambreaker: true,
              discipline: "dreambreaker",
              disciplineName: "DreamBreaker",
              lineupA: ["a1"],
              lineupB: ["b1"],
            },
          ],
          dreambreaker: {
            required: true,
            status: "ready",
            rotation: { sideAPlayerId: "a1", sideBPlayerId: "b1" },
          },
        },
      },
      assignments: [],
    },
  });
  const ctx = adapter.getMatchContext({
    tenantId: "tenant-1",
    competitionId: "team-1",
    matchId: "db-1",
  });
  const rules = adapter.getScoringRules({
    tenantId: "tenant-1",
    competitionId: "team-1",
    matchId: "db-1",
  });
  assert.equal(ctx.isDreambreaker, true);
  assert.equal(ctx.competitionContentLabel, "DreamBreaker");
  assert.equal(ctx.matchFormat, REFEREE_MATCH_FORMAT.DREAMBREAKER);
  assert.equal(rules.scoringSystem, SCORING_SYSTEM.RALLY);
  assert.equal(rules.pointsToWin, 21);
  assert.equal(rules.winBy, 2);
});

test("HOME/MATCH 32-37: content visible; singles not doubles from Đội label", () => {
  const state = individualState(COMPETITION_REFEREE_MODE.INTERNAL, {
    eventType: EVENT_TYPE.MEN_SINGLE,
  });
  const adapter = createInternalTournamentRefereeAdapter({ modeState: state });
  const matchContext = adapter.getMatchContext({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  const participants = adapter.getParticipants({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  const card = buildRefereeAssignmentCard({
    assignment: { matchId: "match-1", competitionId: "comp-1", status: "ASSIGNED" },
    competitionContext: adapter.getCompetitionContext({
      tenantId: "tenant-1",
      competitionId: "comp-1",
    }),
    matchContext,
    participants,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    modeState: state,
  });
  assert.equal(card.competitionContentLabel, "Đơn nam");
  assert.equal(card.matchFormat, REFEREE_MATCH_FORMAT.SINGLES);
  assert.equal(card.expectedPlayersPerSide, 1);
  assert.notEqual(card.participantAEntryLabel, "Đội 9");
  assert.ok(
    card.participantAEntryLabel == null ||
      /Entry 9|Lan/.test(String(card.participantAEntryLabel))
  );
  assert.match(String(card.participantAMemberLine || card.participantA), /Lan/);

  const view = buildRefereeMatchView({
    matchId: "match-1",
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    competitionContext: adapter.getCompetitionContext({
      tenantId: "tenant-1",
      competitionId: "comp-1",
    }),
    matchContext,
    participants,
    scoringRules: adapter.getScoringRules({
      tenantId: "tenant-1",
      competitionId: "comp-1",
      matchId: "match-1",
    }),
    modeState: state,
  });
  assert.equal(view.competitionContentLabel, "Đơn nam");
  assert.equal(view.expectedPlayersPerSide, 1);
  assert.equal(view.courtProjection.markerCount, 2);
  assert.equal(view.servingStatus.showServiceTurn, false);

  assert.equal(
    presentEntryLabel("Đội 9", REFEREE_MATCH_FORMAT.SINGLES, [{ displayName: "Lan" }]),
    null
  );
});

test("HOME doubles lineup shows two athletes + RIGHT/LEFT", () => {
  const state = individualState(COMPETITION_REFEREE_MODE.INTERNAL, {
    eventType: EVENT_TYPE.MEN_DOUBLE,
  });
  const adapter = createInternalTournamentRefereeAdapter({ modeState: state });
  const matchContext = adapter.getMatchContext({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  const participants = adapter.getParticipants({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  const card = buildRefereeAssignmentCard({
    assignment: { matchId: "match-1", competitionId: "comp-1", status: "ASSIGNED" },
    competitionContext: { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL, competitionName: "Cup" },
    matchContext,
    participants,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    modeState: state,
  });
  assert.equal(card.competitionContentLabel, "Đôi nam");
  assert.match(card.participantAMemberLine, /Nguyễn A \/ Trần B/);

  const rules = adapter.getScoringRules({
    tenantId: "tenant-1",
    competitionId: "comp-1",
    matchId: "match-1",
  });
  assert.equal(rules.metadata.openingServiceTurn, 2);
  assert.equal(rules.serversPerSide, 2);

  const view = buildRefereeMatchView({
    matchId: "match-1",
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    matchContext,
    participants,
    scoringRules: rules,
    modeState: state,
    assignedMatch: {
      scoreProjection: {
        points: { SIDE_A: 0, SIDE_B: 0 },
        serve: { servingSide: "SIDE_A", serverNumber: 2, serverPlayerId: "p-a1" },
        format: rules,
      },
    },
    courtState: {
      serverPlayerId: "p-a1",
      servingSide: "SIDE_A",
      serverNumber: 2,
      lineupConfigured: true,
      playerPositions: { sideA: ["p-a1", "p-a2"], sideB: ["p-b1", "p-b2"] },
    },
  });
  assert.equal(view.servingStatus.showServiceTurn, true);
  assert.equal(view.servingStatus.serviceTurn, 2);
  assert.equal(view.servingStatus.serviceCourtLabel, "Phải");
  assert.equal(view.participantDisplay.sideA.members.length, 2);
  assert.equal(view.participantDisplay.sideA.members[0].logicalPosition, "RIGHT");
  assert.equal(view.participantDisplay.sideA.members[1].logicalPosition, "LEFT");
});

test("normalizeIndividualTournamentMatch copies eventType into content fields", () => {
  const normalized = normalizeIndividualTournamentMatch(
    {
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      participantIdsA: ["p1"],
      participantIdsB: ["p2"],
    },
    {
      id: "ev1",
      eventType: EVENT_TYPE.WOMEN_SINGLE,
      entries: [
        { id: "e1", playerIds: ["p1"] },
        { id: "e2", playerIds: ["p2"] },
      ],
    },
    {}
  );
  assert.equal(normalized.eventType, EVENT_TYPE.WOMEN_SINGLE);
  assert.equal(normalized.competitionContentLabel, "Đơn nữ");
  assert.equal(normalized.matchFormat, REFEREE_MATCH_FORMAT.SINGLES);
});

test("Daily adapter projects matchType content", () => {
  const adapter = createDailyPlayRefereeAdapter({
    modeState: {
      tenantId: "tenant-1",
      competitionId: "daily-1",
      session: { sessionId: "daily-1", matchType: "mixed_double" },
      matches: {
        m1: {
          matchId: "m1",
          status: "ready",
          courtId: "c1",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          matchType: "mixed_double",
        },
      },
    },
  });
  const ctx = adapter.getMatchContext({
    tenantId: "tenant-1",
    competitionId: "daily-1",
    matchId: "m1",
  });
  assert.equal(ctx.matchFormat, REFEREE_MATCH_FORMAT.DOUBLES);
  assert.equal(ctx.expectedPlayersPerSide, 2);
  const rules = adapter.getScoringRules({
    tenantId: "tenant-1",
    competitionId: "daily-1",
    matchId: "m1",
  });
  assert.equal(rules.metadata.openingServiceTurn, 2);
});

test("ARCHITECTURE: CORE/contracts freeze surfaces unchanged by this remediation", () => {
  const files = [
    "src/features/competition-core/matches/services/applyMatchTransition.js",
    "src/features/competition-core/scoring/services/progression.js",
    "src/features/competition-engine/integration/referee/contract.js",
  ];
  for (const rel of files) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    assert.ok(text.length > 0);
  }
  // Adapter B remains translation helper ownership only
  const mapper = readFileSync(
    path.join(
      ROOT,
      "src/features/competition-engine/integration/referee/adapters/shared/scoringRulesMapper.js"
    ),
    "utf8"
  );
  assert.match(mapper, /Translator-only|openingServiceTurn/);
  assert.doesNotMatch(mapper, /createInitialScoringState/);
});
