import { MATCH_STATUS } from "../constants/eventTypes.js";
import { MATCH_TYPE } from "../constants/matchTypes.js";
import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { validateServeSnapshot } from "../domain/matchValidation.js";
import { resolveReceivingPlayer } from "../engines/receiverResolver.js";
import { REFEREE_V5_ERROR, createPersistenceError } from "./errors.js";

export function validatePersistedMatchState(state) {
  if (!state?.teams?.teamA || !state?.teams?.teamB) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Thiếu thông tin đội.");
  }

  const endA = state.teams.teamA.courtEnd;
  const endB = state.teams.teamB.courtEnd;
  if (endA === endB) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Hai đội cùng court end.");
  }

  for (const side of ["teamA", "teamB"]) {
    const team = state.teams[side];
    if (state.matchType === MATCH_TYPE.DOUBLES && team.players.length === 2) {
      const sides = team.players.map((p) => p.logicalServiceSide);
      if (sides[0] === sides[1]) {
        return createPersistenceError(
          REFEREE_V5_ERROR.INVALID_MATCH_STATE,
          `${side} có hai VĐV cùng logical service side.`
        );
      }
    }
  }

  if (state.matchType === MATCH_TYPE.SINGLES && state.serverNumber != null) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Singles không có server number.");
  }

  if (state.servingPlayerId && state.receivingPlayerId) {
    const receiverResult = resolveReceivingPlayer(state);
    const snapshotCheck = validateServeSnapshot(state, receiverResult);
    if (!snapshotCheck.ok) {
      return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, snapshotCheck.error);
    }
  }

  if (state.status === MATCH_STATUS.LOCKED && !state.lockedAt) {
    return { ok: true, warning: "locked_without_timestamp" };
  }

  const validEnds = [COURT_END.NEAR_END, COURT_END.FAR_END];
  if (!validEnds.includes(endA) || !validEnds.includes(endB)) {
    return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Court end không hợp lệ.");
  }

  const validSides = [LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT, LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT];
  for (const side of ["teamA", "teamB"]) {
    for (const player of state.teams[side].players) {
      if (!validSides.includes(player.logicalServiceSide)) {
        return createPersistenceError(REFEREE_V5_ERROR.INVALID_MATCH_STATE, "Logical service side không hợp lệ.");
      }
    }
  }

  return { ok: true };
}

export function assertVersionIncrement(beforeVersion, afterVersion) {
  if (Number(afterVersion) !== Number(beforeVersion) + 1) {
    return createPersistenceError(
      REFEREE_V5_ERROR.INVALID_MATCH_STATE,
      "State version phải tăng đúng 1."
    );
  }
  return { ok: true };
}
