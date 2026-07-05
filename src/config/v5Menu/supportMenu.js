import { PERMISSIONS } from "../../auth/permissions.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";



/** Sidebar: 1 hub — hướng dẫn, FAQ, ticket trong /support */

export const SUPPORT_MENU_ROOT = menuFolder({

  key: "support-root",

  icon: "support",

  text: "Hỗ trợ",

  children: [

    menuLeaf({

      key: "support-hub",

      icon: "support",

      text: "Hỗ trợ",

      path: "/support",

      match: "support-hub",

      permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.SUPPORT_TICKET_MANAGE],

      featureStatus: FEATURE_STATUS.LIVE,

      featureNote: "Hướng dẫn, FAQ, yêu cầu hỗ trợ",

    }),

  ],

});

