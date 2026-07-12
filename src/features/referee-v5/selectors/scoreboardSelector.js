import { VIEW_MODE } from "../constants/viewModes.js";
import { logicalPositionToScreenPosition } from "../engines/courtPositionEngine.js";
import { findPlayerInState } from "../domain/matchState.js";
import { resolveServeDirection } from "./serveContextSelector.js";

export function buildServeContext(state, viewMode = VIEW_MODE.REFEREE_PHYSICAL_VIEW) {
  const server = findPlayerInState(state, state.servingPlayerId);
  const receiver = findPlayerInState(state, state.receivingPlayerId);

  if (!server || !receiver) {
    return null;
  }

  return {
    servingPlayerId: state.servingPlayerId,
    receivingPlayerId: state.receivingPlayerId,
    servingTeamId: state.servingTeamId,
    receivingTeamId: state.receivingTeamId,
    serverNumber: state.serverNumber,
    servingLogicalServiceSide: server.logicalServiceSide,
    receivingLogicalServiceSide: receiver.logicalServiceSide,
    servingCourtEnd: server.courtEnd,
    receivingCourtEnd: receiver.courtEnd,
    serveDirection: resolveServeDirection(state),
    serverScreenPosition: logicalPositionToScreenPosition({
      courtEnd: server.courtEnd,
      logicalServiceSide: server.logicalServiceSide,
      viewMode,
    }),
    receiverScreenPosition: logicalPositionToScreenPosition({
      courtEnd: receiver.courtEnd,
      logicalServiceSide: receiver.logicalServiceSide,
      viewMode,
    }),
  };
}

export function formatSideOutScoreLine(state) {
  const teamA = state.teams.teamA.score;
  const teamB = state.teams.teamB.score;
  const serverNumber = state.serverNumber ?? 1;
  return `${teamA} – ${teamB} – ${serverNumber}`;
}
