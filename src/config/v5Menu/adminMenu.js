import { PERMISSIONS } from "../../auth/permissions.js";

import { ROLES } from "../../auth/roles.js";

import { FEATURE_STATUS, menuFolder, menuLeaf } from "./menuBuilders.js";



export const ADMIN_MENU_ROOT = menuFolder({

  key: "admin-root",

  icon: "settings",

  text: "Quản trị",

  children: [

    menuLeaf({

      key: "admin-platform-clubs",

      icon: "groups",

      text: "Sổ CLB Platform",

      path: "/platform/clubs",

      match: "platform-clubs",

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-tenants",

      icon: "tenants",

      text: "Tổ chức / Tenant",

      path: "/admin/tenants",

      permissions: [PERMISSIONS.ROLE_MANAGE, PERMISSIONS.VENUE_UPDATE],

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-court-clusters",

      icon: "courts",

      text: "Cụm sân",

      path: "/admin/court-clusters",

      match: "admin-court-clusters",

      permissions: [PERMISSIONS.CLUSTER_MANAGE],

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

      path: "/admin/roles",

      match: "admin-roles",

      permissions: [PERMISSIONS.ROLE_VIEW, PERMISSIONS.ROLE_MANAGE, PERMISSIONS.PERMISSION_VIEW, PERMISSIONS.TENANT_ROLE_CUSTOMIZE],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-tournament-certifications",

      icon: "trophy",

      text: "Duyệt giải VPR",

      path: "/admin/tournament-certifications",

      permissions: [PERMISSIONS.TOURNAMENT_CERTIFY],

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-rankings",

      icon: "statistics",

      text: "Quản trị VPR",

      path: "/dashboard/rankings",

      permissions: [PERMISSIONS.RANKING_VIEW, PERMISSIONS.RANKING_MANAGE],

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      featureStatus: FEATURE_STATUS.LIVE,

    }),

    menuLeaf({

      key: "admin-private-pairing-rules",

      icon: "ai-pairing",

      text: "Quy tắc ghép cặp riêng",

      path: "/admin/ai-pairing/private-rules",

      match: "admin-private-pairing-rules",

      permissions: [PERMISSIONS.PAIRING_PRIVATE_RULES_VIEW],

      roles: [ROLES.PLATFORM_ADMIN, ROLES.SUPER_ADMIN],

      requiresFeature: "privatePairingRules",

      featureStatus: FEATURE_STATUS.LIVE,

      featureNote: "AI & Ghép cặp · Chỉ SUPER_ADMIN",

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

