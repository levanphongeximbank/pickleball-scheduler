import { PERMISSIONS } from "../../auth/permissions.js";

import { ROLES } from "../../auth/roles.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";



export const CRM_MENU_ROOT = menuFolder({

  key: "crm-root",

  icon: "messages",

  text: "Chăm sóc khách hàng",

  children: [

    menuLeaf({

      key: "messages",

      icon: "messages",

      text: "Tin nhắn",

      path: "/crm/messages",

      match: "crm-messages",

      permissions: [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW],

      excludeRoles: [ROLES.REFEREE, ROLES.PLAYER],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "crm-notifications",

      icon: "notifications",

      text: "Thông báo",

      path: "/mobile/notifications",

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "crm-message-templates",

      icon: "messages",

      text: "Mẫu tin nhắn",

      path: "/crm/templates",

      match: "crm-templates",

      permissions: [PERMISSIONS.CUSTOMER_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "crm-campaigns",

      icon: "messages",

      text: "Chiến dịch",

      path: "/crm/campaigns",

      match: "crm-campaigns",

      permissions: [PERMISSIONS.CUSTOMER_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "crm-contact-history",

      icon: "history",

      text: "Lịch sử liên hệ",

      path: "/crm/history",

      match: "crm-history",

      permissions: [PERMISSIONS.CUSTOMER_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "crm-booking-reminders",

      icon: "notifications",

      text: "Nhắc booking",

      path: "/crm/reminders/booking",

      match: "crm-booking-reminders",

      permissions: [PERMISSIONS.BOOKING_VIEW, PERMISSIONS.CUSTOMER_VIEW],

      excludeRoles: [ROLES.REFEREE, ROLES.PLAYER],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

  ],

});

