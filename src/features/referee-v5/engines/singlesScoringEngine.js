import { DOMAIN_EVENT_TYPE } from "../constants/eventTypes.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import {
  cloneMatchState,
  findPlayerInState,
  getTeamById,
  getTeamSideKey,
} from "../domain/matchState.js";
import { setPlayerLogicalSide } from "./courtPositionEngine.js";
import { recomputeServeContext } from "./receiverResolver.js";
import { checkGameComplete } from "./sideOutScoringEngine.js";

function serviceSideForScore(score) {
  return Number(score) % 2 === 0
    ? LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
    : LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT;
}

function alignServerToScoreSide(state) {
  const team = getTeamById(state, state.servingTeamId);
  if (!team) {
    return state;
  }
  const requiredSide = serviceSideForScore(team.score);
  const server = findPlayerInState(state, state.servingPlayerId);
  if (!server || server.logicalServiceSide === requiredSide) {
    return state;
  }
  return setPlayerLogicalSide(state, state.servingTeamId, state.servingPlayerId, requiredSide);
}

/**
 * Singles side-out scoring.
 */
export function applySinglesSideOutEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [];
  let next = cloneMatchState(state);

  if (String(winningTeamId) === String(next.servingTeamId)) {
    const key = getTeamSideKey(next, winningTeamId);
    next.teams[key].score += 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.POINT_AWARDED);

    next = alignServerToScoreSide(next);
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

  const newServingTeamId = winningTeamId;
  const team = getTeamById(next, newServingTeamId);
  next.servingTeamId = String(newServingTeamId);
  next.servingPlayerId = String(team.players[0].playerId);
  next.serverNumber = null;

  next = alignServerToScoreSide(next);
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }

  return {
    ok: true,
    state: context.state,
    generatedEvents: [
      ...generatedEvents,
      DOMAIN_EVENT_TYPE.SIDE_OUT,
      DOMAIN_EVENT_TYPE.SERVE_CHANGED,
    ],
  };
}

export function applySinglesRallyEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [DOMAIN_EVENT_TYPE.POINT_AWARDED];
  let next = cloneMatchState(state);
  const key = getTeamSideKey(next, winningTeamId);
  next.teams[key].score += 1;

  next.servingTeamId = String(winningTeamId);
  const team = getTeamById(next, winningTeamId);
  next.servingPlayerId = String(team.players[0].playerId);
  next.serverNumber = null;

  next = alignServerToScoreSide(next);
  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }

  if (checkGameComplete(next, config)) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
  }

  return { ok: true, state: context.state, generatedEvents };
}

export function applySinglesScoringEvent(state, winningTeamId, config = {}) {
  if (state.scoringFormat === "rally") {
    return applySinglesRallyEvent(state, winningTeamId, config);
  }
  return applySinglesSideOutEvent(state, winningTeamId, config);
}

export { serviceSideForScore };
