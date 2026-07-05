import { createId } from "../../../utils/id.js";
import {
  DEFAULT_TEAM_TOURNAMENT_SETTINGS,
  DISCIPLINE_CATEGORY,
  GENDER_REQUIREMENT,
  LINEUP_SOURCE,
  LINEUP_STATUS,
  MATCHUP_STATUS,
  SUB_MATCH_STATUS,
} from "../constants.js";

const VALID_CATEGORIES = new Set(Object.values(DISCIPLINE_CATEGORY));
const VALID_GENDERS = new Set(Object.values(GENDER_REQUIREMENT));
const VALID_LINEUP_STATUSES = new Set(Object.values(LINEUP_STATUS));
const VALID_MATCHUP_STATUSES = new Set(Object.values(MATCHUP_STATUS));

function uniqueStringIds(values = []) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeDiscipline(discipline, index = 0) {
  if (!discipline?.id) {
    return null;
  }

  const categoryType = VALID_CATEGORIES.has(discipline.categoryType)
    ? discipline.categoryType
    : DISCIPLINE_CATEGORY.DOUBLES;

  const defaultCount =
    categoryType === DISCIPLINE_CATEGORY.SINGLES ? 1 : 2;

  return {
    ...discipline,
    id: String(discipline.id).trim(),
    name: String(discipline.name || `Nội dung ${index + 1}`).trim(),
    categoryType,
    genderRequirement: VALID_GENDERS.has(discipline.genderRequirement)
      ? discipline.genderRequirement
      : GENDER_REQUIREMENT.ANY,
    playerCount: Number.isFinite(Number(discipline.playerCount))
      ? Math.max(1, Number(discipline.playerCount))
      : defaultCount,
    sortOrder: Number.isFinite(Number(discipline.sortOrder))
      ? Number(discipline.sortOrder)
      : index + 1,
    scoringFormat:
      discipline.scoringFormat && typeof discipline.scoringFormat === "object"
        ? discipline.scoringFormat
        : { winPoints: 1, matchFormat: "best_of_1" },
    countsTowardResult: discipline.countsTowardResult !== false,
  };
}

export function normalizeDisciplines(disciplines = []) {
  if (!Array.isArray(disciplines)) {
    return [];
  }

  return disciplines
    .map((discipline, index) => normalizeDiscipline(discipline, index))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function createDisciplineRecord(options = {}) {
  return normalizeDiscipline({
    id: options.id || createId("disc"),
    name: options.name || "Nội dung mới",
    categoryType: options.categoryType || DISCIPLINE_CATEGORY.DOUBLES,
    genderRequirement: options.genderRequirement || GENDER_REQUIREMENT.ANY,
    playerCount: options.playerCount,
    sortOrder: options.sortOrder,
    scoringFormat: options.scoringFormat,
    countsTowardResult: options.countsTowardResult,
  });
}

export function normalizeTeam(team, index = 0) {
  if (!team?.id) {
    return null;
  }

  const playerIds = uniqueStringIds(team.playerIds || []);
  const deputyPlayerIds = uniqueStringIds(team.deputyPlayerIds || []);
  const captainPlayerId = team.captainPlayerId
    ? String(team.captainPlayerId).trim()
    : "";

  return {
    ...team,
    id: String(team.id).trim(),
    name: String(team.name || `Đội ${index + 1}`).trim(),
    color: team.color ? String(team.color).trim() : "",
    logoUrl: team.logoUrl ? String(team.logoUrl).trim() : "",
    playerIds,
    captainPlayerId,
    deputyPlayerIds,
    absentPlayerIds: uniqueStringIds(team.absentPlayerIds || []),
    lockedPlayerIds: uniqueStringIds(team.lockedPlayerIds || []),
  };
}

export function normalizeTeams(teams = []) {
  if (!Array.isArray(teams)) {
    return [];
  }

  return teams
    .map((team, index) => normalizeTeam(team, index))
    .filter(Boolean);
}

export function createTeamRecord(options = {}) {
  return normalizeTeam({
    id: options.id || createId("team"),
    name: options.name || "Đội mới",
    color: options.color || "",
    logoUrl: options.logoUrl || "",
    playerIds: options.playerIds || [],
    captainPlayerId: options.captainPlayerId || "",
    deputyPlayerIds: options.deputyPlayerIds || [],
    absentPlayerIds: options.absentPlayerIds || [],
    lockedPlayerIds: options.lockedPlayerIds || [],
  });
}

export function normalizeSubMatch(subMatch, index = 0) {
  if (!subMatch?.id) {
    return null;
  }

  const status = Object.values(SUB_MATCH_STATUS).includes(subMatch.status)
    ? subMatch.status
    : SUB_MATCH_STATUS.WAITING;

  return {
    ...subMatch,
    id: String(subMatch.id).trim(),
    disciplineId: String(subMatch.disciplineId || "").trim(),
    sortOrder: Number.isFinite(Number(subMatch.sortOrder))
      ? Number(subMatch.sortOrder)
      : index + 1,
    status,
    score:
      subMatch.score && typeof subMatch.score === "object"
        ? {
            teamA: Number(subMatch.score.teamA) || 0,
            teamB: Number(subMatch.score.teamB) || 0,
            games: Array.isArray(subMatch.score.games)
              ? subMatch.score.games.map((game) => ({
                  teamA: Number(game?.teamA) || 0,
                  teamB: Number(game?.teamB) || 0,
                }))
              : [],
          }
        : { teamA: 0, teamB: 0, games: [] },
    winnerTeamId: subMatch.winnerTeamId
      ? String(subMatch.winnerTeamId).trim()
      : "",
    resultConfirmedAt: subMatch.resultConfirmedAt || null,
  };
}

export function normalizeSubMatches(subMatches = []) {
  if (!Array.isArray(subMatches)) {
    return [];
  }

  return subMatches
    .map((subMatch, index) => normalizeSubMatch(subMatch, index))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeMatchup(matchup) {
  if (!matchup?.id) {
    return null;
  }

  const status = VALID_MATCHUP_STATUSES.has(matchup.status)
    ? matchup.status
    : MATCHUP_STATUS.SCHEDULED;

  return {
    ...matchup,
    id: String(matchup.id).trim(),
    teamAId: String(matchup.teamAId || "").trim(),
    teamBId: String(matchup.teamBId || "").trim(),
    scheduledAt: matchup.scheduledAt || null,
    lineupLockAt: matchup.lineupLockAt || null,
    courtLabel: matchup.courtLabel ? String(matchup.courtLabel).trim() : "",
    status,
    subMatches: normalizeSubMatches(matchup.subMatches || []),
    result:
      matchup.result && typeof matchup.result === "object"
        ? {
            teamAWins: Number(matchup.result.teamAWins) || 0,
            teamBWins: Number(matchup.result.teamBWins) || 0,
            teamAPoints: Number(matchup.result.teamAPoints) || 0,
            teamBPoints: Number(matchup.result.teamBPoints) || 0,
            winnerTeamId: matchup.result.winnerTeamId
              ? String(matchup.result.winnerTeamId).trim()
              : "",
          }
        : null,
  };
}

export function normalizeMatchups(matchups = []) {
  if (!Array.isArray(matchups)) {
    return [];
  }

  return matchups
    .map((matchup, index) => normalizeMatchup(matchup, index))
    .filter(Boolean);
}

export function createMatchupRecord(teamAId, teamBId, options = {}) {
  const disciplines = options.disciplines || [];
  const subMatches = disciplines.map((discipline, index) => ({
    id: createId("sub"),
    disciplineId: discipline.id,
    sortOrder: discipline.sortOrder || index + 1,
    status: SUB_MATCH_STATUS.WAITING,
    score: { teamA: 0, teamB: 0 },
    winnerTeamId: "",
  }));

  return normalizeMatchup({
    id: options.id || createId("matchup"),
    teamAId,
    teamBId,
    scheduledAt: options.scheduledAt || null,
    lineupLockAt: options.lineupLockAt || null,
    courtLabel: options.courtLabel || "",
    status: options.status || MATCHUP_STATUS.LINEUP_OPEN,
    subMatches,
    result: null,
  });
}

export function lineupKey(matchupId, teamId) {
  return `${String(matchupId).trim()}::${String(teamId).trim()}`;
}

export function normalizeLineup(lineup) {
  if (!lineup?.teamId || !lineup?.matchupId) {
    return null;
  }

  const status = VALID_LINEUP_STATUSES.has(lineup.status)
    ? lineup.status
    : LINEUP_STATUS.NOT_SUBMITTED;

  const selections =
    lineup.selections && typeof lineup.selections === "object"
      ? Object.entries(lineup.selections).reduce((accumulator, [key, value]) => {
          accumulator[String(key)] = uniqueStringIds(value);
          return accumulator;
        }, {})
      : {};

  return {
    ...lineup,
    matchupId: String(lineup.matchupId).trim(),
    teamId: String(lineup.teamId).trim(),
    status,
    selections,
    submittedAt: lineup.submittedAt || null,
    lockedAt: lineup.lockedAt || null,
    publishedAt: lineup.publishedAt || null,
    source: lineup.source || LINEUP_SOURCE.CAPTAIN,
    auditNote: lineup.auditNote ? String(lineup.auditNote).trim() : "",
  };
}

export function normalizeLineups(lineups = {}) {
  if (!lineups || typeof lineups !== "object") {
    return {};
  }

  return Object.entries(lineups).reduce((accumulator, [key, lineup]) => {
    const normalized = normalizeLineup(lineup);
    if (normalized) {
      accumulator[key] = normalized;
    }
    return accumulator;
  }, {});
}

export function normalizeStanding(standing, index = 0) {
  if (!standing?.teamId) {
    return null;
  }

  return {
    ...standing,
    teamId: String(standing.teamId).trim(),
    rank: Number.isFinite(Number(standing.rank)) ? Number(standing.rank) : index + 1,
    played: Number(standing.played) || 0,
    wins: Number(standing.wins) || 0,
    losses: Number(standing.losses) || 0,
    subMatchWins: Number(standing.subMatchWins) || 0,
    subMatchLosses: Number(standing.subMatchLosses) || 0,
    subMatchDiff: Number(standing.subMatchDiff) || 0,
    pointsScored: Number(standing.pointsScored) || 0,
    pointsConceded: Number(standing.pointsConceded) || 0,
    rankingPoints: Number(standing.rankingPoints) || 0,
  };
}

export function normalizeStandings(standings = []) {
  if (!Array.isArray(standings)) {
    return [];
  }

  return standings
    .map((standing, index) => normalizeStanding(standing, index))
    .filter(Boolean);
}

export function normalizeTeamData(teamData = {}) {
  const settings = {
    ...DEFAULT_TEAM_TOURNAMENT_SETTINGS,
    ...(teamData.settings && typeof teamData.settings === "object"
      ? teamData.settings
      : {}),
  };

  return {
    disciplines: normalizeDisciplines(teamData.disciplines || []),
    teams: normalizeTeams(teamData.teams || []),
    matchups: normalizeMatchups(teamData.matchups || []),
    lineups: normalizeLineups(teamData.lineups || {}),
    standings: normalizeStandings(teamData.standings || []),
    settings,
  };
}

export function createEmptyTeamData(options = {}) {
  return normalizeTeamData({
    disciplines: options.disciplines || [],
    teams: options.teams || [],
    matchups: options.matchups || [],
    lineups: {},
    standings: [],
    settings: options.settings || {},
  });
}

export function findTeam(teamData, teamId) {
  return (teamData?.teams || []).find((team) => team.id === String(teamId)) || null;
}

export function findMatchup(teamData, matchupId) {
  return (teamData?.matchups || []).find((matchup) => matchup.id === String(matchupId)) || null;
}

export function getLineup(teamData, matchupId, teamId) {
  const key = lineupKey(matchupId, teamId);
  return teamData?.lineups?.[key] || null;
}
