import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRatingSnapshotFromPlayer,
  createRatingSnapshot,
  mapCompetitionEloToSkill,
} from "../src/features/competition-core/index.js";

test("createRatingSnapshot factory returns empty defaults", () => {
  const snapshot = createRatingSnapshot();
  assert.equal(snapshot.publicSkillLevel, null);
  assert.equal(snapshot.competitionElo, null);
  assert.equal(snapshot.dailyPlayRating, null);
});

test("buildRatingSnapshotFromPlayer separates public skill and competition Elo", () => {
  const player = {
    id: "p1",
    current_rating: 3.5,
    skillLevel: 3.5,
    ratingInternal: 4.0,
    rating_confidence: 0.75,
    rating_status: "self_declared",
  };

  const snapshot = buildRatingSnapshotFromPlayer(player);
  assert.equal(snapshot.publicSkillLevel, 3.5);
  assert.ok(snapshot.competitionElo > 1500);
  assert.equal(snapshot.ratingConfidence, 75);
  assert.notEqual(snapshot.competitionElo, snapshot.publicSkillLevel);
});

test("buildRatingSnapshotFromPlayer uses stored competitionElo when present", () => {
  const player = {
    id: "p2",
    current_rating: 4.0,
    competitionElo: 1625,
    rating_confidence: 80,
  };

  const snapshot = buildRatingSnapshotFromPlayer(player);
  assert.equal(snapshot.competitionElo, 1625);
  assert.equal(mapCompetitionEloToSkill(1625).estimatedSkillLevel, 3.81);
});

test("importing rating foundation has no localStorage side effects", () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      throw new Error("localStorage should not be accessed");
    },
    setItem() {
      throw new Error("localStorage should not be accessed");
    },
  };

  assert.doesNotThrow(() => {
    void buildRatingSnapshotFromPlayer({ id: "x", current_rating: 3.5 });
  });

  globalThis.localStorage = original;
});
