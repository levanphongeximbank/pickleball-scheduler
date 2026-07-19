/**
 * Phase 3H — deterministic draw identities.
 *
 * Operation: competitionId::DRAW::contextId
 * Candidate:  drawIdentityKey::CANDIDATE::candidateReference
 * Group:      drawIdentityKey::GROUP::groupNumber
 * Bracket:    drawIdentityKey::BRACKET::bracketId
 * Slot:       drawIdentityKey::SLOT::slotNumber
 * Placement:  drawIdentityKey::PLACEMENT::candidateIdentityKey
 * Bye:        drawIdentityKey::BYE::slotNumber
 *
 * Excludes: display name, mutable rating/ranking, timestamps, random UUID,
 * court, referee, schedule, score, winner.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";

export const DRAW_IDENTITY_KIND = "DRAW";
export const DRAW_CANDIDATE_IDENTITY_KIND = "CANDIDATE";
export const DRAW_GROUP_IDENTITY_KIND = "GROUP";
export const DRAW_BRACKET_IDENTITY_KIND = "BRACKET";
export const DRAW_SLOT_IDENTITY_KIND = "SLOT";
export const DRAW_PLACEMENT_IDENTITY_KIND = "PLACEMENT";
export const DRAW_BYE_IDENTITY_KIND = "BYE";

/**
 * @typedef {Object} DrawIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} contextId
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, contextId?: string }} parts
 * @returns {string}
 */
export function buildDrawIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const contextId = String(parts.contextId || "").trim();
  return `${competitionId}::${DRAW_IDENTITY_KIND}::${contextId}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   candidateReference?: string,
 * }} parts
 * @returns {string}
 */
export function buildCandidateIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const candidateReference = String(parts.candidateReference || "").trim();
  return `${drawKey}::${DRAW_CANDIDATE_IDENTITY_KIND}::${candidateReference}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   groupNumber?: number|string,
 * }} parts
 * @returns {string}
 */
export function buildGroupIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const groupNumber = Number(parts.groupNumber);
  return `${drawKey}::${DRAW_GROUP_IDENTITY_KIND}::${groupNumber}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   bracketId?: string,
 * }} parts
 * @returns {string}
 */
export function buildBracketIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const bracketId = String(parts.bracketId || "main").trim() || "main";
  return `${drawKey}::${DRAW_BRACKET_IDENTITY_KIND}::${bracketId}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   slotNumber?: number|string,
 * }} parts
 * @returns {string}
 */
export function buildSlotIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const slotNumber = Number(parts.slotNumber);
  return `${drawKey}::${DRAW_SLOT_IDENTITY_KIND}::${slotNumber}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   candidateIdentityKey?: string,
 * }} parts
 * @returns {string}
 */
export function buildPlacementIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const candidateIdentityKey = String(parts.candidateIdentityKey || "").trim();
  return `${drawKey}::${DRAW_PLACEMENT_IDENTITY_KIND}::${candidateIdentityKey}`;
}

/**
 * @param {{
 *   drawIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   slotNumber?: number|string,
 * }} parts
 * @returns {string}
 */
export function buildByeIdentityKey(parts = {}) {
  const drawKey =
    isNonEmptyString(parts.drawIdentityKey)
      ? String(parts.drawIdentityKey).trim()
      : buildDrawIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const slotNumber = Number(parts.slotNumber);
  return `${drawKey}::${DRAW_BYE_IDENTITY_KIND}::${slotNumber}`;
}

/**
 * @param {Partial<DrawIdentity>} partial
 * @returns {DrawIdentity}
 */
export function createDrawIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const contextId = String(partial.contextId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
      "DrawIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(contextId)) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
      "DrawIdentity requires contextId",
      { competitionId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildDrawIdentityKey({ competitionId, contextId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: DRAW_IDENTITY_KIND,
    contextId,
    key,
  });
}
