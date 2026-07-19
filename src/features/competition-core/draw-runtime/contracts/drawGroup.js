/**
 * Phase 3H — DrawGroup / DrawBracket / DrawBye / DrawSnapshot contracts.
 */

import { isNonEmptyString } from "../../participants/contracts/shared.js";
import {
  buildBracketIdentityKey,
  buildByeIdentityKey,
  buildDrawIdentityKey,
  buildGroupIdentityKey,
} from "./drawIdentity.js";

/**
 * @typedef {Object} DrawGroup
 * @property {string} groupId
 * @property {string} identityKey
 * @property {string} drawIdentityKey
 * @property {number} groupNumber
 * @property {string|null} [label]
 * @property {number|null} [capacity]
 * @property {string[]} memberPlacementKeys
 * @property {string[]} candidateIdentityKeys
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawGroup> & {
 *   competitionId?: string,
 *   contextId?: string,
 * }} [partial]
 * @returns {DrawGroup}
 */
export function createDrawGroup(partial = {}) {
  const drawIdentityKey =
    isNonEmptyString(partial.drawIdentityKey)
      ? String(partial.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });
  const groupNumber = Number(partial.groupNumber);
  const identityKey =
    isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : buildGroupIdentityKey({ drawIdentityKey, groupNumber });

  return {
    groupId: String(partial.groupId || identityKey).trim(),
    identityKey,
    drawIdentityKey,
    groupNumber,
    label:
      partial.label != null
        ? String(partial.label)
        : Number.isFinite(groupNumber)
          ? String.fromCharCode(65 + ((groupNumber - 1) % 26))
          : null,
    capacity:
      partial.capacity != null && Number.isFinite(Number(partial.capacity))
        ? Number(partial.capacity)
        : null,
    memberPlacementKeys: Array.isArray(partial.memberPlacementKeys)
      ? partial.memberPlacementKeys.map((k) => String(k))
      : [],
    candidateIdentityKeys: Array.isArray(partial.candidateIdentityKeys)
      ? partial.candidateIdentityKeys.map((k) => String(k))
      : [],
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}

/**
 * @typedef {Object} DrawBracket
 * @property {string} bracketId
 * @property {string} identityKey
 * @property {string} drawIdentityKey
 * @property {number} bracketSize
 * @property {number[]} occupiedSlots
 * @property {number[]} byeSlots
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawBracket> & {
 *   competitionId?: string,
 *   contextId?: string,
 * }} [partial]
 * @returns {DrawBracket}
 */
export function createDrawBracket(partial = {}) {
  const drawIdentityKey =
    isNonEmptyString(partial.drawIdentityKey)
      ? String(partial.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });
  const bracketId = String(partial.bracketId || "main").trim() || "main";
  const identityKey =
    isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : buildBracketIdentityKey({ drawIdentityKey, bracketId });

  return {
    bracketId,
    identityKey,
    drawIdentityKey,
    bracketSize: Number.isFinite(Number(partial.bracketSize))
      ? Number(partial.bracketSize)
      : 0,
    occupiedSlots: Array.isArray(partial.occupiedSlots)
      ? partial.occupiedSlots.map((n) => Number(n))
      : [],
    byeSlots: Array.isArray(partial.byeSlots)
      ? partial.byeSlots.map((n) => Number(n))
      : [],
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}

/**
 * @typedef {Object} DrawBye
 * @property {string} byeId
 * @property {string} identityKey
 * @property {string} drawIdentityKey
 * @property {number} slotNumber
 * @property {string|null} [bracketIdentityKey]
 * @property {string} reason
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawBye> & {
 *   competitionId?: string,
 *   contextId?: string,
 * }} [partial]
 * @returns {DrawBye}
 */
export function createDrawBye(partial = {}) {
  const drawIdentityKey =
    isNonEmptyString(partial.drawIdentityKey)
      ? String(partial.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: partial.competitionId,
          contextId: partial.contextId,
        });
  const slotNumber = Number(partial.slotNumber);
  const identityKey =
    isNonEmptyString(partial.identityKey)
      ? String(partial.identityKey).trim()
      : buildByeIdentityKey({ drawIdentityKey, slotNumber });

  return {
    byeId: String(partial.byeId || identityKey).trim(),
    identityKey,
    drawIdentityKey,
    slotNumber,
    bracketIdentityKey:
      partial.bracketIdentityKey != null
        ? String(partial.bracketIdentityKey)
        : null,
    reason: String(partial.reason || "BYE_CALC"),
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}

/**
 * @typedef {Object} DrawSnapshot
 * @property {string} id
 * @property {string} identityKey
 * @property {string} competitionId
 * @property {string} contextId
 * @property {import('./drawPlacement.js').DrawPlacement[]} placements
 * @property {DrawGroup[]} groups
 * @property {DrawBracket[]} brackets
 * @property {DrawBye[]} byes
 * @property {string} recordedAt
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @param {Partial<DrawSnapshot>} [partial]
 * @returns {DrawSnapshot}
 */
export function createDrawSnapshot(partial = {}) {
  const identityKey = String(partial.identityKey || partial.id || "").trim();
  return {
    id: String(partial.id || identityKey).trim(),
    identityKey,
    competitionId: String(partial.competitionId || "").trim(),
    contextId: String(partial.contextId || "").trim(),
    placements: Array.isArray(partial.placements) ? partial.placements : [],
    groups: Array.isArray(partial.groups) ? partial.groups : [],
    brackets: Array.isArray(partial.brackets) ? partial.brackets : [],
    byes: Array.isArray(partial.byes) ? partial.byes : [],
    recordedAt: String(partial.recordedAt || "1970-01-01T00:00:00.000Z"),
    metadata:
      partial.metadata &&
      typeof partial.metadata === "object" &&
      !Array.isArray(partial.metadata)
        ? { ...partial.metadata }
        : undefined,
  };
}
