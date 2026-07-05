import { PERMISSIONS } from "../../auth/permissions.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

const VIEW = [
  PERMISSIONS.STATISTICS_VIEW,
  PERMISSIONS.TOURNAMENT_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.BOOKING_VIEW,
];

/** Sidebar: 1 mục — chi tiết KPI trên trang Dashboard. */
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
      path: "/",
      match: "exact",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
