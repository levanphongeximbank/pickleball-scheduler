import { PERMISSIONS } from "../../auth/permissions.js";
import { ROLES } from "../../auth/roles.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

export const CUSTOMERS_MENU_ROOT = menuFolder({
  key: "customers-root",
  icon: "customers",
  text: "Khách hàng & VĐV",
  children: [
    menuLeaf({
      key: "customers",
      icon: "customers",
      text: "Khách hàng",
      path: "/court-management/customers",
      match: "court-customers",
      permissions: [PERMISSIONS.CUSTOMER_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "members",
      icon: "groups",
      text: "Hội viên",
      path: "/court-management/customers?type=member",
      match: "court-customers",
      permissions: [PERMISSIONS.CUSTOMER_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "players",
      icon: "players",
      text: "Vận động viên",
      path: "/players",
      permissions: [PERMISSIONS.PLAYER_VIEW],
      excludeRoles: [ROLES.PLAYER, ROLES.REFEREE],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
    menuLeaf({
      key: "skill",
      icon: "skill",
      text: "Điểm trình độ",
      path: "/players?tab=skill",
      match: "club-members",
      permissions: [PERMISSIONS.PLAYER_VIEW],
      featureStatus: FEATURE_STATUS.LIVE,
    }),
  ],
});
