import { buildStageReservationIdentityKey } from "./drawIdentity.js";

export const STAGE_RESERVATION_SIDE = Object.freeze({
  A: "A",
  B: "B",
});

/**
 * @typedef {Object} DrawStageReservation
 * @property {string} reservationId
 * @property {string} identityKey
 * @property {string} drawIdentityKey
 * @property {string} bracketIdentityKey
 * @property {string} entryId
 * @property {string} targetStage
 * @property {number} positionNumber
 * @property {number} matchNumber
 * @property {"A"|"B"} side
 * @property {number|null} seedNumber
 * @property {"SEEDED"|"OPEN"} placementMode
 * @property {string} placementReason
 */

/**
 * Immutable CORE-08 placement of one identified entrant at a knockout stage.
 * Contains no match dependency, result, BYE, or advancement semantics.
 *
 * @param {{
 *   drawIdentityKey: string,
 *   bracketIdentityKey: string,
 *   entryId: string,
 *   targetStage: string,
 *   positionNumber: number,
 *   matchNumber: number,
 *   side: "A"|"B",
 *   seedNumber?: number|null,
 *   placementMode: "SEEDED"|"OPEN",
 *   placementReason: string
 * }} partial
 * @returns {DrawStageReservation}
 */
export function createDrawStageReservation(partial) {
  const identityKey = buildStageReservationIdentityKey({
    drawIdentityKey: partial.drawIdentityKey,
    targetStage: partial.targetStage,
    positionNumber: partial.positionNumber,
  });
  return Object.freeze({
    reservationId: identityKey,
    identityKey,
    drawIdentityKey: String(partial.drawIdentityKey),
    bracketIdentityKey: String(partial.bracketIdentityKey),
    entryId: String(partial.entryId).trim(),
    targetStage: String(partial.targetStage).trim(),
    positionNumber: Number(partial.positionNumber),
    matchNumber: Number(partial.matchNumber),
    side: partial.side,
    seedNumber:
      partial.seedNumber != null ? Number(partial.seedNumber) : null,
    placementMode: partial.placementMode,
    placementReason: String(partial.placementReason),
  });
}
