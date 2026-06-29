import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEloUpdatesToPlayers,
  buildEloUpdatesFromMatchRecord,
  calculateEloDelta,
  expectedScore,
} from "../src/tournament/engines/eloEngine.js";

test("eloEngine expectedScore favors higher rating", () => {
  assert.ok(expectedScore(4, 3.5) > 0.5);
  assert.ok(expectedScore(3.5, 4) < 0.5);
});

test("eloEngine shifts ratings after match result", () => {
  const { deltaA, deltaB } = calculateEloDelta(4, 3.5, 11, 7, 32);
  assert.ok(deltaA > 0);
  assert.ok(deltaB < 0);
  assert.equal(Math.round((deltaA + deltaB) * 1000) / 1000, 0);
});

test("eloEngine updates ratingInternal without changing public level", () => {
  const record = {
    id: "m1",
    teamAPlayerIds: ["1", "2"],
    teamBPlayerIds: ["3", "4"],
    scoreA: 11,
    scoreB: 4,
  };
  const players = [
    { id: 1, name: "A1", level: 4, rating: 4, ratingInternal: 4 },
    { id: 2, name: "A2", level: 4, rating: 4, ratingInternal: 4 },
    { id: 3, name: "B1", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
    { id: 4, name: "B2", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
  ];

  const updates = buildEloUpdatesFromMatchRecord(record, players);
  assert.equal(updates.length, 4);

  const nextPlayers = applyEloUpdatesToPlayers(players, updates);
  const winner = nextPlayers.find((player) => player.id === 1);
  const loser = nextPlayers.find((player) => player.id === 3);

  assert.ok(winner.ratingInternal > 4);
  assert.ok(loser.ratingInternal < 3.5);
  assert.equal(winner.level, 4);
  assert.equal(winner.rating, 4);
  assert.equal(loser.level, 3.5);
  assert.ok(winner.skillMeta?.lastRatingInternalUpdateAt);
});

test("eloEngine falls back to level when ratingInternal is missing", () => {
  const record = {
    id: "m2",
    teamAPlayerIds: ["1"],
    teamBPlayerIds: ["2"],
    scoreA: 11,
    scoreB: 3,
  };
  const players = [
    { id: 1, name: "A", level: 3.5, rating: 3.5 },
    { id: 2, name: "B", level: 3.5, rating: 3.5 },
  ];

  const updates = buildEloUpdatesFromMatchRecord(record, players);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].previousRating, 3.5);
});
