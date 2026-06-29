import test from "node:test";
import assert from "node:assert/strict";

import {
  TOURNAMENT_MODE,
  OFFICIAL_MODE,
  TOURNAMENT_STATUS,
  EVENT_TYPE,
  MATCH_STATUS,
  MATCH_STAGE,
  createTournamentRecord,
  createEventRecord,
  createEntryRecord,
  createGroupRecord,
  createMatchRecord,
  normalizeTournament,
  normalizeTournaments,
} from "../src/models/tournament/index.js";

test("createTournamentRecord defaults to daily_play draft", () => {
  const tournament = createTournamentRecord("club-1", { name: "Chơi vui" });

  assert.equal(tournament.clubId, "club-1");
  assert.equal(tournament.mode, TOURNAMENT_MODE.DAILY_PLAY);
  assert.equal(tournament.status, TOURNAMENT_STATUS.DRAFT);
  assert.equal(tournament.officialMode, null);
  assert.equal(tournament.events.length, 0);
});

test("official tournament requires officialMode", () => {
  const tournament = createTournamentRecord("club-1", {
    name: "Open Cup",
    mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
    officialMode: OFFICIAL_MODE.AI_BALANCE,
  });

  assert.equal(tournament.mode, TOURNAMENT_MODE.OFFICIAL_TOURNAMENT);
  assert.equal(tournament.officialMode, OFFICIAL_MODE.AI_BALANCE);
});

test("normalizeTournaments drops invalid records", () => {
  const tournaments = normalizeTournaments([
    { id: "t1", name: "Giải A", mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT },
    { name: "Missing id" },
  ]);

  assert.equal(tournaments.length, 1);
  assert.equal(tournaments[0].id, "t1");
});

test("createEventRecord normalizes event type", () => {
  const event = createEventRecord({
    tournamentId: "t1",
    name: "Đôi nam",
    eventType: EVENT_TYPE.MEN_DOUBLE,
  });

  assert.equal(event.eventType, EVENT_TYPE.MEN_DOUBLE);
  assert.equal(event.tournamentId, "t1");
});

test("createEntryRecord keeps pair metadata", () => {
  const entry = createEntryRecord({
    tournamentId: "t1",
    name: "Cặp A",
    playerIds: ["p1", "p2"],
    representativeClubName: "CLB A",
    pairType: "mixed_club",
    rating: 7.5,
    seed: 3,
  });

  assert.deepEqual(entry.playerIds, ["p1", "p2"]);
  assert.equal(entry.pairType, "mixed_club");
  assert.equal(entry.rating, 7.5);
  assert.equal(entry.seed, 3);
});

test("createGroupRecord applies default points config", () => {
  const group = createGroupRecord({
    tournamentId: "t1",
    label: "A",
    entryIds: ["e1", "e2"],
  });

  assert.equal(group.label, "A");
  assert.deepEqual(group.entryIds, ["e1", "e2"]);
  assert.equal(group.pointsConfig.win, 2);
  assert.equal(group.pointsConfig.loss, 1);
  assert.equal(group.pointsConfig.forfeit, 0);
});

test("createMatchRecord normalizes match status and stage", () => {
  const match = createMatchRecord({
    tournamentId: "t1",
    stage: MATCH_STAGE.SEMIFINAL,
    status: MATCH_STATUS.PLAYING,
    entryAId: "e1",
    entryBId: "e2",
    scoreA: 11,
    scoreB: 8,
  });

  assert.equal(match.stage, MATCH_STAGE.SEMIFINAL);
  assert.equal(match.status, MATCH_STATUS.PLAYING);
  assert.equal(match.scoreA, 11);
  assert.equal(match.scoreB, 8);
});

test("normalizeTournament nests events and groups", () => {
  const tournament = normalizeTournament({
    id: "t1",
    clubId: "club-1",
    name: "Giải nội bộ",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
    events: [
      {
        id: "ev1",
        tournamentId: "t1",
        eventType: EVENT_TYPE.MIXED_DOUBLE,
        groups: [{ id: "g1", label: "A", entryIds: ["e1"] }],
      },
    ],
  });

  assert.equal(tournament.events.length, 1);
  assert.equal(tournament.events[0].groups.length, 1);
  assert.equal(tournament.events[0].groups[0].label, "A");
});
