/**
 * Phase 3D — deterministic team identity.
 * Key = competitionId::TEAM::stableTeamId
 * No timestamp. No random. No array index. No display-name.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

export const TEAM_IDENTITY_KIND = "TEAM";

/**
 * @typedef {Object} TeamIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} stableTeamId
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, stableTeamId?: string }} parts
 * @returns {string}
 */
export function buildTeamIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const stableTeamId = String(parts.stableTeamId || "").trim();
  return `${competitionId}::${TEAM_IDENTITY_KIND}::${stableTeamId}`;
}

/**
 * @param {Partial<TeamIdentity>} partial
 * @returns {TeamIdentity}
 */
export function createTeamIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const stableTeamId = String(partial.stableTeamId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "TeamIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(stableTeamId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "TeamIdentity requires stableTeamId",
      { competitionId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildTeamIdentityKey({ competitionId, stableTeamId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: TEAM_IDENTITY_KIND,
    stableTeamId,
    key,
  });
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam|null|undefined} team
 * @returns {TeamIdentity|null}
 */
export function identityFromCompetitionTeam(team) {
  if (!team || typeof team !== "object") return null;
  if (!isNonEmptyString(team.competitionId) || !isNonEmptyString(team.id)) {
    return null;
  }
  return createTeamIdentity({
    competitionId: team.competitionId,
    stableTeamId: team.id,
    key: team.identityKey || undefined,
  });
}
