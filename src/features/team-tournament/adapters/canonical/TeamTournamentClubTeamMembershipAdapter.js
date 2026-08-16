/**
 * Team Tournament Adapter ĐẦU B — Club / Team / Membership.
 * Club/membership evidence through Contract A. Team roster/captain stay Team.
 */

import {
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  EVIDENCE_STATUS,
  createClubTeamMembershipBinding,
  freezeEvidence,
  requireAdapterContext,
} from "../../../competition-engine/integration/contracts/index.js";
import { findTeam } from "../../models/index.js";
import { TEAM_ADAPTER_B_CLASSIFICATION, TEAM_ADAPTER_B_NAMES } from "./constants.js";
import { wrapTeamBAdapter } from "./surface.js";

function teamHandlersFrom(deps = {}) {
  if (deps.teamHandlers) return deps.teamHandlers;
  const loadTeamData =
    typeof deps.loadTeamData === "function" ? deps.loadTeamData : null;
  if (!loadTeamData) return {};

  return {
    getTeamIdentity(context) {
      const ctx = requireAdapterContext(context, {
        requiredFields: ["tenantId", "correlationId"],
        boundTenantId: deps.boundTenantId,
      });
      const teamData = loadTeamData(ctx);
      const team = findTeam(teamData, ctx.teamId);
      return freezeEvidence({
        sourceSystem: "team-tournament",
        status: team ? EVIDENCE_STATUS.OK : EVIDENCE_STATUS.NOT_FOUND,
        data: team
          ? {
              teamId: team.id,
              competitionId: ctx.competitionId,
              name: team.name || null,
              ownedByTeamCompetition: true,
            }
          : { teamId: ctx.teamId, ownedByTeamCompetition: true },
        reasonCodes: team ? [] : ["TEAM_NOT_FOUND"],
      });
    },
    getTeamRoster(context) {
      const ctx = requireAdapterContext(context, {
        requiredFields: ["tenantId", "correlationId"],
        boundTenantId: deps.boundTenantId,
      });
      const teamData = loadTeamData(ctx);
      const team = findTeam(teamData, ctx.teamId);
      return freezeEvidence({
        sourceSystem: "team-tournament",
        status: team ? EVIDENCE_STATUS.OK : EVIDENCE_STATUS.NOT_FOUND,
        data: {
          teamId: team?.id || ctx.teamId,
          playerIds: [...(team?.playerIds || [])],
          ownedByTeamCompetition: true,
        },
        reasonCodes: team ? [] : ["TEAM_NOT_FOUND"],
      });
    },
    getCaptainRelationship(context) {
      const ctx = requireAdapterContext(context, {
        requiredFields: ["tenantId", "correlationId"],
        boundTenantId: deps.boundTenantId,
      });
      const teamData = loadTeamData(ctx);
      const team = findTeam(teamData, ctx.teamId);
      return freezeEvidence({
        sourceSystem: "team-tournament",
        status: team ? EVIDENCE_STATUS.OK : EVIDENCE_STATUS.NOT_FOUND,
        data: {
          teamId: team?.id || ctx.teamId,
          captainPlayerId: team?.captainPlayerId || null,
          deputyPlayerIds: [...(team?.deputyPlayerIds || [])],
          ownedByTeamCompetition: true,
        },
        reasonCodes: team ? [] : ["TEAM_NOT_FOUND"],
      });
    },
  };
}

export function createTeamTournamentClubTeamMembershipAdapter(deps = {}) {
  const inner =
    deps.contractA ||
    createClubTeamMembershipBinding({
      ...deps,
      teamHandlers: teamHandlersFrom(deps),
    });
  return wrapTeamBAdapter(inner, {
    adapterBName: TEAM_ADAPTER_B_NAMES[4],
    ordinal: 4,
    classification: TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED,
    activation: deps.activation !== false,
    requiredMethods: CLUB_TEAM_MEMBERSHIP_CONTRACT.requiredMethods,
  });
}
