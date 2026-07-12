import { COURT_END } from "../constants/courtEnds.js";
import { LOGICAL_SERVICE_SIDE } from "../constants/courtSides.js";
import { findPlayerInState } from "../domain/matchState.js";

export const SERVE_DIRECTION = Object.freeze({
  NEAR_RIGHT_TO_FAR_LEFT: "NEAR_RIGHT_TO_FAR_LEFT",
  NEAR_LEFT_TO_FAR_RIGHT: "NEAR_LEFT_TO_FAR_RIGHT",
  FAR_RIGHT_TO_NEAR_LEFT: "FAR_RIGHT_TO_NEAR_LEFT",
  FAR_LEFT_TO_NEAR_RIGHT: "FAR_LEFT_TO_NEAR_RIGHT",
});

const DIRECTION_LOOKUP = Object.freeze({
  [`${COURT_END.NEAR_END}:${LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT}`]:
    SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT,
  [`${COURT_END.NEAR_END}:${LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT}`]:
    SERVE_DIRECTION.NEAR_LEFT_TO_FAR_RIGHT,
  [`${COURT_END.FAR_END}:${LOGICAL_SERVICE_SIDE.RIGHT_SERVICE_COURT}`]:
    SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT,
  [`${COURT_END.FAR_END}:${LOGICAL_SERVICE_SIDE.LEFT_SERVICE_COURT}`]:
    SERVE_DIRECTION.FAR_LEFT_TO_NEAR_RIGHT,
});

/**
 * Diagonal serve direction from server logical position (screen-diagonal naming).
 */
export function resolveServeDirection(matchState) {
  const server = findPlayerInState(matchState, matchState.servingPlayerId);
  const receiver = findPlayerInState(matchState, matchState.receivingPlayerId);

  if (!server || !receiver) {
    return null;
  }

  const key = `${server.courtEnd}:${server.logicalServiceSide}`;
  return DIRECTION_LOOKUP[key] || null;
}

export function resolveServeDirectionFromServer(server) {
  if (!server) {
    return null;
  }
  const key = `${server.courtEnd}:${server.logicalServiceSide}`;
  return DIRECTION_LOOKUP[key] || null;
}
