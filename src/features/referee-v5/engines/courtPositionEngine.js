import { COURT_END, flipCourtEnd } from "../constants/courtEnds.js";
import {
  LOGICAL_SERVICE_SIDE,
  flipLogicalServiceSide,
} from "../constants/courtSides.js";
import { VIEW_MODE, SCREEN_POSITION } from "../constants/viewModes.js";
import { cloneMatchState, findPlayerInState } from "../domain/matchState.js";

/**
 * Map logical court position to screen quadrant (REFEREE_PHYSICAL_VIEW).
 * Cross-court diagonal display: FAR end logical RIGHT renders as TOP_LEFT on screen.
 */
export function logicalPositionToScreenPosition({
  courtEnd,
  logicalServiceSide,
  viewMode = VIEW_MODE.REFEREE_PHYSICAL_VIEW,
}) {
  if (viewMode !== VIEW_MODE.REFEREE_PHYSICAL_VIEW) {
    return null;
  }

  if (courtEnd === COURT_END.NEAR_END) {
    return logicalServiceSide === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
      ? SCREEN_POSITION.SCREEN_BOTTOM_RIGHT
      : SCREEN_POSITION.SCREEN_BOTTOM_LEFT;
  }

  // FAR end — cross-court receiver boxes appear on opposite screen horizontal side
  return logicalServiceSide === LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT
    ? SCREEN_POSITION.SCREEN_TOP_LEFT
    : SCREEN_POSITION.SCREEN_TOP_RIGHT;
}

export function swapTeamCourtEnds(state) {
  const next = cloneMatchState(state);
  const teamAEnd = next.teams.teamA.courtEnd;
  next.teams.teamA.courtEnd = next.teams.teamB.courtEnd;
  next.teams.teamB.courtEnd = teamAEnd;
  return next;
}

export function switchPartnersOnTeam(state, teamId) {
  const next = cloneMatchState(state);
  const key =
    String(next.teams.teamA.teamId) === String(teamId) ? "teamA" : "teamB";
  const team = next.teams[key];
  team.players = team.players.map((player) => ({
    ...player,
    logicalServiceSide: flipLogicalServiceSide(player.logicalServiceSide),
  }));
  return next;
}

export function setPlayerLogicalSide(state, teamId, playerId, logicalServiceSide) {
  const next = cloneMatchState(state);
  const key =
    String(next.teams.teamA.teamId) === String(teamId) ? "teamA" : "teamB";
  next.teams[key].players = next.teams[key].players.map((player) =>
    String(player.playerId) === String(playerId)
      ? { ...player, logicalServiceSide }
      : player
  );
  return next;
}

export function getScreenPositionForPlayer(state, playerId, viewMode = VIEW_MODE.REFEREE_PHYSICAL_VIEW) {
  const player = findPlayerInState(state, playerId);
  if (!player) {
    return null;
  }
  return logicalPositionToScreenPosition({
    courtEnd: player.courtEnd,
    logicalServiceSide: player.logicalServiceSide,
    viewMode,
  });
}

export function invertCourtEndForDisplay(courtEnd) {
  return flipCourtEnd(courtEnd);
}
