import { STATE_SCHEMA_VERSION } from "../constants/stateSchema.js";
import { COURT_END } from "../constants/courtEnds.js";
import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { SCORING_FORMAT } from "../constants/scoringFormats.js";

export function createEmptyTeamState({ teamId, courtEnd, players = [] }) {
  return {
    teamId: String(teamId),
    courtEnd,
    score: 0,
    players: players.map((player) => ({
      playerId: String(player.playerId),
      logicalServiceSide: player.logicalServiceSide,
    })),
  };
}

export function cloneMatchState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function getTeamSideKey(state, teamId) {
  if (String(state.teams.teamA.teamId) === String(teamId)) {
    return "teamA";
  }
  if (String(state.teams.teamB.teamId) === String(teamId)) {
    return "teamB";
  }
  return "";
}

export function getTeamById(state, teamId) {
  const key = getTeamSideKey(state, teamId);
  return key ? state.teams[key] : null;
}

export function getOpposingTeamId(state, teamId) {
  const key = getTeamSideKey(state, teamId);
  if (key === "teamA") {
    return state.teams.teamB.teamId;
  }
  if (key === "teamB") {
    return state.teams.teamA.teamId;
  }
  return "";
}

export function findPlayerInState(state, playerId) {
  for (const side of ["teamA", "teamB"]) {
    const team = state.teams[side];
    const player = team.players.find((item) => String(item.playerId) === String(playerId));
    if (player) {
      return {
        ...player,
        teamId: team.teamId,
        courtEnd: team.courtEnd,
      };
    }
  }
  return null;
}

export function createInitialMatchStateSkeleton(config) {
  return {
    matchId: String(config.matchId || ""),
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    matchType: config.matchType || MATCH_TYPE.DOUBLES,
    status: MATCH_STATUS.NOT_STARTED,
    version: 0,
    scoringFormat: config.scoringFormat || SCORING_FORMAT.SIDE_OUT,
    bestOf: Number(config.bestOf) || 1,
    pointsToWin: Number(config.pointsToWin) || 11,
    winBy: Number(config.winBy) || 2,
    maximumScore: config.maximumScore ?? null,
    currentGameNumber: 1,
    teams: {
      teamA: createEmptyTeamState({ teamId: "", courtEnd: COURT_END.NEAR_END, players: [] }),
      teamB: createEmptyTeamState({ teamId: "", courtEnd: COURT_END.FAR_END, players: [] }),
    },
    servingTeamId: "",
    servingPlayerId: "",
    receivingTeamId: "",
    receivingPlayerId: "",
    serverNumber: config.matchType === MATCH_TYPE.SINGLES ? null : 1,
    games: [],
    lastEventSequence: 0,
  };
}

export function incrementVersion(state) {
  return {
    ...state,
    version: Number(state.version || 0) + 1,
    lastEventSequence: Number(state.lastEventSequence || 0) + 1,
  };
}

export function setServeContext(state, context) {
  return {
    ...state,
    servingTeamId: context.servingTeamId,
    servingPlayerId: context.servingPlayerId,
    receivingTeamId: context.receivingTeamId,
    receivingPlayerId: context.receivingPlayerId,
    serverNumber: context.serverNumber,
  };
}

export function isDoublesMatch(state) {
  return state.matchType === MATCH_TYPE.DOUBLES;
}

export function isSinglesMatch(state) {
  return state.matchType === MATCH_TYPE.SINGLES;
}

export function getTeamScore(state, teamId) {
  const team = getTeamById(state, teamId);
  return team ? Number(team.score) || 0 : 0;
}

export function setTeamScore(state, teamId, score) {
  const key = getTeamSideKey(state, teamId);
  if (!key) {
    return state;
  }
  const next = cloneMatchState(state);
  next.teams[key].score = Math.max(0, Number(score) || 0);
  return next;
}

export function listAllPlayerIds(state) {
  return [
    ...state.teams.teamA.players.map((player) => player.playerId),
    ...state.teams.teamB.players.map((player) => player.playerId),
  ];
}

export function opposingTeamKey(teamKey) {
  return teamKey === "teamA" ? "teamB" : "teamA";
}

export function getPlayerOnSide(team, logicalServiceSide) {
  return team.players.find((player) => player.logicalServiceSide === logicalServiceSide) || null;
}

export function getPartner(team, playerId) {
  return team.players.find((player) => String(player.playerId) !== String(playerId)) || null;
}
