import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runAI } from "../src/ai/engine.js";
import { loadAIData } from "../src/ai/storage.js";
import { formatDebugTrace } from "../src/ai/debugPanel.js";

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

function createPlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    level: 3 + (index % 3) * 0.5,
    gender: index % 2 === 0 ? "Nam" : "Nữ",
  }));
}

function createCourts(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Sân ${index + 1}`,
    number: index + 1,
    active: true,
  }));
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
});

test("runAI returns validation errors and debug trace when input is invalid", () => {
  const result = runAI([], {
    enabledCourts: createCourts(1),
    persist: false,
  });

  assert.equal(result.courts.length, 0);
  assert.ok(Array.isArray(result.errors));
  assert.ok(result.errors.length > 0);
  assert.ok(result.debugTrace.some((entry) => entry.step === "input.validate"));
  assert.equal(result.debugTrace.find((entry) => entry.step === "input.validate")?.details.ok, false);
});

test("runAI schedules players on courts with full debug trace in preview mode", () => {
  const players = createPlayers(8);
  const courts = createCourts(2);

  const result = runAI(players, {
    enabledCourts: courts,
    persist: false,
    topCandidates: 2,
  });

  assert.equal(result.courts.length, 2);
  assert.equal(result.waiting.length, 0);
  assert.ok(result.aiScore.total > 0);
  assert.equal(result.persisted, false);

  const steps = result.debugTrace.map((entry) => entry.step);
  assert.deepEqual(steps, [
    "run.start",
    "input.normalize",
    "input.validate",
    "director.lock",
    "waiting.select",
    "balance.assign",
    "pairing.score",
    "history.apply",
    "result.finalize",
  ]);

  assert.ok(formatDebugTrace(result.debugTrace).length >= 9);
});

test("runAI dry run does not persist session or history", () => {
  const players = createPlayers(8);
  const courts = createCourts(2);

  runAI(players, {
    enabledCourts: courts,
    persist: false,
  });

  const aiData = loadAIData();
  assert.equal(aiData.sessions.length, 0);
  assert.equal(Object.keys(aiData.history || {}).length, 0);
});

test("runAI persist mode saves session", () => {
  const players = createPlayers(8);
  const courts = createCourts(2);

  const result = runAI(players, {
    enabledCourts: courts,
    persist: true,
  });

  assert.equal(result.persisted, true);
  assert.ok(result.debugTrace.some((entry) => entry.step === "persist.commit"));

  const aiData = loadAIData();
  assert.equal(aiData.sessions.length, 1);
  assert.ok(Object.keys(aiData.history || {}).length > 0);
});

test("runAI keeps locked court assignment from current result", () => {
  const players = createPlayers(8);
  const courts = createCourts(2);
  const lockedCourt = {
    court: 1,
    courtName: "Sân 1",
    teamA: [players[0], players[1]],
    teamB: [players[2], players[3]],
    teamATotal: 7,
    teamBTotal: 7,
    diff: 0,
    score: 90,
  };

  const result = runAI(players, {
    enabledCourts: courts,
    lockedCourts: [1],
    currentResult: { courts: [lockedCourt] },
    persist: false,
  });

  const courtOne = result.courts.find((court) => court.court === 1);
  assert.ok(courtOne);
  assert.equal(courtOne.teamA.length, 2);
  assert.equal(courtOne.teamB.length, 2);
  assert.equal(courtOne.teamA[0].id, "p1");
});

test("runAI puts overflow players into waiting when court capacity is insufficient", () => {
  const players = createPlayers(10);
  const courts = createCourts(2);

  const result = runAI(players, {
    enabledCourts: courts,
    persist: false,
  });

  assert.equal(result.courts.length, 2);
  assert.ok(result.waiting.length >= 2);
});
