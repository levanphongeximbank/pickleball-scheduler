import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLES } from "../../auth/roles.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

const VIEW = [
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.BOOKING_VIEW,
];

/** Sidebar: Tổng quan + VPR Ranking (Phase 29). */
export const DASHBOARD_MENU_ROOT = menuFolder({
  key: "dashboard-root",
  icon: "dashboard",
  text: "Tổng quan",
  permissions: VIEW,
  children: [
    menuLeaf({
      key: "dashboard-ops",
      icon: "dashboard",
      text: "Tổng quan",
      path: "/dashboard",
      match: "exact",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "dashboard-vpr-rankings",
      icon: "statistics",
      text: "Xếp hạng VPR",
      path: "/dashboard/rankings",
      match: "dashboard-rankings",
      permissions: [PERMISSIONS.RANKING_VIEW, PERMISSIONS.RANKING_MANAGE],
      // Batch 1B: platform admins use Admin › Quản trị VPR; cashiers are not ranking operators.
      excludeRoles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN, ROLES.CASHIER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
