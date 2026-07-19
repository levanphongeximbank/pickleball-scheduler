/**
 * Phase 3F — deterministic match identity.
 * Key = competitionId::MATCH::contextId
 * No timestamp. No random. No display-name.
 * contextId identifies one playable match (TT SubMatch granularity).
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";
import { MATCH_SIDE_KEY } from "../enums/matchSideKeys.js";

export const MATCH_IDENTITY_KIND = "MATCH";
export const MATCH_SIDE_IDENTITY_KIND = "SIDE";

/**
 * @typedef {Object} MatchIdentity
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
export function buildMatchIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const contextId = String(parts.contextId || "").trim();
  return `${competitionId}::${MATCH_IDENTITY_KIND}::${contextId}`;
}

/**
 * Deterministic side id within a match.
 * @param {{
 *   matchIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   sideKey?: string,
 * }} parts
 * @returns {string}
 */
export function buildMatchSideId(parts = {}) {
  const matchKey =
    isNonEmptyString(parts.matchIdentityKey)
      ? String(parts.matchIdentityKey).trim()
      : buildMatchIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
        });
  const sideKey = String(parts.sideKey || MATCH_SIDE_KEY.A).trim().toUpperCase();
  return `${matchKey}::${MATCH_SIDE_IDENTITY_KIND}::${sideKey}`;
}

/**
 * @param {Partial<MatchIdentity>} partial
 * @returns {MatchIdentity}
 */
export function createMatchIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const contextId = String(partial.contextId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "MatchIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(contextId)) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
      "MatchIdentity requires contextId",
      { competitionId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildMatchIdentityKey({ competitionId, contextId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: MATCH_IDENTITY_KIND,
    contextId,
    key,
  });
}

/**
 * @param {import('./competitionMatch.js').CompetitionMatch|null|undefined} match
 * @returns {MatchIdentity|null}
 */
export function identityFromCompetitionMatch(match) {
  if (!match || typeof match !== "object") return null;
  if (
    !isNonEmptyString(match.competitionId) ||
    !isNonEmptyString(match.contextId)
  ) {
    return null;
  }
  return createMatchIdentity({
    competitionId: match.competitionId,
    contextId: match.contextId,
    key: match.identityKey || undefined,
  });
}
