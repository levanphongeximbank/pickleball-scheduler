import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { lockPlayer } from "../src/ai/director.js";
import { saveRoundsForClub, setActivePointers, getClubDataKey } from "../src/domain/clubStorage.js";
import { getScopedStorageKey, setActiveClubId } from "../src/data/club.js";
import { createClubDataRepository } from "../src/domain/repositories/clubDataRepository.js";
import { markClubDataDirty } from "../src/domain/clubSyncMetadata.js";
import {
  resolveTeamTournamentStoreMode,
  TEAM_TOURNAMENT_STORE_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepository.js";

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock({
    "pickleball-clubs-v1": JSON.stringify([{ id: "default-club", name: "CLB" }]),
    "pickleball-active-club-v1": "default-club",
    "pickleball-club-data-v3::default-club": JSON.stringify({
      schemaVersion: 3.5,
      clubId: "default-club",
      players: [],
      courts: [],
      rounds: [],
      tournaments: [],
      director: { lockedCourts: [], lockedPlayers: [] },
      active: { seasonId: null, leagueId: null, roundSlot: null },
      ai: { history: {}, waiting: {}, sessions: [], policies: [], rules: [], tournament: { bracketWinners: {} } },
    }),
  });
  setActiveClubId("default-club");
});

test("director locks persist in club blob not legacy key", () => {
  lockPlayer("player-1", "default-club");

  const legacyKey = getScopedStorageKey("pickleball-director", "default-club");
  assert.equal(localStorage.getItem(legacyKey), null);

  const blob = JSON.parse(localStorage.getItem(getClubDataKey("default-club")));
  assert.equal(blob.director.lockedPlayers.includes("player-1"), true);
});

test("saveRoundsForClub does not write legacy tournament-rounds key", () => {
  saveRoundsForClub([{ id: "r1", name: "Vòng 1" }], "default-club");

  const legacyKey = getScopedStorageKey("pickleball-tournament-rounds", "default-club");
  assert.equal(localStorage.getItem(legacyKey), null);

  const blob = JSON.parse(localStorage.getItem(getClubDataKey("default-club")));
  assert.equal(blob.rounds.length, 1);
});

test("setActivePointers does not write legacy active-slot key", () => {
  setActivePointers({ roundSlot: { roundId: "r1", roundName: "Vòng 1" } }, "default-club");

  const legacyKey = getScopedStorageKey("pickleball-active-slot", "default-club");
  assert.equal(localStorage.getItem(legacyKey), null);

  const blob = JSON.parse(localStorage.getItem(getClubDataKey("default-club")));
  assert.equal(blob.active.roundSlot.roundId, "r1");
});

test("team tournament cloud requires explicit VITE_TEAM_TOURNAMENT_SUPABASE=true", () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    import.meta.env.VITE_SUPABASE_ANON_KEY = "eyJ-test";
    import.meta.env.VITE_TEAM_TOURNAMENT_SUPABASE = "";
    import.meta.env.VITE_TEAM_TOURNAMENT_STORE_MODE = "";
    import.meta.env.NODE_ENV = "production";
    import.meta.env.VITEST = "";
    assert.equal(resolveTeamTournamentStoreMode(), TEAM_TOURNAMENT_STORE_MODES.LOCAL);

    import.meta.env.VITE_TEAM_TOURNAMENT_SUPABASE = "true";
    assert.equal(resolveTeamTournamentStoreMode(), TEAM_TOURNAMENT_STORE_MODES.SUPABASE);
  }
});

test("shouldAutoPull skips when local data is dirty", async () => {
  markClubDataDirty("club-a");

  const repo = createClubDataRepository();
  const decision = await repo.shouldAutoPull("club-a");
  assert.equal(decision.shouldPull, false);
  assert.equal(decision.reason, "LOCAL_DIRTY");
});
