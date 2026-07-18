/**
 * Phase 3D — normalize + validate CompetitionTeam (runtime-local).
 */

import { createCompetitionTeam } from "../../participants/contracts/teamRosterLineup.js";
import { isCompetitionTeamStatus } from "../../participants/enums/statuses.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import { createTeamIdentity } from "../contracts/teamIdentity.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam} team
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam}
 */
export function normalizeAndValidateTeam(team) {
  if (!team || typeof team !== "object") {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "Team must be an object",
      {}
    );
  }

  const normalized = createCompetitionTeam(team);

  if (!normalized.id) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "team id is required",
      {}
    );
  }
  if (!normalized.competitionId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "competitionId is required",
      {}
    );
  }
  if (!normalized.name) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "team name is required",
      { teamId: normalized.id }
    );
  }
  if (!isCompetitionTeamStatus(normalized.status)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_TEAM_STATUS,
      "Unsupported team status",
      { status: normalized.status }
    );
  }

  if (normalized.captainRef) {
    if (!normalized.captainRef.kind || !String(normalized.captainRef.id || "").trim()) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "captainRef requires kind and id",
        { teamId: normalized.id }
      );
    }
  }

  for (const ref of normalized.deputyRefs || []) {
    if (!ref || !ref.kind || !String(ref.id || "").trim()) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "Each deputyRef requires kind and id",
        { teamId: normalized.id }
      );
    }
  }

  const identity = createTeamIdentity({
    competitionId: normalized.competitionId,
    stableTeamId: normalized.id,
  });

  if (normalized.identityKey && normalized.identityKey !== identity.key) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
      "identityKey does not match deterministic team identity",
      {
        expected: identity.key,
        actual: normalized.identityKey,
      }
    );
  }

  return createCompetitionTeam({
    ...normalized,
    identityKey: identity.key,
  });
}
