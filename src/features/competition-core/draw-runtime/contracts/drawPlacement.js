/**
 * Phase 3H — DrawPlacement contract.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import {
  PLACEMENT_REASON,
  isPlacementReason,
} from "../enums/placementReasons.js";
import {
  PLACEMENT_TYPE,
  isPlacementType,
} from "../enums/placementTypes.js";
import {
  buildDrawIdentityKey,
  buildPlacementIdentityKey,
} from "./drawIdentity.js";

/**
 * @typedef {Object} DrawPlacement
 * @property {string} placementId
 * @property {string} identityKey
 * @property {string} drawIdentityKey
 * @property {string} candidateIdentityKey
 * @property {string} placementType
 * @property {string|null} [groupIdentityKey]
 * @property {string|null} [bracketIdentityKey]
 * @property {number|null} [slotNumber]
 * @property {number|null} positionNumber
 * @property {number|null} [seedNumber]
 * @property {string} placementReason
 * @property {string[]} [tieBreakTrace]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawPlacement> & {
 *   competitionId?: string,
 *   contextId?: string,
 * }} [partial]
 * @returns {DrawPlacement}
 */
export function createDrawPlacement(partial = {}) {
  const drawIdentityKey =
    isNonEmptyString(partial.drawIdentityKey)
      ? String(partial.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });

  const candidateIdentityKey = String(partial.candidateIdentityKey || "").trim();

  const identityKey =
    isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : buildPlacementIdentityKey({
          drawIdentityKey,
          candidateIdentityKey,
        });

  const placementId = String(partial.placementId || identityKey).trim();

  const positionNumber =
    partial.positionNumber != null && Number.isFinite(Number(partial.positionNumber))
      ? Number(partial.positionNumber)
      : null;

  return {
    placementId,
    identityKey,
    drawIdentityKey,
    candidateIdentityKey,
    placementType: isPlacementType(partial.placementType)
      ? partial.placementType
      : PLACEMENT_TYPE.GROUP,
    groupIdentityKey:
      partial.groupIdentityKey != null ? String(partial.groupIdentityKey) : null,
    bracketIdentityKey:
      partial.bracketIdentityKey != null
        ? String(partial.bracketIdentityKey)
        : null,
    slotNumber:
      partial.slotNumber != null && Number.isFinite(Number(partial.slotNumber))
        ? Number(partial.slotNumber)
        : null,
    positionNumber,
    seedNumber:
      partial.seedNumber != null && Number.isFinite(Number(partial.seedNumber))
        ? Number(partial.seedNumber)
        : null,
    placementReason: isPlacementReason(partial.placementReason)
      ? partial.placementReason
      : PLACEMENT_REASON.IDENTITY_ORDER,
    tieBreakTrace: Array.isArray(partial.tieBreakTrace)
      ? partial.tieBreakTrace.map((step) => String(step))
      : undefined,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}
