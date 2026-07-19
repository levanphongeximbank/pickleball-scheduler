/**
 * Core-02 optional TEAM Entry bridge for Team Tournament.
 * Shadow only — TT runtime is not required to consume this Entry.
 * Does not create athlete-level Entries.
 */

import { COMPETITION_ENTRY_STATUS } from "../enums/statuses.js";
import { COMPETITION_ENTRY_TYPE } from "../enums/entryTypes.js";
import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createCompetitionEntry,
  createCompetitionTeamReference,
  createFormatExtension,
  createParticipantReference,
} from "../contracts/index.js";
import { createEntryTenantScope } from "../contracts/tenantScope.js";
import { validateCompetitionEntry } from "../validators/index.js";
import {
  validationError,
  validationFail,
} from "../results/validationResult.js";

const SOURCE_SYSTEM = "team-tournament-v6";
const SOURCE_TYPE = "TeamTournamentTeam";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {{
 *   success: boolean,
 *   entry: ReturnType<typeof createCompetitionEntry>|null,
 *   athleteEntriesCreated: number,
 *   validation: import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function mapTeamTournamentTeamToOptionalEntry(source, context = {}) {
  if (!source || typeof source !== "object") {
    return {
      success: false,
      entry: null,
      athleteEntriesCreated: 0,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "Team source must be an object"),
      ]),
    };
  }

  const team = /** @type {Record<string, unknown>} */ (source);
  const teamId = String(team.id || team.teamId || "").trim();
  if (!teamId) {
    return {
      success: false,
      entry: null,
      athleteEntriesCreated: 0,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "id", "Team id required"),
      ]),
    };
  }

  const competitionId = String(
    context.competitionId ||
      context.tournamentId ||
      team.competitionId ||
      team.tournamentId ||
      ""
  ).trim();

  const captainId = team.captainPlayerId || team.captainId || null;
  const representativeRef = captainId
    ? createParticipantReference({
        kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
        id: String(captainId),
        displayNameSnapshot: team.captainName || null,
        sourceSystem: SOURCE_SYSTEM,
      })
    : null;

  const teamRef = createCompetitionTeamReference({
    id: teamId,
    competitionId: competitionId || null,
    sourceSystem: SOURCE_SYSTEM,
  });

  const tenantScope = createEntryTenantScope({
    tenantId: context.tenantId || team.tenantId || null,
    clubId: context.clubId || team.clubId || null,
    organizationId: context.organizationId || team.organizationId || null,
  });

  const entry = createCompetitionEntry({
    id: `entry:team:${competitionId}:${teamId}`,
    competitionId,
    status: COMPETITION_ENTRY_STATUS.ACTIVE,
    entryType: COMPETITION_ENTRY_TYPE.TEAM,
    memberRefs: [],
    teamRef,
    representativeRef,
    name: team.name ? String(team.name) : null,
    seed: typeof team.seed === "number" ? team.seed : null,
    divisionId: team.divisionId || team.groupId || null,
    categoryId: team.categoryId || null,
    tenantScope,
    sourceSystem: SOURCE_SYSTEM,
    sourceType: SOURCE_TYPE,
    sourceId: teamId,
    extensions: createFormatExtension({
      formatKey: "team-tournament-v6",
      payload: {
        optionalBridge: true,
        notRequiredByRuntime: true,
        athleteEntriesNotGenerated: true,
      },
    }),
    metadata: {
      optionalBridge: true,
    },
  });

  const validation = validateCompetitionEntry(entry, {
    expectedCompetitionId: context.expectedCompetitionId || competitionId || null,
    expectedTenantScope: context.expectedTenantScope || tenantScope,
    requireEntryType: true,
  });

  return {
    success: validation.valid,
    entry: validation.valid ? entry : null,
    athleteEntriesCreated: 0,
    validation,
  };
}
