/**
 * V5.0 — Navigation config tập trung (SaaS multi-tenant / multi-venue).
 * Sidebar, mobile drawer, bottom nav và route guards đều derive từ file này.
 */
import { PERMISSIONS } from "../auth/permissions.js";
import { ROLES, normalizeRole, rolesEqual } from "../auth/roles.js";
import { isAiEngineEnabled } from "../features/ai-assistant/constants/aiConfig.js";
import { isPickVnRatingV5Enabled } from "../features/pick-vn-rating-v5/config/flags.js";
import { V5_MENU_GROUPS } from "./v5Menu/index.js";
import { SYSTEM_TECHNICIAN_MENU_ROOT } from "./v5Menu/systemTechnicianMenu.js";
import { TEAM_CAPTAIN_MENU_ROOT } from "./v5Menu/teamCaptainMenu.js";

/** V5 role aliases → canonical ROLES (identity/constants/roles.js). */
export const NAV_ROLE_ALIASES = Object.freeze({
  SUPER_ADMIN: ROLES.PLATFORM_ADMIN,
  COURT_OWNER: ROLES.TENANT_OWNER,
  COURT_MANAGER: ROLES.VENUE_MANAGER,
  CLUB_OWNER: ROLES.CLUB_MANAGER,
  VENUE_OWNER: ROLES.TENANT_OWNER,
});

/** Nhóm nghiệp vụ — id dùng trong ROLE_MENU_MAP. */
export const MENU_GROUP_IDS = Object.freeze({
  DASHBOARD: "dashboard",
  VENUE_OPS: "venue-ops",
  CUSTOMERS: "customers",
  CLUB: "club",
  TOURNAMENT: "tournament",
  FINANCE: "finance",
  TENANT: "tenant",
  REPORTS: "reports",
  CRM: "crm",
  AI: "ai",
  ADMIN: "admin",
  PROFILE: "profile",
  SUPPORT: "support",
  SYSTEM_TECH_ZONE: "system-tech-zone",
  TEAM_CAPTAIN_ZONE: "team-captain-zone",
  PLAYER_ZONE: "player-zone",
  REFEREE_ZONE: "referee-zone",
});

/**
 * Role → nhóm menu được phép thấy.
 * '*' = tất cả nhóm (SUPER_ADMIN / PLATFORM_ADMIN).
 */
export const ROLE_MENU_MAP = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: "*",
  PLATFORM_ADMIN: "*",
  SUPER_ADMIN: "*",
  [ROLES.SYSTEM_TECHNICIAN]: [
    MENU_GROUP_IDS.SYSTEM_TECH_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  SYSTEM_TECHNICIAN: [
    MENU_GROUP_IDS.SYSTEM_TECH_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.TENANT_OWNER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.TENANT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.ADMIN,
    MENU_GROUP_IDS.SUPPORT,
  ],
  TENANT_OWNER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.TENANT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.ADMIN,
    MENU_GROUP_IDS.SUPPORT,
  ],
  COURT_OWNER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.TENANT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.ADMIN,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.VENUE_MANAGER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.SUPPORT,
  ],
  VENUE_MANAGER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.SUPPORT,
  ],
  COURT_MANAGER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.CRM,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.TOURNAMENT_MANAGER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  TOURNAMENT_MANAGER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.TEAM_CAPTAIN]: [
    MENU_GROUP_IDS.TEAM_CAPTAIN_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  TEAM_CAPTAIN: [
    MENU_GROUP_IDS.TEAM_CAPTAIN_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.CASHIER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.ACCOUNTANT]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  ACCOUNTANT: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.CLUB_MANAGER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.SUPPORT,
  ],
  CLUB_MANAGER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.SUPPORT,
  ],
  CLUB_OWNER: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.COACH]: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.SUPPORT,
  ],
  COACH: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.STAFF]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  STAFF: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.REFEREE]: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.REFEREE_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  REFEREE: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.REFEREE_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.PLAYER]: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.PLAYER_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  PLAYER: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.PLAYER_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.CUSTOMER]: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.SUPPORT,
    MENU_GROUP_IDS.PLAYER_ZONE,
  ],
  CUSTOMER: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.SUPPORT,
    MENU_GROUP_IDS.PLAYER_ZONE,
  ],
  [ROLES.SUPPORT]: [
    MENU_GROUP_IDS.SYSTEM_TECH_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  SUPPORT: [
    MENU_GROUP_IDS.SYSTEM_TECH_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
});

/** Route prefix VĐV không được truy cập (menu + guard). */
export const PLAYER_RESTRICTED_ROUTE_PREFIXES = Object.freeze([
  "/daily-play",
  "/tournament/types",
  "/tournament/operations",
  "/tournament/config",
]);

export function isRouteRestrictedForUser(user, pathname) {
  if (!user?.role || !pathname) {
    return false;
  }

  if (!rolesEqual(user.role, ROLES.PLAYER)) {
    return false;
  }

  const path = String(pathname).split("?")[0];
  return PLAYER_RESTRICTED_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * Mapping route cũ ↔ nhãn menu V5 (tham chiếu, không đổi route).
 */
export const NAV_ROUTE_ALIASES = Object.freeze({
  "/court-management": { label: "Trạng thái sân", group: MENU_GROUP_IDS.VENUE_OPS },
  "/court-engine": { label: "Điều phối sân", group: MENU_GROUP_IDS.VENUE_OPS },
  "/select-players": { label: "Danh sách chờ / Ghép cặp", group: MENU_GROUP_IDS.VENUE_OPS },
  "/players": { label: "Danh sách VĐV", group: MENU_GROUP_IDS.CUSTOMERS },
  "/club": { label: "Lịch sinh hoạt / Mùa giải", group: MENU_GROUP_IDS.CLUB },
  "/my-club": { label: "CLB của tôi", group: MENU_GROUP_IDS.CLUB },
  "/discover-clubs": { label: "Khám phá CLB", group: MENU_GROUP_IDS.CLUB },
  "/daily-play": { label: "Vui chơi mỗi ngày", group: MENU_GROUP_IDS.CLUB },
  "/statistics": { label: "Kết quả & Xếp hạng", group: MENU_GROUP_IDS.TOURNAMENT },
  "/admin/ai-pairing/private-rules": {
    label: "Quy tắc ghép cặp riêng",
    group: MENU_GROUP_IDS.ADMIN,
  },
});

/** `future` = ẩn hoàn toàn; `coming-soon` = hiện menu + badge, route placeholder. */
export const NAV_ITEM_STATUS = Object.freeze({
  ACTIVE: "active",
  FUTURE: "future",
  COMING_SOON: "coming-soon",
});

/** Path placeholder cho module chưa có route riêng. */
export function buildComingSoonPath(moduleKey) {
  const key = String(moduleKey || "module").trim() || "module";
  return `/coming-soon/${encodeURIComponent(key)}`;
}

/** Metadata hiển thị trên ComingSoonPage. */
export const COMING_SOON_MODULES = Object.freeze({
  "customer-groups": {
    title: "Nhóm khách hàng",
    description: "Quản lý nhóm khách hàng theo hạng, gói hoặc chiến dịch.",
  },
  debt: {
    title: "Công nợ",
    description: "Theo dõi công nợ khách hàng và nhắc thanh toán.",
  },
  "report-peak": {
    title: "Giờ cao điểm",
    description: "Báo cáo khung giờ cao điểm theo sân và doanh thu.",
  },
  "ai-validation": {
    title: "Cảnh báo bất hợp lý",
    description: "AI phát hiện lịch thi đấu hoặc ghép cặp bất thường.",
  },
});

/** Icon key — map sang MUI icon trong Sidebar / MobileDrawer. */
export const NAV_ICON_KEYS = Object.freeze({
  dashboard: "dashboard",
  "venue-calendar": "calendar",
  "venue-bookings": "bookings",
  "venue-checkin": "checkin",
  "venue-waiting": "waiting",
  "venue-director": "director",
  "venue-status": "status",
  customers: "customers",
  players: "players",
  skill: "skill",
  history: "history",
  groups: "groups",
  "club-list": "club-list",
  "club-members": "club-members",
  "club-schedule": "club-schedule",
  "club-internal": "club-internal",
  "tournament-list": "tournament-list",
  "tournament-create": "tournament-create",
  "tournament-register": "tournament-register",
  "tournament-pairing": "tournament-pairing",
  "tournament-draw": "tournament-draw",
  "tournament-schedule": "tournament-schedule",
  bracket: "bracket",
  referee: "referee",
  statistics: "statistics",
  orders: "orders",
  payments: "payments",
  debt: "debt",
  subscription: "subscription",
  transactions: "transactions",
  "report-overview": "report-overview",
  "report-revenue": "report-revenue",
  "report-performance": "report-performance",
  "report-customers": "report-customers",
  "report-tournament": "report-tournament",
  "report-peak": "report-peak",
  "ai-group": "ai-group",
  "ai-pairing": "ai-pairing",
  "ai-scheduling": "ai-scheduling",
  "ai-time": "ai-time",
  "ai-validation": "ai-validation",
  users: "users",
  roles: "roles",
  tenants: "tenants",
  courts: "courts",
  settings: "settings",
  audit: "audit",
  integrations: "integrations",
  support: "support",
  profile: "profile",
  notifications: "notifications",
  coaches: "coaches",
  messages: "messages",
  marketplace: "marketplace",
  billing: "billing",
  "player-profile": "player-profile",
  "player-skill": "skill",
  "player-skill-assessment": "skill",
  "player-skill-assessment-v5": "skill",
  "my-club": "my-club",
  "referee-hub": "referee-hub",
  "referee-tournaments": "referee-tournaments",
  "mobile-player": "mobile-player",
});

/**
 * Cấu trúc menu desktop + mobile drawer.
 * @property {string} id — nhóm nghiệp vụ (ROLE_MENU_MAP)
 * @property {string} label — tiếng Việt
 * @property {object[]} items
 */
export const MENU_GROUPS = [
  ...V5_MENU_GROUPS,
  {
    id: MENU_GROUP_IDS.SYSTEM_TECH_ZONE,
    label: "Admin",
    roles: [ROLES.SYSTEM_TECHNICIAN, ROLES.SUPPORT],
    items: [SYSTEM_TECHNICIAN_MENU_ROOT],
  },
  {
    id: MENU_GROUP_IDS.TEAM_CAPTAIN_ZONE,
    label: "Đội trưởng",
    roles: [ROLES.TEAM_CAPTAIN],
    items: [TEAM_CAPTAIN_MENU_ROOT],
  },
    {
    id: MENU_GROUP_IDS.PLAYER_ZONE,
    label: "VĐV",
    roles: [ROLES.PLAYER],
    items: [
      {
        key: "player-profile",
        icon: NAV_ICON_KEYS["player-profile"],
        text: "Hồ sơ cá nhân",
        path: "/player/profile",
        roles: [ROLES.PLAYER],
      },
      {
        key: "player-skill",
        icon: NAV_ICON_KEYS["player-skill"],
        text: "Điểm trình độ",
        path: "/player/skill",
        match: "player-skill",
        roles: [ROLES.PLAYER],
      },
      {
        key: "player-skill-assessment",
        icon: NAV_ICON_KEYS["player-skill-assessment"],
        text: "Đánh giá trình độ lần đầu",
        path: "/player/skill-assessment",
        match: "player-skill-assessment",
        roles: [ROLES.PLAYER],
      },
      {
        key: "player-skill-assessment-v5",
        icon: NAV_ICON_KEYS["player-skill-assessment"],
        text: "Đánh giá V5 (shadow)",
        path: "/player/skill-assessment-v5",
        match: "player-skill-assessment-v5",
        roles: [ROLES.PLAYER],
        requiresFeature: "pickVnRatingV5",
      },
      {
        key: "player-home",
        icon: NAV_ICON_KEYS["mobile-player"],
        text: "Trang của tôi",
        path: "/mobile/player",
        roles: [ROLES.PLAYER],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.REFEREE_ZONE,
    label: "Trọng tài",
    roles: [ROLES.REFEREE],
    items: [
      {
        key: "referee-hub",
        icon: NAV_ICON_KEYS["referee-hub"],
        text: "Chấm trận",
        path: "/referee",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
        roles: [ROLES.REFEREE],
      },
      {
        key: "referee-qr",
        icon: NAV_ICON_KEYS["venue-checkin"],
        text: "Quét QR",
        path: "/mobile/qr-scan",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
        roles: [ROLES.REFEREE],
      },
      {
        key: "referee-results",
        icon: NAV_ICON_KEYS.statistics,
        text: "Kết quả & Xếp hạng",
        path: "/statistics",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TEAM_STANDINGS_VIEW],
        roles: [ROLES.REFEREE],
      },
    ],
  },
];

/** Route → permissions tối thiểu (OR). Re-export cho menuAccess. */
export const ROUTE_PERMISSIONS = Object.freeze({
  "/dashboard": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BOOKING_VIEW],
  "/dashboard/rankings": [PERMISSIONS.RANKING_VIEW, PERMISSIONS.RANKING_MANAGE],
  "/players": [PERMISSIONS.PLAYER_VIEW],
  "/players/skill": [PERMISSIONS.PLAYER_VIEW],
  "/court-management": [PERMISSIONS.COURT_VIEW],
  "/court-management/calendar": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/bookings": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/revenue": [PERMISSIONS.FINANCE_VIEW],
  "/court-management/customers": [PERMISSIONS.CUSTOMER_VIEW],
  "/court-management/courts": [PERMISSIONS.COURT_VIEW],
  "/select-players": [PERMISSIONS.SCHEDULING_VIEW],
  "/daily-play": [PERMISSIONS.TOURNAMENT_VIEW],
  "/club": [PERMISSIONS.CLUB_VIEW],
  "/manage/clubs": [PERMISSIONS.CLUB_VIEW],
  "/platform/clubs": [PERMISSIONS.CLUB_VIEW],
  "/tournament": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/list": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/create": [PERMISSIONS.TOURNAMENT_CREATE],
  "/tournament/register": [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/:tournamentId/register": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/my": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/my/:tournamentId": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/:tournamentId/public": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/teams": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/schedule": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.DIRECTOR_USE],
  "/tournament/match-reports": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/config/format": [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/config/settings": [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/bracket": [PERMISSIONS.TOURNAMENT_VIEW],
  "/court-engine": [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
  "/statistics": [PERMISSIONS.STATISTICS_VIEW],
  "/court-management/future": [
    PERMISSIONS.COURT_UPDATE,
    PERMISSIONS.VENUE_UPDATE,
    PERMISSIONS.COURT_VIEW,
  ],
  "/settings": [PERMISSIONS.SETTINGS_VIEW],
  "/my-club": [],
  "/discover-clubs": [],
  "/clubs/discover": [],
  "/club/activity": [],
  "/coaching/coach-list": [],
  "/coaching/register": [],
  "/player/profile": [],
  "/player/skill": [],
  "/player/skill-assessment": [],
  "/player/skill-assessment-v5": [],
  "/settings/integrations": [PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW],
  "/settings/integrations/payments": [PERMISSIONS.INTEGRATION_MANAGE],
  "/settings/integrations/zalo-oa": [PERMISSIONS.INTEGRATION_MANAGE],
  "/billing": [PERMISSIONS.BILLING_VIEW],
  "/billing/current-plan": [PERMISSIONS.BILLING_VIEW],
  "/billing/usage": [PERMISSIONS.BILLING_VIEW],
  "/billing/invoices": [PERMISSIONS.BILLING_INVOICE_VIEW],
  "/billing/payment": [PERMISSIONS.BILLING_PAYMENT_VIEW],
  "/billing/upgrade": [PERMISSIONS.BILLING_SUBSCRIPTION_VIEW],
  "/billing/support": [PERMISSIONS.BILLING_VIEW],
  "/finance/debt": [PERMISSIONS.FINANCE_VIEW],
  "/finance/receipts": [PERMISSIONS.FINANCE_VIEW],
  "/finance/refunds": [PERMISSIONS.FINANCE_VIEW],
  "/crm/messages": [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW],
  "/crm/templates": [PERMISSIONS.CUSTOMER_VIEW],
  "/crm/campaigns": [PERMISSIONS.CUSTOMER_VIEW],
  "/crm/history": [PERMISSIONS.CUSTOMER_VIEW],
  "/crm/reminders/booking": [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW],
  "/reports": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.FINANCE_VIEW],
  "/admin/billing": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/tenants": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/plans": [PERMISSIONS.BILLING_PLAN_VIEW],
  "/admin/billing/invoices": [PERMISSIONS.BILLING_INVOICE_VIEW],
  "/admin/billing/payments": [PERMISSIONS.BILLING_PAYMENT_VIEW],
  "/admin/billing/audit": [PERMISSIONS.BILLING_AUDIT_VIEW],
  "/users": [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_VIEW],
  "/admin/roles": [
    PERMISSIONS.ROLE_MANAGE,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.PERMISSION_VIEW,
    PERMISSIONS.TENANT_ROLE_CUSTOMIZE,
  ],
  "/admin/tournament-certifications": [PERMISSIONS.TOURNAMENT_CERTIFY, PERMISSIONS.RANKING_MANAGE],
  "/audit": [PERMISSIONS.USER_MANAGE, PERMISSIONS.ACTIVITY_LOG_VIEW, PERMISSIONS.ROLE_VIEW],
  "/profile": [],
  "/notifications": [],
  "/referee": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
  "/403": [],
  "/admin/tenants": [PERMISSIONS.TENANT_VIEW, PERMISSIONS.ROLE_MANAGE],
  "/admin/court-clusters": [PERMISSIONS.CLUSTER_MANAGE],
  "/admin/ai-pairing/private-rules": [PERMISSIONS.PAIRING_PRIVATE_RULES_VIEW],
  "/support": [PERMISSIONS.SUPPORT_TICKET_MANAGE, PERMISSIONS.BILLING_VIEW],
  "/marketplace": [PERMISSIONS.MARKETPLACE_VIEW],
  "/marketplace/orders": [PERMISSIONS.MARKETPLACE_VIEW],
  "/mobile/check-in": [PERMISSIONS.TOURNAMENT_VIEW],
  "/mobile/qr-scan": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.MATCH_UPDATE],
  "/mobile/qr-generate": [PERMISSIONS.TOURNAMENT_UPDATE],
  "/mobile/notifications": [],
  "/mobile/player": [],
  "/mobile/operations": [
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.COURT_VIEW,
    PERMISSIONS.FINANCE_VIEW,
  ],
  "/coming-soon": [],
  "/team-portal": [PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MEMBER_VIEW],
});

export function resolveComingSoonModule(moduleKey) {
  const key = decodeURIComponent(String(moduleKey || "").trim());
  return COMING_SOON_MODULES[key] || {
    title: key || "Tính năng mới",
    description: "Tính năng đang được phát triển cho phiên bản V5.1.",
  };
}

/**
 * Mobile bottom-nav theo persona V5.
 * @property {string} profile — manager | referee | player
 */
export const MOBILE_BOTTOM_NAV_PROFILES = Object.freeze({
  manager: [
    {
      key: "dashboard",
      label: "Tổng quan",
      path: "/dashboard",
      iconKey: "dashboard",
      match: "exact",
      permissions: [
        PERMISSIONS.STATISTICS_VIEW,
        PERMISSIONS.TOURNAMENT_VIEW,
        PERMISSIONS.FINANCE_VIEW,
        PERMISSIONS.BOOKING_VIEW,
      ],
      excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
    },
    {
      key: "venue-calendar",
      label: "Lịch sân",
      path: "/court-management/calendar",
      iconKey: "calendar",
      permissions: [PERMISSIONS.BOOKING_VIEW],
      excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
    },
    {
      key: "venue-checkin",
      label: "Check-in",
      path: "/mobile/check-in",
      iconKey: "checkin",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      excludeRoles: [ROLES.PLAYER],
    },
    {
      key: "tournament",
      label: "Giải đấu",
      path: "/tournament",
      iconKey: "tournament-list",
      match: "tournament-home",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "more",
      label: "Thêm",
      action: "open-drawer",
      iconKey: "more",
      excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
    },
  ],
  referee: [
    {
      key: "referee-matches",
      label: "Trận đấu",
      path: "/referee",
      iconKey: "referee-hub",
      permissions: [PERMISSIONS.MATCH_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "referee-score",
      label: "Nhập điểm",
      path: "/referee",
      iconKey: "referee-hub",
      match: "referee-hub",
      permissions: [PERMISSIONS.MATCH_UPDATE],
    },
    {
      key: "referee-results",
      label: "Kết quả",
      path: "/statistics",
      iconKey: "statistics",
      permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "player-home",
      label: "Hồ sơ",
      path: "/mobile/player",
      iconKey: "mobile-player",
      roles: [ROLES.REFEREE],
    },
  ],
  player: [
    {
      key: "player-home-main",
      label: "Trang của tôi",
      path: "/mobile/player",
      iconKey: "mobile-player",
      roles: [ROLES.PLAYER],
    },
    {
      key: "player-schedule",
      label: "Lịch chơi",
      path: "/tournament",
      iconKey: "tournament-schedule",
      match: "tournament-home",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "player-tournament",
      label: "Giải đấu",
      path: "/tournament",
      iconKey: "tournament-list",
      match: "tournament-home",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "player-qr",
      label: "QR",
      path: "/mobile/player?tab=qr",
      iconKey: "checkin",
      roles: [ROLES.PLAYER],
    },
    {
      key: "player-skill",
      label: "Điểm trình độ",
      path: "/player/skill",
      iconKey: "skill",
      roles: [ROLES.PLAYER],
    },
    {
      key: "player-skill-assessment-v5",
      label: "Đánh giá V5 (shadow)",
      path: "/player/skill-assessment-v5",
      iconKey: "skill",
      roles: [ROLES.PLAYER],
      requiresFeature: "pickVnRatingV5",
    },
    {
      key: "player-profile",
      label: "Hồ sơ",
      path: "/player/profile",
      iconKey: "player-profile",
      roles: [ROLES.PLAYER],
    },
  ],
});

/** Drawer quick links — mobile. */
export const MOBILE_QUICK_LINKS = [
  {
    key: "my-profile",
    label: "Hồ sơ của tôi",
    path: "/profile",
    iconKey: "profile",
  },
  {
    key: "operations",
    label: "Dashboard vận hành",
    path: "/mobile/operations",
    iconKey: "dashboard",
    permissions: [
      PERMISSIONS.BOOKING_VIEW,
      PERMISSIONS.COURT_VIEW,
      PERMISSIONS.FINANCE_VIEW,
    ],
    excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
  },
  {
    key: "qr-scan",
    label: "Quét QR Check-in",
    path: "/mobile/qr-scan",
    iconKey: "checkin",
    permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE],
    excludeRoles: [ROLES.PLAYER],
  },
  {
    key: "notifications",
    label: "Thông báo",
    path: "/mobile/notifications",
    iconKey: "notifications",
  },
  {
    key: "settings",
    label: "Cài đặt",
    path: "/settings",
    iconKey: "settings",
    permissions: [PERMISSIONS.SETTINGS_VIEW],
    excludeRoles: [ROLES.REFEREE],
  },
];

export const MOBILE_DRAWER_WIDTH = 280;
export const MOBILE_BREAKPOINT = "md";

/** Flat list cho Global Search. */
export function collectMenuItemLabels(groups) {
  const labels = [];

  function walkItems(items) {
    for (const item of items || []) {
      if (item.text) {
        labels.push(item.text);
      }
      if (item.children?.length) {
        walkItems(item.children);
      }
    }
  }

  for (const group of groups || []) {
    walkItems(group.items);
  }

  return labels;
}

export function buildSearchableNavItems(groups = MENU_GROUPS) {
  const items = [];

  function walk(group, groupItems) {
    for (const item of groupItems || []) {
      if (item.path || item.resolvePath) {
        items.push({
          key: item.key,
          label: item.text,
          path: item.path,
          group: group.label,
          permissions: item.permissions,
          roles: item.roles,
          excludeRoles: item.excludeRoles,
          requiresFeature: item.requiresFeature,
        });
      }
      if (item.children?.length) {
        walk(group, item.children);
      }
    }
  }

  for (const group of groups) {
    walk(group, group.items);
  }

  return items;
}

export function resolveNavRole(role) {
  const value = String(role || "").trim();
  if (!value) return "";
  if (NAV_ROLE_ALIASES[value]) {
    return NAV_ROLE_ALIASES[value];
  }
  return normalizeRole(value) || value;
}

export function resolveRoleMenuAccess(role) {
  const raw = String(role || "").trim();
  if (!raw) return [];

  const normalized = resolveNavRole(raw);
  const upper = raw.toUpperCase();

  const direct =
    ROLE_MENU_MAP[raw] ??
    ROLE_MENU_MAP[normalized] ??
    ROLE_MENU_MAP[upper] ??
    ROLE_MENU_MAP[normalizeRole(raw)];
  if (direct) return direct;
  return [];
}

export function resolveMobileNavProfile(role) {
  const normalized = resolveNavRole(role);
  if (normalized === ROLES.REFEREE) return "referee";
  if (normalized === ROLES.PLAYER || normalized === ROLES.CUSTOMER) return "player";
  if (normalized === ROLES.CLUB_MANAGER) return "player";
  if (normalized === ROLES.TEAM_CAPTAIN) return "player";
  if (normalized === ROLES.SYSTEM_TECHNICIAN) return "manager";
  return "manager";
}

export function isNavFeatureEnabled(featureKey) {
  if (featureKey === "ai") return isAiEngineEnabled();
  if (featureKey === "pickVnRatingV5") return isPickVnRatingV5Enabled();
  return true;
}

/** Danh sách mục V5.1/future — chỉ khai báo tại navigationConfig (ẩn hoàn toàn). */
export function listFutureNavItems(groups = MENU_GROUPS) {
  const items = [];
  for (const group of groups) {
    for (const item of group.items || []) {
      if (item.navStatus === NAV_ITEM_STATUS.FUTURE) {
        items.push({
          key: item.key,
          label: item.text,
          group: group.label,
          note: item.futureNote || "",
        });
      }
    }
  }
  return items;
}

/** Mục coming-soon — hiển thị menu + badge, route placeholder. */
export function listComingSoonNavItems(groups = MENU_GROUPS) {
  const items = [];

  function walk(group, groupItems) {
    for (const item of groupItems || []) {
      if (item.navStatus === NAV_ITEM_STATUS.COMING_SOON) {
        items.push({
          key: item.key,
          label: item.text,
          path: item.path,
          group: group.label,
          badge: item.badge || "Sắp ra mắt",
        });
      }
      if (item.children?.length) {
        walk(group, item.children);
      }
    }
  }

  for (const group of groups) {
    walk(group, group.items);
  }

  return items;
}

/** Sidebar phẳng — thứ tự menu theo mockup Slate Enterprise (Direction C). */
export const SHELL_FLAT_MENU_KEYS = Object.freeze([
  "dashboard",
  "venue-calendar",
  "venue-bookings",
  "tournament-root",
  "customers",
  "coaches",
  "report-revenue",
  "report-overview",
  "messages",
  "mobile-notifications",
  "support-settings",
]);

export const SHELL_FLAT_MENU_LABELS = Object.freeze({
  customers: "Hội viên",
  "report-revenue": "Doanh thu",
  "report-overview": "Báo cáo",
  "mobile-notifications": "Thông báo",
  "support-settings": "Cài đặt",
});

const SHELL_FLAT_MENU_KEYS_BY_ROLE = Object.freeze({
  [ROLES.PLAYER]: [
    "my-club",
    "tournament-root",
    "player-profile",
    "mobile-notifications",
  ],
  [ROLES.TEAM_CAPTAIN]: ["captain-home", "captain-schedule", "captain-lineup", "captain-results", "captain-support"],
  [ROLES.REFEREE]: ["referee-hub", "profile", "mobile-notifications"],
  [ROLES.SYSTEM_TECHNICIAN]: ["tech-overview", "tech-tenants", "tech-users", "tech-integrations", "tech-support-tickets"],
});

export function resolveShellFlatMenuKeys(user) {
  const role = normalizeRole(user?.role);
  if (SHELL_FLAT_MENU_KEYS_BY_ROLE[role]) {
    return SHELL_FLAT_MENU_KEYS_BY_ROLE[role];
  }
  if (role === ROLES.PLATFORM_ADMIN || role === ROLES.SUPER_ADMIN) {
    return [...SHELL_FLAT_MENU_KEYS, "admin-tenants", "users"];
  }
  return SHELL_FLAT_MENU_KEYS;
}

export function flattenMenuGroupsForShell(groups, user) {
  const itemMap = new Map();

  function indexItems(items) {
    for (const item of items || []) {
      if (item.key && !itemMap.has(item.key)) {
        itemMap.set(item.key, item);
      }
      if (item.children?.length) {
        indexItems(item.children);
      }
    }
  }

  for (const group of groups || []) {
    indexItems(group.items);
  }

  const keys = resolveShellFlatMenuKeys(user);
  const items = [];

  for (const key of keys) {
    if (key === "tournament-root") {
      items.push({ key: "tournament-root", type: "tournament-tree" });
      continue;
    }

    const item = itemMap.get(key);
    if (!item) continue;
    const label = SHELL_FLAT_MENU_LABELS[key];
    items.push(label ? { ...item, text: label } : item);
  }

  if (items.length) {
    return items;
  }

  for (const group of groups || []) {
    for (const item of group.items || []) {
      const mapKey = item.key || item.path;
      if (!mapKey || items.some((row) => (row.key || row.path) === mapKey)) continue;
      items.push(item);
    }
  }

  return items;
}

export function resolveTournamentMenuRoot(groups) {
  const tournamentGroup = (groups || []).find((group) => group.id === MENU_GROUP_IDS.TOURNAMENT);
  const root = tournamentGroup?.items?.[0];
  if (!root?.children?.length) {
    return null;
  }
  return root;
}
