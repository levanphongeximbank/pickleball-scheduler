import { getPlayerRatingInternal } from "../../../models/player.js";
import { createId } from "../../../utils/id.js";
import { TEAM_GROUP_SEEDING } from "../constants.js";

function roundRating(value) {
  return Math.round(Number(value) * 100) / 100;
}

function buildPlayersById(players = []) {
  return new Map(players.map((player) => [String(player.id), player]));
}

export function computeTeamSeedMetrics(team, playersById = new Map()) {
  const roster = (team?.playerIds || [])
    .map((playerId) => playersById.get(String(playerId)))
    .filter(Boolean);
  const ratings = roster.map((player) => getPlayerRatingInternal(player));
  const storedAvg = Number(team?.avgLevel) > 0 ? Number(team.avgLevel) : 0;

  if (!ratings.length) {
    return {
      topPlayerRating: storedAvg,
      totalRating: storedAvg,
      avgLevel: storedAvg,
    };
  }

  const totalRating = roundRating(ratings.reduce((sum, rating) => sum + rating, 0));
  const avgLevel = roundRating(totalRating / ratings.length);

  return {
    topPlayerRating: roundRating(Math.max(...ratings)),
    totalRating,
    avgLevel: avgLevel || storedAvg,
  };
}

function compareTeamsForSeed(left, right, seedingMode) {
  if (seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL) {
    if (right.topPlayerRating !== left.topPlayerRating) {
      return right.topPlayerRating - left.topPlayerRating;
    }
    if (right.totalRating !== left.totalRating) {
      return right.totalRating - left.totalRating;
    }
    return String(left.id).localeCompare(String(right.id));
  }

  if (right.avgLevel !== left.avgLevel) {
    return right.avgLevel - left.avgLevel;
  }
  return String(left.id).localeCompare(String(right.id));
}

export function sortTeamsForGroupSeeding(teams = [], players = [], seedingMode) {
  const mode =
    seedingMode === TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL
      ? TEAM_GROUP_SEEDING.TOP_PLAYER_THEN_TOTAL
      : TEAM_GROUP_SEEDING.AVG_LEVEL;
  const playersById = buildPlayersById(players);

  const enriched = teams.map((team) => {
    const metrics = computeTeamSeedMetrics(team, playersById);
    return {
      ...team,
      ...metrics,
    };
  });

  const sorted = [...enriched].sort((left, right) => compareTeamsForSeed(left, right, mode));

  return sorted.map((team, index) => ({
    ...team,
    seed: index + 1,
  }));
}

export function shuffleTeamsForOpenDraw(teams = [], randomFn = Math.random) {
  const shuffled = [...teams];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }

  return shuffled.map((team) => ({
    ...team,
    seed: 0,
  }));
}

export function buildSnakeGroupsFromSortedTeams(teams = [], groupCount = 2) {
  const count = Math.max(1, Math.min(Number(groupCount) || 1, teams.length));
  const groups = Array.from({ length: count }, (_, index) => ({
    id: createId("grp"),
    name: `Bảng ${String.fromCharCode(65 + index)}`,
    teamIds: [],
  }));

  teams.forEach((team, index) => {
    const round = Math.floor(index / count);
    const position = index % count;
    const groupIndex = round % 2 === 0 ? position : count - 1 - position;
    groups[groupIndex].teamIds.push(team.id);
  });

  return groups;
}

export function resolveGroupSeedingMode(value) {
  const modes = Object.values(TEAM_GROUP_SEEDING);
  if (modes.includes(value)) {
    return value;
  }
  return TEAM_GROUP_SEEDING.AVG_LEVEL;
}
