/**
 * Sidebar Giải đấu — phẳng 9 mục. Chi tiết sâu: tournamentInPageNav.js
 */
import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLES } from "../../auth/roles.js";
import { TOURNAMENT_ROUTES } from "../tournamentRoutes.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

const VIEW = [PERMISSIONS.TOURNAMENT_VIEW];
const CREATE = [PERMISSIONS.TOURNAMENT_CREATE];

export const TOURNAMENT_MENU_ROOT = menuFolder({
  key: "tournament-root",
  icon: "tournament-list",
  text: "Giải đấu",
  children: [
    menuLeaf({
      key: "tournament-overview",
      icon: "dashboard",
      text: "Tổng quan",
      path: TOURNAMENT_ROUTES.overview,
      match: "tournament-home",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-list",
      icon: "tournament-list",
      text: "Danh sách giải",
      path: TOURNAMENT_ROUTES.list,
      match: "tournament-list",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-create",
      icon: "tournament-create",
      text: "Tạo giải",
      path: TOURNAMENT_ROUTES.create,
      match: "tournament-create",
      permissions: CREATE,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-types-hub",
      icon: "groups",
      text: "Loại giải",
      path: TOURNAMENT_ROUTES.typesHub,
      match: "tournament-types-hub",
      permissions: VIEW,
      excludeRoles: [ROLES.PLAYER],
      featureStatus: FEATURE_STATUS.LIVE,
      featureNote: "Tab/thẻ: Đơn nam, Đôi tự do, Chia thủ công…",
    }),
    menuLeaf({
      key: "tournament-roster-hub",
      icon: "players",
      text: "Vận động viên / Đội",
      path: TOURNAMENT_ROUTES.rosterHub,
      match: "tournament-roster-hub",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-organize-hub",
      icon: "tournament-schedule",
      text: "Tổ chức thi đấu",
      path: TOURNAMENT_ROUTES.organizeHub,
      match: "tournament-organize-hub",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-operations-hub",
      icon: "referee",
      text: "Điều hành",
      path: TOURNAMENT_ROUTES.operationsHub,
      match: "tournament-operations-hub",
      permissions: VIEW,
      excludeRoles: [ROLES.PLAYER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-results-hub",
      icon: "statistics",
      text: "Kết quả",
      path: TOURNAMENT_ROUTES.resultsHub,
      match: "tournament-results-hub",
      permissions: VIEW,
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "tournament-config-hub",
      icon: "settings",
      text: "Cấu hình",
      path: TOURNAMENT_ROUTES.configHub,
      match: "tournament-config-hub",
      permissions: VIEW,
      excludeRoles: [ROLES.PLAYER],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
