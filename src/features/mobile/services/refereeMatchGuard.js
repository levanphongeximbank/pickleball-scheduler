import { MATCH_LIVE_STATUS } from "../../../domain/matchLiveSync.js";
import { isRefereeMatchLocked } from "../../../tournament/engines/refereeStatusEngine.js";
import { PERMISSIONS } from "../../identity/constants/permissions.js";
import { ROLES, normalizeRole } from "../../identity/constants/roles.js";
import { can } from "../../../auth/rbac.js";
import { isRbacEnabled } from "../../../auth/authService.js";

export const REFEREE_MATCH_ACTIONS = Object.freeze({
  SCORE_INCREMENT: "score_increment",
  SCORE_DECREMENT: "score_decrement",
  FINALIZE: "finalize",
  VIEW: "view",
});

const SCORE_ACTIONS = new Set([
  REFEREE_MATCH_ACTIONS.SCORE_INCREMENT,
  REFEREE_MATCH_ACTIONS.SCORE_DECREMENT,
]);

export function hasMatchCorrectionPermission(user, scope = {}) {
  if (!user) {
    return false;
  }

  return can(user, PERMISSIONS.TOURNAMENT_UPDATE, scope, { rbacEnabled: isRbacEnabled() });
}

export function isMatchAssignedToUser(matchRow, user) {
  if (!matchRow || !user) {
    return false;
  }

  if (normalizeRole(user.role) === ROLES.SUPER_ADMIN) {
    return true;
  }

  const refereeName = String(matchRow.refereeName || "").trim().toLowerCase();
  if (!refereeName) {
    return normalizeRole(user.role) === ROLES.REFEREE;
  }

  const displayName = String(user.displayName || "").trim().toLowerCase();
  const emailPrefix = String(user.email || "").split("@")[0].toLowerCase();

  return (
    (displayName && (refereeName === displayName || refereeName.includes(displayName))) ||
    (emailPrefix && refereeName.includes(emailPrefix))
  );
}

export function guardRefereeMatchAction({
  user,
  matchRow,
  action = REFEREE_MATCH_ACTIONS.VIEW,
  scope = {},
  sessionToken = null,
} = {}) {
  if (!user) {
    return { ok: false, code: "UNAUTHORIZED", error: "Chưa đăng nhập." };
  }

  if (!matchRow) {
    return { ok: false, code: "NO_MATCH", error: "Không tìm thấy trận đấu." };
  }

  const rbacOn = { rbacEnabled: isRbacEnabled() };
  const canUpdate = can(user, PERMISSIONS.MATCH_UPDATE, scope, rbacOn);
  const canCorrect = hasMatchCorrectionPermission(user, scope);

  if (isRbacEnabled() && !canUpdate && normalizeRole(user.role) !== ROLES.REFEREE) {
    return { ok: false, code: "FORBIDDEN", error: "Không có quyền chấm trận." };
  }

  if (
    sessionToken &&
    matchRow.refereeToken &&
    String(matchRow.refereeToken) !== String(sessionToken)
  ) {
    return {
      ok: false,
      code: "WRONG_TOKEN",
      error: "Token trận không khớp phiên hiện tại.",
    };
  }

  if (
    isRbacEnabled() &&
    normalizeRole(user.role) === ROLES.REFEREE &&
    !isMatchAssignedToUser(matchRow, user) &&
    !canCorrect
  ) {
    return {
      ok: false,
      code: "NOT_ASSIGNED",
      error: "Trận này không thuộc phân công của bạn.",
    };
  }

  const locked = isRefereeMatchLocked(matchRow);

  if (locked && SCORE_ACTIONS.has(action)) {
    const allowCorrection = isRbacEnabled() && canCorrect;
    if (!allowCorrection) {
      return {
        ok: false,
        code: "MATCH_LOCKED",
        error: "Trận đã khóa — không thể sửa điểm.",
        locked: true,
      };
    }
  }

  if (action === REFEREE_MATCH_ACTIONS.FINALIZE && locked) {
    return {
      ok: false,
      code: "MATCH_LOCKED",
      error: "Trận đã chốt hoặc đang chờ xác nhận.",
      locked: true,
    };
  }

  if (SCORE_ACTIONS.has(action) || action === REFEREE_MATCH_ACTIONS.FINALIZE) {
    if (matchRow.status !== MATCH_LIVE_STATUS.PLAYING && !canCorrect) {
      return {
        ok: false,
        code: "NOT_PLAYING",
        error:
          matchRow.status === MATCH_LIVE_STATUS.FINALIZE_REQUESTED
            ? "Trận đang chờ BTC xác nhận — không thể sửa điểm."
            : "Trận chưa bắt đầu hoặc đã kết thúc.",
        locked: matchRow.status !== MATCH_LIVE_STATUS.PLAYING,
      };
    }
  }

  if (action === REFEREE_MATCH_ACTIONS.SCORE_DECREMENT && !canCorrect) {
    const scoreA = matchRow.scoreA ?? 0;
    const scoreB = matchRow.scoreB ?? 0;
    if (scoreA === 0 && scoreB === 0) {
      return { ok: false, code: "INVALID_SCORE", error: "Không thể giảm điểm khi tỷ số là 0." };
    }
  }

  return { ok: true, canCorrect, locked };
}

export function guardRefereeSessionRoute({ user, matchId, assignments = [], scope = {} }) {
  if (!user) {
    return { ok: false, code: "UNAUTHORIZED" };
  }

  const rbacOn = { rbacEnabled: isRbacEnabled() };
  const canUpdate = can(user, PERMISSIONS.MATCH_UPDATE, scope, rbacOn);

  if (isRbacEnabled() && !canUpdate && normalizeRole(user.role) !== ROLES.REFEREE) {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (normalizeRole(user.role) === ROLES.SUPER_ADMIN) {
    return { ok: true };
  }

  const assigned = assignments.some((item) => String(item.matchId) === String(matchId));
  if (!assigned && normalizeRole(user.role) === ROLES.REFEREE) {
    return { ok: false, code: "NOT_ASSIGNED", error: "Trận không thuộc phân công của bạn." };
  }

  return { ok: true };
}

export function requiresFinalizeConfirmation() {
  return true;
}
