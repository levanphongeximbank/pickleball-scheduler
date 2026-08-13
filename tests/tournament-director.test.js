import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createMatchRecord, EVENT_TYPE, MATCH_STATUS } from "../src/models/tournament/index.js";
import { shouldShowDirectorBlockingLoad } from "../src/features/tournament/director/directorLoadingGate.js";
import {
  assignTournamentMatchToAvailableCourt,
  buildEventDirectorSnapshot,
  buildTournamentDirectorSnapshot,
  enrichMatchForDirector,
  partitionTournamentMatches,
  resolveEntryLabel,
  submitTournamentDirectorMatchScore,
} from "../src/tournament/engines/tournamentDirectorEngine.js";
import {
  buildOfficialAiBalancePlan,
  generateKnockoutBracket,
} from "../src/tournament/engines/index.js";

function buildMalePlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `male-${index + 1}`,
    name: `Nam ${index + 1}`,
    gender: "Nam",
    rating: 5 - index * 0.2,
    level: 5 - index * 0.2,
  }));
}

test("partitionTournamentMatches splits waiting, on court and completed", () => {
  const matches = [
    createMatchRecord({ id: "m1", status: MATCH_STATUS.WAITING }),
    createMatchRecord({ id: "m2", status: MATCH_STATUS.ASSIGNED }),
    createMatchRecord({ id: "m3", status: MATCH_STATUS.PLAYING }),
    createMatchRecord({ id: "m4", status: MATCH_STATUS.COMPLETED }),
  ];

  const partitioned = partitionTournamentMatches(matches);
  assert.equal(partitioned.waiting.length, 1);
  assert.equal(partitioned.onCourt.length, 2);
  assert.equal(partitioned.completed.length, 1);
});

test("enrichMatchForDirector resolves entry labels", () => {
  const entries = [
    { id: "e1", name: "Doi A", playerIds: ["p1", "p2"] },
    { id: "e2", name: "Doi B", playerIds: ["p3", "p4"] },
  ];
  const match = createMatchRecord({
    id: "m1",
    entryAId: "e1",
    entryBId: "e2",
    groupId: "g1",
  });

  const enriched = enrichMatchForDirector(match, entries, []);
  assert.equal(enriched.entryALabel, "Doi A");
  assert.equal(enriched.stageLabel, "Vòng bảng");
});

test("assignTournamentMatchToAvailableCourt assigns and starts match", () => {
  const courts = [{ id: "1", name: "San 1", active: true }];
  const matches = [
    createMatchRecord({
      id: "m1",
      entryAId: "e1",
      entryBId: "e2",
      status: MATCH_STATUS.WAITING,
    }),
  ];

  const result = assignTournamentMatchToAvailableCourt({
    matches,
    courts,
    matchId: "m1",
    legacyAvailability: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.courtId, "1");
  assert.equal(result.match.status, MATCH_STATUS.PLAYING);
});

test("submitTournamentDirectorMatchScore updates group standings data", () => {
  const event = {
    id: "e1",
    entries: [
      { id: "a", name: "Doi A", playerIds: ["1", "2"] },
      { id: "b", name: "Doi B", playerIds: ["3", "4"] },
    ],
    groups: [{ id: "g1", label: "A", entryIds: ["a", "b"] }],
    matches: [
      createMatchRecord({
        id: "m1",
        groupId: "g1",
        entryAId: "a",
        entryBId: "b",
        status: MATCH_STATUS.PLAYING,
      }),
    ],
  };

  const result = submitTournamentDirectorMatchScore(event, "m1", {
    scoreA: 11,
    scoreB: 7,
  });

  assert.equal(result.ok, true);
  assert.equal(result.match.winnerId, "a");

  const snapshot = buildEventDirectorSnapshot({ event: result.event, courts: [], players: [] });
  assert.equal(snapshot.standings[0].standing[0].id, "a");
  assert.equal(snapshot.standings[0].standing[0].matchPoints, 2);
});

test("submitTournamentDirectorMatchScore propagates knockout bracket", () => {
  const players = buildMalePlayers(16);
  const plan = buildOfficialAiBalancePlan({
    tournament: { id: "t1", events: [] },
    players,
    selectedPlayerIds: players.map((player) => String(player.id)),
    eventType: EVENT_TYPE.MEN_DOUBLE,
    groupCount: 2,
  });

  const completedMatches = plan.event.matches.map((match, index) => ({
    ...match,
    scoreA: index % 2 === 0 ? 11 : 8,
    scoreB: index % 2 === 0 ? 6 : 11,
    winnerId: index % 2 === 0 ? match.entryAId : match.entryBId,
    loserId: index % 2 === 0 ? match.entryBId : match.entryAId,
    status: MATCH_STATUS.COMPLETED,
  }));

  const bracket = generateKnockoutBracket({
    ...plan.event,
    matches: completedMatches,
  });
  assert.equal(bracket.ok, true);

  const firstKo = bracket.event.matches.find((match) => match.bracketMatchId === "R1-M1");
  const playingKo = {
    ...firstKo,
    status: MATCH_STATUS.PLAYING,
  };
  const eventWithPlaying = {
    ...bracket.event,
    matches: bracket.event.matches.map((match) =>
      match.id === playingKo.id ? playingKo : match
    ),
  };

  const result = submitTournamentDirectorMatchScore(eventWithPlaying, playingKo.id, {
    scoreA: 11,
    scoreB: 4,
  });

  assert.equal(result.ok, true);
  const semi = result.event.matches.find((match) => match.bracketMatchId === "R2-M1");
  assert.ok(semi.entryAId);
});

test("buildTournamentDirectorSnapshot works for daily play mode", () => {
  const snapshot = buildTournamentDirectorSnapshot({
    tournament: {
      mode: "daily_play",
      settings: {
        dailyPlay: {
          matches: [
            {
              id: "d1",
              teamALabel: "A",
              teamBLabel: "B",
              status: MATCH_STATUS.WAITING,
            },
          ],
          checkedInPlayerIds: [],
        },
      },
    },
    courts: [{ id: 1, active: true }],
    players: [],
    lockedCourtIds: [],
  });

  assert.equal(snapshot.summary.waiting, 1);
  assert.equal(snapshot.mode, "daily_play");
});

test("resolveEntryLabel falls back to player names", () => {
  const label = resolveEntryLabel(
    "e1",
    [{ id: "e1", playerIds: ["p1"] }],
    [{ id: "p1", name: "Le Phong" }]
  );
  assert.equal(label, "Le Phong");
});

test("canonical Daily Director snapshot does not treat assigned as playing (DP-12)", async () => {
  const { buildCanonicalDailyDirectorSnapshot } = await import(
    "../src/features/tournament/director/services/dailyDirectorProjection.js"
  );
  const snapshot = buildCanonicalDailyDirectorSnapshot({
    tournament: {
      mode: "daily_play",
      settings: {
        refereeRoster: [
          {
            id: "ref-canon-1",
            name: "TT Lan",
            source: "canonical_account",
            canonicalUserId: "u-ref-1",
          },
          { id: "r-manual", name: "Khách" },
        ],
        dailyRefereeAssignments: {
          d2: {
            name: "TT Lan",
            token: "tok-lan",
            rosterId: "ref-canon-1",
            canonicalUserId: "u-ref-1",
            source: "canonical_account",
          },
        },
      },
    },
    session: {
      dailyPlay: {
        matches: [
          { id: "d1", status: MATCH_STATUS.WAITING, teamALabel: "A", teamBLabel: "B" },
          { id: "d2", status: MATCH_STATUS.ASSIGNED, teamALabel: "C", teamBLabel: "D" },
          { id: "d3", status: MATCH_STATUS.PLAYING, teamALabel: "E", teamBLabel: "F" },
          { id: "d4", status: MATCH_STATUS.COMPLETED, teamALabel: "G", teamBLabel: "H" },
        ],
      },
      courts: [{ id: "c1", name: "Sân 1" }],
      courtStates: [{ id: "c1", currentMatchId: "d3", status: "playing" }],
      leases: [{ id: "l1", matchId: "d3", courtId: "c1", status: "active" }],
    },
    players: [{ id: "p1", name: "Lan" }],
  });

  assert.equal(snapshot.matches.waiting.length, 1);
  assert.equal(snapshot.matches.assigned.length, 1);
  assert.equal(snapshot.matches.playing.length, 1);
  assert.equal(snapshot.matches.onCourt.length, 1);
  assert.equal(snapshot.matches.completed.length, 1);
  assert.equal(snapshot.matches.onCourt[0].id, "d3");
  assert.equal(snapshot.matches.assigned[0].referee.canonicalUserId, "u-ref-1");
  assert.equal(snapshot.refereeSettings.roster.length, 2);
  assert.ok(snapshot.refereeSettings.roster.some((e) => e.canonicalUserId === "u-ref-1"));
  assert.ok(snapshot.refereeSettings.roster.some((e) => e.source === "manual" || !e.canonicalUserId));
});

test("Daily referee metadata merge never overwrites newer dailyPlay (DP-12)", async () => {
  const { mergeDailyRefereeMetadata } = await import(
    "../src/features/tournament/director/services/dailyRefereeMetadataPatch.js"
  );
  const latest = {
    dailyPlay: { revision: 9, matches: [{ id: "m1", status: "playing" }] },
    refereeRoster: [{ id: "r1", name: "Old" }],
  };
  const merged = mergeDailyRefereeMetadata(latest, {
    dailyPlay: { revision: 1, matches: [] },
    dailyRefereeAssignments: {
      m1: { name: "TT Lan", canonicalUserId: "u-ref-1", token: "t1" },
    },
  });
  assert.equal(merged.dailyPlay.revision, 9);
  assert.equal(merged.dailyPlay.matches[0].status, "playing");
  assert.equal(merged.dailyRefereeAssignments.m1.canonicalUserId, "u-ref-1");
});

test("Daily Director completed cards expose Sửa điểm without using submit_score (DP-14)", () => {
  const board = fs.readFileSync(
    path.resolve("src/features/tournament/director/components/DirectorMatchCard.jsx"),
    "utf8"
  );
  const actions = fs.readFileSync(
    path.resolve("src/features/tournament/director/hooks/useDirectorActions.js"),
    "utf8"
  );
  const mode = fs.readFileSync(
    path.resolve("src/features/tournament/director/TournamentDirectorMode.jsx"),
    "utf8"
  );
  assert.match(board, /actionLabel: isDaily \? "Sửa điểm"/);
  assert.match(board, /onCorrectScore/);
  assert.match(actions, /handleOpenCorrectScore/);
  assert.match(actions, /dailySession\.correctScore/);
  assert.match(mode, /onCorrectScore=\{handleOpenCorrectScore\}/);
  assert.match(mode, /isCorrection=\{Boolean\(isDaily && scoreCorrectionMode\)\}/);
});

test("non-Daily Director snapshot still treats assigned as onCourt", () => {
  const snapshot = buildTournamentDirectorSnapshot({
    tournament: { mode: "official_tournament" },
    event: {
      id: "e1",
      entries: [],
      matches: [
        createMatchRecord({ id: "m1", status: MATCH_STATUS.WAITING }),
        createMatchRecord({ id: "m2", status: MATCH_STATUS.ASSIGNED }),
        createMatchRecord({ id: "m3", status: MATCH_STATUS.PLAYING }),
      ],
    },
    courts: [],
    players: [],
    lockedCourtIds: [],
  });
  assert.equal(snapshot.matches.waiting.length, 1);
  assert.equal(snapshot.matches.onCourt.length, 2);
});

test("DP-13B — Director keeps board visible during same-scope background revalidation", () => {
  assert.equal(
    shouldShowDirectorBlockingLoad({
      tournament: { id: "t1" },
      tournamentLoading: true,
      accessPending: true,
      isDaily: true,
      dailyState: { revision: 3 },
      dailyLoading: true,
    }),
    false
  );
  assert.equal(
    shouldShowDirectorBlockingLoad({
      tournament: null,
      tournamentLoading: true,
      accessPending: true,
      isDaily: true,
      dailyState: null,
      dailyLoading: true,
    }),
    true
  );
  const mode = fs.readFileSync(
    path.resolve("src/features/tournament/director/TournamentDirectorMode.jsx"),
    "utf8"
  );
  assert.match(mode, /shouldShowDirectorBlockingLoad/);
  assert.equal(mode.includes("if (initialLoading || tournamentAccess.pending)"), false);
});
