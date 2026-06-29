import test from "node:test";
import assert from "node:assert/strict";

import {
  applyMatchRecordToLeagueStandings,
  buildLeagueStandingsRows,
  createEmptyLeagueStandings,
} from "../src/tournament/engines/seasonStandingsEngine.js";

test("seasonStandingsEngine accumulates league points from match records", () => {
  let standings = createEmptyLeagueStandings();
  const record = {
    id: "m1",
    playerIds: ["1", "2", "3", "4"],
    teamAPlayerIds: ["1", "2"],
    teamBPlayerIds: ["3", "4"],
    scoreA: 11,
    scoreB: 7,
  };

  standings = applyMatchRecordToLeagueStandings(standings, record, {
    win: 3,
    draw: 1,
    loss: 0,
  });

  assert.equal(standings.players["1"].points, 3);
  assert.equal(standings.players["3"].points, 0);
  assert.equal(standings.players["1"].wins, 1);
  assert.equal(standings.players["3"].losses, 1);

  const revised = {
    ...record,
    scoreA: 8,
    scoreB: 11,
  };
  standings = applyMatchRecordToLeagueStandings(standings, revised, {
    win: 3,
    draw: 1,
    loss: 0,
  });

  assert.equal(standings.players["1"].points, 0);
  assert.equal(standings.players["3"].points, 3);
});

test("seasonStandingsEngine sorts standings by points", () => {
  const standings = {
    players: {
      1: { points: 3, matches: 1, wins: 1, losses: 0, draws: 0 },
      2: { points: 6, matches: 2, wins: 2, losses: 0, draws: 0 },
    },
    matchContributions: {},
  };

  const rows = buildLeagueStandingsRows(standings, [
    { id: 1, name: "An" },
    { id: 2, name: "Binh" },
  ]);

  assert.equal(rows[0].playerId, "2");
  assert.equal(rows[0].points, 6);
});
