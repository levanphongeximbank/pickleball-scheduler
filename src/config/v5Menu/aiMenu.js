import { PERMISSIONS } from "../../auth/permissions.js";
import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";

/** Sidebar: 1 hub — các gợi ý AI trong tab/thẻ /ai */
export const AI_MENU_ROOT = menuFolder({
  key: "ai-root",
  icon: "ai-group",
  text: "Trợ lý thông minh",
  requiresFeature: "ai",
  children: [
    menuLeaf({
      key: "ai-hub",
      icon: "ai-group",
      text: "Trợ lý thông minh",
      path: "/ai",
      match: "ai-hub",
      permissions: [PERMISSIONS.TOURNAMENT_VIEW, PERMISSIONS.SCHEDULING_RUN],
      requiresFeature: "ai",
      featureStatus: FEATURE_STATUS.LIVE,
      featureNote: "Gợi ý xếp sân, ghép cặp, cảnh báo…",
    }),
  ],
});
