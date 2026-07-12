import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { RALLY_VARIANT, SCORING_FORMAT } from "../constants/scoringFormats.js";
import {
  findPlayerInState,
  listAllPlayerIds,
} from "./matchState.js";

export function validateInitializeConfig(config) {
  const errors = [];

  if (!config?.teams?.teamA?.teamId || !config?.teams?.teamB?.teamId) {
    errors.push("Hai đội phải có teamId.");
  }

  if (String(config?.teams?.teamA?.teamId) === String(config?.teams?.teamB?.teamId)) {
    errors.push("Hai đội phải khác nhau.");
  }

  const teamAPlayers = config?.teams?.teamA?.players || [];
  const teamBPlayers = config?.teams?.teamB?.players || [];
  const allIds = [...teamAPlayers, ...teamBPlayers].map((player) => String(player.playerId));

  if (new Set(allIds).size !== allIds.length) {
    errors.push("VĐV không được trùng.");
  }

  if (config.matchType === MATCH_TYPE.SINGLES) {
    if (teamAPlayers.length !== 1 || teamBPlayers.length !== 1) {
      errors.push("Singles phải có một VĐV mỗi đội.");
    }
  }

  if (config.matchType === MATCH_TYPE.DOUBLES) {
    if (teamAPlayers.length !== 2 || teamBPlayers.length !== 2) {
      errors.push("Doubles phải có hai VĐV mỗi đội.");
    }

    for (const side of ["teamA", "teamB"]) {
      const players = config.teams[side].players;
      const sides = players.map((player) => player.logicalServiceSide);
      if (
        !sides.includes(LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT) ||
        !sides.includes(LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT)
      ) {
        errors.push(`${side} phải có một VĐV trái và một VĐV phải.`);
      }
    }
  }

  if (config.teams?.teamA?.courtEnd === config.teams?.teamB?.courtEnd) {
    errors.push("Hai đội không được cùng court end.");
  }

  if (!config.firstServingTeamId) {
    errors.push("Thiếu đội giao đầu tiên.");
  }

  if (!config.firstServingPlayerId) {
    errors.push("Thiếu người giao đầu tiên.");
  }

  if (
    config.rallyVariant === RALLY_VARIANT.MLP ||
    config.scoringFormat === "mlp_rally" ||
    config.rallyServeRotation === "mlp"
  ) {
    errors.push("MLP_RALLY_NOT_SUPPORTED");
  }

  if (
    config.scoringFormat === SCORING_FORMAT.RALLY &&
    config.rallyVariant === RALLY_VARIANT.MLP
  ) {
    errors.push("MLP_RALLY_NOT_SUPPORTED");
  }

  const serverTeam =
    String(config.firstServingTeamId) === String(config.teams?.teamA?.teamId)
      ? config.teams.teamA
      : config.teams.teamB;

  if (
    serverTeam &&
    !serverTeam.players.some(
      (player) => String(player.playerId) === String(config.firstServingPlayerId)
    )
  ) {
    errors.push("Người giao phải thuộc đội giao.");
  }

  return errors;
}

export function validateServeSnapshot(state, receiverResult) {
  if (!receiverResult?.ok) {
    return receiverResult;
  }

  const server = findPlayerInState(state, state.servingPlayerId);
  const receiver = findPlayerInState(state, state.receivingPlayerId);

  if (!server || !receiver) {
    return { ok: false, error: "SERVER_OR_RECEIVER_MISSING" };
  }

  if (String(server.teamId) === String(receiver.teamId)) {
    return { ok: false, error: "RECEIVER_SAME_TEAM" };
  }

  if (
    state.matchType !== MATCH_TYPE.SINGLES &&
    server.logicalServiceSide !== receiver.logicalServiceSide
  ) {
    return { ok: false, error: "RECEIVER_NOT_DIAGONAL" };
  }

  if (String(server.courtEnd) === String(receiver.courtEnd)) {
    return { ok: false, error: "RECEIVER_SAME_END" };
  }

  const knownIds = new Set(listAllPlayerIds(state));
  if (!knownIds.has(state.servingPlayerId) || !knownIds.has(state.receivingPlayerId)) {
    return { ok: false, error: "PLAYER_NOT_IN_MATCH" };
  }

  return { ok: true };
}

export function validateEventPreconditions(state, event) {
  if (state.status === "locked" && event.eventType !== "UNDO_LAST_EVENT") {
    return { ok: false, error: "MATCH_LOCKED" };
  }

  if (Number(event.expectedVersion) !== Number(state.version)) {
    return { ok: false, error: "VERSION_CONFLICT" };
  }

  if (Number(event.sequence) !== Number(state.lastEventSequence) + 1) {
    return { ok: false, error: "SEQUENCE_GAP" };
  }

  return { ok: true };
}

export function assertDifferentCourtEnds(teamAEnd, teamBEnd) {
  return teamAEnd !== teamBEnd && [COURT_END.NEAR_END, COURT_END.FAR_END].includes(teamAEnd);
}
