import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runWaitingEngine } from "../src/ai/waiting.js";
import { getScopedStorageKey } from "../src/data/club.js";

const WAITING_STORAGE_KEY = "pickleball_ai_waiting";

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

test("runWaitingEngine prioritizes players with higher waitCount", () => {
  globalThis.localStorage = createLocalStorageMock({
    [getScopedStorageKey(WAITING_STORAGE_KEY)]: JSON.stringify({
      p1: { waitCount: 5, playCount: 3, lastWaitRound: 0, lastPlayRound: 0 },
      p2: { waitCount: 4, playCount: 3, lastWaitRound: 0, lastPlayRound: 0 },
      p3: { waitCount: 1, playCount: 1, lastWaitRound: 0, lastPlayRound: 0 },
      p4: { waitCount: 1, playCount: 2, lastWaitRound: 0, lastPlayRound: 0 },
      p5: { waitCount: 0, playCount: 0, lastWaitRound: 0, lastPlayRound: 0 },
    }),
  });

  const players = ["p1", "p2", "p3", "p4", "p5"].map((id, index) => ({
    id,
    name: `Player ${index + 1}`,
    level: 3,
  }));

  const result = runWaitingEngine(players, { courtCount: 1 });

  assert.equal(result.playingPlayers.length, 4);
  assert.equal(result.waitingPlayers.length, 1);
  assert.deepEqual(
    result.playingPlayers.map((player) => player.id),
    ["p1", "p2", "p3", "p4"]
  );
});

test("runWaitingEngine keeps playing players as multiples of 4", () => {
  const players = Array.from({ length: 10 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `P${index + 1}`,
    level: 3,
  }));

  const result = runWaitingEngine(players, { courtCount: 2 });

  assert.equal(result.playingPlayers.length, 8);
  assert.equal(result.waitingPlayers.length, 2);
});

test("runWaitingEngine returns waitingSnapshot before round update", () => {
  globalThis.localStorage = createLocalStorageMock({
    [getScopedStorageKey(WAITING_STORAGE_KEY)]: JSON.stringify({
      p1: { waitCount: 3, playCount: 1, lastWaitRound: 0, lastPlayRound: 0 },
      p2: { waitCount: 0, playCount: 2, lastWaitRound: 0, lastPlayRound: 0 },
    }),
  });

  const players = [
    { id: "p1", name: "P1", level: 3 },
    { id: "p2", name: "P2", level: 3 },
    { id: "p3", name: "P3", level: 3 },
    { id: "p4", name: "P4", level: 3 },
  ];

  const result = runWaitingEngine(players, { courtCount: 1 });

  assert.equal(result.waitingSnapshot.p1.waitCount, 3);
  assert.equal(result.waitingSnapshot.p2.waitCount, 0);
});
