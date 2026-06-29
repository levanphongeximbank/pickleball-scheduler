import test from "node:test";
import assert from "node:assert/strict";

import { createMatchRecord, EVENT_TYPE, MATCH_STATUS } from "../src/models/tournament/index.js";
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
  assert.equal(enriched.stageLabel, "Vong bang");
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
