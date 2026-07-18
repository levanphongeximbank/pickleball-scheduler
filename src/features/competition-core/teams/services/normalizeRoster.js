/**
 * Phase 3D — normalize + validate CompetitionRoster (runtime-local).
 * Does not implement substitution workflow. Locked roster mutation guard is
 * representation-only (OD-04) — no workflow cutover.
 */

import { createCompetitionRoster } from "../../participants/contracts/teamRosterLineup.js";
import { isCompetitionRosterStatus } from "../../participants/enums/statuses.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";
import { createRosterIdentity } from "../contracts/rosterIdentity.js";
import {
  buildRosterMemberIdentityKey,
  formatParticipantReferenceToken,
} from "../contracts/rosterMemberIdentity.js";

/**
 * @param {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster} roster
 * @returns {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster}
 */
export function normalizeAndValidateRoster(roster) {
  if (!roster || typeof roster !== "object") {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "Roster must be an object",
      {}
    );
  }

  const normalized = createCompetitionRoster(roster);

  if (!normalized.id) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "roster id is required",
      {}
    );
  }
  if (!normalized.competitionId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "competitionId is required",
      {}
    );
  }
  if (!normalized.teamId) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "teamId is required",
      {}
    );
  }
  if (!isCompetitionRosterStatus(normalized.status)) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.UNSUPPORTED_ROSTER_STATUS,
      "Unsupported roster status",
      { status: normalized.status }
    );
  }

  /** @type {Set<string>} */
  const seen = new Set();
  for (const member of normalized.members || []) {
    if (!member?.person?.kind || !String(member.person.id || "").trim()) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
        "Each roster member requires person.kind and person.id",
        { rosterId: normalized.id, teamId: normalized.teamId }
      );
    }
    const token = formatParticipantReferenceToken(member.person);
    const memberKey = buildRosterMemberIdentityKey({
      competitionId: normalized.competitionId,
      teamId: normalized.teamId,
      participantReference: token,
    });
    if (seen.has(memberKey)) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.ROSTER_MEMBER_IDENTITY_COLLISION,
        "Duplicate roster member identity",
        { identityKey: memberKey }
      );
    }
    seen.add(memberKey);
  }

  const identity = createRosterIdentity({
    competitionId: normalized.competitionId,
    teamId: normalized.teamId,
  });

  if (normalized.identityKey && normalized.identityKey !== identity.key) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
      "identityKey does not match deterministic roster identity",
      {
        expected: identity.key,
        actual: normalized.identityKey,
      }
    );
  }

  return createCompetitionRoster({
    ...normalized,
    identityKey: identity.key,
  });
}
