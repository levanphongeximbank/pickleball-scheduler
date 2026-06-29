import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSeededGroups,
  createTeamsFromPlayers,
  seedTeamsIntoGroups,
} from "../src/pages/tournament.seeding.logic.js";

function createPlayer(id, level) {
  return {
    id,
    name: `P${id}`,
    level,
  };
}

test("createTeamsFromPlayers builds balanced pairs in skill_controlled mode", () => {
  const players = [
    createPlayer(1, 5.0),
    createPlayer(2, 4.5),
    createPlayer(3, 4.0),
    createPlayer(4, 3.5),
    createPlayer(5, 3.0),
    createPlayer(6, 2.5),
  ];

  const teams = createTeamsFromPlayers(players, { mode: "skill_controlled" });

  assert.equal(teams.length, 3);
  assert.equal(teams[0].members[0].id, 1);
  assert.equal(teams[0].members[1].id, 6);
  assert.equal(teams[1].members[0].id, 2);
  assert.equal(teams[1].members[1].id, 5);
});

test("seedTeamsIntoGroups uses snake seeding for skill_controlled mode", () => {
  const teams = Array.from({ length: 8 }, (_, index) => ({
    id: `T${index + 1}`,
    name: `T${index + 1}`,
    avgLevel: 10 - index,
  }));

  const groups = seedTeamsIntoGroups(teams, 4, { mode: "skill_controlled" });

  assert.equal(groups[0].teams[0].id, "T1");
  assert.equal(groups[1].teams[0].id, "T2");
  assert.equal(groups[2].teams[0].id, "T3");
  assert.equal(groups[3].teams[0].id, "T4");

  assert.equal(groups[3].teams[1].id, "T5");
  assert.equal(groups[2].teams[1].id, "T6");
  assert.equal(groups[1].teams[1].id, "T7");
  assert.equal(groups[0].teams[1].id, "T8");
});

test("buildSeededGroups creates open groups with expected team count", () => {
  const players = Array.from({ length: 16 }, (_, index) => createPlayer(index + 1, 2 + index * 0.1));

  const seeded = buildSeededGroups(players, {
    mode: "open",
    groupCount: 4,
    teamSize: 2,
    randomFn: () => 0,
  });

  assert.equal(seeded.teams.length, 8);
  assert.equal(seeded.groups.length, 4);
  assert.equal(seeded.groups[0].teams.length, 2);
  assert.equal(seeded.groups[1].teams.length, 2);
  assert.equal(seeded.groups[2].teams.length, 2);
  assert.equal(seeded.groups[3].teams.length, 2);
});
