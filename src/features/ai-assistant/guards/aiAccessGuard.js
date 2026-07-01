import { getCurrentUser } from "../../../auth/authService.js";
import { can } from "../../../auth/rbac.js";
import { guardClubAction } from "../../../auth/guardAction.js";
import { assertTournamentAccess } from "../../../domain/tournamentService.js";
import {
  AI_MANAGEMENT_ROLES,
  AI_PERMISSION,
  AI_VIEW_ONLY_ROLES,
} from "../constants/aiConfig.js";
import { normalizeRole } from "../../identity/constants/roles.js";

function userRole(user) {
  return normalizeRole(user?.role || user?.profile?.role || "");
}

/**
 * Kiểm tra quyền AI — management (apply) vs view-only (referee).
 * @param {Object} options
 * @param {string} options.clubId
 * @param {string} options.tournamentId
 * @param {string} options.tenantId
 * @param {boolean} [options.requireApply=false]
 */
export function guardAiAccess({ clubId, tournamentId, tenantId, requireApply = false } = {}) {
  const user = getCurrentUser();
  if (!clubId || !tournamentId) {
    return { ok: false, error: "Thiếu clubId hoặc tournamentId.", code: "BAD_REQUEST" };
  }

  const access = assertTournamentAccess(clubId, tournamentId, { tenantId });
  if (!access.ok) {
    return access;
  }

  const role = userRole(user);
  const isViewOnly = AI_VIEW_ONLY_ROLES.has(role);
  const isManagement = AI_MANAGEMENT_ROLES.has(role) || role === "SUPER_ADMIN";

  if (requireApply) {
    if (isViewOnly) {
      return {
        ok: false,
        error: "Trọng tài chỉ được xem cảnh báo, không được áp dụng đề xuất AI.",
        code: "FORBIDDEN",
      };
    }

    const actionCheck = guardClubAction(clubId, AI_PERMISSION);
    if (!actionCheck.ok) {
      return actionCheck;
    }

    if (!isManagement && !can(user, AI_PERMISSION, { clubId, tenantId, venueId: tenantId })) {
      return {
        ok: false,
        error: "Bạn không có quyền sử dụng AI Assistant.",
        code: "FORBIDDEN",
      };
    }
  } else if (!isManagement && !isViewOnly) {
    if (!can(user, AI_PERMISSION, { clubId, tenantId, venueId: tenantId })) {
      return {
        ok: false,
        error: "Bạn không có quyền xem AI Assistant.",
        code: "FORBIDDEN",
      };
    }
  }

  return {
    ok: true,
    tournament: access.tournament,
    canApply: isManagement && !isViewOnly,
    viewOnly: isViewOnly,
    user,
  };
}
