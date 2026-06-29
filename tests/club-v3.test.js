import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  CLUB_SCHEMA_VERSION,
  getClubDataKey,
  loadClubData,
  purgeClubData,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { migrateV2ToV3 } from "../src/domain/migrateV2ToV3.js";
import { createClub, deleteClub, renameClub } from "../src/domain/clubService.js";
import {
  createSeason,
  setActiveSeason,
} from "../src/domain/seasonService.js";
import {
  createLeague,
  setActiveLeague,
} from "../src/domain/leagueService.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { loadAIData } from "../src/ai/storage.js";
import { buildSessionMeta } from "../src/ai/session.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

let originalDateNow;

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  originalDateNow = Date.now;
  Date.now = () => 12345;
  setActiveClubId(DEFAULT_CLUB.id);
});

afterEach(() => {
  Date.now = originalDateNow;
});

test("migrateV2ToV3 maps legacy players courts and ai sessions", () => {
  localStorage.setItem(
    "players::default-club",
    JSON.stringify([{ id: 1, name: "A", gender: "Nam", level: 3.5, active: true }])
  );
  localStorage.setItem(
    "courts::default-club",
    JSON.stringify([{ id: 10, name: "San 1", number: 1, active: true }])
  );
  localStorage.setItem(
    "pickleball-ai::default-club",
    JSON.stringify({
      sessions: [{ id: 99, date: "2026-01-01", courts: [], waiting: [], meta: {} }],
      history: {},
      policies: [],
      rules: [],
    })
  );

  const migrated = migrateV2ToV3(DEFAULT_CLUB.id);

  assert.equal(migrated.players.length, 1);
  assert.equal(migrated.courts.length, 1);
  assert.equal(migrated.sessions.length, 1);
  assert.equal(migrated.sessions[0].meta.clubId, DEFAULT_CLUB.id);
});

test("loadClubData ensures default season and league", () => {
  const data = loadClubData(DEFAULT_CLUB.id);

  assert.equal(data.schemaVersion, CLUB_SCHEMA_VERSION);
  assert.equal(data.seasons.length, 1);
  assert.equal(data.leagues.length, 1);
  assert.equal(data.active.seasonId, data.seasons[0].id);
  assert.equal(data.active.leagueId, data.leagues[0].id);
  assert.ok(Array.isArray(data.tournaments));
  assert.equal(data.tournaments.length, 0);
});

test("loadClubData upgrades legacy schema 3 blob with tournaments array", () => {
  localStorage.setItem(
    getClubDataKey(DEFAULT_CLUB.id),
    JSON.stringify({
      schemaVersion: 3,
      clubId: DEFAULT_CLUB.id,
      players: [{ id: 1, name: "A", gender: "Nam", level: 3.5, active: true }],
      courts: [{ id: 10, name: "Sân 1", number: 1, active: true }],
      seasons: [],
      leagues: [],
      rounds: [{ id: "r1", name: "Vòng 1" }],
      sessions: [{ id: 99, date: "2026-01-01", courts: [], waiting: [], meta: {} }],
      ai: { history: {}, waiting: {}, policies: [], rules: [], tournament: {} },
      active: { seasonId: null, leagueId: null, roundSlot: null },
    })
  );

  const data = loadClubData(DEFAULT_CLUB.id);

  assert.equal(data.schemaVersion, CLUB_SCHEMA_VERSION);
  assert.equal(data.players.length, 1);
  assert.equal(data.rounds.length, 1);
  assert.equal(data.sessions.length, 1);
  assert.ok(Array.isArray(data.tournaments));
  assert.equal(data.tournaments.length, 0);
});

test("clubService create rename delete works with storage purge", () => {
  const created = createClub("CLB Test V3");
  assert.equal(created.ok, true);

  const clubId = created.club.id;
  saveClubData(clubId, {
    ...loadClubData(clubId),
    players: [{ id: 1, name: "P1", gender: "Nam", level: 3, active: true }],
  });

  const renamed = renameClub(clubId, "CLB Test V3 Updated");
  assert.equal(renamed.ok, true);

  const removed = deleteClub(clubId);
  assert.equal(removed.ok, true);
  assert.equal(localStorage.getItem(getClubDataKey(clubId)), null);
});

test("season and league services update active pointers", () => {
  const seasonResult = createSeason(DEFAULT_CLUB.id, "Mua 2026", {
    makeActive: true,
  });
  assert.equal(seasonResult.ok, true);

  const leagueResult = createLeague(
    DEFAULT_CLUB.id,
    seasonResult.season.id,
    "Giai Open",
    { makeActive: true }
  );
  assert.equal(leagueResult.ok, true);

  const data = loadClubData(DEFAULT_CLUB.id);
  assert.equal(data.active.seasonId, seasonResult.season.id);
  assert.equal(data.active.leagueId, leagueResult.league.id);

  const season2 = createSeason(DEFAULT_CLUB.id, "Mua 2027");
  setActiveSeason(DEFAULT_CLUB.id, season2.season.id);
  setActiveLeague(DEFAULT_CLUB.id, leagueResult.league.id);

  const afterSwitch = loadClubData(DEFAULT_CLUB.id);
  assert.equal(afterSwitch.active.seasonId, seasonResult.season.id);
  assert.equal(afterSwitch.active.leagueId, leagueResult.league.id);
});

test("buildSessionMeta includes club season and league ids", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  const meta = buildSessionMeta({}, DEFAULT_CLUB.id);

  assert.equal(meta.clubId, DEFAULT_CLUB.id);
  assert.equal(meta.seasonId, data.active.seasonId);
  assert.equal(meta.leagueId, data.active.leagueId);
});

test("loadAIData reads sessions from unified club blob", () => {
  const data = loadClubData(DEFAULT_CLUB.id);
  data.sessions = [
    {
      id: 1,
      date: "2026-01-01",
      courts: [],
      waiting: [],
      meta: { clubId: DEFAULT_CLUB.id },
    },
  ];
  saveClubData(DEFAULT_CLUB.id, data);

  const aiData = loadAIData(DEFAULT_CLUB.id);
  assert.equal(aiData.sessions.length, 1);
  assert.equal(aiData.schemaVersion, 3);
});

test("purgeClubData removes scoped club blob", () => {
  loadClubData("club-x");
  purgeClubData("club-x");
  assert.equal(localStorage.getItem(getClubDataKey("club-x")), null);
});
