import { MATCH_TYPE } from "../constants/matchTypes.js";
import {
  findPlayerInState,
  getOpposingTeamId,
  getTeamById,
} from "../domain/matchState.js";

/**
 * Resolve người đỡ bóng — same logical service side on opponent end (doubles).
 * Singles: sole opponent player (cross-court direction derived separately).
 */
export function resolveReceivingPlayer(state) {
  const server = findPlayerInState(state, state.servingPlayerId);
  if (!server) {
    return { ok: false, error: "SERVER_NOT_FOUND" };
  }

  const opposingTeamId = getOpposingTeamId(state, server.teamId);
  const opposingTeam = getTeamById(state, opposingTeamId);
  if (!opposingTeam) {
    return { ok: false, error: "OPPONENT_NOT_FOUND" };
  }

  let receiver;

  if (state.matchType === MATCH_TYPE.SINGLES) {
    receiver = opposingTeam.players[0];
  } else {
    const legalSide = server.logicalServiceSide;
    receiver = opposingTeam.players.find(
      (player) => player.logicalServiceSide === legalSide
    );
  }

  if (!receiver) {
    return { ok: false, error: "RECEIVER_NOT_FOUND" };
  }

  if (String(receiver.playerId) === String(server.playerId)) {
    return { ok: false, error: "RECEIVER_SAME_AS_SERVER" };
  }

  return {
    ok: true,
    receivingPlayerId: receiver.playerId,
    receivingTeamId: opposingTeamId,
    receivingLogicalServiceSide: receiver.logicalServiceSide,
    servingLogicalServiceSide: server.logicalServiceSide,
    servingCourtEnd: server.courtEnd,
    receivingCourtEnd: opposingTeam.courtEnd,
  };
}

export function applyReceiverToState(state, receiverResult) {
  if (!receiverResult?.ok) {
    return state;
  }
  return {
    ...state,
    receivingPlayerId: receiverResult.receivingPlayerId,
    receivingTeamId: receiverResult.receivingTeamId,
  };
}

export function recomputeServeContext(state) {
  const receiverResult = resolveReceivingPlayer(state);
  if (!receiverResult.ok) {
    return { ok: false, error: receiverResult.error, state };
  }

  const nextState = applyReceiverToState(state, receiverResult);
  return { ok: true, state: nextState, receiverResult };
}
