import { PERMISSIONS } from "../../auth/permissions.js";

import { ROLES } from "../../auth/roles.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";



export const ADMIN_MENU_ROOT = menuFolder({

  key: "admin-root",

  icon: "settings",

  text: "Quản trị",

  children: [

    menuLeaf({

      key: "admin-tenants",

      icon: "tenants",

      text: "Cụm sân / Cơ sở",

      path: "/admin/tenants",

      permissions: [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-hours",

      icon: "calendar",

      text: "Giờ mở cửa",

      path: "/admin/hours",

      match: "admin-hours",

      permissions: [PERMISSIONS.VENUE_UPDATE, PERMISSIONS.SETTINGS_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-staff",

      icon: "users",

      text: "Nhân viên",

      path: "/admin/staff",

      match: "admin-staff",

      permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.VENUE_UPDATE],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "courts",

      icon: "courts",

      text: "Sân",

      path: "/court-management/courts",

      match: "court-courts",

      permissions: [PERMISSIONS.COURT_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "users",

      icon: "users",

      text: "Người dùng",

      path: "/users",

      permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "roles",

      icon: "roles",

      text: "Vai trò & Quyền",

      path: "/users?tab=roles",

      match: "users-roles",

      permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.ROLE_MANAGE],

      featureStatus: FEATURE_STATUS.LIVE,

      featureNote: "Tab vai trò trên trang Người dùng",

    }),

    menuLeaf({

      key: "support-settings",

      icon: "settings",

      text: "Cài đặt",

      path: "/settings",

      match: "settings",

      permissions: [PERMISSIONS.SETTINGS_VIEW],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

  ],

});

