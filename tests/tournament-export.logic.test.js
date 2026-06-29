import test from "node:test";
import assert from "node:assert/strict";

import { buildTournamentResultExport } from "../src/pages/tournament.export.logic.js";

test("buildTournamentResultExport builds tournament snapshot with champion and standings", () => {
  const payload = buildTournamentResultExport({
    rounds: [
      { id: 1, name: "Vong bang A", groupLabel: "A", seededTeams: [{ id: "t1", name: "Team 1" }] },
    ],
    sessions: [
      { id: 11, result: { status: "completed" } },
      { id: 12, result: { status: "pending" } },
    ],
    groupStandings: [
      {
        group: "A",
        roundId: 1,
        roundName: "Vong bang A",
        matchCount: 3,
        standing: [
          { id: "t1", name: "Team 1", played: 3, won: 2, draw: 1, lost: 0, pointsFor: 30, pointsAgainst: 20, scoreDiff: 10, matchPoints: 7 },
        ],
        qualified: [{ id: "t1", name: "Team 1" }],
      },
    ],
    knockoutProgress: {
      completedRounds: 3,
      totalRounds: 3,
      champion: { id: "t1", name: "Team 1" },
      rounds: [
        {
          name: "Chung ket",
          completed: true,
          matches: [
            {
              id: "R3-M1",
              homeSeed: "W(R2-M1)",
              awaySeed: "W(R2-M2)",
              home: { id: "t1", name: "Team 1" },
              away: { id: "t2", name: "Team 2" },
              winnerSide: "home",
              winner: { id: "t1", name: "Team 1" },
              completed: true,
            },
          ],
        },
      ],
    },
    bracketWinners: { "R3-M1": "home" },
    bracketUnlockedRounds: { "Chung ket": true },
  });

  assert.equal(payload.version, 1);
  assert.equal(payload.overview.totalRounds, 1);
  assert.equal(payload.overview.totalSessions, 2);
  assert.equal(payload.overview.completedSessions, 1);
  assert.equal(payload.overview.champion?.name, "Team 1");
  assert.equal(payload.groupStandings[0].standing[0].rank, 1);
  assert.equal(payload.knockout.rounds[0].matches[0].winner?.id, "t1");
  assert.equal(payload.bracketState.winnersByMatch["R3-M1"], "home");
  assert.equal(payload.bracketState.unlockedRounds["Chung ket"], true);
});
