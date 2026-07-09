/**
 * V5.2 roles — canonical names + legacy VENUE_* / v4 aliases (DB tương thích ngược).
 */
export const ROLES = Object.freeze({
  /** Quản trị nền tảng / Super Admin */
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  /** @deprecated alias — normalize → PLATFORM_ADMIN */
  SUPER_ADMIN: "SUPER_ADMIN",
  SYSTEM_TECHNICIAN: "SYSTEM_TECHNICIAN",
  /** Chủ đơn vị / Chủ sân */
  TENANT_OWNER: "TENANT_OWNER",
  /** @deprecated alias — normalize → TENANT_OWNER */
  COURT_OWNER: "COURT_OWNER",
  VENUE_MANAGER: "VENUE_MANAGER",
  /** @deprecated alias — normalize → VENUE_MANAGER */
  COURT_MANAGER: "COURT_MANAGER",
  TOURNAMENT_MANAGER: "TOURNAMENT_MANAGER",
  TEAM_CAPTAIN: "TEAM_CAPTAIN",
  CASHIER: "CASHIER",
  CLUB_MANAGER: "CLUB_MANAGER",
  /** @deprecated alias — normalize → CLUB_MANAGER */
  CLUB_OWNER: "CLUB_OWNER",
  COACH: "COACH",
  REFEREE: "REFEREE",
  STAFF: "STAFF",
  PLAYER: "PLAYER",
  CUSTOMER: "CUSTOMER",
  SUPPORT: "SUPPORT",
  /** @deprecated — giữ tương thích v4 */
  ACCOUNTANT: "ACCOUNTANT",
  /** @deprecated DB legacy — normalize → TENANT_OWNER */
  VENUE_OWNER: "VENUE_OWNER",
});

/** Legacy DB / seed values → canonical role trong app. */
export const LEGACY_ROLE_ALIASES = Object.freeze({
  [ROLES.SUPER_ADMIN]: ROLES.PLATFORM_ADMIN,
  [ROLES.COURT_OWNER]: ROLES.TENANT_OWNER,
  [ROLES.COURT_MANAGER]: ROLES.VENUE_MANAGER,
  [ROLES.CLUB_OWNER]: ROLES.CLUB_MANAGER,
  [ROLES.VENUE_OWNER]: ROLES.TENANT_OWNER,
  ADMIN: ROLES.PLATFORM_ADMIN,
  owner: ROLES.TENANT_OWNER,
  OWNER: ROLES.TENANT_OWNER,
});

export const CANONICAL_ROLES = Object.freeze([
  ROLES.PLATFORM_ADMIN,
  ROLES.SYSTEM_TECHNICIAN,
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.TOURNAMENT_MANAGER,
  ROLES.TEAM_CAPTAIN,
  ROLES.CASHIER,
  ROLES.CLUB_MANAGER,
  ROLES.COACH,
  ROLES.REFEREE,
  ROLES.STAFF,
  ROLES.PLAYER,
  ROLES.CUSTOMER,
  ROLES.SUPPORT,
  ROLES.ACCOUNTANT,
]);

export const ROLE_LABELS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: "Quản trị nền tảng / Super Admin",
  [ROLES.SUPER_ADMIN]: "Quản trị nền tảng / Super Admin",
  [ROLES.SYSTEM_TECHNICIAN]: "Admin",
  [ROLES.TENANT_OWNER]: "Chủ đơn vị / Chủ sân",
  [ROLES.COURT_OWNER]: "Chủ đơn vị / Chủ sân",
  [ROLES.VENUE_MANAGER]: "Quản lý cơ sở",
  [ROLES.COURT_MANAGER]: "Quản lý cơ sở",
  [ROLES.TOURNAMENT_MANAGER]: "Quản lý giải đấu",
  [ROLES.TEAM_CAPTAIN]: "Trưởng nhóm / Đội trưởng",
  [ROLES.CASHIER]: "Thu ngân",
  [ROLES.CLUB_MANAGER]: "Quản lý CLB",
  [ROLES.CLUB_OWNER]: "Quản lý CLB",
  [ROLES.COACH]: "Huấn luyện viên",
  [ROLES.REFEREE]: "Trọng tài",
  [ROLES.STAFF]: "Nhân sự vận hành",
  [ROLES.PLAYER]: "Vận động viên",
  [ROLES.CUSTOMER]: "Khách hàng / Hội viên",
  [ROLES.SUPPORT]: "Hỗ trợ hệ thống",
  [ROLES.VENUE_OWNER]: "Chủ đơn vị / Chủ sân",
  [ROLES.ACCOUNTANT]: "Kế toán",
});

export const GLOBAL_ROLES = Object.freeze([ROLES.PLATFORM_ADMIN]);

export const PLATFORM_SCOPED_ROLES = Object.freeze([ROLES.SYSTEM_TECHNICIAN]);

export const VENUE_SCOPED_ROLES = Object.freeze([
  ROLES.TENANT_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.TOURNAMENT_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.STAFF,
  ROLES.COACH,
]);

export const CLUB_SCOPED_ROLES = Object.freeze([ROLES.CLUB_MANAGER, ROLES.PLAYER]);

export const TOURNAMENT_TEAM_SCOPED_ROLES = Object.freeze([ROLES.TEAM_CAPTAIN]);

export function normalizeRole(role) {
  const value = String(role || "").trim();
  if (!value) {
    return "";
  }
  if (LEGACY_ROLE_ALIASES[value]) {
    return LEGACY_ROLE_ALIASES[value];
  }
  const upper = value.toUpperCase();
  if (LEGACY_ROLE_ALIASES[upper]) {
    return LEGACY_ROLE_ALIASES[upper];
  }
  if (CANONICAL_ROLES.includes(upper)) {
    return upper;
  }
  return value;
}

/** Ghi DB: giữ legacy nếu staging chưa migrate role string. */
export function denormalizeRoleForDb(role) {
  const canonical = normalizeRole(role);
  if (canonical === ROLES.TENANT_OWNER) {
    return ROLES.VENUE_OWNER;
  }
  if (canonical === ROLES.VENUE_MANAGER) {
    return ROLES.VENUE_MANAGER;
  }
  if (canonical === ROLES.PLATFORM_ADMIN) {
    return ROLES.SUPER_ADMIN;
  }
  return canonical;
}

export function rolesEqual(roleA, roleB) {
  return normalizeRole(roleA) === normalizeRole(roleB);
}

export function isValidRole(role) {
  const normalized = normalizeRole(role);
  return CANONICAL_ROLES.includes(normalized);
}

export function getRoleLabel(role) {
  const canonical = normalizeRole(role);
  return ROLE_LABELS[canonical] || ROLE_LABELS[role] || "";
}

export function isGlobalRole(role) {
  return rolesEqual(role, ROLES.PLATFORM_ADMIN);
}

export function isPlatformScopedRole(role) {
  const normalized = normalizeRole(role);
  return PLATFORM_SCOPED_ROLES.includes(normalized);
}

export function isVenueScopedRole(role) {
  const normalized = normalizeRole(role);
  return VENUE_SCOPED_ROLES.includes(normalized);
}

export function isClubScopedRole(role) {
  const normalized = normalizeRole(role);
  return CLUB_SCOPED_ROLES.includes(normalized);
}

export function isTournamentTeamScopedRole(role) {
  const normalized = normalizeRole(role);
  return TOURNAMENT_TEAM_SCOPED_ROLES.includes(normalized);
}

export function isRefereeRole(role) {
  return rolesEqual(role, ROLES.REFEREE);
}

export function isTeamCaptainRole(role) {
  return rolesEqual(role, ROLES.TEAM_CAPTAIN);
}

export function isPlatformWideRole(role) {
  const normalized = normalizeRole(role);
  return isGlobalRole(normalized) || isPlatformScopedRole(normalized);
}

export function isPlatformAthleteViewer(role) {
  return isPlatformWideRole(role);
}
