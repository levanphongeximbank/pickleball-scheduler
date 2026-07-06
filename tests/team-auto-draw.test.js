import test from "node:test";
import assert from "node:assert/strict";

import { getPlayerGenderKey } from "../src/models/player.js";
import { FORMAT_PRESET } from "../src/features/team-tournament/constants.js";
import {
  applyMlpAutoDraw,
  applyTeamPairing,
  assignSeededTeamsToGroups,
  pairTeamsFromSelectedPlayers,
  suggestMlpTeamsFromPlayers,
} from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { initializeTeamTournamentData } from "../src/features/team-tournament/engines/teamTournamentEngine.js";

function makePlayers(count, startLevel = 4.5) {
  const players = [];
  for (let index = 0; index < count; index += 1) {
    const isMale = index % 2 === 0;
    players.push({
      id: `p${index + 1}`,
      name: isMale ? `Nam ${index + 1}` : `Nữ ${index + 1}`,
      gender: isMale ? "Nam" : "Nữ",
      level: startLevel - index * 0.1,
      rating: startLevel - index * 0.1,
    });
  }
  return players;
}

function makeDiscreteLevelPool() {
  const players = [];
  for (let index = 0; index < 6; index += 1) {
    players.push({
      id: `m${index + 1}`,
      name: `Nam ${index + 1}`,
      gender: "Nam",
      level: 4,
      rating: 4,
    });
  }
  for (let index = 0; index < 2; index += 1) {
    players.push({
      id: `m${6 + index + 1}`,
      name: `Nam yếu ${index + 1}`,
      gender: "Nam",
      level: 3.5,
      rating: 3.5,
    });
  }
  for (let index = 0; index < 4; index += 1) {
    players.push({
      id: `f${index + 1}`,
      name: `Nữ ${index + 1}`,
      gender: "Nữ",
      level: 4.25,
      rating: 4.25,
    });
  }
  for (let index = 0; index < 4; index += 1) {
    players.push({
      id: `f${4 + index + 1}`,
      name: `Nữ yếu ${index + 1}`,
      gender: "Nữ",
      level: 3.75,
      rating: 3.75,
    });
  }
  return players;
}

function teamSpread(teams = []) {
  const levels = teams.map((team) => team.avgLevel || 0);
  return Math.max(...levels) - Math.min(...levels);
}

function maxMaleGapInTeam(team, playerById) {
  const males = team.playerIds
    .map((id) => playerById.get(id))
    .filter((player) => getPlayerGenderKey(player?.gender) === "male");
  if (males.length < 2) {
    return 0;
  }
  const ratings = males.map((player) => player.rating);
  return Math.max(...ratings) - Math.min(...ratings);
}

test("suggestMlpTeamsFromPlayers — 8M+8F tạo 4 đội 2M+2F", () => {
  const players = makePlayers(16);
  const result = suggestMlpTeamsFromPlayers(players);

  assert.equal(result.teams.length, 4);
  result.teams.forEach((team) => {
    assert.equal(team.playerIds.length, 4);
    assert.ok(team.seed >= 1);
    assert.ok(team.avgLevel > 0);
    assert.ok(team.captainPlayerId);
  });
});

test("suggestMlpTeamsFromPlayers — mỗi đội đúng 2 nam 2 nữ", () => {
  const players = makePlayers(12);
  const playerById = new Map(players.map((player) => [player.id, player]));
  const result = suggestMlpTeamsFromPlayers(players);

  result.teams.forEach((team) => {
    const males = team.playerIds.filter(
      (id) => getPlayerGenderKey(playerById.get(id)?.gender) === "male"
    );
    const females = team.playerIds.filter(
      (id) => getPlayerGenderKey(playerById.get(id)?.gender) === "female"
    );
    assert.equal(males.length, 2);
    assert.equal(females.length, 2);
  });
});

test("suggestMlpTeamsFromPlayers — avgLevel các đội gần nhau", () => {
  const players = makePlayers(16, 5);
  const result = suggestMlpTeamsFromPlayers(players);
  const spread = Math.round(teamSpread(result.teams) * 100) / 100;
  assert.ok(spread <= 0.35, `spread too large: ${spread}`);
});

test("pairTeamsFromSelectedPlayers — 8 VĐV, 2 đội MLP → 2 đội 4 người, 0 chờ", () => {
  const players = makePlayers(8);
  const selectedPlayerIds = players.map((player) => player.id);
  const result = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds,
    teamCount: 2,
    teamNames: ["Alpha", "Beta"],
    formatPreset: FORMAT_PRESET.MLP_4,
  });

  assert.equal(result.teams.length, 2);
  assert.equal(result.waitingPlayerIds.length, 0);
  assert.ok(result.teams.some((team) => team.name === "Alpha"));
  assert.ok(result.teams.some((team) => team.name === "Beta"));
  result.teams.forEach((team) => {
    assert.equal(team.playerIds.length, 4);
    assert.equal(team.captainPlayerId, "");
  });
});

test("pairTeamsFromSelectedPlayers — 10 VĐV, 2 đội → 2 đội 4 người, 2 chờ", () => {
  const players = makePlayers(10);
  const selectedPlayerIds = players.map((player) => player.id);
  const result = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds,
    teamCount: 2,
    formatPreset: FORMAT_PRESET.MLP_4,
  });

  assert.equal(result.teams.length, 2);
  assert.equal(result.waitingPlayerIds.length, 2);
});

test("pairTeamsFromSelectedPlayers — pool rating rời rạc spread <= 0.25", () => {
  const players = makeDiscreteLevelPool();
  const result = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds: players.map((player) => player.id),
    teamCount: 4,
    formatPreset: FORMAT_PRESET.MLP_4,
    randomFn: () => 0,
  });

  assert.equal(result.teams.length, 4);
  assert.ok(teamSpread(result.teams) <= 0.25, `spread too large: ${teamSpread(result.teams)}`);
});

test("pairTeamsFromSelectedPlayers — within-team male gap <= 1.0", () => {
  const players = makeDiscreteLevelPool();
  const playerById = new Map(players.map((player) => [player.id, player]));
  const result = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds: players.map((player) => player.id),
    teamCount: 4,
    formatPreset: FORMAT_PRESET.MLP_4,
    randomFn: () => 0,
  });

  result.teams.forEach((team) => {
    assert.ok(
      maxMaleGapInTeam(team, playerById) <= 1.0,
      `male gap too large on ${team.name}`
    );
  });
});

test("pairTeamsFromSelectedPlayers — bước 1 xáo nam mạnh nhất", () => {
  const players = makePlayers(8, 5);
  const topMaleId = players.find((player) => getPlayerGenderKey(player.gender) === "male").id;

  const result = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds: players.map((player) => player.id),
    teamCount: 2,
    teamNames: ["Đội 1", "Đội 2"],
    formatPreset: FORMAT_PRESET.MLP_4,
    randomFn: () => 0,
  });

  const teamWithTopMale = result.teams.find((team) => team.playerIds.includes(topMaleId));
  assert.ok(teamWithTopMale);
  assert.notEqual(teamWithTopMale.name, "Đội 1");
});

test("applyTeamPairing — không tạo groups", () => {
  const teamData = initializeTeamTournamentData({
    settings: { formatPreset: FORMAT_PRESET.MLP_4 },
    groups: [{ id: "g1", name: "Bảng A", teamIds: [] }],
  });
  const players = makePlayers(8);
  const pairing = pairTeamsFromSelectedPlayers({
    players,
    selectedPlayerIds: players.map((player) => player.id),
    teamCount: 2,
    formatPreset: FORMAT_PRESET.MLP_4,
  });

  const teamsWithCaptains = pairing.teams.map((team, index) => ({
    ...team,
    captainPlayerId: team.playerIds[index % team.playerIds.length],
  }));

  const result = applyTeamPairing(teamData, { teams: teamsWithCaptains });
  assert.equal(result.ok, true);
  assert.equal(result.teamData.teams.length, 2);
  assert.equal(result.teamData.groups.length, 0);
  assert.equal(result.teamData.matchups.length, 0);
});

test("assignSeededTeamsToGroups — 4 đội chia 2 bảng skill snake", () => {
  const suggestion = suggestMlpTeamsFromPlayers(makePlayers(16));
  let teamData = initializeTeamTournamentData({
    settings: { formatPreset: "mlp_4" },
    teams: suggestion.teams,
  });

  const { teamData: grouped, balance } = assignSeededTeamsToGroups(teamData);
  assert.equal(grouped.groups.length, 2);
  assert.equal(
    grouped.groups[0].teamIds.length + grouped.groups[1].teamIds.length,
    4
  );
  assert.ok(balance);
  assert.equal(balance.groups.length, 2);
});

test("applyMlpAutoDraw — ghép đội và chia bảng", () => {
  const teamData = initializeTeamTournamentData({
    settings: { formatPreset: "mlp_4" },
  });
  const result = applyMlpAutoDraw(teamData, makePlayers(12));

  assert.equal(result.ok, true);
  assert.equal(result.teamData.teams.length, 3);
  assert.ok(result.teamData.groups.length >= 1);
});
