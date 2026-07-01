import { PERMISSIONS } from "../auth/permissions.js";
import { ROLES } from "../auth/roles.js";

/**
 * Cấu hình menu Sidebar — mỗi item có permissions (OR).
 * Icon render trong Sidebar.jsx.
 */
export const SIDEBAR_MENU_GROUPS = [
  {
    label: "Điều hành",
    items: [
      {
        key: "dashboard",
        text: "Tổng quan",
        path: "/",
        match: "exact",
        permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "court-engine",
        text: "Court Engine",
        path: "/court-engine",
        match: "court-engine",
        permissions: [PERMISSIONS.DIRECTOR_USE, PERMISSIONS.SCHEDULING_RUN],
      },
      {
        key: "live-courts",
        text: "Live Courts",
        path: "/court-management",
        match: "live-courts",
        permissions: [PERMISSIONS.COURT_VIEW],
      },
    ],
  },
  {
    label: "CLB",
    items: [
      {
        key: "club-list",
        text: "Danh sách CLB",
        path: "/clubs",
        match: "clubs",
        permissions: [PERMISSIONS.CLUB_VIEW],
      },
      {
        key: "club-create",
        text: "Tạo CLB mới",
        path: "/clubs?create=1",
        match: "clubs-create",
        permissions: [PERMISSIONS.CLUB_CREATE],
      },
      {
        key: "players",
        text: "Người chơi",
        path: "/players",
        permissions: [PERMISSIONS.PLAYER_VIEW],
        excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
      },
      {
        key: "daily-play",
        text: "Vui chơi mỗi ngày",
        path: "/daily-play",
        match: "daily-play",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "seasons",
        text: "Mùa giải",
        path: "/club",
        match: "seasons-only",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.SEASON_UPDATE],
      },
    ],
  },
  {
    label: "Giải đấu",
    items: [
      {
        key: "tournament-create",
        text: "Tạo giải đấu",
        path: "/tournament",
        match: "tournament-home",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "bracket",
        text: "Sơ đồ thi đấu",
        path: "/tournament/bracket",
        match: "bracket",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "statistics",
        text: "Kết quả",
        path: "/statistics",
        permissions: [PERMISSIONS.STATISTICS_VIEW],
      },
    ],
  },
  {
    label: "VĐV",
    roles: [ROLES.PLAYER],
    items: [
      {
        key: "player-profile",
        text: "Hồ sơ cá nhân",
        resolvePath: (user) =>
          user?.playerId ? `/players/profile/${user.playerId}` : null,
        permissions: [PERMISSIONS.PLAYER_VIEW],
        roles: [ROLES.PLAYER],
      },
    ],
  },
  {
    label: "Trọng tài",
    roles: [ROLES.REFEREE],
    items: [
      {
        key: "referee-hub",
        text: "Chấm trận",
        path: "/referee",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.MATCH_UPDATE],
        roles: [ROLES.REFEREE],
      },
      {
        key: "referee-tournaments",
        text: "Giải đấu",
        path: "/tournament",
        match: "tournament-home",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
        roles: [ROLES.REFEREE],
      },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      {
        key: "admin-tenants",
        text: "Tenant Management",
        path: "/admin/tenants",
        permissions: [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        key: "users",
        text: "Người dùng",
        path: "/users",
        permissions: [PERMISSIONS.USER_MANAGE],
      },
      {
        key: "audit",
        text: "Nhật ký",
        path: "/audit",
        permissions: [PERMISSIONS.USER_MANAGE],
      },
      {
        key: "profile",
        text: "Hồ sơ của tôi",
        path: "/profile",
      },
      {
        key: "club-settings",
        text: "CLB & Giải",
        path: "/club",
        match: "club-settings",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.CLUB_UPDATE],
      },
      {
        key: "marketplace",
        text: "Marketplace",
        path: "/marketplace",
        permissions: [PERMISSIONS.MARKETPLACE_VIEW],
        requiresFeature: "marketplace",
      },
      {
        key: "integrations",
        text: "Tích hợp",
        path: "/settings/integrations",
        permissions: [PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.SETTINGS_VIEW],
        requiresFeature: "integrations",
      },
      {
        key: "admin-marketplace",
        text: "Admin Marketplace",
        path: "/admin/marketplace",
        permissions: [PERMISSIONS.MARKETPLACE_MANAGE],
        roles: [ROLES.SUPER_ADMIN, ROLES.COURT_OWNER],
        requiresFeature: "marketplace",
      },
      {
        key: "admin-integrations",
        text: "Integration Logs",
        path: "/admin/integration-logs",
        permissions: [PERMISSIONS.API_MANAGE, PERMISSIONS.INTEGRATION_MANAGE],
        roles: [ROLES.SUPER_ADMIN, ROLES.COURT_OWNER],
        requiresFeature: "integrations",
      },
      {
        key: "checkin",
        text: "QR Check-in",
        path: "/mobile/check-in",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "qr-scan",
        text: "Quét QR",
        path: "/mobile/qr-scan",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE, PERMISSIONS.TOURNAMENT_VIEW],
      },
      {
        key: "qr-generate",
        text: "Tạo QR",
        path: "/mobile/qr-generate",
        permissions: [PERMISSIONS.TOURNAMENT_UPDATE],
      },
      {
        key: "mobile-notifications",
        text: "Thông báo",
        path: "/mobile/notifications",
      },
      {
        key: "player-home",
        text: "Của tôi (Mobile)",
        path: "/mobile/player",
      },
      {
        key: "billing",
        text: "Billing",
        path: "/billing",
        permissions: [PERMISSIONS.BILLING_VIEW],
      },
      {
        key: "admin-billing",
        text: "Admin Billing",
        path: "/admin/billing",
        permissions: [PERMISSIONS.BILLING_MANAGE],
        roles: [ROLES.SUPER_ADMIN],
      },
      {
        key: "settings",
        text: "Cài đặt",
        path: "/settings",
        permissions: [PERMISSIONS.SETTINGS_VIEW],
      },
    ],
  },
];
