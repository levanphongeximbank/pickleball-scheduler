import { DOMAIN_EVENT_TYPE } from "../constants/eventTypes.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import {
  cloneMatchState,
  getPartner,
  getTeamById,
  getTeamSideKey,
} from "../domain/matchState.js";
import { switchPartnersOnTeam } from "./courtPositionEngine.js";
import { recomputeServeContext } from "./receiverResolver.js";

export function checkGameComplete(state, config = {}) {
  const pointsToWin = Number(config.pointsToWin ?? state.pointsToWin) || 11;
  const winBy = Number(config.winBy ?? state.winBy) || 2;
  const maximumScore = config.maximumScore ?? state.maximumScore;

  const scoreA = state.teams.teamA.score;
  const scoreB = state.teams.teamB.score;
  const leader = Math.max(scoreA, scoreB);
  const trailer = Math.min(scoreA, scoreB);

  if (leader < pointsToWin) {
    return false;
  }

  if (maximumScore != null && leader >= maximumScore) {
    return true;
  }

  return leader - trailer >= winBy;
}

function pickInitialServerForTeam(state, teamId, preferredSide = LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT) {
  const team = getTeamById(state, teamId);
  if (!team) {
    return null;
  }
  const onPreferred = team.players.find(
    (player) => player.logicalServiceSide === preferredSide
  );
  return onPreferred?.playerId || team.players[0]?.playerId || null;
}

function activateServer2(state, servingTeamId) {
  const team = getTeamById(state, servingTeamId);
  const partner = getPartner(team, state.servingPlayerId);
  if (!partner) {
    return { ok: false, error: "PARTNER_NOT_FOUND" };
  }

  let next = cloneMatchState(state);
  next.servingPlayerId = partner.playerId;
  next.serverNumber = 2;

  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }

  return {
    ok: true,
    state: context.state,
    generatedEvents: [DOMAIN_EVENT_TYPE.SECOND_SERVER_ACTIVATED, DOMAIN_EVENT_TYPE.SERVE_CHANGED],
  };
}

function performSideOut(state, newServingTeamId, config) {
  const preferredSide =
    config.sideOutInitialServerSide || LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT;
  const newServerId = pickInitialServerForTeam(state, newServingTeamId, preferredSide);

  if (!newServerId) {
    return { ok: false, error: "SIDE_OUT_SERVER_NOT_FOUND" };
  }

  let next = cloneMatchState(state);
  next.servingTeamId = String(newServingTeamId);
  next.servingPlayerId = String(newServerId);
  next.serverNumber = 1;

  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }

  return {
    ok: true,
    state: context.state,
    generatedEvents: [DOMAIN_EVENT_TYPE.SIDE_OUT, DOMAIN_EVENT_TYPE.SERVE_CHANGED],
  };
}

/**
 * Side-out doubles rally result.
 */
export function applySideOutScoringEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [];
  let next = cloneMatchState(state);

  if (String(winningTeamId) === String(next.servingTeamId)) {
    const key = getTeamSideKey(next, winningTeamId);
    next.teams[key].score += 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.POINT_AWARDED);

    next = switchPartnersOnTeam(next, winningTeamId);
    generatedEvents.push(DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED);

    const context = recomputeServeContext(next);
    if (!context.ok) {
      return context;
    }
    next = context.state;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);

    if (checkGameComplete(next, config)) {
      generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
    }

    return { ok: true, state: next, generatedEvents };
  }

  // Receiving team won rally — no point
  if (Number(next.serverNumber) === 1) {
    return activateServer2(next, next.servingTeamId);
  }

  const newServingTeamId = winningTeamId;
  const sideOutResult = performSideOut(next, newServingTeamId, config);
  if (!sideOutResult.ok) {
    return sideOutResult;
  }

  return {
    ok: true,
    state: sideOutResult.state,
    generatedEvents: [...generatedEvents, ...sideOutResult.generatedEvents],
  };
}

export function applySideOutRallyByTeamKey(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  return applySideOutScoringEvent(state, teamId, config);
}
