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

/**
 * Phase 1I-C — Public Player Directory.
 * No special permission. Visible to authenticated non-PLAYER roles via PROFILE group.
 * PLAYER role uses the PLAYER_ZONE copy (PROFILE group is hidden for PLAYER).
 */
export const ATHLETES_DIRECTORY_MENU_LEAF = menuLeaf({
  key: "athletes-directory",
  icon: "players",
  text: "Danh bạ vận động viên",
  path: "/athletes",
  featureStatus: FEATURE_STATUS.LIVE,
  featureNote: "Authenticated Public Player Directory (Phase 1I-C)",
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
