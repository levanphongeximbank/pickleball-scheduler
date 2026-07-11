import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCompetitionEloUpdatesToPlayers,
  buildCompetitionEloUpdatesFromMatchRecord,
  assessMonthlyPublicLevelV2,
  createMonthlyReviewV2Proposal,
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

const record = {
  id: "m-v2-1",
  teamAPlayerIds: ["1", "2"],
  teamBPlayerIds: ["3", "4"],
  scoreA: 11,
  scoreB: 4,
  status: "completed",
};

const players = [
  { id: 1, name: "A1", skillLevel: 4, current_rating: 4, competitionElo: 1700, competitionMatchCount: 5 },
  { id: 2, name: "A2", skillLevel: 4, current_rating: 4, competitionElo: 1700, competitionMatchCount: 5 },
  { id: 3, name: "B1", skillLevel: 3.5, current_rating: 3.5, competitionElo: 1500, competitionMatchCount: 5 },
  { id: 4, name: "B2", skillLevel: 3.5, current_rating: 3.5, competitionElo: 1500, competitionMatchCount: 5 },
];

test("buildCompetitionEloUpdatesFromMatchRecord produces winner/loser deltas on Elo scale", () => {
  const updates = buildCompetitionEloUpdatesFromMatchRecord(record, players);
  assert.equal(updates.length, 4);

  const winner = updates.find((item) => item.playerId === "1");
  const loser = updates.find((item) => item.playerId === "3");
  assert.ok(winner.nextRating > winner.previousRating);
  assert.ok(loser.nextRating < loser.previousRating);
  assert.equal(winner.kFactor, 40);
});

test("applyCompetitionEloUpdatesToPlayers does not mutate public skill", () => {
  const updates = buildCompetitionEloUpdatesFromMatchRecord(record, players);
  const next = applyCompetitionEloUpdatesToPlayers(players, updates);
  const winner = next.find((player) => player.id === 1);

  assert.equal(winner.skillLevel, 4);
  assert.equal(winner.current_rating, 4);
  assert.ok(winner.competitionElo > 1700);
  assert.equal(winner.competitionMatchCount, 6);
});

test("applyEloFromMatchRecord uses legacy path when rating v2 flag off", () => {
  const clubId = "cc02-legacy-club";
  saveClubData(clubId, {
    players: JSON.parse(JSON.stringify(players)),
    tournaments: [],
    updatedAt: new Date().toISOString(),
  });

  applyEloFromMatchRecord(clubId, record, { envSource: {} });
  const data = loadClubData(clubId);
  const winner = data.players.find((player) => String(player.id) === "1");

  assert.ok(winner.skillLevel > 4);
  assert.ok(winner.ratingInternal > 4);
});

test("applyEloFromMatchRecord uses v2 path when rating v2 flag on", () => {
  const clubId = "cc02-v2-club";
  saveClubData(clubId, {
    players: JSON.parse(JSON.stringify(players)),
    tournaments: [],
    updatedAt: new Date().toISOString(),
  });

  applyEloFromMatchRecord(clubId, record, {
    envSource: {
      VITE_COMPETITION_CORE_ENABLED: "true",
      VITE_COMPETITION_CORE_RATING_V2_ENABLED: "true",
    },
  });

  const data = loadClubData(clubId);
  const winner = data.players.find((player) => String(player.id) === "1");

  assert.equal(winner.skillLevel, 4);
  assert.equal(winner.current_rating, 4);
  assert.ok(winner.competitionElo > 1700);
});

test("monthly review v2 creates proposal without auto public update", () => {
  const player = {
    id: "p1",
    name: "Test",
    current_rating: 3.5,
    skillLevel: 3.5,
    competitionElo: 1900,
    competitionMatchCount: 12,
    rating_confidence: 0.8,
    skillMeta: {},
  };

  const assessment = assessMonthlyPublicLevelV2(
    player,
    {},
    new Date("2026-08-01"),
    { force: true, skipGates: true }
  );
  assert.ok(assessment.estimatedSkillLevel > 3.5);

  const proposal = createMonthlyReviewV2Proposal(assessment);
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.competitionElo, 1900);
});

test("monthly review v2 skips when gates not met", () => {
  const player = {
    id: "p2",
    name: "Low",
    current_rating: 3.5,
    competitionElo: 1500,
    competitionMatchCount: 2,
    rating_confidence: 0.2,
    skillMeta: {},
  };

  const assessment = assessMonthlyPublicLevelV2(
    player,
    {},
    new Date("2026-08-01"),
    { force: true }
  );

  assert.equal(assessment.skipped, true);
  assert.ok(Array.isArray(assessment.skipReasons));
});
