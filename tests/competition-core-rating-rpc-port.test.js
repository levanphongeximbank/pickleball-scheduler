import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCompetitionEloFromMatchRecord,
  shouldPreferDatabaseRating,
  finalizeDatabaseRatingApply,
} from "../src/features/competition-core/rating/index.js";
import { loadClubData, saveClubData } from "../src/domain/clubStorage.js";

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

test.before(() => {
  globalThis.localStorage = createLocalStorageMock();
});

const players = [
  { id: 1, name: "A1", skillLevel: 4, current_rating: 4, competitionElo: 1700, competitionMatchCount: 5 },
  { id: 2, name: "A2", skillLevel: 4, current_rating: 4, competitionElo: 1700, competitionMatchCount: 5 },
  { id: 3, name: "B1", skillLevel: 3.5, current_rating: 3.5, competitionElo: 1500, competitionMatchCount: 5 },
  { id: 4, name: "B2", skillLevel: 3.5, current_rating: 3.5, competitionElo: 1500, competitionMatchCount: 5 },
];

const record = {
  id: "m-rpc-1",
  teamAPlayerIds: ["1", "2"],
  teamBPlayerIds: ["3", "4"],
  scoreA: 11,
  scoreB: 4,
  status: "completed",
};

const v2Env = {
  VITE_COMPETITION_CORE_ENABLED: "true",
  VITE_COMPETITION_CORE_RATING_V2_ENABLED: "true",
};

test("shouldPreferDatabaseRating true when v2 flags on", () => {
  assert.equal(shouldPreferDatabaseRating({ envSource: v2Env }), true);
  assert.equal(shouldPreferDatabaseRating({ envSource: v2Env, ratingApplyBackend: "blob" }), false);
});

test("applyCompetitionEloFromMatchRecord uses injected database backend", () => {
  const clubId = "cc02d-rpc-port";
  saveClubData(clubId, {
    players: JSON.parse(JSON.stringify(players)),
    tournaments: [],
    updatedAt: new Date().toISOString(),
  });

  let calls = 0;
  const result = applyCompetitionEloFromMatchRecord(clubId, record, {
    envSource: v2Env,
    ratingApplyBackend: "database",
    applyDatabaseRating: () => {
      calls += 1;
      return {
        ok: true,
        skipped: false,
        backend: "database",
        updates: [{ playerId: "1", previousRating: 1700, nextRating: 1710 }],
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.backend, "database");
  assert.equal(result.idempotency, "rating_applications");
});

test("database failure falls back to blob when allowed", () => {
  const clubId = "cc02d-rpc-fallback";
  saveClubData(clubId, {
    players: JSON.parse(JSON.stringify(players)),
    tournaments: [],
    updatedAt: new Date().toISOString(),
  });

  const result = applyCompetitionEloFromMatchRecord(clubId, record, {
    envSource: v2Env,
    ratingApplyBackend: "database",
    applyDatabaseRating: () => ({ ok: false, error: "rpc-unavailable" }),
  });

  assert.equal(result.skipped, false);
  assert.equal(result.idempotency, "ratingV2Applications");

  const data = loadClubData(clubId);
  assert.equal(data.ratingV2Applications?.length, 4);
});

test("finalizeDatabaseRatingApply returns error when fallback disabled", () => {
  const result = finalizeDatabaseRatingApply(
    "club",
    record,
    [],
    { ok: false, error: "rpc-failed" },
    { fallbackBlobOnRpcFailure: false }
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /rpc-failed/);
});
