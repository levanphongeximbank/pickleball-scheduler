/**
 * Phase 3D — deterministic roster member identity.
 * Key = competitionId::ROSTER_MEMBER::teamId::participantReference
 * participantReference = kind:id (no timestamp / random / array index)
 */

import {
  PARTICIPANT_SCHEMA_VERSION,
  isNonEmptyString,
} from "../../participants/contracts/shared.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

export const ROSTER_MEMBER_IDENTITY_KIND = "ROSTER_MEMBER";

/**
 * @typedef {Object} RosterMemberIdentity
 * @property {string} schemaVersion
 * @property {string} competitionId
 * @property {string} kind
 * @property {string} teamId
 * @property {string} participantReference
 * @property {string} key
 */

/**
 * @param {{ kind?: string, id?: string }|null|undefined} person
 * @returns {string}
 */
export function formatParticipantReferenceToken(person) {
  if (!person || typeof person !== "object") return "";
  const kind = String(person.kind || "").trim();
  const id = String(person.id || "").trim();
  if (!kind || !id) return "";
  return `${kind}:${id}`;
}

/**
 * @param {{
 *   competitionId?: string,
 *   teamId?: string,
 *   participantReference?: string,
 *   person?: { kind?: string, id?: string },
 * }} parts
 * @returns {string}
 */
export function buildRosterMemberIdentityKey(parts = {}) {
  const competitionId = String(parts.competitionId || "").trim();
  const teamId = String(parts.teamId || "").trim();
  const participantReference =
    String(parts.participantReference || "").trim() ||
    formatParticipantReferenceToken(parts.person);
  return `${competitionId}::${ROSTER_MEMBER_IDENTITY_KIND}::${teamId}::${participantReference}`;
}

/**
 * @param {Partial<RosterMemberIdentity> & { person?: { kind?: string, id?: string } }} partial
 * @returns {RosterMemberIdentity}
 */
export function createRosterMemberIdentity(partial = {}) {
  const competitionId = String(partial.competitionId || "").trim();
  const teamId = String(partial.teamId || "").trim();
  const participantReference =
    String(partial.participantReference || "").trim() ||
    formatParticipantReferenceToken(partial.person);

  if (!isNonEmptyString(competitionId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "RosterMemberIdentity requires competitionId",
      {}
    );
  }
  if (!isNonEmptyString(teamId)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "RosterMemberIdentity requires teamId",
      { competitionId }
    );
  }
  if (!isNonEmptyString(participantReference)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
      "RosterMemberIdentity requires participantReference",
      { competitionId, teamId }
    );
  }

  const key =
    isNonEmptyString(partial.key) && String(partial.key).includes("::")
      ? String(partial.key)
      : buildRosterMemberIdentityKey({
          competitionId,
          teamId,
          participantReference,
        });

  return Object.freeze({
    schemaVersion: String(partial.schemaVersion ?? PARTICIPANT_SCHEMA_VERSION),
    competitionId,
    kind: ROSTER_MEMBER_IDENTITY_KIND,
    teamId,
    participantReference,
    key,
  });
}
