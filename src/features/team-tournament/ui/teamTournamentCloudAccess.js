/**
 * Canonical Team Tournament page access for cloud_only / cloud_primary runtime.
 *
 * Authority = already-loaded cloud tournament object.
 * Does NOT consult the legacy local club tournament blob.
 */
import { hasRole, isRbacEnforced } from "../../../auth/rbac.js";
import { isRefereeRole, ROLES } from "../../../auth/roles.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { getPermissionsForRole } from "../../identity/matrix/rolePermissions.js";
import { guardRecordTenant } from "../../tenant/guards/tenantGuard.js";
import { assertLoadedTournamentAccess } from "../../tournament/guards/tournamentAccess.js";
import {
  canManageTeam,
  canManageTeamMatchResult,
  canViewTeamMatchResults,
} from "../engines/teamPermissionEngine.js";
import { getTeamData, isTeamTournament } from "../engines/teamTournamentEngine.js";
import { resolveCanonicalCaptainAthleteIdFromUser } from "../engines/captainIdentityResolver.js";

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
  const viewerPlayerId =
    resolveCanonicalCaptainAthleteIdFromUser(user) ||
    String(input.viewerAthleteId || "").trim() ||
    null;
  const isCaptain =
    Boolean(viewerPlayerId) &&
    (teamData?.teams || []).some(
      (team) =>
        team.captainPlayerId === viewerPlayerId ||
        (team.deputyPlayerIds || []).includes(viewerPlayerId)
    );

  const allowed = canManage || canViewAll || isCaptain;
  const status = String(tournament?.status || "").toLowerCase();
  if (status === "draft" && !canManage) {
    return {
      allowed: false,
      pending: false,
      canManage: false,
      canViewAll: false,
      isCaptain: Boolean(isCaptain),
      viewerPlayerId,
      error: "Giải nháp chỉ hiển thị cho ban tổ chức.",
      code: "DRAFT_NOT_VISIBLE",
    };
  }

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

function shouldSkipClubGuardForRefereePortal(user, rbacEnabled) {
  return (
    isRbacEnforced({ rbacEnabled, user }) &&
    Boolean(user) &&
    (hasRole(user, ROLES.PLAYER) || isRefereeRole(user.role))
  );
}

/**
 * TeamRefereePortal access against an already-loaded cloud tournament.
 * Does not consult localStorage or the legacy club tournament blob.
 *
 * PLAYER / REFEREE keep the existing portal club-guard skip and are
 * authorized from the loaded tournament + tenant + referee permissions.
 *
 * @param {object} input
 * @param {boolean} [input.loading]
 * @param {string|null} [input.loadError]
 */
export function resolveTeamRefereeCloudPageAccess(input = {}) {
  const {
    loading = false,
    loadError = null,
    tournament = null,
    clubId = "",
    currentTenantId = null,
    user = null,
    rbacEnabled = false,
    isAuthenticated = false,
    can = () => false,
  } = input;

  if (loading) {
    return {
      allowed: false,
      pending: true,
      canManage: false,
      canView: false,
      error: null,
      code: "PENDING_CLOUD_LOAD",
    };
  }

  if (!tournament) {
    return {
      allowed: false,
      pending: false,
      canManage: false,
      canView: false,
      error: loadError || "Không tìm thấy giải đấu.",
      code: "NOT_FOUND",
    };
  }

  if (!isTeamTournament(tournament)) {
    return {
      allowed: false,
      pending: false,
      canManage: false,
      canView: false,
      error: "Giải này không phải giải đồng đội.",
      code: "NOT_TEAM_TOURNAMENT",
    };
  }

  if (shouldSkipClubGuardForRefereePortal(user, rbacEnabled)) {
    if (currentTenantId && tournament.tenantId) {
      const tenantCheck = guardRecordTenant(tournament, currentTenantId, {
        user,
        rbacEnabled,
      });
      if (!tenantCheck.ok) {
        return {
          allowed: false,
          pending: false,
          canManage: false,
          canView: false,
          error: tenantCheck.error,
          code: tenantCheck.code || "FORBIDDEN",
        };
      }
    }
  } else {
    const page = resolveTeamTournamentCloudPageAccess({
      rbacEnabled,
      isAuthenticated,
      clubId: String(clubId || tournament.clubId || "").trim(),
      tournament,
      currentTenantId,
      user,
      can,
    });

    if (page.pending) {
      return {
        allowed: false,
        pending: true,
        canManage: false,
        canView: false,
        error: null,
        code: page.code || "PENDING_CLOUD_LOAD",
      };
    }

    if (!page.allowed) {
      return {
        allowed: false,
        pending: false,
        canManage: false,
        canView: false,
        error: page.error,
        code: page.code || "FORBIDDEN",
      };
    }
  }

  if (!rbacEnabled || !isAuthenticated) {
    return {
      allowed: true,
      pending: false,
      canManage: true,
      canView: true,
      error: null,
      code: null,
    };
  }

  const permissions = getPermissionsForRole(user?.role || "");
  const canManage = canManageTeamMatchResult({ permissions });
  const canView = canViewTeamMatchResults({ permissions });

  if (!canView && !canManage) {
    return {
      allowed: false,
      pending: false,
      canManage: false,
      canView: false,
      error: "Bạn không có quyền xem trang trọng tài giải đồng đội.",
      code: "FORBIDDEN",
    };
  }

  return {
    allowed: true,
    pending: false,
    canManage,
    canView,
    error: null,
    code: null,
  };
}
