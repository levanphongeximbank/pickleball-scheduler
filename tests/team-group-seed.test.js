import test from "node:test";
import assert from "node:assert/strict";

import { TEAM_GROUP_SEEDING } from "../src/features/team-tournament/constants.js";
import { createTeamRecord } from "../src/features/team-tournament/models/index.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  assignSeededTeamsToGroups,
} from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import {
  buildSnakeGroupsFromSortedTeams,
  computeTeamSeedMetrics,
  shuffleTeamsForOpenDraw,
  sortTeamsForGroupSeeding,
} from "../src/features/team-tournament/engines/teamGroupSeedEngine.js";

function makePlayer(id, level) {
  return {
    id,
    name: id,
    level,
    rating: level,
  };
}

function makeTeam(id, playerLevels, overrides = {}) {
  const playerIds = playerLevels.map((_, index) => `${id}-p${index + 1}`);
  const players = playerLevels.map((level, index) => makePlayer(playerIds[index], level));
  const total = playerLevels.reduce((sum, level) => sum + level, 0);
  const team = createTeamRecord({
    id,
    name: id,
    playerIds,
    avgLevel: Math.round((total / playerLevels.length) * 100) / 100,
    ...overrides,
  });
  return { team, players };
}

test("sortTeamsForGroupSeeding — tie-break ace bằng nhau, tổng điểm cao hơn seed mạnh hơn", () => {
  const { team: teamA, players: playersA } = makeTeam("team-a", [5.0, 3.0]);
  const { team: teamB, players: playersB } = makeTeam("team-b", [5.0, 3.5]);
  const players = [...playersA, ...playersB];

  const sorted = sortTeamsForGroupSeeding(
    [teamA, teamB],
    players,
    TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL
  );

  assert.equal(sorted[0].id, "team-b");
  assert.equal(sorted[0].seed, 1);
  assert.equal(sorted[0].topPlayerRating, 5);
  assert.equal(sorted[0].totalRating, 8.5);
  assert.equal(sorted[1].id, "team-a");
  assert.equal(sorted[1].seed, 2);
  assert.equal(sorted[1].totalRating, 8);
});

test("assignSeededTeamsToGroups — 16 đội chia 4 bảng snake theo ace + tổng điểm", () => {
  const players = [];
  const teams = Array.from({ length: 16 }, (_, index) => {
    const top = 5 - index * 0.1;
    const second = 3 + index * 0.05;
    const { team, players: roster } = makeTeam(`team-${index + 1}`, [top, second]);
    players.push(...roster);
    return team;
  });

  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL },
    teams,
  });

  const { teamData: grouped } = assignSeededTeamsToGroups(teamData, {
    groupCount: 4,
    players,
    seedingMode: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
  });

  assert.equal(grouped.groups.length, 4);
  grouped.groups.forEach((group) => {
    assert.equal(group.teamIds.length, 4);
  });

  const seedByTeamId = new Map(grouped.teams.map((team) => [team.id, team.seed]));
  const groupA = grouped.groups[0].teamIds.map((teamId) => seedByTeamId.get(teamId));
  const groupD = grouped.groups[3].teamIds.map((teamId) => seedByTeamId.get(teamId));

  assert.deepEqual(groupA, [1, 8, 9, 16]);
  assert.deepEqual(groupD, [4, 5, 12, 13]);
});

test("assignSeededTeamsToGroups — avg_level giữ thứ tự theo trung bình đội", () => {
  const teams = [
    createTeamRecord({ id: "weak", name: "Weak", avgLevel: 3.2 }),
    createTeamRecord({ id: "strong", name: "Strong", avgLevel: 4.8 }),
    createTeamRecord({ id: "mid", name: "Mid", avgLevel: 4.0 }),
    createTeamRecord({ id: "low", name: "Low", avgLevel: 3.5 }),
  ];

  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.AVG_LEVEL },
    teams,
  });

  const { teamData: grouped } = assignSeededTeamsToGroups(teamData, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
  });

  const seedByTeamId = new Map(grouped.teams.map((team) => [team.id, team.seed]));
  assert.equal(seedByTeamId.get("strong"), 1);
  assert.equal(seedByTeamId.get("mid"), 2);
  assert.equal(seedByTeamId.get("low"), 3);
  assert.equal(seedByTeamId.get("weak"), 4);

  const groupA = grouped.groups[0].teamIds.map((teamId) => seedByTeamId.get(teamId));
  const groupB = grouped.groups[1].teamIds.map((teamId) => seedByTeamId.get(teamId));
  assert.deepEqual(groupA, [1, 4]);
  assert.deepEqual(groupB, [2, 3]);
});

test("assignSeededTeamsToGroups — off mode không gán seed và có thể xáo thứ tự", () => {
  const teams = Array.from({ length: 4 }, (_, index) =>
    createTeamRecord({
      id: `team-${index + 1}`,
      name: `Team ${index + 1}`,
      avgLevel: 4 - index * 0.2,
      seed: index + 1,
    })
  );
  const teamData = initializeTeamTournamentData({
    settings: { groupSeeding: TEAM_GROUP_SEEDING.OFF },
    teams,
  });

  const first = assignSeededTeamsToGroups(teamData, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.OFF,
    randomFn: () => 0,
  });
  const second = assignSeededTeamsToGroups(teamData, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.OFF,
    randomFn: () => 0.99,
  });

  first.teamData.teams.forEach((team) => {
    assert.equal(team.seed, 0);
  });
  assert.notDeepEqual(
    first.teamData.groups[0].teamIds,
    second.teamData.groups[0].teamIds
  );
});

test("sortTeamsForGroupSeeding — thiếu players fallback avgLevel", () => {
  const teams = [
    createTeamRecord({ id: "a", avgLevel: 3.1 }),
    createTeamRecord({ id: "b", avgLevel: 4.2 }),
  ];

  const sorted = sortTeamsForGroupSeeding(
    teams,
    [],
    TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL
  );

  assert.equal(sorted[0].id, "b");
  assert.equal(sorted[1].id, "a");
});

test("assignSeededTeamsToGroups — cảnh báo khi thiếu players ở chế độ ace", () => {
  const teams = [
    createTeamRecord({ id: "a", avgLevel: 4.0 }),
    createTeamRecord({ id: "b", avgLevel: 3.5 }),
  ];
  const teamData = initializeTeamTournamentData({ teams });

  const { warnings } = assignSeededTeamsToGroups(teamData, {
    groupCount: 2,
    seedingMode: TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL,
    players: [],
  });

  assert.ok(warnings.some((warning) => warning.includes("Thiếu danh sách VĐV")));
});

test("computeTeamSeedMetrics — tính ace và tổng điểm từ roster", () => {
  const { team, players } = makeTeam("team-x", [4.8, 3.2]);
  const playersById = new Map(players.map((player) => [player.id, player]));

  const metrics = computeTeamSeedMetrics(team, playersById);
  assert.equal(metrics.topPlayerRating, 4.8);
  assert.equal(metrics.totalRating, 8);
  assert.equal(metrics.avgLevel, 4);
});

test("buildSnakeGroupsFromSortedTeams — giữ thứ tự đã sort", () => {
  const teams = Array.from({ length: 8 }, (_, index) =>
    createTeamRecord({ id: `t${index + 1}`, seed: index + 1 })
  );
  const groups = buildSnakeGroupsFromSortedTeams(teams, 4);
  assert.deepEqual(groups[0].teamIds, ["t1", "t8"]);
  assert.deepEqual(groups[1].teamIds, ["t2", "t7"]);
  assert.deepEqual(groups[2].teamIds, ["t3", "t6"]);
  assert.deepEqual(groups[3].teamIds, ["t4", "t5"]);
});

test("shuffleTeamsForOpenDraw — reset seed về 0", () => {
  const teams = [
    createTeamRecord({ id: "a", seed: 1 }),
    createTeamRecord({ id: "b", seed: 2 }),
  ];
  const shuffled = shuffleTeamsForOpenDraw(teams, () => 0.5);
  shuffled.forEach((team) => {
    assert.equal(team.seed, 0);
  });
});
