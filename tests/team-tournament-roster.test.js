import test from "node:test";
import assert from "node:assert/strict";

import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  addTeamToTournament,
  initializeTeamTournamentData,
} from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  addPlayerToTeam,
  assignTeamCaptain,
  computeTeamRosterStats,
  findPlayerTeam,
  getTeamRosterWarnings,
  getVisibleTeams,
  removePlayerFromTeam,
  validateAddPlayerToTeam,
  validateAssignCaptain,
  validateRemovePlayerFromTeam,
} from "../src/features/team-tournament/engines/teamRosterEngine.js";
import { canManageTeam } from "../src/features/team-tournament/engines/teamPermissionEngine.js";

const players = [
  { id: "p1", name: "Nam A", gender: "Nam" },
  { id: "p2", name: "Nam B", gender: "Nam" },
  { id: "p3", name: "Nu A", gender: "Nữ" },
  { id: "p4", name: "Nu B", gender: "Nữ" },
];

test("create team and assign players", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "Future Arena" });

  const add1 = addPlayerToTeam(teamData, "team-a", "p1");
  const add2 = addPlayerToTeam(add1.teamData, "team-a", "p3");

  assert.equal(add2.ok, true);
  const team = findPlayerTeam(add2.teamData, "p1");
  assert.equal(team?.id, "team-a");
  assert.deepEqual(team.playerIds, ["p1", "p3"]);
});

test("reject duplicate player across teams by default", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "A" });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "B" });
  teamData = addPlayerToTeam(teamData, "team-a", "p1").teamData;

  const blocked = validateAddPlayerToTeam(teamData, "team-b", "p1");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /đã thuộc đội/);
});

test("allow duplicate player across teams when config enables it", () => {
  let teamData = initializeTeamTournamentData({
    disciplines: [],
    settings: { allowPlayerCrossTeam: true },
  });
  teamData = addTeamToTournament(teamData, { id: "team-a", name: "A" });
  teamData = addTeamToTournament(teamData, { id: "team-b", name: "B" });
  teamData = addPlayerToTeam(teamData, "team-a", "p1").teamData;

  const allowed = validateAddPlayerToTeam(teamData, "team-b", "p1");
  assert.equal(allowed.ok, true);
});

test("captain must be a team member", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    playerIds: ["p1"],
  });

  const invalid = validateAssignCaptain(findPlayerTeam(teamData, "p1"), "p2");
  assert.equal(invalid.ok, false);

  const valid = assignTeamCaptain(teamData, "team-a", "p1");
  assert.equal(valid.ok, true);
  assert.equal(valid.teamData.teams[0].captainPlayerId, "p1");
});

test("cannot remove captain before assigning a new one", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    playerIds: ["p1", "p2"],
    captainPlayerId: "p1",
  });

  const blocked = validateRemovePlayerFromTeam(teamData.teams[0], "p1");
  assert.equal(blocked.ok, false);

  teamData = assignTeamCaptain(teamData, "team-a", "p2").teamData;
  const allowed = removePlayerFromTeam(teamData, "team-a", "p1");
  assert.equal(allowed.ok, true);
});

test("roster stats and gender warnings", () => {
  let teamData = initializeTeamTournamentData();
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    playerIds: ["p1"],
  });

  const stats = computeTeamRosterStats(teamData.teams[0], players);
  assert.equal(stats.total, 1);
  assert.equal(stats.males, 1);
  assert.equal(stats.females, 0);

  const warnings = getTeamRosterWarnings(teamData.teams[0], teamData, players);
  assert.ok(warnings.length > 0);
  assert.ok(warnings.some((warning) => warning.includes("Thiếu VĐV nữ")));
});

test("team.manage permission gates roster management", () => {
  assert.equal(canManageTeam({ permissions: [PERMISSIONS.TEAM_MANAGE] }), true);
  assert.equal(canManageTeam({ permissions: [PERMISSIONS.TOURNAMENT_UPDATE] }), true);
  assert.equal(canManageTeam({ permissions: [PERMISSIONS.TEAM_VIEW] }), false);
  assert.equal(canManageTeam({ permissions: [PERMISSIONS.TEAM_LINEUP_SUBMIT] }), false);
});

test("captain only sees own team in read-only mode", () => {
  let teamData = initializeTeamTournamentData({ disciplines: [] });
  teamData = addTeamToTournament(teamData, {
    id: "team-a",
    name: "A",
    captainPlayerId: "p1",
    playerIds: ["p1"],
  });
  teamData = addTeamToTournament(teamData, {
    id: "team-b",
    name: "B",
    captainPlayerId: "p2",
    playerIds: ["p2"],
  });

  const visible = getVisibleTeams(teamData, {
    canManage: false,
    canViewAll: false,
    viewerPlayerId: "p1",
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "team-a");
});
