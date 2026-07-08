import { PERMISSIONS } from "../../../auth/permissions.js";
import { ROLES, normalizeRole } from "../../../auth/roles.js";

/**
 * Xác định phạm vi và section Dashboard theo role / permission (Sprint 8 RBAC).
 */
export function resolveDashboardAccess(user, can, scope = {}) {
  const role = normalizeRole(user?.role);

  if (role === ROLES.PLAYER || role === ROLES.REFEREE) {
    return { allowed: false, reason: "role_restricted" };
  }

  const canCheck = (permission) =>
    typeof can === "function" ? can(permission, scope) : true;

  const sections = {
    revenue: canCheck(PERMISSIONS.FINANCE_VIEW),
    customers: canCheck(PERMISSIONS.CUSTOMER_VIEW),
    clubs: canCheck(PERMISSIONS.CLUB_VIEW),
    courts: canCheck(PERMISSIONS.COURT_VIEW),
    players: canCheck(PERMISSIONS.PLAYER_VIEW),
    topPlayers: canCheck(PERMISSIONS.STATISTICS_VIEW) || canCheck(PERMISSIONS.PLAYER_VIEW),
    heatmap: canCheck(PERMISSIONS.COURT_VIEW) || canCheck(PERMISSIONS.BOOKING_VIEW),
    peakHours: canCheck(PERMISSIONS.COURT_VIEW) || canCheck(PERMISSIONS.BOOKING_VIEW),
    insights: true,
    clubOperations:
      canCheck(PERMISSIONS.STATISTICS_VIEW) ||
      canCheck(PERMISSIONS.TOURNAMENT_VIEW) ||
      canCheck(PERMISSIONS.SCHEDULING_VIEW),
  };

  if (role === ROLES.CASHIER) {
    sections.revenue = true;
    sections.customers = true;
    sections.courts = true;
    sections.heatmap = true;
    sections.peakHours = true;
    sections.clubs = false;
    sections.players = false;
    sections.topPlayers = false;
    sections.clubOperations = false;
  }

  if (role === ROLES.ACCOUNTANT) {
    sections.revenue = true;
    sections.customers = true;
    sections.clubs = false;
    sections.topPlayers = canCheck(PERMISSIONS.STATISTICS_VIEW);
    sections.clubOperations = false;
  }

  if (role === ROLES.CLUB_MANAGER) {
    sections.revenue = canCheck(PERMISSIONS.FINANCE_VIEW);
    sections.courts = false;
    sections.heatmap = false;
    sections.peakHours = false;
  }

  const dataScope =
    role === ROLES.SUPER_ADMIN
      ? "system"
      : role === ROLES.CLUB_MANAGER
        ? "club"
        : "tenant";

  const hasAnySection = Object.values(sections).some(Boolean);

  return {
    allowed: hasAnySection,
    role,
    dataScope,
    sections,
    scopeLabel:
      dataScope === "system"
        ? "Toàn hệ thống"
        : dataScope === "club"
          ? "CLB hiện tại"
          : "Sân / tenant hiện tại",
  };
}
