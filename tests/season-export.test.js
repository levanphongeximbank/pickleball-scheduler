import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import {
  buildSeasonExport,
  closeSeason,
} from "../src/domain/seasonCloseService.js";
import { applySeasonPointsFromMatchRecord } from "../src/domain/seasonStandingsService.js";
import { setActiveSeason } from "../src/domain/seasonService.js";
import { createSeason } from "../src/domain/seasonService.js";
import {
  buildSeasonExportPackage,
  summarizeTournamentForExport,
} from "../src/tournament/engines/seasonExportEngine.js";
import { buildSeasonFullCsv } from "../src/pages/seasonExport.logic.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { ensureDemoVenue, assignClubToVenue } from "../src/domain/venueService.js";

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

test("buildSeasonExportPackage includes standings and tournament summary", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const season = data.seasons[0];
  const league = data.leagues.find((item) => item.seasonId === season.id);

  applySeasonPointsFromMatchRecord(DEFAULT_CLUB.id, league.id, {
    id: "match-export-1",
    playerIds: ["p1", "p2"],
    teamAPlayerIds: ["p1"],
    teamBPlayerIds: ["p2"],
    scoreA: 11,
    scoreB: 5,
  });

  const refreshed = loadClubData(DEFAULT_CLUB.id);
  const packagePayload = buildSeasonExportPackage({
    clubId: DEFAULT_CLUB.id,
    clubName: "Test Club",
    season,
    leagues: [league],
    rounds: refreshed.rounds || [],
    tournaments: refreshed.tournaments || [],
    seasonStandings: refreshed.seasonStandings || {},
    players: refreshed.players || [],
  });

  assert.equal(packagePayload.type, "season-results");
  assert.equal(packagePayload.season.id, season.id);
  assert.equal(packagePayload.leagues.length, 1);
  assert.ok(packagePayload.leagues[0].standings.length >= 1);
});

test("summarizeTournamentForExport counts completed matches", () => {
  const summary = summarizeTournamentForExport({
    id: "t1",
    name: "Giai test",
    mode: "daily_play",
    status: "active",
    matches: [
      { id: "m1", status: "completed" },
      { id: "m2", status: "scheduled" },
    ],
    entries: [{ id: "e1" }],
  });

  assert.equal(summary.matchCount, 2);
  assert.equal(summary.completedMatchCount, 1);
  assert.equal(summary.entryCount, 1);
});

test("summarizeTournamentForExport normalizes playing and forfeited statuses", () => {
  const summary = summarizeTournamentForExport({
    id: "t2",
    name: "Giai dau",
    mode: "internal_tournament",
    status: "active",
    matches: [
      { id: "m1", status: "playing" },
      { id: "m2", status: "in_progress" },
      { id: "m3", status: "forfeit" },
      { id: "m4", status: "scheduled" },
    ],
    entries: [{ id: "e1" }],
  });

  assert.equal(summary.matchCount, 4);
  assert.equal(summary.completedMatchCount, 1);
  assert.equal(summary.activeMatchCount, 2);
  assert.equal(summary.progressPercent, 25);
});

test("buildSeasonFullCsv exports one section per league", () => {
  const csv = buildSeasonFullCsv({
    season: { name: "Mua 2026" },
    leagues: [
      {
        league: { name: "Giao luu" },
        standings: [
          {
            playerId: "1",
            name: "An",
            points: 3,
            matches: 1,
            wins: 1,
            losses: 0,
            draws: 0,
            rating: 4,
          },
        ],
      },
      {
        league: { name: "Chinh thuc" },
        standings: [
          {
            playerId: "2",
            name: "Binh",
            points: 6,
            matches: 2,
            wins: 2,
            losses: 0,
            draws: 0,
            rating: 4.2,
          },
        ],
      },
    ],
  });

  assert.match(csv, /Mua: Mua 2026/);
  assert.match(csv, /Giai: Giao luu/);
  assert.match(csv, /Giai: Chinh thuc/);
  assert.match(csv, /An/);
  assert.match(csv, /Binh/);
});

test("closeSeason marks season completed", () => {
  const created = createSeason(DEFAULT_CLUB.id, "Mua chot test", { makeActive: false });
  const seasonId = created.season.id;

  const result = closeSeason(DEFAULT_CLUB.id, seasonId);
  assert.equal(result.ok, true);
  assert.equal(result.season.status, "completed");
  assert.ok(result.export);
  assert.equal(result.export.season.status, "completed");

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.seasons.find((season) => season.id === seasonId)?.status, "completed");
});

test("closeSeason completes leagues in season", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const targetSeasonId = data.active.seasonId;
  const other = createSeason(DEFAULT_CLUB.id, "Mua tam", { makeActive: true });

  setActiveSeason(DEFAULT_CLUB.id, other.season.id);

  const result = closeSeason(DEFAULT_CLUB.id, targetSeasonId);
  assert.equal(result.ok, true);

  const leagues = loadClubData(DEFAULT_CLUB.id).leagues.filter(
    (league) => league.seasonId === targetSeasonId
  );
  assert.ok(leagues.length > 0);
  assert.ok(leagues.every((league) => league.status === "completed"));
});

test("closeSeason blocks active season without switching", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const activeSeasonId = data.active.seasonId;

  const result = closeSeason(DEFAULT_CLUB.id, activeSeasonId);
  assert.equal(result.ok, false);
  assert.match(result.error, /active/i);
});

test("buildSeasonExport returns package for existing season", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const result = buildSeasonExport(DEFAULT_CLUB.id, data.active.seasonId);

  assert.equal(result.ok, true);
  assert.equal(result.package.clubId, DEFAULT_CLUB.id);
  assert.ok(Array.isArray(result.package.leagues));
});

test("closeSeason works after switching away from season", () => {
  const created = createSeason(DEFAULT_CLUB.id, "Mua tam", { makeActive: true });
  const other = createSeason(DEFAULT_CLUB.id, "Mua khac", { makeActive: true });

  setActiveSeason(DEFAULT_CLUB.id, other.season.id);

  const result = closeSeason(DEFAULT_CLUB.id, created.season.id);
  assert.equal(result.ok, true);
  assert.equal(result.season.status, "completed");
});

test("buildSeasonExport allowed on trial — CLB không phụ thuộc gói venue", () => {
  enableRbac(true);
  ensureDemoVenue();
  assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");

  signInAs(
    createUserRecord({
      role: ROLES.CLUB_OWNER,
      venueId: "venue-demo",
      clubId: DEFAULT_CLUB.id,
    })
  );

  const data = loadClubData(DEFAULT_CLUB.id);
  const result = buildSeasonExport(DEFAULT_CLUB.id, data.active.seasonId);
  assert.equal(result.ok, true);

  signOut();
  enableRbac(false);
});
