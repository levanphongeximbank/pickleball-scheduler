import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { commitScheduleResult } from "../src/ai/persist.js";
import { loadAIData } from "../src/ai/storage.js";
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

test("commitScheduleResult saves session, waiting, and history", () => {
  const result = {
    courts: [
      {
        court: 1,
        teamA: [{ id: "p1", level: 3 }, { id: "p2", level: 3 }],
        teamB: [{ id: "p3", level: 3 }, { id: "p4", level: 3 }],
      },
    ],
    waiting: [{ id: "p5", level: 3 }],
    aiScore: { total: 80 },
  };

  const commit = commitScheduleResult(result, { competitionType: "open" });

  assert.equal(commit.ok, true);
  assert.equal(loadAIData().sessions.length, 1);

  const waitingRaw = globalThis.localStorage.getItem(getScopedStorageKey(WAITING_STORAGE_KEY));
  const waitingData = JSON.parse(waitingRaw);
  assert.equal(waitingData.p1.playCount, 1);
  assert.equal(waitingData.p5.waitCount, 1);

  const aiData = loadAIData();
  assert.equal(aiData.history.p1.games, 1);
  assert.equal(aiData.history.p1.partners.p2, 1);
});

test("commitScheduleResult rejects empty result", () => {
  const commit = commitScheduleResult(null);
  assert.equal(commit.ok, false);
});
