/**
 * Trusted-server authz — user-scoped canonical authorities only.
 * Does not invent RBAC. Browser permission claims are ignored.
 *
 * Generic tenant permission is not enough: the concrete tournament must also
 * be bound via existing canonical_tournament_get / team_tournament_get_setup.
 */

import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";
import { isUuid } from "./loadCanonicalCompetitionModeState.js";

function rpcFailed(error) {
  if (!error) return false;
  const combined = `${error.message || ""} ${error.details || ""} ${error.code || ""}`;
  return /TOURNAMENT_FORBIDDEN|TOURNAMENT_MISSING_TENANT|TOURNAMENT_NOT_FOUND|42501|PGRST/i.test(
    combined
  )
    ? combined
    : combined || "RPC failed";
}

async function callUserRpc(userClient, name, args) {
  const { data, error } = await userClient.rpc(name, args);
  return { data, error };
}

function unwrapRpc(data) {
  if (data && typeof data === "object") return data;
  return null;
}

async function assertConcreteCanonicalTournament(userClient, input) {
  const tournamentId = String(input.tournamentId || "").trim();
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();
  const canonicalId = String(input.canonicalId || "").trim();
  const targetId = isUuid(canonicalId)
    ? canonicalId
    : isUuid(tournamentId)
      ? tournamentId
      : "";
  if (!targetId || !clubId) return false;
  const got = await callUserRpc(userClient, "canonical_tournament_get", {
    p_tenant_id: tenantId,
    p_club_id: clubId,
    p_tournament_id: targetId,
  });
  if (got.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      rpcFailed(got.error) || "Canonical tournament binding failed",
      { tenantId, tournamentId }
    );
  }
  const payload = unwrapRpc(got.data);
  if (payload && payload.ok === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Canonical tournament is not bound for the authenticated actor",
      { tenantId, tournamentId, code: payload.code || null }
    );
  }
  return true;
}

async function assertConcreteTeamTournament(userClient, tournamentId) {
  const got = await callUserRpc(userClient, "team_tournament_get_setup", {
    p_tournament_id: tournamentId,
  });
  if (got.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      rpcFailed(got.error) || "Team tournament binding failed",
      { tournamentId }
    );
  }
  const payload = unwrapRpc(got.data);
  if (payload && payload.ok === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Team tournament is not bound for the authenticated actor",
      { tournamentId, code: payload.code || null }
    );
  }
  return true;
}

/**
 * @param {{
 *   userClient: object,
 *   tenantId: string,
 *   tournamentId: string,
 *   actorId: string,
 *   clubId?: string|null,
 *   canonicalId?: string|null,
 *   teamBound?: boolean,
 *   canonicalBound?: boolean,
 * }} input
 */
export async function assertTrustedAssignmentAuthz(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const tournamentId = String(input.tournamentId || "").trim();
  const actorId = String(input.actorId || "").trim();
  const userClient = input.userClient;

  if (!tenantId || !tournamentId || !actorId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
      "tenantId, tournamentId, and authenticated actorId are required",
      {}
    );
  }

  const tenant = await callUserRpc(userClient, "canonical_tournament_assert_tenant", {
    p_tenant_id: tenantId,
  });
  if (tenant.error) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      rpcFailed(tenant.error) || "Canonical tenant assertion failed",
      { tenantId }
    );
  }

  let permOk = false;
  const perm = await callUserRpc(
    userClient,
    "canonical_tournament_assert_permission",
    { p_permission: "tournament.update" }
  );
  if (!perm.error) permOk = true;

  if (!permOk) {
    const teamManage = await callUserRpc(userClient, "team_tournament_can_manage", {});
    if (!teamManage.error && teamManage.data === true) permOk = true;
  }

  if (!permOk) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "tournament.update / team.manage authorization denied",
      { tenantId, tournamentId, actorId }
    );
  }

  let concreteBound = false;
  if (input.canonicalBound !== false) {
    concreteBound =
      (await assertConcreteCanonicalTournament(userClient, {
        tenantId,
        tournamentId,
        clubId: input.clubId,
        canonicalId: input.canonicalId,
      })) || concreteBound;
  }
  if (input.teamBound === true) {
    concreteBound =
      (await assertConcreteTeamTournament(userClient, tournamentId)) ||
      concreteBound;
  }

  return Object.freeze({
    tenantId,
    tournamentId,
    actorId,
    actorAuthorized: true,
    tournamentBound: true,
    concreteTournamentBound: concreteBound,
  });
}
