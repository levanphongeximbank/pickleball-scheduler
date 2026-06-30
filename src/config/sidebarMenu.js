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
        permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
      },
      {
        key: "live-courts",
        text: "Live Courts",
        path: "/court-management",
        match: "live-courts",
        permissions: [PERMISSIONS.COURTS_VIEW],
      },
    ],
  },
  {
    label: "CLB",
    items: [
      {
        key: "players",
        text: "Người chơi",
        path: "/players",
        permissions: [PERMISSIONS.PLAYERS_VIEW],
      },
      {
        key: "daily-play",
        text: "Vui chơi mỗi ngày",
        path: "/daily-play",
        match: "daily-play",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
      },
      {
        key: "seasons",
        text: "Mùa giải",
        path: "/club",
        match: "seasons-only",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.SEASONS_MANAGE],
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
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
      },
      {
        key: "bracket",
        text: "Sơ đồ thi đấu",
        path: "/tournament/bracket",
        match: "bracket",
        permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.PLAYER_SCHEDULE_VIEW],
      },
      {
        key: "statistics",
        text: "Kết quả",
        path: "/statistics",
        permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.PLAYER_RESULTS_VIEW],
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
        permissions: [PERMISSIONS.PLAYER_PROFILE_VIEW],
        roles: [ROLES.PLAYER],
      },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      {
        key: "club-settings",
        text: "CLB & Giải",
        path: "/club",
        match: "club-settings",
        permissions: [PERMISSIONS.CLUB_VIEW, PERMISSIONS.CLUB_MANAGE],
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
