import { DOMAIN_EVENT_TYPE } from "../../../constants/eventTypes.js";
import {
  LOGICAL_SERVICE_SIDE,
  flipLogicalServiceSide,
} from "../../../constants/courtSides.js";
import { RULE_SET_ID } from "../../../constants/scoringStrategy.js";
import {
  cloneMatchState,
  getPartner,
  getTeamById,
  getTeamSideKey,
} from "../../../domain/matchState.js";
import { setPlayerLogicalSide } from "../../courtPositionEngine.js";
import { recomputeServeContext } from "../../receiverResolver.js";
import { checkGameComplete } from "../../sideOutScoringEngine.js";
import { applySwitchEnds } from "../../switchEndsEngine.js";
/** USAP Rule 21.B — end-change milestone by game target score. */
export function resolveSideSwitchThreshold(pointsToWin) {
  const target = Number(pointsToWin) || 11;
  if (target <= 11) {
    return 6;
  }
  if (target <= 15) {
    return 8;
  }
  return 11;
}

/** Even score → right service box; odd → left (USAP §5 / 14.A). */
export function serviceSideForScore(score) {
  return Number(score) % 2 === 0
    ? LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
    : LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT;
}

function alignTeamForScore(state, teamId, serverPlayerId) {
  const team = getTeamById(state, teamId);
  if (!team) {
    return state;
  }

  const requiredServerSide = serviceSideForScore(team.score);
  const partner = getPartner(team, serverPlayerId);
  let next = setPlayerLogicalSide(state, teamId, serverPlayerId, requiredServerSide);

  if (partner) {
    next = setPlayerLogicalSide(
      next,
      teamId,
      partner.playerId,
      flipLogicalServiceSide(requiredServerSide)
    );
  }

  return next;
}

function pickServerPlayerId(state, teamId) {
  const team = getTeamById(state, teamId);
  if (!team) {
    return null;
  }

  const requiredServerSide = serviceSideForScore(team.score);
  const onSide = team.players.find(
    (player) => player.logicalServiceSide === requiredServerSide
  );
  return onSide?.playerId || team.players[0]?.playerId || null;
}

function shouldSwitchEndsAfterScore(state, config, scoreBefore) {
  const threshold = resolveSideSwitchThreshold(config.pointsToWin ?? state.pointsToWin);
  const maxBefore = Math.max(scoreBefore.teamA, scoreBefore.teamB);
  const maxAfter = Math.max(state.teams.teamA.score, state.teams.teamB.score);
  return maxBefore < threshold && maxAfter >= threshold;
}

/**
 * USAP 2026 Provisional Rally — doubles only.
 * - Point every rally (no freeze)
 * - One server per serving stint; side-out on serve loss (no Server 1/2)
 * - Positions by team score parity; end switch per Rule 21.B
 */
export function applyUsap2026ProvisionalRallyDoubles(state, winningTeamId, config = {}) {
  const generatedEvents = [DOMAIN_EVENT_TYPE.POINT_AWARDED];
  const scoreBefore = {
    teamA: state.teams.teamA.score,
    teamB: state.teams.teamB.score,
  };

  let next = cloneMatchState(state);
  const winningKey = getTeamSideKey(next, winningTeamId);
  if (!winningKey) {
    return { ok: false, error: "INVALID_WINNING_TEAM" };
  }

  next.teams[winningKey].score += 1;
  const wasServing = String(next.servingTeamId) === String(winningTeamId);

  if (wasServing) {
    next = alignTeamForScore(next, next.servingTeamId, next.servingPlayerId);
    next.serverNumber = null;
    generatedEvents.push(DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED, DOMAIN_EVENT_TYPE.SERVE_CHANGED);
  } else {
    generatedEvents.push(DOMAIN_EVENT_TYPE.SIDE_OUT);

    const newServerId = pickServerPlayerId(next, winningTeamId);
    if (!newServerId) {
      return { ok: false, error: "RALLY_SERVER_NOT_FOUND" };
    }

    next = alignTeamForScore(next, winningTeamId, newServerId);
    next.servingTeamId = String(winningTeamId);
    next.servingPlayerId = String(newServerId);
    next.serverNumber = null;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);
  }

  if (shouldSwitchEndsAfterScore(next, config, scoreBefore)) {
    const switchResult = applySwitchEnds(next);
    if (!switchResult.ok) {
      return switchResult;
    }
    next = switchResult.state;
    generatedEvents.push(...switchResult.generatedEvents);
  }

  const context = recomputeServeContext(next);
  if (!context.ok) {
    return context;
  }
  next = context.state;

  if (checkGameComplete(next, config)) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.GAME_COMPLETED);
  }

  return { ok: true, state: next, generatedEvents };
}

export const usap2026ProvisionalRallyDoublesStrategy = {
  id: RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1,

  applyRallyResult(state, winningTeamId, config) {
    return applyUsap2026ProvisionalRallyDoubles(state, winningTeamId, config);
  },
};
