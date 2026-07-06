import test from "node:test";
import assert from "node:assert/strict";

import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  computeTeamStandings,
  getStandingsTable,
} from "../src/features/team-tournament/engines/teamStandingsEngine.js";

function completedMatchup(teamAId, teamBId, winnerTeamId, subResult) {
  return {
    id: `matchup-${teamAId}-${teamBId}`,
    teamAId,
    teamBId,
    status: MATCHUP_STATUS.COMPLETED,
    subMatches: [],
    result: {
      teamAWins: subResult.teamAWins,
      teamBWins: subResult.teamBWins,
      teamAPoints: subResult.teamAPoints || 0,
      teamBPoints: subResult.teamBPoints || 0,
      winnerTeamId,
    },
  };
}

test("BXH — 3 đội cùng điểm thắng, xếp theo hiệu số trận con", () => {
  let teamData = initializeTeamTournamentData({
    settings: {
      tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"],
    },
  });
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Đội A", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "Đội B", playerIds: [] });
  teamData = addTeamToTournament(teamData, { id: "team-c", name: "Đội C", playerIds: [] });

  teamData = {
    ...teamData,
    matchups: [
      completedMatchup("team-a", "team-b", "team-a", {
        teamAWins: 4,
        teamBWins: 0,
        teamAPoints: 44,
        teamBPoints: 10,
      }),
      completedMatchup("team-b", "team-c", "team-b", {
        teamAWins: 3,
        teamBWins: 1,
        teamAPoints: 33,
        teamBPoints: 20,
      }),
      completedMatchup("team-a", "team-c", "team-c", {
        teamAWins: 2,
        teamBWins: 3,
        teamAPoints: 28,
        teamBPoints: 35,
      }),
    ],
  };

  const ranked = getStandingsTable(computeTeamStandings(teamData));

  assert.equal(ranked.length, 3);
  ranked.forEach((row) => {
    assert.equal(row.wins, 1);
    assert.equal(row.losses, 1);
  });

  assert.equal(ranked[0].teamId, "team-a");
  assert.equal(ranked[0].subMatchDiff, 3);
  assert.equal(ranked[1].teamId, "team-c");
  assert.equal(ranked[1].subMatchDiff, -1);
  assert.equal(ranked[2].teamId, "team-b");
  assert.equal(ranked[2].subMatchDiff, -2);
});
