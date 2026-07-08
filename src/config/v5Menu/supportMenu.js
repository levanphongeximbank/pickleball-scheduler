import { PERMISSIONS } from "../../auth/permissions.js";

import { FEATURE_STATUS, menuLeaf } from "./menuBuilders.js";

/** Hồ sơ — luôn hiển thị sidebar (không lồng trong folder). */
export const PROFILE_MENU_LEAF = menuLeaf({
  key: "my-profile",
  icon: "profile",
  text: "Hồ sơ của tôi",
  path: "/profile",
  featureStatus: FEATURE_STATUS.LIVE,
});

export const SUPPORT_HUB_LEAF = menuLeaf({
  key: "support-hub",
  icon: "support",
  text: "Hỗ trợ",
  path: "/support",
  match: "support-hub",
  permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.SUPPORT_TICKET_MANAGE],
  featureStatus: FEATURE_STATUS.LIVE,
  featureNote: "Hướng dẫn, FAQ, yêu cầu hỗ trợ",
});

/** @deprecated Dùng PROFILE_MENU_LEAF + SUPPORT_HUB_LEAF */
export const SUPPORT_MENU_ROOT = PROFILE_MENU_LEAF;
