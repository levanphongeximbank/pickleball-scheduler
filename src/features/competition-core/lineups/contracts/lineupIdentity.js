/**
 * Phase 3E — deterministic lineup identity.
 * Key = competitionId::LINEUP::contextId::teamId
 * No timestamp. No random. No display-name.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

export const LINEUP_IDENTITY_KIND = "LINEUP";

/**
 * @typedef {Object} LineupIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} contextId
 * @property {string} teamId
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, contextId?: string, teamId?: string }} parts
 * @returns {string}
 */
export function buildLineupIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const contextId = String(parts.contextId || "").trim();
  const teamId = String(parts.teamId || "").trim();
  return `${competitionId}::${LINEUP_IDENTITY_KIND}::${contextId}::${teamId}`;
}

/**
 * Deterministic slot id within a lineup.
 * Index is position within disciplineOrSideKey (canonically meaningful).
 *
 * @param {{
 *   lineupIdentityKey?: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   teamId?: string,
 *   disciplineOrSideKey?: string,
 *   index?: number,
 * }} parts
 * @returns {string}
 */
export function buildLineupSlotId(parts = {}) {
  const lineupKey =
    isNonEmptyString(parts.lineupIdentityKey)
      ? String(parts.lineupIdentityKey).trim()
      : buildLineupIdentityKey({
          competitionId: parts.competitionId,
          contextId: parts.contextId,
          teamId: parts.teamId,
        });
  const discipline = String(parts.disciplineOrSideKey || "").trim();
  const index =
    typeof parts.index === "number" && Number.isInteger(parts.index)
      ? parts.index
      : 0;
  return `${lineupKey}::${discipline}::${index}`;
}

/**
 * @param {Partial<LineupIdentity>} partial
 * @returns {LineupIdentity}
 */
export function createLineupIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const contextId = String(partial.contextId || "").trim();
  const teamId = String(partial.teamId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "LineupIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(contextId)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "LineupIdentity requires contextId",
      { competitionId }
    );
  }
  if (!isNonEmptyString(teamId)) {
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
      "LineupIdentity requires teamId",
      { competitionId, contextId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildLineupIdentityKey({ competitionId, contextId, teamId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: LINEUP_IDENTITY_KIND,
    contextId,
    teamId,
    key,
  });
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup|null|undefined} lineup
 * @returns {LineupIdentity|null}
 */
export function identityFromCompetitionLineup(lineup) {
  if (!lineup || typeof lineup !== "object") return null;
  if (
    !isNonEmptyString(lineup.competitionId) ||
    !isNonEmptyString(lineup.contextId) ||
    !isNonEmptyString(lineup.teamId)
  ) {
    return null;
  }
  return createLineupIdentity({
    competitionId: lineup.competitionId,
    contextId: lineup.contextId,
    teamId: lineup.teamId,
    key: lineup.identityKey || undefined,
  });
}
