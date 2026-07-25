import { PERMISSIONS } from "../../auth/permissions.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

/** Sidebar: Reporting workspace at /reports — PARTIAL until durable runtime is injected. */
export const REPORTS_MENU_ROOT = menuFolder({
  key: "reports-root",
  icon: "report-overview",
  text: "Báo cáo",
  children: [
    menuLeaf({
      key: "reports-hub",
      icon: "report-overview",
      text: "Báo cáo",
      path: "/reports",
      match: "reports-hub",
      permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.FINANCE_VIEW],
      featureStatus: FEATURE_STATUS.PARTIAL,
      featureNote: "Reporting workspace trung thực — runtime durable có thể UNAVAILABLE",
    }),
  ],
});
