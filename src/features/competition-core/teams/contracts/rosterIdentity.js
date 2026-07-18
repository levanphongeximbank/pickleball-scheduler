/**
 * Phase 3D — deterministic roster identity.
 * Key = competitionId::ROSTER::teamId
 * No timestamp. No random. No array index.
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

export const ROSTER_IDENTITY_KIND = "ROSTER";

/**
 * @typedef {Object} RosterIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} teamId
 * @property {string} key
 */

/**
 * @param {{ competitionId?: string, teamId?: string }} parts
 * @returns {string}
 */
export function buildRosterIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const teamId = String(parts.teamId || "").trim();
  return `${competitionId}::${ROSTER_IDENTITY_KIND}::${teamId}`;
}

/**
 * @param {Partial<RosterIdentity>} partial
 * @returns {RosterIdentity}
 */
export function createRosterIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const teamId = String(partial.teamId || "").trim();

  if (!isNonEmptyString(competitionId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "RosterIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(teamId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "RosterIdentity requires teamId",
      { competitionId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildRosterIdentityKey({ competitionId, teamId });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: ROSTER_IDENTITY_KIND,
    teamId,
    key,
  });
}

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster|null|undefined} roster
 * @returns {RosterIdentity|null}
 */
export function identityFromCompetitionRoster(roster) {
  if (!roster || typeof roster !== "object") return null;
  if (
    !isNonEmptyString(roster.competitionId) ||
    !isNonEmptyString(roster.teamId)
  ) {
    return null;
  }
  return createRosterIdentity({
    competitionId: roster.competitionId,
    teamId: roster.teamId,
    key: roster.identityKey || undefined,
  });
}
