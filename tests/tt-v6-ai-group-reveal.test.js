/**
 * AI group reveal session — frozen teams → engine once → groupCards for reveal.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { buildAiGroupRevealSession } from "../src/features/team-tournament/showcase/buildAiGroupRevealSession.js";
import {
  buildShowcaseGroupRevealSteps,
  assertGroupRevealParity,
  selectRevealedGroupState,
} from "../src/features/team-tournament/showcase/showcaseRevealSteps.js";
import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";

function makePlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Athlete ${i + 1}`,
    gender: i % 2 === 0 ? "Nam" : "Nữ",
    rating: 3 + (i % 5) * 0.1,
  }));
}

function makeTeams(count, size = 4) {
  return Array.from({ length: count }, (_, t) => {
    const start = t * size;
    return {
      id: `t${t + 1}`,
      name: `Đội ${t + 1}`,
      seed: t + 1,
      playerIds: Array.from({ length: size }, (_, i) => `p${start + i + 1}`),
      avgLevel: 3.5,
    };
  });
}

test("AI group reveal builds A/B groupCards without re-pairing teams", () => {
  const players = makePlayers(16);
  const teams = makeTeams(4);
  const built = buildAiGroupRevealSession({
    teams,
    players,
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    randomFn: () => 0.42,
  });
  assert.equal(built.ok, true);
  assert.equal(built.groupCount, 2);
  assert.equal(built.session.groupSession.groupCards.length, 2);
  assert.match(built.session.groupSession.groupCards[0].name, /^Bảng A$/);
  assert.match(built.session.groupSession.groupCards[1].name, /^Bảng B$/);
  assert.equal(built.teamData.groups.length, 2);
  assert.equal(built.session.teamCards.length, 4);
});

test("AI group reveal steps place teams into groups without duplicates", () => {
  const players = makePlayers(32);
  const teams = makeTeams(8);
  const built = buildAiGroupRevealSession({
    teams,
    players,
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
    randomFn: () => 0.17,
  });
  assert.equal(built.ok, true);
  const steps = buildShowcaseGroupRevealSteps(built.session);
  assert.equal(steps.ok, true);
  assert.equal(assertGroupRevealParity(built.session, steps), true);

  const midway = selectRevealedGroupState(steps, 2);
  assert.equal(midway.revealedCount, 2);
  assert.ok(midway.groups.length >= 1);
});

test("AI group reveal rejects empty teams", () => {
  const built = buildAiGroupRevealSession({ teams: [], players: [] });
  assert.equal(built.ok, false);
});
