import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  assignAward,
  autoAssignAwardsFromRanking,
  buildTeamFinalRanking,
  exportAwardsCsv,
  getAwardsPreview,
  updateAwardsConfig,
} from "../src/features/team-tournament/engines/awardsEngine.js";
import {
  canCloseTeamTournament,
  closeTeamTournament,
  isTeamTournamentClosed,
} from "../src/features/team-tournament/engines/teamClosingEngine.js";
import { generateTeamKnockoutMatchups } from "../src/features/team-tournament/engines/teamKnockoutEngine.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  createDisciplineRecord,
  createMatchupRecord,
  normalizeTeamData,
} from "../src/features/team-tournament/models/index.js";
import { MATCHUP_STATUS } from "../src/features/team-tournament/constants.js";

function withCompletedResult(matchup, winnerTeamId) {
  const winnerIsA = String(winnerTeamId) === String(matchup.teamAId);
  return {
    ...matchup,
    status: MATCHUP_STATUS.COMPLETED,
    result: {
      teamAWins: winnerIsA ? 1 : 0,
      teamBWins: winnerIsA ? 0 : 1,
      teamAPoints: winnerIsA ? 11 : 5,
      teamBPoints: winnerIsA ? 5 : 11,
      winnerTeamId,
    },
  };
}

function rrStandingsFixture() {
  let teamData = initializeTeamTournamentData({});
  for (const [id, name] of [
    ["t1", "Alpha"],
    ["t2", "Bravo"],
    ["t3", "Charlie"],
  ]) {
    teamData = addTeamToTournament(teamData, { id, name });
  }
  return normalizeTeamData({
    ...teamData,
    matchups: [
      withCompletedResult(createMatchupRecord("t1", "t2", { id: "m1", disciplines: [] }), "t1"),
      withCompletedResult(createMatchupRecord("t1", "t3", { id: "m2", disciplines: [] }), "t1"),
      withCompletedResult(createMatchupRecord("t2", "t3", { id: "m3", disciplines: [] }), "t2"),
    ],
  });
}

function knockoutFinalFixture() {
  let teamData = initializeTeamTournamentData({
    disciplines: [
      createDisciplineRecord({
        id: "d1",
        name: "Đôi",
        playerCount: 2,
        sortOrder: 1,
      }),
    ],
  });
  for (const [id, name] of [
    ["a1", "A1"],
    ["a2", "A2"],
    ["b1", "B1"],
    ["b2", "B2"],
  ]) {
    teamData = addTeamToTournament(teamData, {
      id,
      name,
      playerIds: [`${id}-p1`, `${id}-p2`],
      captainPlayerId: `${id}-p1`,
    });
  }
  const base = normalizeTeamData({
    ...teamData,
    groups: [
      { id: "g-a", name: "A", teamIds: ["a1", "a2"] },
      { id: "g-b", name: "B", teamIds: ["b1", "b2"] },
    ],
    matchups: [
      withCompletedResult(
        createMatchupRecord("a1", "a2", {
          id: "rr-a",
          groupId: "g-a",
          disciplines: teamData.disciplines,
        }),
        "a1"
      ),
      withCompletedResult(
        createMatchupRecord("b1", "b2", {
          id: "rr-b",
          groupId: "g-b",
          disciplines: teamData.disciplines,
        }),
        "b1"
      ),
    ],
  });

  const built = generateTeamKnockoutMatchups(base, { qualifiersPerGroup: 1 });
  assert.equal(built.ok, true);
  let next = built.teamData;
  const finals = (next.matchups || []).filter(
    (m) => m.stage === "knockout" && !m.nextMatchupId
  );
  assert.ok(finals.length >= 1);
  const final = finals[0];
  next = normalizeTeamData({
    ...next,
    matchups: next.matchups.map((m) =>
      String(m.id) === String(final.id)
        ? withCompletedResult({ ...m, teamAId: "a1", teamBId: "b1" }, "b1")
        : m
    ),
  });
  return next;
}

test("T-S2-H01 standings podium when no knockout", () => {
  const ranking = buildTeamFinalRanking(rrStandingsFixture()).ranking;
  assert.equal(ranking[0].teamId, "t1");
  assert.equal(ranking[0].source, "standings");
  assert.equal(ranking[1].teamId, "t2");
});

test("T-S2-H02 knockout final sets champion and runner-up", () => {
  const ranking = buildTeamFinalRanking(knockoutFinalFixture()).ranking;
  assert.equal(ranking[0].teamId, "b1");
  assert.equal(ranking[0].source, "knockout_final");
  assert.equal(ranking[1].teamId, "a1");
});

test("T-S2-H03 auto assign + close freezes and blocks re-close", () => {
  const teamData = rrStandingsFixture();
  const assigned = autoAssignAwardsFromRanking(teamData);
  assert.equal(assigned.ok, true);
  assert.ok(assigned.awards.some((a) => a.key === "champion" && a.teamId === "t1"));

  const closed = closeTeamTournament(assigned.teamData, {
    tournamentId: "tt-1",
    tournamentName: "Demo",
  });
  assert.equal(closed.ok, true);
  assert.equal(isTeamTournamentClosed(closed.teamData), true);
  assert.equal(closed.teamData.settings.resultsLocked, true);
  assert.ok(closed.summary.champion?.teamId === "t1");
  assert.equal(canCloseTeamTournament(closed.teamData).ok, false);

  const blocked = updateAwardsConfig(closed.teamData, {
    fairPlay: { enabled: true },
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "CLOSED");
});

test("T-S2-H04 manual assign fair-play before close", () => {
  let teamData = rrStandingsFixture();
  const cfg = updateAwardsConfig(teamData, { fairPlay: { enabled: true } });
  assert.equal(cfg.ok, true);
  teamData = cfg.teamData;
  const assigned = assignAward(teamData, "fairPlay", "t3");
  assert.equal(assigned.ok, true);
  const preview = getAwardsPreview(assigned.teamData);
  const fair = preview.awards.find((a) => a.key === "fairPlay");
  assert.equal(fair?.teamId, "t3");
});

test("T-S2-H05 export awards csv has header", () => {
  const file = exportAwardsCsv(rrStandingsFixture());
  assert.ok(file.content.startsWith("key,label,rank"));
  assert.ok(file.content.includes("champion"));
});

test("T-S2-H06 awards close panel exists", () => {
  const panel = path.join(
    process.cwd(),
    "src/components/tournament/team/TeamAwardsClosePanel.jsx"
  );
  assert.equal(fs.existsSync(panel), true);
});
