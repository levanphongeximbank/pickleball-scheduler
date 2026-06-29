import test from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.sessionStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
};

const {
  isScoreDraftScopeValid,
  loadScoreDrafts,
  saveScoreDrafts,
} = await import("../src/tournament/scoreDraftStorage.js");

const scope = {
  clubId: "club-1",
  tournamentId: "tour-1",
  eventId: "event-1",
};

test("scoreDraftStorage validates draft scope", () => {
  assert.equal(isScoreDraftScopeValid(scope), true);
  assert.equal(isScoreDraftScopeValid({ tournamentId: "tour-1" }), false);
});

test("scoreDraftStorage persists and reloads draft scores", () => {
  memory.clear();
  saveScoreDrafts(scope, {
    "match-1": { scoreA: "11", scoreB: "7" },
  });

  assert.deepEqual(loadScoreDrafts(scope), {
    "match-1": { scoreA: "11", scoreB: "7" },
  });
});

test("scoreDraftStorage clears storage when drafts are empty", () => {
  memory.clear();
  saveScoreDrafts(scope, { "match-1": { scoreA: "11", scoreB: "7" } });
  saveScoreDrafts(scope, {});

  assert.deepEqual(loadScoreDrafts(scope), {});
});
