import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_COMPETITION_ELO,
  mapCompetitionEloToSkill,
  mapSkillToCompetitionElo,
  detectRatingStorageScale,
} from "../src/features/competition-core/rating/index.js";

test("mapSkillToCompetitionElo anchors 3.5 skill to 1500 elo", () => {
  assert.equal(mapSkillToCompetitionElo(3.5), DEFAULT_COMPETITION_ELO);
  assert.equal(mapSkillToCompetitionElo(4.0), 1700);
  assert.equal(mapSkillToCompetitionElo(3.0), 1300);
});

test("mapCompetitionEloToSkill inverts anchor mapping", () => {
  const mapped = mapCompetitionEloToSkill(1500);
  assert.equal(mapped.estimatedSkillLevel, 3.5);
  assert.equal(mapped.mappingVersion, "v1");
});

test("mapCompetitionEloToSkill clamps to skill bounds", () => {
  const low = mapCompetitionEloToSkill(100, { minLevel: 1.0, maxLevel: 8.0 });
  const high = mapCompetitionEloToSkill(5000, { minLevel: 1.0, maxLevel: 8.0 });
  assert.equal(low.estimatedSkillLevel, 1.0);
  assert.equal(high.estimatedSkillLevel, 8.0);
});

test("mapCompetitionEloToSkill normalizes confidence 0-1 and 0-100", () => {
  assert.equal(mapCompetitionEloToSkill(1500, { confidence: 0.72 }).confidence, 72);
  assert.equal(mapCompetitionEloToSkill(1500, { confidence: 85 }).confidence, 85);
});

test("detectRatingStorageScale distinguishes skill vs competition elo", () => {
  assert.equal(detectRatingStorageScale(3.5), "skill");
  assert.equal(detectRatingStorageScale(1500), "competition_elo");
});
