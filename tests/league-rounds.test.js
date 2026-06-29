import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import {
  createLeagueRound,
  linkTournamentToRound,
  updateLeagueRound,
} from "../src/domain/leagueRoundService.js";
import { createTournament } from "../src/domain/tournamentService.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/index.js";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  loadClubData(DEFAULT_CLUB.id);
});

test("createTournament auto-links league round in season", () => {
  const created = createTournament(DEFAULT_CLUB.id, {
    name: "Giai noi bo tuan 1",
    mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
  });

  assert.equal(created.ok, true);
  assert.ok(created.tournament.roundId);

  const data = loadClubData(DEFAULT_CLUB.id);
  const round = data.rounds.find((item) => item.id === created.tournament.roundId);
  assert.ok(round);
  assert.ok((round.tournamentIds || []).includes(created.tournament.id));
});

test("ensureTournamentLeagueRound reuses active round slot", () => {
  const first = createTournament(DEFAULT_CLUB.id, {
    name: "Giai 1",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });
  const second = createTournament(DEFAULT_CLUB.id, {
    name: "Giai 2",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  });

  assert.equal(first.tournament.roundId, second.tournament.roundId);
});

test("updateLeagueRound renames round", () => {
  const created = createLeagueRound(DEFAULT_CLUB.id, {
    seasonId: loadClubData(DEFAULT_CLUB.id).active.seasonId,
    leagueId: loadClubData(DEFAULT_CLUB.id).active.leagueId,
    name: "Vong tam",
  });

  const result = updateLeagueRound(DEFAULT_CLUB.id, created.round.id, {
    name: "Vong chinh thuc",
  });

  assert.equal(result.ok, true);
  assert.equal(result.round.name, "Vong chinh thuc");
});

test("linkTournamentToRound moves tournament between rounds", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const roundA = createLeagueRound(DEFAULT_CLUB.id, {
    seasonId: data.active.seasonId,
    leagueId: data.active.leagueId,
    name: "Vong A",
  });
  const roundB = createLeagueRound(DEFAULT_CLUB.id, {
    seasonId: data.active.seasonId,
    leagueId: data.active.leagueId,
    name: "Vong B",
  });
  const tournament = createTournament(DEFAULT_CLUB.id, {
    name: "Giai chuyen vong",
    mode: TOURNAMENT_MODE.DAILY_PLAY,
  }).tournament;

  linkTournamentToRound(DEFAULT_CLUB.id, tournament.id, roundA.round.id);
  linkTournamentToRound(DEFAULT_CLUB.id, tournament.id, roundB.round.id);

  const after = loadClubData(DEFAULT_CLUB.id);
  const savedTournament = after.tournaments.find((item) => item.id === tournament.id);
  const savedRoundA = after.rounds.find((item) => item.id === roundA.round.id);
  const savedRoundB = after.rounds.find((item) => item.id === roundB.round.id);

  assert.equal(savedTournament.roundId, roundB.round.id);
  assert.ok(!(savedRoundA.tournamentIds || []).includes(tournament.id));
  assert.ok((savedRoundB.tournamentIds || []).includes(tournament.id));
});
