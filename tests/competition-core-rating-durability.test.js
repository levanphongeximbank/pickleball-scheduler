import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCompetitionEloAtomically,
  isMatchRatingEligible,
  InMemoryRatingIdempotencyStore,
  buildRatingApplicationEntries,
} from "../src/features/competition-core/rating/index.js";
import { applyEloFromMatchRecord } from "../src/domain/eloService.js";
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
  id: "m-dur-1",
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

function seedClub(clubId) {
  saveClubData(clubId, {
    players: JSON.parse(JSON.stringify(players)),
    tournaments: [],
    updatedAt: new Date().toISOString(),
  });
}

test("1 — same match twice after new service path reload remains idempotent", () => {
  const clubId = "cc02c-idempotent-restart";
  seedClub(clubId);

  const first = applyCompetitionEloAtomically(clubId, record);
  assert.equal(first.skipped, false);

  const second = applyCompetitionEloAtomically(clubId, record);
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "already-applied");

  const data = loadClubData(clubId);
  assert.equal(data.ratingV2Applications?.length, 4);
});

test("2 — concurrent in-memory idempotency store rejects duplicate registration", async () => {
  const store = new InMemoryRatingIdempotencyStore();
  const entries = buildRatingApplicationEntries(
    [
      { playerId: "1", previousRating: 1500, nextRating: 1510 },
      { playerId: "3", previousRating: 1500, nextRating: 1490 },
    ],
    "m-concurrent"
  );

  const [first, second] = await Promise.all([
    store.registerAll(entries),
    store.registerAll(entries),
  ]);

  const applied = [first, second].filter((result) => result.ok && !result.skipped).length;
  const idempotent = [first, second].filter((result) => result.ok && result.skipped).length;
  assert.equal(applied, 1);
  assert.equal(idempotent, 1);
});

test("3 — simulated failure on second player leaves first player unchanged on disk", () => {
  const clubId = "cc02c-rollback-player";
  seedClub(clubId);

  const result = applyCompetitionEloAtomically(clubId, record, {
    simulateFailAfterPlayerIndex: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);

  const data = loadClubData(clubId);
  const player1 = data.players.find((player) => String(player.id) === "1");
  assert.equal(player1.competitionElo, 1700);
  assert.equal(data.ratingV2Applications?.length ?? 0, 0);
});

test("4 — simulated history failure leaves ratings unchanged", () => {
  const clubId = "cc02c-rollback-history";
  seedClub(clubId);

  const result = applyCompetitionEloAtomically(clubId, record, {
    simulateHistoryFailure: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.rolledBack, true);

  const data = loadClubData(clubId);
  const player1 = data.players.find((player) => String(player.id) === "1");
  assert.equal(player1.competitionElo, 1700);
  assert.equal(data.ratingV2History?.length ?? 0, 0);
});

test("5 — FORFEIT with scores but no subtype requires review", () => {
  const result = isMatchRatingEligible({
    ...record,
    status: "forfeit",
    scoreA: 11,
    scoreB: 0,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.status, "requires_review");
  assert.equal(result.reason, "forfeit_legacy");
});

test("6 — BYE does not update competition Elo", () => {
  const clubId = "cc02c-bye";
  seedClub(clubId);

  const result = applyCompetitionEloAtomically(clubId, { ...record, isBye: true });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "bye");
});

test("7 — public skill unchanged under V2 apply", () => {
  const clubId = "cc02c-public-skill";
  seedClub(clubId);

  applyCompetitionEloAtomically(clubId, record);
  const data = loadClubData(clubId);
  const winner = data.players.find((player) => String(player.id) === "1");

  assert.equal(winner.skillLevel, 4);
  assert.equal(winner.current_rating, 4);
  assert.ok(winner.competitionElo > 1700);
});

test("8 — Daily Play does not update Competition Elo", () => {
  const clubId = "cc02c-daily";
  seedClub(clubId);

  const result = applyCompetitionEloAtomically(clubId, {
    ...record,
    source: "daily_play",
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "daily_play");
});

test("9 — feature flag OFF keeps legacy behavior", () => {
  const clubId = "cc02c-flag-off";
  seedClub(clubId);

  applyEloFromMatchRecord(clubId, record, { envSource: {} });
  const data = loadClubData(clubId);
  const winner = data.players.find((player) => String(player.id) === "1");

  assert.ok(winner.skillLevel > 4);
  assert.ok(winner.ratingInternal > 4);
  assert.equal(data.ratingV2Applications?.length ?? 0, 0);
});

test("10 — feature flag ON uses durable per-player application markers", () => {
  const clubId = "cc02c-flag-on-db-idempotency";
  seedClub(clubId);

  applyEloFromMatchRecord(clubId, record, { envSource: v2Env });
  const data = loadClubData(clubId);

  assert.equal(data.ratingV2Applications?.length, 4);
  assert.ok(
    data.ratingV2Applications.every(
      (entry) => entry.matchId === record.id && entry.ratingType === "competition_elo"
    )
  );
});
