import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { loadClubs } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
import {
  DEMO_ROSTER_CLUBS,
  buildDemoPlayers,
  seedDemoClubsRoster,
} from "../src/demo/seed/demoClubsRosterSeed.js";

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
  globalThis.localStorage = createLocalStorageMock();
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("buildDemoPlayers — 60 VĐV đa dạng giới tính và level", () => {
  const players = buildDemoPlayers(60, DEMO_ROSTER_CLUBS[0]);
  assert.equal(players.length, 60);
  assert.ok(players.some((player) => player.gender === "Nam"));
  assert.ok(players.some((player) => player.gender === "Nữ"));
  assert.ok(players.every((player) => player.level >= 1.0 && player.level <= 8.0));
});

test("seedDemoClubsRoster — 4 CLB × 60 VĐV", () => {
  const result = seedDemoClubsRoster({ playersPerClub: 60 });
  assert.equal(result.ok, true);
  assert.equal(result.clubs.length, 4);
  assert.equal(result.totalPlayers, 240);

  const clubs = loadClubs();
  for (const spec of DEMO_ROSTER_CLUBS) {
    assert.ok(clubs.some((club) => club.id === spec.id), `missing club ${spec.id}`);
    const data = loadClubData(spec.id);
    assert.equal(data.players.length, 60);
  }
});
