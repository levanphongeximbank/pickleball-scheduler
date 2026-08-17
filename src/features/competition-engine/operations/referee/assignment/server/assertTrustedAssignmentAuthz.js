/**
 * Trusted-server authz — user-scoped canonical authorities only.
 * Does not invent RBAC. Browser permission claims are ignored.
 */

import { ASSIGNMENT_COMMAND_ERROR_CODE } from "../constants.js";
import { failAssignmentCommand } from "../errors.js";

function rpcFailed(error) {
  if (!error) return false;
  const combined = `${error.message || ""} ${error.details || ""} ${error.code || ""}`;
  return /TOURNAMENT_FORBIDDEN|TOURNAMENT_MISSING_TENANT|42501|PGRST/i.test(
    combined
  )
    ? combined
    : combined || "RPC failed";
}

async function callUserRpc(userClient, name, args) {
  const { data, error } = await userClient.rpc(name, args);
  return { data, error };
}

/**
 * @param {{
 *   userClient: object,
 *   tenantId: string,
 *   tournamentId: string,
 *   actorId: string,
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

  return Object.freeze({ tenantId, tournamentId, actorId, actorAuthorized: true });
}
