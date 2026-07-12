import { SCREEN_POSITION } from "../constants/viewModes.js";
import { SERVE_DIRECTION } from "./serveContextSelector.js";

/** Percent coordinates for court overlay (REFEREE_PHYSICAL_VIEW). */
export const SCREEN_COORDINATES = Object.freeze({
  [SCREEN_POSITION.SCREEN_TOP_LEFT]: { x: 28, y: 18 },
  [SCREEN_POSITION.SCREEN_TOP_RIGHT]: { x: 72, y: 18 },
  [SCREEN_POSITION.SCREEN_BOTTOM_LEFT]: { x: 28, y: 82 },
  [SCREEN_POSITION.SCREEN_BOTTOM_RIGHT]: { x: 72, y: 82 },
});

export function screenPositionToCoords(screenPosition) {
  return SCREEN_COORDINATES[screenPosition] || { x: 50, y: 50 };
}

export function isDiagonalServeDirection(serveDirection) {
  return Object.values(SERVE_DIRECTION).includes(serveDirection);
}

export function isStraightCourtArrow(fromCoords, toCoords) {
  const sameRow = Math.abs(fromCoords.y - toCoords.y) < 2;
  const sameCol = Math.abs(fromCoords.x - toCoords.x) < 2;
  return sameRow || sameCol;
}

export function buildArrowGeometry(serveContext) {
  if (!serveContext?.serverScreenPosition || !serveContext?.receiverScreenPosition) {
    return null;
  }

  const from = screenPositionToCoords(serveContext.serverScreenPosition);
  const to = screenPositionToCoords(serveContext.receiverScreenPosition);

  return {
    from,
    to,
    serveDirection: serveContext.serveDirection,
    servingPlayerId: serveContext.servingPlayerId,
    receivingPlayerId: serveContext.receivingPlayerId,
    isDiagonal: !isStraightCourtArrow(from, to),
  };
}

export function describeServeDirectionVi(serveDirection) {
  const map = {
    [SERVE_DIRECTION.NEAR_RIGHT_TO_FAR_LEFT]: "Dưới phải → Trên trái",
    [SERVE_DIRECTION.NEAR_LEFT_TO_FAR_RIGHT]: "Dưới trái → Trên phải",
    [SERVE_DIRECTION.FAR_RIGHT_TO_NEAR_LEFT]: "Trên phải → Dưới trái",
    [SERVE_DIRECTION.FAR_LEFT_TO_NEAR_RIGHT]: "Trên trái → Dưới phải",
  };
  return map[serveDirection] || serveDirection;
}
