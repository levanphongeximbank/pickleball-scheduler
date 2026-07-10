/**
 * Phase 20 — Routes exempt from tenant operational lock (billing/support/profile).
 */

import {
  ROLES,
  isClubScopedRole,
  isGlobalRole,
  isPlatformScopedRole,
  normalizeRole,
} from "../../../auth/roles.js";

const BILLING_EXEMPT_EXACT = new Set([
  "/profile",
  "/player/profile",
  "/player/skill",
  "/player/skill-assessment",
  "/my-club",
  "/discover-clubs",
  "/change-password",
  "/403",
]);

const BILLING_EXEMPT_PREFIXES = [
  "/billing",
  "/profile/",
  "/player/profile/",
  "/player/skill/",
  "/player/skill-assessment/",
  "/mobile/player",
  "/mobile/notifications",
  "/onboarding/",
];

/** Module CLB — không phụ thuộc gói venue (lịch, VĐV, giải nội bộ, xếp sân…). */
const CLUB_OPERATIONAL_PREFIXES = [
  "/club",
  "/my-club",
  "/discover-clubs",
  "/manage/clubs",
  "/players",
  "/select-players",
  "/daily-play",
  "/coaching",
  "/statistics",
  "/tournament",
];

/** Vai trò CLB & VĐV — không bị khóa bởi gói thuê của tenant (chỉ chủ sân/nhân viên vận hành). */
export function isSubscriptionOperationalExemptRole(user) {
  if (!user?.role) {
    return false;
  }

  if (isGlobalRole(user.role) || isPlatformScopedRole(user.role)) {
    return true;
  }

  const role = normalizeRole(user.role);
  return (
    isClubScopedRole(role) ||
    role === ROLES.PLAYER ||
    role === ROLES.REFEREE ||
    role === ROLES.COACH ||
    role === ROLES.CUSTOMER ||
    role === ROLES.TEAM_CAPTAIN
  );
}

/** Paths that remain accessible when tenant subscription is locked. */
export function isBillingExemptPath(pathname) {
  if (!pathname) {
    return false;
  }

  if (BILLING_EXEMPT_EXACT.has(pathname)) {
    return true;
  }

  return BILLING_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}`)
  );
}

/** Route module CLB — luôn mở dù venue chưa có / hết gói. */
export function isClubOperationalPath(pathname) {
  if (!pathname) {
    return false;
  }

  return CLUB_OPERATIONAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Route hoặc billing exempt — dùng trong OperationalRouteGate. */
export function isOperationalRouteExempt(pathname) {
  return isBillingExemptPath(pathname) || isClubOperationalPath(pathname);
}

/** Self-service routes — VĐV/khách không cần tenant gán trên profile để mở trang. */
export function isTenantSelfServiceExemptPath(pathname) {
  return isBillingExemptPath(pathname);
}

/** Default operational action checked for route lock. */
export const DEFAULT_OPERATIONAL_ACTION = "create_booking";
