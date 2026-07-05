import { DASHBOARD_MENU_ROOT } from "./dashboardMenu.js";
import { VENUE_OPS_MENU_ROOT } from "./venueOpsMenu.js";
import { CUSTOMERS_MENU_ROOT } from "./customersMenu.js";
import { CLUB_COACHING_MENU_ROOT } from "./clubCoachingMenu.js";
import { TOURNAMENT_MENU_ROOT } from "./tournamentMenu.js";
import { FINANCE_MENU_ROOT } from "./financeMenu.js";
import { REPORTS_MENU_ROOT } from "./reportsMenu.js";
import { CRM_MENU_ROOT } from "./crmMenu.js";
import { AI_MENU_ROOT } from "./aiMenu.js";
import { ADMIN_MENU_ROOT } from "./adminMenu.js";
import { SUPPORT_MENU_ROOT } from "./supportMenu.js";
import { SYSTEM_TECHNICIAN_MENU_ROOT } from "./systemTechnicianMenu.js";
import { TEAM_CAPTAIN_MENU_ROOT } from "./teamCaptainMenu.js";

export { TOURNAMENT_MENU_ROOT } from "./tournamentMenu.js";
export { SYSTEM_TECHNICIAN_MENU_ROOT } from "./systemTechnicianMenu.js";
export { FEATURE_STATUS, SIDEBAR_MAX_FOLDER_DEPTH } from "./menuBuilders.js";
export { auditMenuFeatureCoverage, formatMenuAuditReport } from "./menuFeatureAudit.js";
export { auditSidebarMenuDepth } from "./menuDepthAudit.js";
export {
  TOURNAMENT_IN_PAGE_NAV,
  collectTournamentInPageLabels,
} from "./tournamentInPageNav.js";
export { auditFullMenuCoverage } from "./fullMenuAudit.js";

/** MENU_GROUPS V5 — cây menu đầy đủ theo spec hệ thống. */
export const V5_MENU_GROUPS = [
  { id: "dashboard", label: "Tổng quan", items: [DASHBOARD_MENU_ROOT] },
  { id: "venue-ops", label: "Vận hành sân", items: [VENUE_OPS_MENU_ROOT] },
  { id: "customers", label: "Khách hàng & VĐV", items: [CUSTOMERS_MENU_ROOT] },
  { id: "club", label: "CLB & Huấn luyện", items: [CLUB_COACHING_MENU_ROOT] },
  { id: "tournament", label: "Giải đấu", items: [TOURNAMENT_MENU_ROOT] },
  { id: "finance", label: "Tài chính", items: [FINANCE_MENU_ROOT] },
  { id: "reports", label: "Báo cáo", items: [REPORTS_MENU_ROOT] },
  { id: "crm", label: "Chăm sóc khách hàng", items: [CRM_MENU_ROOT] },
  { id: "ai", label: "Trợ lý thông minh", items: [AI_MENU_ROOT], requiresFeature: "ai" },
  { id: "admin", label: "Quản trị", items: [ADMIN_MENU_ROOT] },
  { id: "support", label: "Hỗ trợ", items: [SUPPORT_MENU_ROOT] },
];
