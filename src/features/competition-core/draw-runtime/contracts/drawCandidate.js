/**
 * Phase 3H — DrawCandidate contract.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import { CANDIDATE_TYPE, isCandidateType } from "../enums/candidateTypes.js";
import {
  buildCandidateIdentityKey,
  buildDrawIdentityKey,
} from "./drawIdentity.js";

/**
 * @typedef {Object} DrawCandidate
 * @property {string} candidateId
 * @property {string} candidateIdentityKey
 * @property {string} candidateType
 * @property {string} candidateReference
 * @property {string|null} [seedAssignmentReference]
 * @property {number|null} [seedNumber]
 * @property {string|null} [seedTier]
 * @property {boolean} [eligible]
 * @property {boolean} [protectedPlacement]
 * @property {{ groupNumber?: number|null, slotNumber?: number|null, positionNumber?: number|null }|null} [manualPlacement]
 * @property {number|null} [sourcePriority]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawCandidate> & {
 *   competitionId?: string,
 *   contextId?: string,
 *   drawIdentityKey?: string,
 * }} [partial]
 * @returns {DrawCandidate}
 */
export function createDrawCandidate(partial = {}) {
  const candidateReference = String(
    partial.candidateReference ||
      partial.candidateId ||
      ""
  ).trim();

  const candidateId = String(partial.candidateId || candidateReference || "").trim();

  const drawIdentityKey =
    isNonEmptyString(partial.drawIdentityKey)
      ? String(partial.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });

  const candidateType = isCandidateType(partial.candidateType)
    ? partial.candidateType
    : CANDIDATE_TYPE.UNKNOWN;

  const seedNumber =
    partial.seedNumber != null && Number.isFinite(Number(partial.seedNumber))
      ? Number(partial.seedNumber)
      : null;

  const sourcePriority =
    partial.sourcePriority != null && Number.isFinite(Number(partial.sourcePriority))
      ? Number(partial.sourcePriority)
      : null;

  const candidateIdentityKey =
    isNonEmptyString(partial.candidateIdentityKey)
      ? String(partial.candidateIdentityKey).trim()
      : buildCandidateIdentityKey({
          drawIdentityKey,
          candidateReference,
        });

  let manualPlacement = null;
  if (partial.manualPlacement && typeof partial.manualPlacement === "object") {
    const mp = partial.manualPlacement;
    manualPlacement = {
      groupNumber:
        mp.groupNumber != null && Number.isFinite(Number(mp.groupNumber))
          ? Number(mp.groupNumber)
          : null,
      slotNumber:
        mp.slotNumber != null && Number.isFinite(Number(mp.slotNumber))
          ? Number(mp.slotNumber)
          : null,
      positionNumber:
        mp.positionNumber != null && Number.isFinite(Number(mp.positionNumber))
          ? Number(mp.positionNumber)
          : null,
    };
  }

  return {
    candidateId,
    candidateIdentityKey,
    candidateType,
    candidateReference,
    seedAssignmentReference:
      partial.seedAssignmentReference != null
        ? String(partial.seedAssignmentReference)
        : null,
    seedNumber,
    seedTier: partial.seedTier != null ? String(partial.seedTier) : null,
    eligible: partial.eligible !== false,
    protectedPlacement: partial.protectedPlacement === true,
    manualPlacement,
    sourcePriority,
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}
