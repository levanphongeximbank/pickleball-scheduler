import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGroupStandingFromSessions,
  buildGroupStandingsForRounds,
} from "../src/pages/tournament.standings.logic.js";

function createPlayer(id, name) {
  return { id, name };
}

function createCourt(courtId, teamA, teamB) {
  return {
    court: courtId,
    teamA,
    teamB,
  };
}

test("buildGroupStandingFromSessions computes points and ranking for a group", () => {
  const rounds = [{ id: 101, name: "Vong bang A", groupLabel: "A" }];

  const sessions = [
    {
      meta: { roundId: 101 },
      courts: [
        createCourt(
          1,
          [createPlayer("p1", "A1"), createPlayer("p2", "A2")],
          [createPlayer("p3", "A3"), createPlayer("p4", "A4")]
        ),
      ],
      result: {
        status: "completed",
        courts: [{ courtId: 1, teamAScore: 11, teamBScore: 7 }],
      },
    },
    {
      meta: { roundId: 101 },
      courts: [
        createCourt(
          2,
          [createPlayer("p1", "A1"), createPlayer("p2", "A2")],
          [createPlayer("p5", "A5"), createPlayer("p6", "A6")]
        ),
      ],
      result: {
        status: "completed",
        courts: [{ courtId: 2, teamAScore: 8, teamBScore: 11 }],
      },
    },
  ];

  const standing = buildGroupStandingFromSessions(sessions, rounds[0]);

  assert.equal(standing.group, "A");
  assert.equal(standing.matchCount, 2);
  assert.equal(standing.standing.length, 3);

  const topTeam = standing.standing[0];
  assert.equal(topTeam.name, "A5 / A6");
  assert.equal(topTeam.matchPoints, 3);
  assert.equal(topTeam.scoreDiff, 3);

  const secondTeam = standing.standing[1];
  assert.equal(secondTeam.name, "A1 / A2");
  assert.equal(secondTeam.matchPoints, 3);
  assert.equal(secondTeam.scoreDiff, 1);

  assert.equal(standing.standing[2].name, "A3 / A4");
  assert.equal(standing.standing[2].matchPoints, 0);
});

test("buildGroupStandingsForRounds only keeps rounds with completed results and top qualifiers", () => {
  const rounds = [
    { id: 201, name: "Vong bang B", groupLabel: "B" },
    { id: 202, name: "Vong bang C", groupLabel: "C" },
  ];

  const sessions = [
    {
      meta: { roundId: 201 },
      courts: [
        createCourt(
          1,
          [createPlayer("b1", "B1"), createPlayer("b2", "B2")],
          [createPlayer("b3", "B3"), createPlayer("b4", "B4")]
        ),
      ],
      result: {
        status: "completed",
        courts: [{ courtId: 1, teamAScore: 11, teamBScore: 6 }],
      },
    },
    {
      meta: { roundId: 202 },
      courts: [
        createCourt(
          1,
          [createPlayer("c1", "C1"), createPlayer("c2", "C2")],
          [createPlayer("c3", "C3"), createPlayer("c4", "C4")]
        ),
      ],
      result: {
        status: "pending",
        courts: [{ courtId: 1, teamAScore: 11, teamBScore: 6 }],
      },
    },
  ];

  const standings = buildGroupStandingsForRounds(sessions, rounds, { qualifiersPerGroup: 2 });

  assert.equal(standings.length, 1);
  assert.equal(standings[0].group, "B");
  assert.equal(standings[0].qualified.length, 2);
  assert.equal(standings[0].qualified[0].name, "B1 / B2");
});
