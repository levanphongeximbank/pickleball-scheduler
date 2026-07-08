import test from "node:test";
import assert from "node:assert/strict";

import { normalizePlayer } from "../src/models/player.js";
import {
  applyApprovedPublicLevel,
  assessMonthlyPublicLevel,
  createSkillLevelProposal,
  isMonthlyReviewDue,
  computeNextPublicLevel,
} from "../src/tournament/engines/skillLevelEngine.js";
import { applyEloUpdatesToPlayers, buildEloUpdatesFromMatchRecord } from "../src/tournament/engines/eloEngine.js";

test("normalizePlayer keeps public level and initializes ratingInternal fallback", () => {
  const player = normalizePlayer({
    id: 1,
    name: "An",
    gender: "Nam",
    level: 3.5,
  });

  assert.equal(player.level, 3.5);
  assert.equal(player.rating, 3.5);
  assert.equal(player.ratingInternal, 3.5);
});

test("isMonthlyReviewDue is true for new month", () => {
  assert.equal(
    isMonthlyReviewDue({ lastPublicLevelReviewAt: "2026-05-15T00:00:00.000Z" }, new Date("2026-06-01")),
    true
  );
  assert.equal(
    isMonthlyReviewDue({ lastPublicLevelReviewAt: "2026-06-02T00:00:00.000Z" }, new Date("2026-06-15")),
    false
  );
});

test("computeNextPublicLevel promotes when internal rating is high enough", () => {
  const result = computeNextPublicLevel(3.5, 3.9, {
    step: 0.5,
    promoteThreshold: 0.35,
    demoteThreshold: 0.35,
  });

  assert.equal(result.changed, true);
  assert.equal(result.nextLevel, 4);
});

test("assessment does not include applied public level", () => {
  const player = {
    id: 9,
    name: "Chi",
    level: 3.5,
    rating: 3.5,
    current_rating: 3.5,
    rating_match_count: 5,
    ratingInternal: 4.1,
  };

  const assessment = assessMonthlyPublicLevel(
    player,
    { enabled: true, promoteThreshold: 0.35, demoteThreshold: 0.35 },
    new Date("2026-06-01T10:00:00.000Z")
  );

  assert.equal(assessment.changed, true);
  assert.equal(assessment.nextLevel, 4);
  assert.equal(player.level, 3.5);
});

test("proposal record is created without changing player level", () => {
  const assessment = {
    playerId: "9",
    playerName: "Chi",
    previousLevel: 3.5,
    nextLevel: 4,
    ratingInternal: 4.1,
    changed: true,
    direction: "up",
    reviewMonth: "2026-06",
  };

  const proposal = createSkillLevelProposal(assessment, new Date("2026-06-01T10:00:00.000Z"));
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.proposedLevel, 4);
});

test("approve path updates only public level", () => {
  const player = {
    id: 9,
    name: "Chi",
    level: 3.5,
    rating: 3.5,
    ratingInternal: 4.1,
  };
  const assessment = {
    playerId: "9",
    previousLevel: 3.5,
    nextLevel: 4,
    ratingInternal: 4.1,
    changed: true,
    direction: "up",
    reviewMonth: "2026-06",
  };

  const next = applyApprovedPublicLevel(player, assessment, new Date("2026-06-02T10:00:00.000Z"));
  assert.equal(next.level, 4);
  assert.equal(next.rating, 4);
  assert.equal(next.ratingInternal, 4.1);
});

test("elo after match updates skillLevel mirrors", () => {
  const record = {
    id: "m1",
    teamAPlayerIds: ["1"],
    teamBPlayerIds: ["2"],
    scoreA: 11,
    scoreB: 4,
  };
  const players = [
    { id: 1, name: "A", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
    { id: 2, name: "B", level: 3.5, rating: 3.5, ratingInternal: 3.5 },
  ];

  const updates = buildEloUpdatesFromMatchRecord(record, players);
  const nextPlayers = applyEloUpdatesToPlayers(players, updates);
  const winner = nextPlayers.find((item) => item.id === 1);

  assert.ok(winner.skillLevel > 3.5);
  assert.equal(winner.level, winner.skillLevel);
  assert.equal(winner.rating, winner.skillLevel);
});
