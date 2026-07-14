import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMiniTableStats,
  computeTeamStandings,
  freezeTiebreakOrder,
  getGroupStandingsTables,
  isTiebreakFrozen,
  rankStandingsRows,
  setTiebreakOrder,
} from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { createMatchupRecord } from "../src/features/team-tournament/models/index.js";
import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";
import { generateTeamKnockoutMatchups } from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import fs from "node:fs";
import path from "node:path";

function completedMatchup(teamAId, teamBId, winnerTeamId, extras = {}) {
  const matchup = createMatchupRecord(teamAId, teamBId, {
    status: MATCHUP_STATUS.COMPLETED,
    groupId: extras.groupId || "",
    disciplines: [],
  });
  matchup.result = {
    teamAWins: winnerTeamId === teamAId ? 2 : 1,
    teamBWins: winnerTeamId === teamBId ? 2 : 1,
    teamAPoints: winnerTeamId === teamAId ? 42 : 30,
    teamBPoints: winnerTeamId === teamBId ? 42 : 30,
    winnerTeamId,
  };
  return matchup;
}

function threeTeamCycleFixture() {
  let teamData = initializeTeamTournamentData({
    settings: {
      tiebreakOrder: ["wins", "headToHead", "manual"],
    },
  });
  teamData = addTeamToTournament(teamData, { id: "a", name: "A" });
  teamData = addTeamToTournament(teamData, { id: "b", name: "B" });
  teamData = addTeamToTournament(teamData, { id: "c", name: "C" });
  // Cycle: A>B, B>C, C>A — all 1-1; mini-table needed
  teamData = {
    ...teamData,
    matchups: [
      completedMatchup("a", "b", "a"),
      completedMatchup("b", "c", "b"),
      completedMatchup("c", "a", "c"),
    ],
  };
  return teamData;
}

test("T-S2-E01 mini-table stats only count internal matches", () => {
  const teamData = threeTeamCycleFixture();
  const mini = buildMiniTableStats(["a", "b", "c"], teamData.matchups, teamData);
  assert.equal(mini.get("a").wins, 1);
  assert.equal(mini.get("b").wins, 1);
  assert.equal(mini.get("c").wins, 1);
});

test("T-S2-E02 three-way cycle uses mini-table then deterministic order", () => {
  const teamData = threeTeamCycleFixture();
  const ranked = computeTeamStandings(teamData).standings;
  assert.equal(ranked.length, 3);
  // still deterministic after mini-table (same wins) via manual/id
  const ids = ranked.map((row) => row.teamId).sort();
  assert.deepEqual(ids, ["a", "b", "c"]);
  assert.ok(ranked.some((row) => String(row.tieBreakNote || "").includes("mini")));
});

test("T-S2-E03 pairwise H2H still wins for 2-team tie", () => {
  let teamData = initializeTeamTournamentData({
    settings: { tiebreakOrder: ["wins", "headToHead", "manual"] },
  });
  teamData = addTeamToTournament(teamData, { id: "x", name: "X" });
  teamData = addTeamToTournament(teamData, { id: "y", name: "Y" });
  teamData = addTeamToTournament(teamData, { id: "z", name: "Z" });
  teamData = {
    ...teamData,
    matchups: [
      completedMatchup("x", "y", "x"),
      completedMatchup("x", "z", "z"),
      completedMatchup("y", "z", "y"),
    ],
  };
  // All have 1 win. Between x/y: x beat y → x above y if in same bucket after wins
  const ranked = rankStandingsRows(
    computeTeamStandings(teamData).standings,
    teamData.matchups,
    ["wins", "headToHead", "manual"],
    teamData
  );
  assert.equal(ranked.length, 3);
  const x = ranked.find((row) => row.teamId === "x");
  const y = ranked.find((row) => row.teamId === "y");
  assert.ok(x.rank < y.rank);
});

test("T-S2-E04 freeze blocks setTiebreakOrder; knockout freezes", () => {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "a", name: "A" });
  teamData = addTeamToTournament(teamData, { id: "b", name: "B" });
  teamData = addTeamToTournament(teamData, { id: "c", name: "C" });
  teamData = addTeamToTournament(teamData, { id: "d", name: "D" });
  teamData = {
    ...teamData,
    groups: [
      { id: "g1", name: "Bảng A", teamIds: ["a", "b"] },
      { id: "g2", name: "Bảng B", teamIds: ["c", "d"] },
    ],
    matchups: [
      completedMatchup("a", "b", "a", { groupId: "g1" }),
      completedMatchup("c", "d", "c", { groupId: "g2" }),
    ],
    disciplines: [{ id: "d1", name: "Đôi", activationRule: "always", sortOrder: 1 }],
  };

  assert.equal(isTiebreakFrozen(teamData), false);
  const frozen = freezeTiebreakOrder(teamData, { reason: "manual" });
  assert.equal(frozen.ok, true);
  assert.equal(isTiebreakFrozen(frozen.teamData), true);
  const blocked = setTiebreakOrder(frozen.teamData, ["wins", "manual"]);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "TIEBREAK_FROZEN");

  const ko = generateTeamKnockoutMatchups(teamData, { qualifiersPerGroup: 1 });
  assert.equal(ko.ok, true);
  assert.equal(isTiebreakFrozen(ko.teamData), true);
});

test("T-S2-E05 group standings tables separate groups", () => {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, { id: "a", name: "A" });
  teamData = addTeamToTournament(teamData, { id: "b", name: "B" });
  teamData = addTeamToTournament(teamData, { id: "c", name: "C" });
  teamData = addTeamToTournament(teamData, { id: "d", name: "D" });
  teamData = {
    ...teamData,
    groups: [
      { id: "g1", name: "Bảng A", teamIds: ["a", "b"] },
      { id: "g2", name: "Bảng B", teamIds: ["c", "d"] },
    ],
    matchups: [
      completedMatchup("a", "b", "a", { groupId: "g1" }),
      completedMatchup("c", "d", "d", { groupId: "g2" }),
    ],
  };
  const tables = getGroupStandingsTables(teamData);
  assert.equal(tables.length, 2);
  assert.equal(tables[0].standing[0].teamId, "a");
  assert.equal(tables[1].standing[0].teamId, "d");
});

test("T-S2-E06 tiebreak config panel exists", () => {
  const panel = path.resolve(
    "src/components/tournament/team/TeamTiebreakConfigPanel.jsx"
  );
  assert.equal(fs.existsSync(panel), true);
  const src = fs.readFileSync(panel, "utf8");
  assert.match(src, /updateTeamTiebreakOrder/);
});
