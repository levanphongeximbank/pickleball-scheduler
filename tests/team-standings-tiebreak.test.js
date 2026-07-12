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
import { normalizeStanding } from "../src/features/team-tournament/models/index.js";

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

test("BXH metadata — match thường có forfeit metadata mặc định", () => {
  const teamData = {
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
    teams: [
      { id: "team-a", name: "Đội A", playerIds: [] },
      { id: "team-b", name: "Đội B", playerIds: [] },
    ],
    matchups: [
      completedMatchup("team-a", "team-b", "team-a", {
        teamAWins: 3,
        teamBWins: 1,
        teamAPoints: 33,
        teamBPoints: 24,
      }),
    ],
  };

  const ranked = getStandingsTable(computeTeamStandings(teamData));

  ranked.forEach((row) => {
    assert.equal(row.forfeitWins, 0);
    assert.equal(row.forfeitLosses, 0);
    assert.equal(row.withdrawn, false);
  });
});

test("BXH metadata — forfeit tăng đúng winner/loser và không double-count", () => {
  const forfeitMatchup = completedMatchup("team-a", "team-b", "team-a", {
    teamAWins: 3,
    teamBWins: 0,
    teamAPoints: 33,
    teamBPoints: 0,
  });
  forfeitMatchup.result = {
    ...forfeitMatchup.result,
    forfeit: true,
    resultType: "forfeit",
    forfeitingTeamId: "team-b",
  };
  const teamData = {
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
    teams: [
      { id: "team-a", name: "Đội A", playerIds: [] },
      { id: "team-b", name: "Đội B", playerIds: [] },
    ],
    matchups: [forfeitMatchup],
  };

  const first = getStandingsTable(computeTeamStandings(teamData));
  const second = getStandingsTable(computeTeamStandings(teamData));
  const winner = first.find((row) => row.teamId === "team-a");
  const loser = first.find((row) => row.teamId === "team-b");
  const winnerAgain = second.find((row) => row.teamId === "team-a");
  const loserAgain = second.find((row) => row.teamId === "team-b");

  assert.equal(winner.forfeitWins, 1);
  assert.equal(winner.forfeitLosses, 0);
  assert.equal(loser.forfeitWins, 0);
  assert.equal(loser.forfeitLosses, 1);
  assert.equal(winnerAgain.forfeitWins, 1);
  assert.equal(loserAgain.forfeitLosses, 1);
});

test("BXH metadata — withdrawn lấy từ team metadata, team thường false", () => {
  const teamData = {
    settings: { tiebreakOrder: ["wins", "subMatchDiff", "pointsScored", "manual"] },
    teams: [
      { id: "team-a", name: "Đội A", playerIds: [] },
      { id: "team-b", name: "Đội B", playerIds: [], withdrawn: true },
    ],
    matchups: [
      completedMatchup("team-a", "team-b", "team-a", {
        teamAWins: 3,
        teamBWins: 0,
        teamAPoints: 33,
        teamBPoints: 0,
      }),
    ],
  };

  const ranked = getStandingsTable(computeTeamStandings(teamData));
  assert.equal(ranked.find((row) => row.teamId === "team-a").withdrawn, false);
  assert.equal(ranked.find((row) => row.teamId === "team-b").withdrawn, true);
});

test("normalizeStanding giữ giá trị metadata thật và cấp default khi thiếu", () => {
  const preserved = normalizeStanding({
    teamId: "team-a",
    forfeitWins: 2,
    forfeitLosses: 1,
    withdrawn: true,
  });
  const defaulted = normalizeStanding({ teamId: "team-b" });

  assert.equal(preserved.forfeitWins, 2);
  assert.equal(preserved.forfeitLosses, 1);
  assert.equal(preserved.withdrawn, true);
  assert.equal(defaulted.forfeitWins, 0);
  assert.equal(defaulted.forfeitLosses, 0);
  assert.equal(defaulted.withdrawn, false);
});

test("BXH metadata — rank và tie-break không đổi sau khi expose metadata", () => {
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
  assert.deepEqual(
    ranked.map((row) => row.teamId),
    ["team-a", "team-c", "team-b"]
  );
  assert.deepEqual(
    ranked.map((row) => row.subMatchDiff),
    [3, -1, -2]
  );
});
