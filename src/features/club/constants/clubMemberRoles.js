export const CLUB_MEMBER_ROLES = Object.freeze({
  MEMBER: "member",
  CAPTAIN: "captain",
  COACH: "coach",
  MANAGER: "manager",
});

export const CLUB_MEMBER_ROLE_LABELS = Object.freeze({
  member: "Thành viên",
  captain: "Đội trưởng",
  coach: "Huấn luyện viên",
  manager: "Quản lý CLB",
});

/** Club membership lifecycle statuses (DB: active | left | removed; UI may also use inactive). */
export const CLUB_MEMBER_STATUSES = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  LEFT: "left",
  REMOVED: "removed",
});

export const CLUB_MEMBER_STATUS_LABELS = Object.freeze({
  active: "Đang hoạt động",
  left: "Đã rời",
  removed: "Đã xóa",
  inactive: "Không hoạt động",
  pending: "Chờ duyệt",
  rejected: "Từ chối",
});

/**
 * Canonical active rule: only raw/normalized status === 'active' counts as active.
 * Unknown, left, removed, pending, rejected, inactive → never active.
 */
export function normalizeClubMemberStatus(rawStatus) {
  const status = String(rawStatus || "")
    .trim()
    .toLowerCase();
  if (status === CLUB_MEMBER_STATUSES.ACTIVE) {
    return CLUB_MEMBER_STATUSES.ACTIVE;
  }
  if (status === CLUB_MEMBER_STATUSES.LEFT) {
    return CLUB_MEMBER_STATUSES.LEFT;
  }
  if (status === CLUB_MEMBER_STATUSES.REMOVED) {
    return CLUB_MEMBER_STATUSES.REMOVED;
  }
  if (status === CLUB_MEMBER_STATUSES.INACTIVE) {
    return CLUB_MEMBER_STATUSES.INACTIVE;
  }
  if (status === "pending" || status === "rejected") {
    return status;
  }
  return CLUB_MEMBER_STATUSES.INACTIVE;
}

export function isClubMemberStatusActive(status) {
  return normalizeClubMemberStatus(status) === CLUB_MEMBER_STATUSES.ACTIVE;
}

export function getClubMemberStatusLabel(status) {
  const normalized = normalizeClubMemberStatus(status);
  return CLUB_MEMBER_STATUS_LABELS[normalized] || CLUB_MEMBER_STATUS_LABELS.inactive;
}

/** Count members that are currently active (same rule as Home active_member_count). */
export function countActiveClubMembers(members = []) {
  return (members || []).filter((m) => isClubMemberStatusActive(m?.status)).length;
}
