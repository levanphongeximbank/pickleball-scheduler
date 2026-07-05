import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLES } from "../../auth/roles.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

function teamPortalPath(user) {
  const tournamentId = user?.tournamentId || user?.tournament_id;
  return tournamentId ? `/team-portal/${tournamentId}` : null;
}

/** Menu Trưởng nhóm / Đội trưởng — V5.2 */
export const TEAM_CAPTAIN_MENU_ROOT = menuFolder({
  key: "team-captain-root",
  icon: "club-members",
  text: "Đội của tôi",
  roles: [ROLES.TEAM_CAPTAIN],
  children: [
    menuLeaf({
      key: "captain-home",
      icon: "club-members",
      text: "Trang đội của tôi",
      resolvePath: teamPortalPath,
      permissions: [PERMISSIONS.TEAM_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-schedule",
      icon: "tournament-schedule",
      text: "Lịch thi đấu",
      path: "/tournament/schedule",
      permissions: [PERMISSIONS.TEAM_SCHEDULE_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-team-list",
      icon: "tournament-list",
      text: "Danh sách đội",
      path: "/tournament/teams",
      permissions: [PERMISSIONS.TEAM_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-my-team",
      icon: "club-members",
      text: "Đội của tôi",
      resolvePath: teamPortalPath,
      permissions: [PERMISSIONS.TEAM_MEMBER_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-lineup",
      icon: "bracket",
      text: "Đội hình thi đấu",
      resolvePath: teamPortalPath,
      permissions: [PERMISSIONS.TEAM_LINEUP_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-checkin",
      icon: "checkin",
      text: "Điểm danh đội",
      path: "/mobile/check-in",
      permissions: [PERMISSIONS.TEAM_CHECKIN_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-results",
      icon: "statistics",
      text: "Kết quả",
      path: "/statistics",
      permissions: [PERMISSIONS.TEAM_RESULT_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-announcements",
      icon: "notifications",
      text: "Thông báo giải",
      path: "/mobile/notifications",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-messages",
      icon: "messages",
      text: "Tin nhắn đội",
      path: "/crm/messages",
      permissions: [PERMISSIONS.TEAM_MESSAGE_SEND],
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "captain-support",
      icon: "support",
      text: "Hỗ trợ",
      path: "/support",
      roles: [ROLES.TEAM_CAPTAIN],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
