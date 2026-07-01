/**
 * v4.0 roles — canonical names + legacy VENUE_* aliases (DB tương thích ngược).
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  COURT_OWNER: "COURT_OWNER",
  COURT_MANAGER: "COURT_MANAGER",
  CASHIER: "CASHIER",
  ACCOUNTANT: "ACCOUNTANT",
  REFEREE: "REFEREE",
  CLUB_OWNER: "CLUB_OWNER",
  PLAYER: "PLAYER",
  /** @deprecated DB legacy — normalize → COURT_OWNER */
  VENUE_OWNER: "VENUE_OWNER",
  /** @deprecated DB legacy — normalize → COURT_MANAGER */
  VENUE_MANAGER: "VENUE_MANAGER",
});

/** Legacy DB / seed values → canonical role trong app. */
export const LEGACY_ROLE_ALIASES = Object.freeze({
  [ROLES.VENUE_OWNER]: ROLES.COURT_OWNER,
  [ROLES.VENUE_MANAGER]: ROLES.COURT_MANAGER,
  TENANT_OWNER: ROLES.COURT_OWNER,
  CLUB_MANAGER: ROLES.COURT_MANAGER,
});

export const CANONICAL_ROLES = Object.freeze([
  ROLES.SUPER_ADMIN,
  ROLES.COURT_OWNER,
  ROLES.COURT_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.REFEREE,
  ROLES.CLUB_OWNER,
  ROLES.PLAYER,
]);

export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: "Quản trị hệ thống",
  [ROLES.COURT_OWNER]: "Chủ sân",
  [ROLES.COURT_MANAGER]: "Quản lý sân",
  [ROLES.CASHIER]: "Thu ngân",
  [ROLES.ACCOUNTANT]: "Kế toán",
  [ROLES.REFEREE]: "Trọng tài",
  [ROLES.CLUB_OWNER]: "Chủ CLB",
  [ROLES.PLAYER]: "Vận động viên",
  [ROLES.VENUE_OWNER]: "Chủ sân",
  [ROLES.VENUE_MANAGER]: "Quản lý sân",
  TENANT_OWNER: "Chủ tenant",
  CLUB_MANAGER: "Quản lý CLB",
});

export const GLOBAL_ROLES = Object.freeze([ROLES.SUPER_ADMIN]);

export const VENUE_SCOPED_ROLES = Object.freeze([
  ROLES.COURT_OWNER,
  ROLES.COURT_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
  ROLES.REFEREE,
]);

export const CLUB_SCOPED_ROLES = Object.freeze([ROLES.CLUB_OWNER, ROLES.PLAYER]);

export function normalizeRole(role) {
  const value = String(role || "").trim();
  if (!value) {
    return "";
  }
  return LEGACY_ROLE_ALIASES[value] || value;
}

/** Ghi DB: giữ legacy nếu staging chưa migrate role string (additive Sprint 1). */
export function denormalizeRoleForDb(role) {
  const canonical = normalizeRole(role);
  if (canonical === ROLES.COURT_OWNER) {
    return ROLES.VENUE_OWNER;
  }
  if (canonical === ROLES.COURT_MANAGER) {
    return ROLES.VENUE_MANAGER;
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

export function isGlobalRole(role) {
  return rolesEqual(role, ROLES.SUPER_ADMIN);
}

export function isVenueScopedRole(role) {
  const normalized = normalizeRole(role);
  return VENUE_SCOPED_ROLES.includes(normalized);
}

export function isClubScopedRole(role) {
  const normalized = normalizeRole(role);
  return CLUB_SCOPED_ROLES.includes(normalized);
}

export function isRefereeRole(role) {
  return rolesEqual(role, ROLES.REFEREE);
}
