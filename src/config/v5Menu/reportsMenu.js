import { PERMISSIONS } from "../../auth/permissions.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

/** Sidebar: 1 hub — chi tiết báo cáo trong màn hình /reports */
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
      featureStatus: FEATURE_STATUS.LIVE,
      featureNote: "Tab: doanh thu, hiệu suất, giờ cao điểm…",
    }),
  ],
});
