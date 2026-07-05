/**
 * V5.0 — Navigation config tập trung (SaaS multi-tenant / multi-venue).
 * Sidebar, mobile drawer, bottom nav và route guards đều derive từ file này.
 */
import { PERMISSIONS } from "../auth/permissions.js";
import { ROLES, normalizeRole } from "../auth/roles.js";
import { isAiEngineEnabled } from "../features/ai-assistant/constants/aiConfig.js";

/** V5 role aliases → canonical ROLES (identity/constants/roles.js). */
export const NAV_ROLE_ALIASES = Object.freeze({
  PLATFORM_ADMIN: ROLES.SUPER_ADMIN,
  TENANT_OWNER: ROLES.COURT_OWNER,
  VENUE_MANAGER: ROLES.COURT_MANAGER,
});

/** Nhóm nghiệp vụ — id dùng trong ROLE_MENU_MAP. */
export const MENU_GROUP_IDS = Object.freeze({
  DASHBOARD: "dashboard",
  VENUE_OPS: "venue-ops",
  CUSTOMERS: "customers",
  CLUB: "club",
  TOURNAMENT: "tournament",
  FINANCE: "finance",
  REPORTS: "reports",
  AI: "ai",
  ADMIN: "admin",
  SUPPORT: "support",
  PLAYER_ZONE: "player-zone",
  REFEREE_ZONE: "referee-zone",
});

/**
 * Role → nhóm menu được phép thấy.
 * '*' = tất cả nhóm (SUPER_ADMIN / PLATFORM_ADMIN).
 */
export const ROLE_MENU_MAP = Object.freeze({
  [ROLES.SUPER_ADMIN]: "*",
  PLATFORM_ADMIN: "*",
  [ROLES.COURT_OWNER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.FINANCE,
    MENU_GROUP_IDS.REPORTS,
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
    MENU_GROUP_IDS.REPORTS,
    MENU_GROUP_IDS.AI,
    MENU_GROUP_IDS.ADMIN,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.COURT_MANAGER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.VENUE_OPS,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.REPORTS,
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
    MENU_GROUP_IDS.AI,
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
  [ROLES.CLUB_OWNER]: [
    MENU_GROUP_IDS.DASHBOARD,
    MENU_GROUP_IDS.CUSTOMERS,
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.SUPPORT,
    MENU_GROUP_IDS.PLAYER_ZONE,
  ],
  [ROLES.REFEREE]: [
    MENU_GROUP_IDS.REFEREE_ZONE,
    MENU_GROUP_IDS.SUPPORT,
  ],
  [ROLES.PLAYER]: [
    MENU_GROUP_IDS.CLUB,
    MENU_GROUP_IDS.TOURNAMENT,
    MENU_GROUP_IDS.SUPPORT,
    MENU_GROUP_IDS.PLAYER_ZONE,
  ],
});

/**
 * Mapping route cũ ↔ nhãn menu V5 (tham chiếu, không đổi route).
 */
export const NAV_ROUTE_ALIASES = Object.freeze({
  "/court-management": { label: "Trạng thái sân", group: MENU_GROUP_IDS.VENUE_OPS },
  "/court-engine": { label: "Điều phối sân", group: MENU_GROUP_IDS.VENUE_OPS },
  "/select-players": { label: "Danh sách chờ / Ghép cặp", group: MENU_GROUP_IDS.VENUE_OPS },
  "/players": { label: "Danh sách VĐV", group: MENU_GROUP_IDS.CUSTOMERS },
  "/club": { label: "Lịch sinh hoạt / Mùa giải", group: MENU_GROUP_IDS.CLUB },
  "/daily-play": { label: "Giải nội bộ CLB", group: MENU_GROUP_IDS.CLUB },
  "/statistics": { label: "Kết quả & Xếp hạng", group: MENU_GROUP_IDS.TOURNAMENT },
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
  marketplace: "marketplace",
  billing: "billing",
  "player-profile": "player-profile",
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
  {
    id: MENU_GROUP_IDS.DASHBOARD,
    label: "Tổng quan",
    items: [
      {
        key: "dashboard",
        icon: NAV_ICON_KEYS.dashboard,
        text: "Tổng quan",
        path: "/",
        match: "exact",
        permissions: [
          PERMISSIONS.STATISTICS_VIEW,
          PERMISSIONS.TOURNAMENT_VIEW,
          PERMISSIONS.FINANCE_VIEW,
          PERMISSIONS.BOOKING_VIEW,
        ],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.VENUE_OPS,
    label: "Vận hành cụm sân",
    items: [
      {
        key: "venue-calendar",
        icon: NAV_ICON_KEYS["venue-calendar"],
        text: "Lịch sân",
        path: "/court-management/calendar",
        match: "court-calendar",
        permissions: [PERMISSIONS.BOOKING_VIEW],
      },
      {
        key: "venue-bookings",
        icon: NAV_ICON_KEYS["venue-bookings"],
        text: "Đặt sân",
        path: "/court-management/bookings",
        match: "court-bookings",
        permissions: [PERMISSIONS.BOOKING_VIEW],
      },
      {
        key: "venue-checkin",
        icon: NAV_ICON_KEYS["venue-checkin"],
        text: "Check-in",
        path: "/mobile/check-in",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
        excludeRoles: [ROLES.PLAYER],
      },
      {
        key: "venue-waiting",
        icon: NAV_ICON_KEYS["venue-waiting"],
        text: "Danh sách chờ",
        path: "/select-players",
        permissions: [PERMISSIONS.SCHEDULING_VIEW, PERMISSIONS.SCHEDULING_RUN],
      },
      {
        key: "venue-director",
        icon: NAV_ICON_KEYS["venue-director"],
        text: "Điều phối sân",
        path: "/court-engine",
        match: "court-engine",
        permissions: [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
      },
      {
        key: "venue-status",
        icon: NAV_ICON_KEYS["venue-status"],
        text: "Trạng thái sân",
        path: "/court-management",
        match: "live-courts",
        permissions: [PERMISSIONS.COURT_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.CUSTOMERS,
    label: "Khách hàng & VĐV",
    items: [
      {
        key: "customers",
        icon: NAV_ICON_KEYS.customers,
        text: "Khách hàng",
        path: "/court-management/customers",
        match: "court-customers",
        permissions: [PERMISSIONS.CUSTOMER_VIEW],
      },
      {
        key: "players",
        icon: NAV_ICON_KEYS.players,
        text: "Vận động viên",
        path: "/players",
        permissions: [PERMISSIONS.PLAYER_VIEW],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
      },
      {
        key: "skill",
        icon: NAV_ICON_KEYS.skill,
        text: "Điểm trình độ",
        path: "/statistics",
        match: "statistics-skill",
        permissions: [PERMISSIONS.STATISTICS_VIEW],
      },
      {
        key: "history",
        icon: NAV_ICON_KEYS.history,
        text: "Lịch sử thi đấu",
        path: "/statistics",
        match: "statistics-history",
        permissions: [PERMISSIONS.STATISTICS_VIEW],
      },
      {
        key: "customer-groups",
        icon: NAV_ICON_KEYS.groups,
        text: "Nhóm khách hàng",
        path: buildComingSoonPath("customer-groups"),
        navStatus: NAV_ITEM_STATUS.COMING_SOON,
        badge: "Sắp ra mắt",
        futureNote: "V5.1 — chưa có route /court-management/customer-groups",
        permissions: [PERMISSIONS.CUSTOMER_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.CLUB,
    label: "CLB",
    items: [
      {
        key: "club-list",
        icon: NAV_ICON_KEYS["club-list"],
        text: "Danh sách CLB",
        path: "/clubs",
        match: "clubs",
        permissions: [PERMISSIONS.CLUB_VIEW],
      },
      {
        key: "club-members",
        icon: NAV_ICON_KEYS["club-members"],
        text: "Thành viên CLB",
        path: "/players",
        match: "club-members",
        permissions: [PERMISSIONS.PLAYER_VIEW, PERMISSIONS.CLUB_VIEW],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE, ROLES.CASHIER],
      },
      {
        key: "club-schedule",
        icon: NAV_ICON_KEYS["club-schedule"],
        text: "Lịch sinh hoạt",
        path: "/club",
        match: "seasons-only",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.SEASON_UPDATE],
      },
      {
        key: "club-internal",
        icon: NAV_ICON_KEYS["club-internal"],
        text: "Giải nội bộ CLB",
        path: "/daily-play",
        match: "daily-play",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.TOURNAMENT,
    label: "Giải đấu",
    items: [
      {
        key: "tournament-list",
        icon: NAV_ICON_KEYS["tournament-list"],
        text: "Danh sách giải",
        path: "/tournament",
        match: "tournament-home",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "tournament-create",
        icon: NAV_ICON_KEYS["tournament-create"],
        text: "Tạo giải",
        path: "/tournament",
        match: "tournament-create",
        permissions: [PERMISSIONS.TOURNAMENT_CREATE, PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "tournament-register",
        icon: NAV_ICON_KEYS["tournament-register"],
        text: "Đăng ký VĐV",
        path: "/tournament",
        match: "tournament-register",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
      },
      {
        key: "tournament-pairing",
        icon: NAV_ICON_KEYS["tournament-pairing"],
        text: "Ghép cặp",
        path: "/select-players",
        permissions: [PERMISSIONS.SCHEDULING_RUN, PERMISSIONS.TOURNAMENT_UPDATE],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE, ROLES.CASHIER],
      },
      {
        key: "tournament-draw",
        icon: NAV_ICON_KEYS["tournament-draw"],
        text: "Chia bảng",
        path: "/tournament/bracket",
        match: "bracket",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.TOURNAMENT_UPDATE],
      },
      {
        key: "tournament-schedule",
        icon: NAV_ICON_KEYS["tournament-schedule"],
        text: "Lịch thi đấu",
        path: "/court-engine",
        match: "tournament-schedule",
        permissions: [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "bracket",
        icon: NAV_ICON_KEYS.bracket,
        text: "Sơ đồ thi đấu",
        path: "/tournament/bracket",
        match: "bracket",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "referee",
        icon: NAV_ICON_KEYS.referee,
        text: "Trọng tài",
        path: "/referee",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
        roles: [ROLES.REFEREE, ROLES.COURT_OWNER, ROLES.COURT_MANAGER, ROLES.SUPER_ADMIN],
      },
      {
        key: "statistics",
        icon: NAV_ICON_KEYS.statistics,
        text: "Kết quả & Xếp hạng",
        path: "/statistics",
        permissions: [PERMISSIONS.STATISTICS_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.FINANCE,
    label: "Tài chính",
    items: [
      {
        key: "orders",
        icon: NAV_ICON_KEYS.orders,
        text: "Đơn hàng",
        path: "/marketplace/orders",
        permissions: [PERMISSIONS.MARKETPLACE_VIEW],
        requiresFeature: "marketplace",
      },
      {
        key: "payments",
        icon: NAV_ICON_KEYS.payments,
        text: "Thanh toán",
        path: "/billing/payment",
        permissions: [PERMISSIONS.BILLING_PAYMENT_VIEW, PERMISSIONS.BILLING_VIEW],
      },
      {
        key: "debt",
        icon: NAV_ICON_KEYS.debt,
        text: "Công nợ",
        path: buildComingSoonPath("debt"),
        navStatus: NAV_ITEM_STATUS.COMING_SOON,
        badge: "Sắp ra mắt",
        futureNote: "V5.1 — chưa có route công nợ riêng (không trỏ revenue)",
        permissions: [PERMISSIONS.FINANCE_VIEW],
      },
      {
        key: "subscription",
        icon: NAV_ICON_KEYS.subscription,
        text: "Gói thuê bao",
        path: "/billing/current-plan",
        permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_SUBSCRIPTION_VIEW],
      },
      {
        key: "transactions",
        icon: NAV_ICON_KEYS.transactions,
        text: "Lịch sử giao dịch",
        path: "/billing/invoices",
        permissions: [PERMISSIONS.BILLING_INVOICE_VIEW, PERMISSIONS.BILLING_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.REPORTS,
    label: "Báo cáo",
    items: [
      {
        key: "report-overview",
        icon: NAV_ICON_KEYS["report-overview"],
        text: "Tổng quan kinh doanh",
        path: "/",
        match: "exact",
        permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.FINANCE_VIEW],
      },
      {
        key: "report-revenue",
        icon: NAV_ICON_KEYS["report-revenue"],
        text: "Doanh thu sân",
        path: "/court-management/revenue",
        match: "court-revenue",
        permissions: [PERMISSIONS.FINANCE_VIEW],
      },
      {
        key: "report-performance",
        icon: NAV_ICON_KEYS["report-performance"],
        text: "Hiệu suất sân",
        path: "/court-management",
        match: "live-courts",
        permissions: [PERMISSIONS.COURT_VIEW, PERMISSIONS.STATISTICS_VIEW],
      },
      {
        key: "report-customers",
        icon: NAV_ICON_KEYS["report-customers"],
        text: "Khách hàng",
        path: "/court-management/customers",
        match: "court-customers",
        permissions: [PERMISSIONS.CUSTOMER_VIEW],
      },
      {
        key: "report-tournament",
        icon: NAV_ICON_KEYS["report-tournament"],
        text: "Giải đấu",
        path: "/statistics",
        permissions: [PERMISSIONS.STATISTICS_VIEW],
      },
      {
        key: "report-peak",
        icon: NAV_ICON_KEYS["report-peak"],
        text: "Giờ cao điểm",
        path: buildComingSoonPath("report-peak"),
        navStatus: NAV_ITEM_STATUS.COMING_SOON,
        badge: "Sắp ra mắt",
        futureNote: "V5.1 — chưa có báo cáo giờ cao điểm riêng",
        permissions: [PERMISSIONS.FINANCE_VIEW, PERMISSIONS.STATISTICS_VIEW],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.AI,
    label: "Trợ lý AI",
    requiresFeature: "ai",
    items: [
      {
        key: "ai-group",
        icon: NAV_ICON_KEYS["ai-group"],
        text: "Đề xuất chia bảng",
        path: "/tournament?ai=group",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
        requiresFeature: "ai",
      },
      {
        key: "ai-pairing",
        icon: NAV_ICON_KEYS["ai-pairing"],
        text: "Đề xuất ghép cặp",
        path: "/tournament?ai=pairing",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.SCHEDULING_RUN],
        requiresFeature: "ai",
      },
      {
        key: "ai-scheduling",
        icon: NAV_ICON_KEYS["ai-scheduling"],
        text: "Đề xuất xếp sân",
        path: "/court-engine?ai=scheduling",
        match: "court-engine",
        permissions: [PERMISSIONS.SCHEDULING_RUN, PERMISSIONS.DIRECTOR_USE],
        requiresFeature: "ai",
      },
      {
        key: "ai-time",
        icon: NAV_ICON_KEYS["ai-time"],
        text: "Dự đoán thời gian",
        path: "/tournament?ai=time",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
        requiresFeature: "ai",
      },
      {
        key: "ai-validation",
        icon: NAV_ICON_KEYS["ai-validation"],
        text: "Cảnh báo bất hợp lý",
        path: buildComingSoonPath("ai-validation"),
        navStatus: NAV_ITEM_STATUS.COMING_SOON,
        badge: "Beta",
        futureNote: "V5.1 — chưa có màn AI validation riêng",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
        requiresFeature: "ai",
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.ADMIN,
    label: "Quản trị",
    items: [
      {
        key: "admin-tenants",
        icon: NAV_ICON_KEYS.tenants,
        text: "Cụm sân / Cơ sở",
        path: "/admin/tenants",
        permissions: [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        key: "users",
        icon: NAV_ICON_KEYS.users,
        text: "Người dùng",
        path: "/users",
        permissions: [PERMISSIONS.USER_MANAGE],
      },
      {
        key: "roles",
        icon: NAV_ICON_KEYS.roles,
        text: "Vai trò & Quyền",
        path: "/users",
        match: "users-roles",
        permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE],
      },
      {
        key: "courts",
        icon: NAV_ICON_KEYS.courts,
        text: "Sân thi đấu",
        path: "/court-management/courts",
        match: "court-courts",
        permissions: [PERMISSIONS.COURT_VIEW],
      },
      {
        key: "settings",
        icon: NAV_ICON_KEYS.settings,
        text: "Cấu hình",
        path: "/settings",
        permissions: [PERMISSIONS.SETTINGS_VIEW],
      },
      {
        key: "audit",
        icon: NAV_ICON_KEYS.audit,
        text: "Nhật ký hoạt động",
        path: "/audit",
        permissions: [PERMISSIONS.USER_MANAGE],
      },
      {
        key: "integrations",
        icon: NAV_ICON_KEYS.integrations,
        text: "Tích hợp",
        path: "/settings/integrations",
        permissions: [PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW],
        requiresFeature: "integrations",
      },
      {
        key: "admin-marketplace",
        icon: NAV_ICON_KEYS.marketplace,
        text: "Admin Marketplace",
        path: "/admin/marketplace",
        permissions: [PERMISSIONS.MARKETPLACE_MANAGE],
        roles: [ROLES.SUPER_ADMIN, ROLES.COURT_OWNER],
        requiresFeature: "marketplace",
      },
      {
        key: "admin-integrations",
        icon: NAV_ICON_KEYS.integrations,
        text: "Integration Logs",
        path: "/admin/integration-logs",
        permissions: [PERMISSIONS.API_MANAGE, PERMISSIONS.INTEGRATION_MANAGE],
        roles: [ROLES.SUPER_ADMIN, ROLES.COURT_OWNER],
        requiresFeature: "integrations",
      },
      {
        key: "admin-billing",
        icon: NAV_ICON_KEYS.billing,
        text: "Admin Billing",
        path: "/admin/billing",
        permissions: [PERMISSIONS.BILLING_MANAGE],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        key: "club-settings",
        icon: NAV_ICON_KEYS["club-list"],
        text: "CLB & Giải",
        path: "/club",
        match: "club-settings",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.CLUB_UPDATE],
      },
    ],
  },
  {
    id: MENU_GROUP_IDS.SUPPORT,
    label: "Hỗ trợ",
    items: [
      {
        key: "support",
        icon: NAV_ICON_KEYS.support,
        text: "Trung tâm trợ giúp",
        path: "/billing/support",
        permissions: [PERMISSIONS.BILLING_VIEW],
        excludeRoles: [ROLES.REFEREE],
      },
      {
        key: "profile",
        icon: NAV_ICON_KEYS.profile,
        text: "Hồ sơ của tôi",
        path: "/profile",
      },
      {
        key: "mobile-notifications",
        icon: NAV_ICON_KEYS.notifications,
        text: "Thông báo",
        path: "/mobile/notifications",
        excludeRoles: [ROLES.REFEREE],
      },
      {
        key: "qr-scan",
        icon: NAV_ICON_KEYS["venue-checkin"],
        text: "Quét QR",
        path: "/mobile/qr-scan",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
        excludeRoles: [ROLES.PLAYER],
      },
      {
        key: "qr-generate",
        icon: NAV_ICON_KEYS["venue-checkin"],
        text: "Tạo QR",
        path: "/mobile/qr-generate",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
      },
      {
        key: "marketplace",
        icon: NAV_ICON_KEYS.marketplace,
        text: "Marketplace",
        path: "/marketplace",
        permissions: [PERMISSIONS.MARKETPLACE_VIEW],
        requiresFeature: "marketplace",
      },
      {
        key: "mobile-player-owner",
        icon: NAV_ICON_KEYS["mobile-player"],
        text: "Trang của tôi",
        path: "/mobile/player",
        roles: [ROLES.COURT_OWNER, ROLES.COURT_MANAGER, ROLES.SUPER_ADMIN],
      },
      {
        key: "billing",
        icon: NAV_ICON_KEYS.billing,
        text: "Gói & Thanh toán",
        path: "/billing",
        permissions: [PERMISSIONS.BILLING_VIEW],
        excludeRoles: [ROLES.REFEREE],
      },
      {
        key: "support-settings",
        icon: NAV_ICON_KEYS.settings,
        text: "Cài đặt",
        path: "/settings",
        permissions: [PERMISSIONS.SETTINGS_VIEW],
        excludeRoles: [ROLES.REFEREE],
      },
    ],
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
        resolvePath: (user) =>
          user?.playerId ? `/players/profile/${user.playerId}` : null,
        permissions: [PERMISSIONS.PLAYER_VIEW],
        roles: [ROLES.PLAYER],
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
  "/": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BOOKING_VIEW],
  "/dashboard": [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.BOOKING_VIEW],
  "/players": [PERMISSIONS.PLAYER_VIEW],
  "/court-management": [PERMISSIONS.COURT_VIEW],
  "/court-management/calendar": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/bookings": [PERMISSIONS.BOOKING_VIEW],
  "/court-management/revenue": [PERMISSIONS.FINANCE_VIEW],
  "/court-management/customers": [PERMISSIONS.CUSTOMER_VIEW],
  "/court-management/courts": [PERMISSIONS.COURT_VIEW],
  "/select-players": [PERMISSIONS.SCHEDULING_VIEW],
  "/daily-play": [PERMISSIONS.TOURNAMENT_VIEW],
  "/club": [PERMISSIONS.CLUB_VIEW],
  "/clubs": [PERMISSIONS.CLUB_VIEW],
  "/tournament": [PERMISSIONS.TOURNAMENT_VIEW],
  "/tournament/bracket": [PERMISSIONS.TOURNAMENT_VIEW],
  "/court-engine": [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
  "/statistics": [PERMISSIONS.STATISTICS_VIEW],
  "/court-management/future": [
    PERMISSIONS.COURT_UPDATE,
    PERMISSIONS.VENUE_UPDATE,
    PERMISSIONS.COURT_VIEW,
  ],
  "/settings": [PERMISSIONS.SETTINGS_VIEW],
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
  "/admin/billing": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/tenants": [PERMISSIONS.BILLING_MANAGE],
  "/admin/billing/plans": [PERMISSIONS.BILLING_PLAN_VIEW],
  "/admin/billing/invoices": [PERMISSIONS.BILLING_INVOICE_VIEW],
  "/admin/billing/payments": [PERMISSIONS.BILLING_PAYMENT_VIEW],
  "/admin/billing/audit": [PERMISSIONS.BILLING_AUDIT_VIEW],
  "/users": [PERMISSIONS.USER_MANAGE],
  "/audit": [PERMISSIONS.USER_MANAGE],
  "/profile": [],
  "/referee": [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
  "/403": [],
  "/admin/tenants": [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],
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
      path: "/",
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
      path: "/mobile/check-in",
      iconKey: "checkin",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
    },
    {
      key: "player-profile",
      label: "Hồ sơ",
      resolvePath: (user) =>
        user?.playerId ? `/players/profile/${user.playerId}` : "/mobile/player",
      iconKey: "player-profile",
      roles: [ROLES.PLAYER],
    },
  ],
});

/** Drawer quick links — mobile. */
export const MOBILE_QUICK_LINKS = [
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
export function buildSearchableNavItems(groups = MENU_GROUPS) {
  const items = [];
  for (const group of groups) {
    for (const item of group.items || []) {
      if (!item.path && !item.resolvePath) continue;
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
  if (normalized === ROLES.PLAYER) return "player";
  if (normalized === ROLES.CLUB_OWNER) return "player";
  return "manager";
}

export function isNavFeatureEnabled(featureKey) {
  if (featureKey === "ai") return isAiEngineEnabled();
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
  for (const group of groups) {
    for (const item of group.items || []) {
      if (item.navStatus === NAV_ITEM_STATUS.COMING_SOON) {
        items.push({
          key: item.key,
          label: item.text,
          path: item.path,
          group: group.label,
          badge: item.badge || "Sắp ra mắt",
        });
      }
    }
  }
  return items;
}
