import test from "node:test";
import assert from "node:assert/strict";

import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  LINEUP_SOURCE,
  LINEUP_STATUS,
} from "../src/features/team-tournament/constants.js";
import {
  addDisciplineToTournament,
  addTeamToTournament,
  buildRoundRobinMatchups,
  createTeamTournamentShell,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  lockMatchupLineups,
  publishMatchupLineups,
  submitLineup,
  getVisibleLineup,
  buildOfficialPairings,
} from "../src/features/team-tournament/engines/lineupEngine.js";
import { recordSubMatchResult } from "../src/features/team-tournament/engines/teamResultEngine.js";
import { computeTeamStandings, getStandingsTable } from "../src/features/team-tournament/engines/teamStandingsEngine.js";
import {
  canSubmitLineup,
  isTeamCaptain,
  assertTeamScope,
} from "../src/features/team-tournament/engines/teamPermissionEngine.js";
import { findTeam, getLineup } from "../src/features/team-tournament/models/index.js";

const players = [
  { id: "p1", name: "Nam A", gender: "Nam" },
  { id: "p2", name: "Nam B", gender: "Nam" },
  { id: "p3", name: "Nam C", gender: "Nam" },
  { id: "p4", name: "Nu A", gender: "Nữ" },
  { id: "p5", name: "Nu B", gender: "Nữ" },
  { id: "p6", name: "Nu C", gender: "Nữ" },
  { id: "p7", name: "Nam D", gender: "Nam" },
  { id: "p8", name: "Nu D", gender: "Nữ" },
  { id: "p9", name: "Nam E", gender: "Nam" },
  { id: "p10", name: "Nu E", gender: "Nữ" },
];

function buildFixture() {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "Future Arena",
    playerIds: ["p1", "p2", "p4", "p5", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p1",
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "Elite Club",
    playerIds: ["p3", "p6", "p2", "p4", "p7", "p8", "p9", "p10"],
    captainPlayerId: "p3",
  });
  teamData = buildRoundRobinMatchups(teamData, {
    lineupLockAt: "2099-01-01T08:30:00.000Z",
  });
  return teamData;
}

function lineupSelectionsForTeam(teamData, teamId) {
  const team = findTeam(teamData, teamId);
  const [menDouble, womenDouble, mixed1, mixed2] = teamData.disciplines;
  const males = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && (player.gender === "Nam");
  });
  const females = team.playerIds.filter((id) => {
    const player = players.find((item) => item.id === id);
    return player && (player.gender === "Nữ");
  });

  return {
    [menDouble.id]: [males[0], males[1]],
    [womenDouble.id]: [females[0], females[1]],
    [mixed1.id]: [males[2], females[2]],
    [mixed2.id]: [males[3], females[3]],
  };
}

test("create team tournament shell uses team_tournament mode", () => {
  const tournament = createTeamTournamentShell("club-1", { name: "Giải đồng đội mùa hè" });
  assert.equal(tournament.mode, TOURNAMENT_MODE.TEAM_TOURNAMENT);
  assert.equal(tournament.teamData.disciplines.length, 4);
});

test("custom disciplines are not hard-coded to four categories", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addDisciplineToTournament(teamData, { name: "Đơn nam", playerCount: 1 });
  teamData = addDisciplineToTournament(teamData, { name: "Đơn nữ", playerCount: 1 });
  teamData = addDisciplineToTournament(teamData, { name: "Đôi nam", playerCount: 2 });
  teamData = addDisciplineToTournament(teamData, { name: "Đôi nữ", playerCount: 2 });
  teamData = addDisciplineToTournament(teamData, { name: "Mixed 1", playerCount: 2 });
  teamData = addDisciplineToTournament(teamData, { name: "Mixed 2", playerCount: 2 });

  assert.equal(teamData.disciplines.length, 6);
});

test("captain can submit lineup before lock time", () => {
  const teamData = buildFixture();
  const matchup = teamData.matchups[0];
  const result = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
    now: "2026-01-01T08:00:00.000Z",
  });

  assert.equal(result.ok, true);
  const lineup = getLineup(result.teamData, matchup.id, "team-a");
  assert.equal(lineup.status, LINEUP_STATUS.SUBMITTED);
  assert.ok(lineup.submittedAt);
});

test("lineup lock auto-randomizes missing team lineup", () => {
  const teamData = buildFixture();
  const matchup = teamData.matchups[0];

  const submitted = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
    now: "2026-01-01T08:00:00.000Z",
  });

  const locked = lockMatchupLineups(submitted.teamData, {
    matchupId: matchup.id,
    players,
    now: "2026-01-01T09:00:00.000Z",
  });

  assert.equal(locked.ok, true);
  const randomLineup = getLineup(locked.teamData, matchup.id, "team-b");
  assert.equal(randomLineup.status, LINEUP_STATUS.LOCKED);
  assert.equal(randomLineup.source, LINEUP_SOURCE.RANDOM);
  assert.match(randomLineup.auditNote, /không nộp đội hình trước hạn/);
});

test("opponent lineup hidden before publish", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  const submitA = submitLineup(teamData, {
    matchupId: matchup.id,
    teamId: "team-a",
    selections: lineupSelectionsForTeam(teamData, "team-a"),
    players,
  });
  const submitB = submitLineup(submitA.teamData, {
    matchupId: matchup.id,
    teamId: "team-b",
    selections: lineupSelectionsForTeam(submitA.teamData, "team-b"),
    players,
  });
  const locked = lockMatchupLineups(submitB.teamData, {
    matchupId: matchup.id,
    players,
    now: "2026-01-01T09:00:00.000Z",
  });

  const hidden = getVisibleLineup(locked.teamData, {
    matchupId: matchup.id,
    viewerTeamId: "team-a",
    isOrganizer: false,
  });

  assert.equal(hidden.ok, true);
  assert.ok(hidden.ownLineup);
  assert.equal(hidden.opponentLineup, null);

  const published = publishMatchupLineups(locked.teamData, { matchupId: matchup.id });
  const visible = getVisibleLineup(published.teamData, {
    matchupId: matchup.id,
    viewerTeamId: "team-a",
    isOrganizer: false,
  });

  assert.ok(visible.opponentLineup);
});

test("compute matchup aggregate result from sub matches", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  teamData = publishMatchupLineups(
    lockMatchupLineups(
      submitLineup(
        submitLineup(teamData, {
          matchupId: matchup.id,
          teamId: "team-a",
          selections: lineupSelectionsForTeam(teamData, "team-a"),
          players,
        }).teamData,
        {
          matchupId: matchup.id,
          teamId: "team-b",
          selections: lineupSelectionsForTeam(teamData, "team-b"),
          players,
        }
      ).teamData,
      { matchupId: matchup.id, players, now: "2026-01-01T09:00:00.000Z" }
    ).teamData,
    { matchupId: matchup.id }
  ).teamData;

  const subMatches = matchup.subMatches;
  const first = recordSubMatchResult(teamData, {
    matchupId: matchup.id,
    subMatchId: subMatches[0].id,
    score: { teamA: 11, teamB: 5 },
  });
  const second = recordSubMatchResult(first.teamData, {
    matchupId: matchup.id,
    subMatchId: subMatches[1].id,
    score: { teamA: 8, teamB: 11 },
  });
  const third = recordSubMatchResult(second.teamData, {
    matchupId: matchup.id,
    subMatchId: subMatches[2].id,
    score: { teamA: 11, teamB: 9 },
  });
  const fourth = recordSubMatchResult(third.teamData, {
    matchupId: matchup.id,
    subMatchId: subMatches[3].id,
    score: { teamA: 11, teamB: 7 },
  });

  assert.equal(fourth.matchupResult.teamAWins, 3);
  assert.equal(fourth.matchupResult.teamBWins, 1);
  assert.equal(fourth.matchupResult.winnerTeamId, "team-a");
});

test("standings table ranks teams by wins and sub-match diff", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  let current = publishMatchupLineups(
    lockMatchupLineups(
      submitLineup(
        submitLineup(teamData, {
          matchupId: matchup.id,
          teamId: "team-a",
          selections: lineupSelectionsForTeam(teamData, "team-a"),
          players,
        }).teamData,
        {
          matchupId: matchup.id,
          teamId: "team-b",
          selections: lineupSelectionsForTeam(teamData, "team-b"),
          players,
        }
      ).teamData,
      { matchupId: matchup.id, players, now: "2026-01-01T09:00:00.000Z" }
    ).teamData,
    { matchupId: matchup.id }
  ).teamData;

  matchup.subMatches.forEach((subMatch, index) => {
    const score = index < 3
      ? { teamA: 11, teamB: 6 }
      : { teamA: 6, teamB: 11 };
    current = recordSubMatchResult(current, {
      matchupId: matchup.id,
      subMatchId: subMatch.id,
      score,
    }).teamData;
  });

  const standings = getStandingsTable(computeTeamStandings(current));
  assert.equal(standings.length, 2);
  assert.equal(standings[0].played, 1);
  assert.ok(standings[0].wins + standings[1].wins === 1);
});

test("captain permission only applies to own team", () => {
  const teamData = buildFixture();
  const teamA = findTeam(teamData, "team-a");
  const teamB = findTeam(teamData, "team-b");

  assert.equal(isTeamCaptain(teamA, "p1"), true);
  assert.equal(isTeamCaptain(teamB, "p1"), false);
  assert.equal(
    canSubmitLineup({
      team: teamA,
      playerId: "p1",
      permissions: [PERMISSIONS.TEAM_LINEUP_SUBMIT],
    }),
    true
  );
  assert.equal(
    canSubmitLineup({
      team: teamB,
      playerId: "p1",
      permissions: [PERMISSIONS.TEAM_LINEUP_SUBMIT],
    }),
    false
  );
  assert.equal(
    assertTeamScope(teamData, "team-b", "p1", [PERMISSIONS.TEAM_LINEUP_SUBMIT]).ok,
    false
  );
});

test("referee sees official pairings only after publish", () => {
  let teamData = buildFixture();
  const matchup = teamData.matchups[0];

  teamData = lockMatchupLineups(
    submitLineup(
      submitLineup(teamData, {
        matchupId: matchup.id,
        teamId: "team-a",
        selections: lineupSelectionsForTeam(teamData, "team-a"),
        players,
      }).teamData,
      {
        matchupId: matchup.id,
        teamId: "team-b",
        selections: lineupSelectionsForTeam(teamData, "team-b"),
        players,
      }
    ).teamData,
    { matchupId: matchup.id, players, now: "2026-01-01T09:00:00.000Z" }
  ).teamData;

  const beforePublish = buildOfficialPairings(teamData, matchup.id);
  assert.equal(beforePublish.ok, false);

  teamData = publishMatchupLineups(teamData, { matchupId: matchup.id }).teamData;
  const afterPublish = buildOfficialPairings(teamData, matchup.id);
  assert.equal(afterPublish.ok, true);
  assert.equal(afterPublish.pairings.length, teamData.disciplines.length);
});

test("individual/double tournament mode remains unchanged", () => {
  const tournament = createTeamTournamentShell("club-1");
  assert.notEqual(tournament.mode, TOURNAMENT_MODE.INTERNAL_TOURNAMENT);
  assert.notEqual(tournament.mode, TOURNAMENT_MODE.OFFICIAL_TOURNAMENT);
  assert.equal(tournament.events.length, 0);
});
