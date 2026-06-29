/** Vai trò hệ thống RBAC — một user có một role chính. */
export const ROLES = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  VENUE_OWNER: "VENUE_OWNER",
  VENUE_MANAGER: "VENUE_MANAGER",
  CASHIER: "CASHIER",
  ACCOUNTANT: "ACCOUNTANT",
  CLUB_OWNER: "CLUB_OWNER",
  PLAYER: "PLAYER",
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPER_ADMIN]: "Quản trị hệ thống",
  [ROLES.VENUE_OWNER]: "Chủ sân",
  [ROLES.VENUE_MANAGER]: "Quản lý sân",
  [ROLES.CASHIER]: "Thu ngân",
  [ROLES.ACCOUNTANT]: "Kế toán",
  [ROLES.CLUB_OWNER]: "Chủ CLB",
  [ROLES.PLAYER]: "Vận động viên",
});

/** Role không gắn tenant/venue. */
export const GLOBAL_ROLES = Object.freeze([ROLES.SUPER_ADMIN]);

/** Role gắn venue (tenant). */
export const VENUE_SCOPED_ROLES = Object.freeze([
  ROLES.VENUE_OWNER,
  ROLES.VENUE_MANAGER,
  ROLES.CASHIER,
  ROLES.ACCOUNTANT,
]);

/** Role gắn club trong venue. */
export const CLUB_SCOPED_ROLES = Object.freeze([ROLES.CLUB_OWNER, ROLES.PLAYER]);

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

export function isGlobalRole(role) {
  return GLOBAL_ROLES.includes(role);
}

export function isVenueScopedRole(role) {
  return VENUE_SCOPED_ROLES.includes(role);
}

export function isClubScopedRole(role) {
  return CLUB_SCOPED_ROLES.includes(role);
}
