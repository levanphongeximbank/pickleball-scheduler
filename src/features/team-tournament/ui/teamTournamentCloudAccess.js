/**
 * Canonical Team Tournament page access for cloud_only / cloud_primary runtime.
 *
 * Authority = already-loaded cloud tournament object.
 * Does NOT consult the legacy local club tournament blob.
 */
import { assertLoadedTournamentAccess } from "../../tournament/guards/tournamentAccess.js";
import { getPermissionsForRole } from "../../identity/matrix/rolePermissions.js";
import { canManageTeam } from "../engines/teamPermissionEngine.js";
import { getTeamData } from "../engines/teamTournamentEngine.js";
import { PERMISSIONS } from "../../../auth/permissions.js";

/**
 * @param {object} input
 * @param {boolean} input.rbacEnabled
 * @param {boolean} input.isAuthenticated
 * @param {string} input.clubId
 * @param {object|null|undefined} input.tournament cloud-loaded tournament
 * @param {string|null|undefined} input.currentTenantId
 * @param {object|null|undefined} input.user
 * @param {(permission: string, scope?: object) => boolean} [input.can]
 */
export function resolveTeamTournamentCloudPageAccess(input = {}) {
  const {
    rbacEnabled = false,
    isAuthenticated = false,
    clubId = "",
    tournament = null,
    currentTenantId = null,
    user = null,
    can = () => false,
  } = input;

  if (!rbacEnabled || !isAuthenticated) {
    return {
      allowed: true,
      pending: false,
      canManage: true,
      canViewAll: true,
      viewerPlayerId: null,
      error: null,
      code: null,
    };
  }

  // Loading / not yet hydrated — never treat as blob NOT_FOUND.
  if (!tournament) {
    return {
      allowed: false,
      pending: true,
      canManage: false,
      canViewAll: false,
      viewerPlayerId: null,
      error: null,
      code: "PENDING_CLOUD_LOAD",
    };
  }

  const loadedCheck = assertLoadedTournamentAccess(clubId, tournament, {
    tenantId: currentTenantId,
    user,
    rbacEnabled,
  });
  if (!loadedCheck.ok) {
    return {
      allowed: false,
      pending: false,
      canManage: false,
      canViewAll: false,
      viewerPlayerId: null,
      error: loadedCheck.error || "Không tìm thấy giải.",
      code: loadedCheck.code || "FORBIDDEN",
    };
  }

  const rolePermissions = getPermissionsForRole(user?.role || "");
  const scope = {
    clubId,
    venueId: currentTenantId,
    tenantId: currentTenantId,
  };

  const canManage =
    can(PERMISSIONS.TEAM_MANAGE, scope) ||
    can(PERMISSIONS.TOURNAMENT_UPDATE, scope) ||
    canManageTeam({ permissions: rolePermissions });

  const canViewAll =
    canManage ||
    can(PERMISSIONS.TEAM_VIEW, scope) ||
    can(PERMISSIONS.TOURNAMENT_VIEW, scope);

  const teamData = getTeamData(tournament);
  const viewerPlayerId = user?.playerId ? String(user.playerId) : null;
  const isCaptain =
    Boolean(viewerPlayerId) &&
    (teamData?.teams || []).some(
      (team) =>
        team.captainPlayerId === viewerPlayerId ||
        (team.deputyPlayerIds || []).includes(viewerPlayerId)
    );

  const allowed = canManage || canViewAll || isCaptain;

  return {
    allowed,
    pending: false,
    canManage,
    canViewAll: canViewAll && !canManage,
    isCaptain: Boolean(isCaptain),
    viewerPlayerId: canManage ? null : viewerPlayerId,
    error: allowed ? null : "Bạn không có quyền xem giải đồng đội này.",
    code: allowed ? null : "FORBIDDEN",
  };
}
