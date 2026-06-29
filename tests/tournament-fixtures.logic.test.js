import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRoundRobinRounds,
  buildSeededGroupSessions,
} from "../src/pages/tournament.fixtures.logic.js";

function createTeam(id) {
  return {
    id: `T${id}`,
    name: `Team ${id}`,
    members: [
      { id: `P${id}A`, name: `P${id}A` },
      { id: `P${id}B`, name: `P${id}B` },
    ],
  };
}

test("buildRoundRobinRounds creates 3 rounds for 4 teams", () => {
  const rounds = buildRoundRobinRounds([
    createTeam(1),
    createTeam(2),
    createTeam(3),
    createTeam(4),
  ]);

  assert.equal(rounds.length, 3);
  assert.equal(rounds[0].matches.length, 2);
  assert.equal(rounds[1].matches.length, 2);
  assert.equal(rounds[2].matches.length, 2);
});

test("buildSeededGroupSessions creates sessions with round meta", () => {
  const sessions = buildSeededGroupSessions([
    {
      id: 1001,
      name: "Vong bang A",
      groupLabel: "A",
      seededTeams: [createTeam(1), createTeam(2), createTeam(3), createTeam(4)],
    },
  ], {
    startAt: 9000,
    baseDate: Date.UTC(2026, 0, 1, 12, 0, 0),
  });

  assert.equal(sessions.length, 3);
  assert.equal(sessions[0].meta.roundId, 1001);
  assert.equal(sessions[0].meta.groupLabel, "A");
  assert.equal(sessions[0].meta.generatedFromSeed, true);
  assert.equal(sessions[0].courts.length, 2);
  assert.equal(sessions[0].courts[0].teamA.length, 2);
  assert.equal(sessions[0].courts[0].teamB.length, 2);
});

test("buildSeededGroupSessions uses courts from court manager", () => {
  const sessions = buildSeededGroupSessions([
    {
      id: 1001,
      name: "Vong bang A",
      groupLabel: "A",
      seededTeams: [createTeam(1), createTeam(2), createTeam(3), createTeam(4)],
    },
  ], {
    startAt: 9000,
    baseDate: Date.UTC(2026, 0, 1, 12, 0, 0),
    courts: [
      { id: 11, name: "Sân VIP", number: null, active: true },
      { id: 12, name: "Sân 2", number: 2, active: true },
    ],
  });

  assert.equal(sessions.length, 3);
  assert.equal(sessions[0].courts[0].court, 11);
  assert.equal(sessions[0].courts[0].courtName, "Sân VIP");
  assert.equal(sessions[0].courts[1].court, 12);
  assert.equal(sessions[0].courts[1].courtName, "Sân 2");
  assert.deepEqual(sessions[0].meta.courtIds, [11, 12]);
});

test("buildSeededGroupSessions splits matches when fewer courts than matches", () => {
  const sessions = buildSeededGroupSessions([
    {
      id: 1001,
      name: "Vong bang A",
      groupLabel: "A",
      seededTeams: [createTeam(1), createTeam(2), createTeam(3), createTeam(4)],
    },
  ], {
    startAt: 9000,
    baseDate: Date.UTC(2026, 0, 1, 12, 0, 0),
    courts: [{ id: 1, name: "Sân 1", number: 1, active: true }],
  });

  assert.equal(sessions.length, 6);
  assert.equal(sessions[0].courts.length, 1);
  assert.equal(sessions[1].courts.length, 1);
  assert.match(sessions[0].meta.shiftLabel, /Lượt 1 - Phiên 1/);
  assert.match(sessions[1].meta.shiftLabel, /Lượt 1 - Phiên 2/);
});
