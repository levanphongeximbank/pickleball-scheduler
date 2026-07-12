import { DOMAIN_EVENT_TYPE } from "../constants/eventTypes.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import {
  cloneMatchState,
  getTeamSideKey,
} from "../domain/matchState.js";
import { switchPartnersOnTeam } from "./courtPositionEngine.js";
import { recomputeServeContext } from "./receiverResolver.js";
import { checkGameComplete } from "./sideOutScoringEngine.js";

/**
 * Basic rally scoring — OWNER DECISION REQUIRED for full MLP rotation rules.
 * Current behavior:
 * - Winning team scores +1
 * - Serve transfers to winning team
 * - Server = player on RIGHT side of winning team (initial)
 * - Partners switch after winning team retains/converts serve (simplified MLP)
 */
export function applyRallyScoringEvent(state, winningTeamId, config = {}) {
  const generatedEvents = [DOMAIN_EVENT_TYPE.POINT_AWARDED];
  let next = cloneMatchState(state);
  const key = getTeamSideKey(next, winningTeamId);

  if (!key) {
    return { ok: false, error: "INVALID_WINNING_TEAM" };
  }

  next.teams[key].score += 1;

  const wasServing = String(next.servingTeamId) === String(winningTeamId);

  if (!wasServing) {
    const rightPlayer = next.teams[key].players.find(
      (player) => player.logicalServiceSide === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
    );
    next.servingTeamId = String(winningTeamId);
    next.servingPlayerId = String(rightPlayer?.playerId || next.teams[key].players[0].playerId);
    next.serverNumber = 1;
    generatedEvents.push(DOMAIN_EVENT_TYPE.SERVE_CHANGED);
  } else {
    next = switchPartnersOnTeam(next, winningTeamId);
    generatedEvents.push(DOMAIN_EVENT_TYPE.PLAYERS_SWITCHED);
  }

  const sideSwitchAt = Number(config.sideSwitchAt ?? 11);
  const totalPoints = next.teams.teamA.score + next.teams.teamB.score;
  if (sideSwitchAt > 0 && totalPoints === sideSwitchAt) {
    generatedEvents.push(DOMAIN_EVENT_TYPE.ENDS_SWITCHED);
    // End switch handled separately if needed — milestone only flagged here
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

export function applyRallyScoringByTeamKey(state, teamKey, config) {
  const teamId = state.teams[teamKey].teamId;
  return applyRallyScoringEvent(state, teamId, config);
}
