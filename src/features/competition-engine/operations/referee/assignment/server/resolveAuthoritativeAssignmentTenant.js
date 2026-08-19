/**
 * Trusted-server Tenant resolution for CORE-13 assignment.
 *
 * Caller tenantId is never authority. Venue is never Tenant.
 * Authoritative Tenant is derived from canonical tournament / Team header,
 * then corroborated by match live state when present.
 */

import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { extractCanonicalMatchIndex } from "./loadCanonicalCompetitionModeState.js";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function loadCanonicalTournament(serviceClient, tournamentId) {
  const { data, error } = await serviceClient
    .from("canonical_tournaments")
    .select("id, tenant_id, club_id, status, mode, payload, external_key")
    .eq("id", tournamentId)
    .maybeSingle();
  if (error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      error.message || "Canonical tournament lookup failed",
      { tournamentId }
    );
  }
  return data || null;
}

async function loadTeamTournament(serviceClient, tournamentId) {
  const byId = await serviceClient
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id, status, payload")
    .eq("id", tournamentId)
    .maybeSingle();
  if (byId.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      byId.error.message || "Team tournament lookup failed",
      { tournamentId }
    );
  }
  if (byId.data) return byId.data;

  const { data, error } = await serviceClient
    .from("team_tournaments")
    .select("id, tenant_id, tournament_id, status, payload")
    .eq("tournament_id", tournamentId)
    .limit(1);
  if (error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      error.message || "Team tournament lookup failed",
      { tournamentId }
    );
  }
  return Array.isArray(data) && data[0] ? data[0] : null;
}

async function loadLiveMatchTenant(serviceClient, matchId) {
  const { data, error } = await serviceClient
    .from("match_live_states")
    .select("tenant_id, tournament_id, match_id")
    .eq("match_id", matchId)
    .limit(1);
  if (error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      error.message || "Match live tenant lookup failed",
      { matchId }
    );
  }
  return Array.isArray(data) && data[0] ? data[0] : null;
}

/**
 * @param {{
 *   serviceClient: object,
 *   tournamentId?: unknown,
 *   matchId?: unknown,
 *   claimedTenantId?: unknown,
 *   venueId?: unknown,
 * }} input
 */
export async function resolveAuthoritativeAssignmentTenant(input = {}) {
  const tournamentId = text(input.tournamentId);
  const matchId = text(input.matchId);
  const claimedTenantId = text(input.claimedTenantId);
  const serviceClient = input.serviceClient;

  if (!tournamentId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
      "tournamentId is required for trusted-server tenant resolution",
      {}
    );
  }
  if (!serviceClient || typeof serviceClient.from !== "function") {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED,
      "Trusted-server service client is required",
      {}
    );
  }

  const canonical = await loadCanonicalTournament(serviceClient, tournamentId);
  const teamHeader = canonical ? null : await loadTeamTournament(serviceClient, tournamentId);
  const tenantId = text(canonical?.tenant_id) || text(teamHeader?.tenant_id);

  if (!tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Tournament is not bound in canonical server context",
      { tournamentId }
    );
  }

  if (claimedTenantId && claimedTenantId !== tenantId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Caller tenantId is not authoritative and does not match canonical tournament tenant",
      { claimedTenantId, canonicalTenantId: tenantId, tournamentId }
    );
  }

  let resolvedMatchTournamentId = null;
  if (matchId) {
    const live = await loadLiveMatchTenant(serviceClient, matchId);
    const liveTenant = text(live?.tenant_id);
    if (liveTenant && liveTenant !== tenantId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
        "Match live tenant does not match canonical tournament tenant",
        { matchId, liveTenant, canonicalTenantId: tenantId }
      );
    }
    const liveTournamentId = text(live?.tournament_id);
    if (liveTournamentId && liveTournamentId !== tournamentId) {
      failAssignmentCommand(
        ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
        "Canonical match tournament ownership does not match requested tournamentId",
        {
          matchId,
          requestedTournamentId: tournamentId,
          resolvedMatchTournamentId: liveTournamentId,
        }
      );
    }
    if (!liveTournamentId) {
      const index = extractCanonicalMatchIndex(canonical || teamHeader || {});
      const bound =
        Boolean(index.matches?.[matchId]) || Boolean(index.matchups?.[matchId]);
      if (!bound) {
        failAssignmentCommand(
          ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
          "Match is not bound to the requested tournament",
          { matchId, requestedTournamentId: tournamentId }
        );
      }
      resolvedMatchTournamentId = tournamentId;
    } else {
      resolvedMatchTournamentId = liveTournamentId;
    }
  }

  return Object.freeze({
    tenantId,
    tournamentId,
    clubId: text(canonical?.club_id) || null,
    canonicalBound: Boolean(canonical?.id),
    teamBound: Boolean(teamHeader?.id),
    claimedTenantId: claimedTenantId || null,
    callerTenantAsAuthority: "DENY",
    venueAsTenantFallback: "DENY",
    resolvedMatchTournamentId,
  });
}
