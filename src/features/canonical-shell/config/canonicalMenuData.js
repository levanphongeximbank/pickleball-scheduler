/** Auto-derived from Phase 1 CANONICAL_ROUTE_INVENTORY — Phase 2 foundation. Do not hand-edit route authority. */
export const CANONICAL_MENU_DATA = Object.freeze({
  "meta": {
    "source": "docs/ui-ux/canonical-navigation/CANONICAL_ROUTE_INVENTORY.json",
    "generatedAt": "2026-08-05T14:37:15.750Z",
    "phase": "3-menu-completion",
    "proposedCanonicalMenuCount": 83
  },
  "ownerDecisions": {
    "B01": {
      "id": "B01",
      "status": "APPROVED_A_KEEP_SEPARATE",
      "phase4Code": "APPROVED_A_KEEP_SEPARATE",
      "messagingExperienceRoute": "/messages",
      "crmMessagesRoute": "/crm/messages",
      "canonicalRoute": "/crm/messages",
      "communicationRoute": "/messages",
      "disposition": "KEEP_SEPARATE_CANONICAL",
      "redirectBetweenRoutes": false,
      "menuOwnerCrm": "CRM & Chăm sóc khách hàng",
      "menuOwnerCommunication": "Giao tiếp / Messaging Experience",
      "rule": "Phase 4 OD-B01: /messages and /crm/messages remain separate canonical business functions; no redirect"
    },
    "B02": {
      "id": "B02",
      "status": "APPROVED_RETAIN_ALL_42",
      "phase4Code": "APPROVED_RETAIN_ALL_42",
      "canonicalRouteFamily": "/tournaments/:id/*",
      "legacyRouteFamily": "/tournament/*",
      "disposition": "RETAIN_ALL_42_NO_REDIRECT",
      "rule": "Phase 4 OD-B02: retain all 42 legacy /tournament/* routes; do not invent plural redirects or tournamentId"
    },
    "B03": {
      "id": "B03",
      "status": "APPROVED_PILOT_ALIGNED_SHADOW",
      "phase4Code": "APPROVED_PILOT_ALIGNED_SHADOW",
      "route": "/player/skill-assessment-v5",
      "disposition": "HIDE_SHADOW_PILOT_ALIGNED",
      "rule": "Phase 4 OD-B03: hide from menu/search; SUPER_ADMIN/PLATFORM_ADMIN allow; PLAYER only with V5 flag + enrollment; others 403"
    }
  },
  "level1Groups": [
    {
      "id": "01",
      "key": "tong-quan",
      "label": "Tổng quan"
    },
    {
      "id": "02",
      "key": "van-hanh-san",
      "label": "Vận hành sân"
    },
    {
      "id": "03",
      "key": "khach-hang-vdv",
      "label": "Khách hàng & VĐV"
    },
    {
      "id": "04",
      "key": "clb-huan-luyen",
      "label": "CLB & Huấn luyện"
    },
    {
      "id": "05",
      "key": "giai-dau",
      "label": "Giải đấu"
    },
    {
      "id": "06",
      "key": "rating-xep-hang",
      "label": "Rating & Xếp hạng"
    },
    {
      "id": "07",
      "key": "tai-chinh",
      "label": "Tài chính"
    },
    {
      "id": "08",
      "key": "bao-cao-phan-tich",
      "label": "Báo cáo & Phân tích"
    },
    {
      "id": "09",
      "key": "ai-assistant",
      "label": "AI Assistant"
    },
    {
      "id": "10",
      "key": "thong-bao",
      "label": "Thông báo"
    },
    {
      "id": "11",
      "key": "public-portal",
      "label": "Public Portal"
    },
    {
      "id": "12",
      "key": "quan-tri-nen-tang",
      "label": "Quản trị nền tảng"
    },
    {
      "id": "13",
      "key": "ho-tro",
      "label": "Hỗ trợ"
    }
  ],
  "roleLevel1Access": {
    "SUPER_ADMIN": [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
      "13"
    ],
    "VENUE_OWNER": [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "13"
    ],
    "VENUE_MANAGER": [
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "08",
      "09",
      "10",
      "13"
    ],
    "CASHIER": [
      "01",
      "02",
      "07",
      "13"
    ],
    "CLUB_OWNER": [
      "01",
      "03",
      "04",
      "05",
      "13"
    ],
    "CLUB_MANAGER": [
      "01",
      "03",
      "04",
      "05",
      "13"
    ],
    "COACH": [
      "04",
      "13"
    ],
    "REFEREE": [
      "04",
      "05",
      "08",
      "13"
    ],
    "PLAYER": [
      "03",
      "04",
      "05",
      "06",
      "13"
    ],
    "SYSTEM_TECHNICIAN": [
      "01",
      "06",
      "12",
      "13"
    ]
  },
  "canonicalRoleMapping": {
    "SUPER_ADMIN": "PLATFORM_ADMIN",
    "VENUE_OWNER": "TENANT_OWNER",
    "VENUE_MANAGER": "VENUE_MANAGER",
    "CASHIER": "CASHIER",
    "CLUB_OWNER": "CLUB_MANAGER",
    "CLUB_MANAGER": "CLUB_MANAGER",
    "COACH": "COACH",
    "REFEREE": "REFEREE",
    "PLAYER": "PLAYER",
    "SYSTEM_TECHNICIAN": "SYSTEM_TECHNICIAN"
  },
  "nodes": [
    {
      "id": "nav__11__portal-home__home",
      "label": "Trang chủ",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/home",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-home",
      "level2Label": "Trang chủ portal",
      "level3": "home",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__11__portal-tournaments__list",
      "label": "Danh sách",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/tournaments",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-tournaments",
      "level2Label": "Giải đấu công khai",
      "level3": "list",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__11__portal-clubs__list",
      "label": "Danh sách",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/clubs",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-clubs",
      "level2Label": "CLB công khai",
      "level3": "list",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__11__portal-courts__list",
      "label": "Danh sách",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/courts",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-courts",
      "level2Label": "Sân công khai",
      "level3": "list",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__11__portal-rankings__public-bxh",
      "label": "Public Bxh",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/rankings",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-rankings",
      "level2Label": "BXH công khai",
      "level3": "public-bxh",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__11__portal-news__list",
      "label": "Danh sách",
      "description": "Public Portal",
      "icon": "dashboard",
      "route": "/news",
      "level1": "11",
      "level1Label": "Public Portal",
      "level2": "portal-news",
      "level2Label": "Tin tức",
      "level3": "list",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "PUBLIC"
      ],
      "sidebar": "public-header",
      "guards": [
        "public"
      ]
    },
    {
      "id": "nav__01__dashboard__overview",
      "label": "Tổng quan",
      "description": "Tổng quan",
      "icon": "dashboard",
      "route": "/dashboard",
      "level1": "01",
      "level1Label": "Tổng quan",
      "level2": "dashboard",
      "level2Label": "Tổng quan",
      "level3": "overview",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "statistics.view",
        "tournament.view",
        "finance.view",
        "booking.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate",
        "TenantGate",
        "OperationalRouteGate"
      ]
    },
    {
      "id": "nav__06__vpr-admin__manage-rankings",
      "label": "Quản lý ranking",
      "description": "Rating & Xếp hạng",
      "icon": "ranking",
      "route": "/dashboard/rankings",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "vpr-admin",
      "level2Label": "VPR / Ranking",
      "level3": "manage-rankings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "ranking.view",
        "ranking.manage"
      ],
      "featureFlags": [
        "VITE_VPR_RANKING_ENABLED"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__08__statistics__results-rankings",
      "label": "Kết quả & BXH",
      "description": "Báo cáo & Phân tích",
      "icon": "stats",
      "route": "/statistics",
      "level1": "08",
      "level1Label": "Báo cáo & Phân tích",
      "level2": "statistics",
      "level2Label": "Thống kê",
      "level3": "results-rankings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "statistics.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "in-page",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__court-hub__home",
      "label": "Trang chủ",
      "description": "Vận hành sân",
      "icon": "courts",
      "route": "/court-management",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "court-hub",
      "level2Label": "Trung tâm sân",
      "level3": "home",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "court.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "tabs",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__calendar__view-calendar",
      "label": "Xem lịch",
      "description": "Vận hành sân",
      "icon": "calendar",
      "route": "/court-management/calendar",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "calendar",
      "level2Label": "Lịch sân",
      "level3": "view-calendar",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "booking.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__bookings__manage-bookings",
      "label": "Manage Bookings",
      "description": "Vận hành sân",
      "icon": "bookings",
      "route": "/court-management/bookings",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "bookings",
      "level2Label": "Đặt sân",
      "level3": "manage-bookings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "booking.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__venue-revenue__view-revenue",
      "label": "View Revenue",
      "description": "Tài chính",
      "icon": "revenue",
      "route": "/court-management/revenue",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "venue-revenue",
      "level2Label": "Doanh thu sân",
      "level3": "view-revenue",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__03__customers__list-customers",
      "label": "List Customers",
      "description": "Khách hàng & VĐV",
      "icon": "customers",
      "route": "/court-management/customers",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "customers",
      "level2Label": "Khách hàng",
      "level3": "list-customers",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__03__members__list-members",
      "label": "List Members",
      "description": "Khách hàng & VĐV",
      "icon": "players",
      "route": "/court-management/members",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "members",
      "level2Label": "Thành viên sân",
      "level3": "list-members",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__courts__manage-courts",
      "label": "Manage Courts",
      "description": "Vận hành sân",
      "icon": "courts",
      "route": "/court-management/courts",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "courts",
      "level2Label": "Danh sách sân",
      "level3": "manage-courts",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "court.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__waiting-list__pairing-queue",
      "label": "Pairing Queue",
      "description": "Vận hành sân",
      "icon": "waiting",
      "route": "/select-players",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "waiting-list",
      "level2Label": "Hàng chờ",
      "level3": "pairing-queue",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "scheduling.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__director__court-director",
      "label": "Court Director",
      "description": "Vận hành sân",
      "icon": "dashboard",
      "route": "/court-engine",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "director",
      "level2Label": "Director",
      "level3": "court-director",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "director.use",
        "scheduling.run"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__02__check-in__mobile-checkin",
      "label": "Mobile Checkin",
      "description": "Vận hành sân",
      "icon": "dashboard",
      "route": "/mobile/check-in",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "check-in",
      "level2Label": "Check-in",
      "level3": "mobile-checkin",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "MobileRouteGate"
      ]
    },
    {
      "id": "nav__02__check-in__qr-scan",
      "label": "Qr Scan",
      "description": "Vận hành sân",
      "icon": "dashboard",
      "route": "/mobile/qr-scan",
      "level1": "02",
      "level1Label": "Vận hành sân",
      "level2": "check-in",
      "level2Label": "Check-in",
      "level3": "qr-scan",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view",
        "match.update"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "referee-zone",
      "guards": [
        "MobileRouteGate"
      ]
    },
    {
      "id": "nav__03__player-mobile__player-home",
      "label": "Player Home",
      "description": "Khách hàng & VĐV",
      "icon": "mobile",
      "route": "/mobile/player",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "player-mobile",
      "level2Label": "Player mobile",
      "level3": "player-home",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "player-zone",
      "guards": [
        "MobileRouteGate"
      ]
    },
    {
      "id": "nav__01__mobile-ops__ops-dashboard",
      "label": "Ops Dashboard",
      "description": "Tổng quan",
      "icon": "mobile",
      "route": "/mobile/operations",
      "level1": "01",
      "level1Label": "Tổng quan",
      "level2": "mobile-ops",
      "level2Label": "Vận hành mobile",
      "level3": "ops-dashboard",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "booking.view",
        "court.view",
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "drawer-quick",
      "guards": [
        "MobileRouteGate"
      ]
    },
    {
      "id": "nav__10__notification-settings__mobile-settings",
      "label": "Mobile Settings",
      "description": "Thông báo",
      "icon": "notifications",
      "route": "/mobile/notifications",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "notification-settings",
      "level2Label": "Cài đặt thông báo",
      "level3": "mobile-settings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "crm",
      "guards": [
        "MobileRouteGate"
      ]
    },
    {
      "id": "nav__03__athletes__staff-directory",
      "label": "Staff Directory",
      "description": "Khách hàng & VĐV",
      "icon": "players",
      "route": "/players",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "athletes",
      "level2Label": "Vận động viên",
      "level3": "staff-directory",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "player.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__06__skill-levels__staff-skill-view",
      "label": "Staff Skill View",
      "description": "Rating & Xếp hạng",
      "icon": "skill",
      "route": "/players/skill",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "skill-levels",
      "level2Label": "Trình độ",
      "level3": "staff-skill-view",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "player.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__03__profile__my-profile",
      "label": "My Profile",
      "description": "Khách hàng & VĐV",
      "icon": "profile",
      "route": "/profile",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "profile",
      "level2Label": "Hồ sơ",
      "level3": "my-profile",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__03__athletes__directory",
      "label": "Directory",
      "description": "Khách hàng & VĐV",
      "icon": "players",
      "route": "/athletes",
      "level1": "03",
      "level1Label": "Khách hàng & VĐV",
      "level2": "athletes",
      "level2Label": "Vận động viên",
      "level3": "directory",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__06__skill-levels__player-skill-view",
      "label": "Player Skill View",
      "description": "Rating & Xếp hạng",
      "icon": "skill",
      "route": "/player/skill",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "skill-levels",
      "level2Label": "Trình độ",
      "level3": "player-skill-view",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": "player-zone",
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__06__skill-assessment__first-assessment",
      "label": "First Assessment",
      "description": "Rating & Xếp hạng",
      "icon": "skill",
      "route": "/player/skill-assessment",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "skill-assessment",
      "level2Label": "Đánh giá trình độ",
      "level3": "first-assessment",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__04__club-ops__club-management",
      "label": "Club Management",
      "description": "CLB & Huấn luyện",
      "icon": "club",
      "route": "/club",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "club-ops",
      "level2Label": "Vận hành CLB",
      "level3": "club-management",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "club.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__club-governance__manage-clubs",
      "label": "Manage Clubs",
      "description": "CLB & Huấn luyện",
      "icon": "club",
      "route": "/manage/clubs",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "club-governance",
      "level2Label": "Quản trị CLB",
      "level3": "manage-clubs",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "club.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__platform-clubs__all-clubs",
      "label": "All Clubs",
      "description": "Quản trị nền tảng",
      "icon": "club",
      "route": "/platform/clubs",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "platform-clubs",
      "level2Label": "CLB nền tảng",
      "level3": "all-clubs",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "club.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__club-discovery__discover",
      "label": "Discover",
      "description": "CLB & Huấn luyện",
      "icon": "club",
      "route": "/discover-clubs",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "club-discovery",
      "level2Label": "Khám phá CLB",
      "level3": "discover",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [
        "VITE_CLUB_STORAGE_V2"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__04__my-club__my-club-home",
      "label": "My Club Home",
      "description": "CLB & Huấn luyện",
      "icon": "club",
      "route": "/my-club",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "my-club",
      "level2Label": "CLB của tôi",
      "level3": "my-club-home",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__04__my-club__membership-requests",
      "label": "Membership Requests",
      "description": "CLB & Huấn luyện",
      "icon": "club",
      "route": "/my-club/requests",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "my-club",
      "level2Label": "CLB của tôi",
      "level3": "membership-requests",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__05__daily-play__launcher",
      "label": "Launcher",
      "description": "Giải đấu",
      "icon": "daily",
      "route": "/daily-play",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "daily-play",
      "level2Label": "Daily Play",
      "level3": "launcher",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate",
        "player-blocked"
      ]
    },
    {
      "id": "nav__04__coaching__coach-directory",
      "label": "Coach Directory",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/coaches",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "coach-directory",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__coach-list-player",
      "label": "Coach List Player",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/coach-list",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "coach-list-player",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__register-package",
      "label": "Register Package",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/register",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "register-package",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__students",
      "label": "Students",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/students",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "students",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__classes",
      "label": "Classes",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/classes",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "classes",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__schedule",
      "label": "Lịch thi đấu",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/schedule",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "schedule",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__packages",
      "label": "Packages",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/packages",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "packages",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__attendance",
      "label": "Attendance",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/attendance",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "attendance",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__04__coaching__evaluations",
      "label": "Evaluations",
      "description": "CLB & Huấn luyện",
      "icon": "coach",
      "route": "/coaching/evaluations",
      "level1": "04",
      "level1Label": "CLB & Huấn luyện",
      "level2": "coaching",
      "level2Label": "Huấn luyện",
      "level3": "evaluations",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__engine",
      "label": "Engine",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/engine",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "engine",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__seed",
      "label": "Hạt giống",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/seed",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "seed",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__draw",
      "label": "Bốc thăm",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/draw",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "draw",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__schedule",
      "label": "Lịch thi đấu",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/schedule",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "schedule",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__courts",
      "label": "Sân thi đấu",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/courts",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "courts",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__ranking",
      "label": "Bảng xếp hạng",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/ranking",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "ranking",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__tournament-engine__logs",
      "label": "Nhật ký",
      "description": "Giải đấu",
      "icon": "tournament",
      "route": "/tournaments/:tournamentId/logs",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "tournament-engine",
      "level2Label": "Tournament Engine",
      "level3": "logs",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "pattern",
      "mobileVisible": false,
      "desktopVisible": false,
      "badge": null,
      "proposedCanonicalMenu": true,
      "contextualOnly": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": false,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__05__referee__hub",
      "label": "Hub",
      "description": "Giải đấu",
      "icon": "referee",
      "route": "/referee",
      "level1": "05",
      "level1Label": "Giải đấu",
      "level2": "referee",
      "level2Label": "Trọng tài",
      "level3": "hub",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.view",
        "match.update"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": "referee-zone",
      "guards": [
        "auth-only"
      ]
    },
    {
      "id": "nav__07__subscription__current-plan",
      "label": "Current Plan",
      "description": "Tài chính",
      "icon": "billing",
      "route": "/billing/current-plan",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "subscription",
      "level2Label": "Gói đăng ký",
      "level3": "current-plan",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "billing.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__payments__payment",
      "label": "Payment",
      "description": "Tài chính",
      "icon": "payments",
      "route": "/billing/payment",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "payments",
      "level2Label": "Thanh toán",
      "level3": "payment",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "billing.payment.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__subscription__upgrade",
      "label": "Upgrade",
      "description": "Tài chính",
      "icon": "billing",
      "route": "/billing/upgrade",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "subscription",
      "level2Label": "Gói đăng ký",
      "level3": "upgrade",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "billing.subscription.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__finance__debt",
      "label": "Debt",
      "description": "Tài chính",
      "icon": "finance",
      "route": "/finance/debt",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "finance",
      "level2Label": "Tài chính",
      "level3": "debt",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__finance__receipts",
      "label": "Receipts",
      "description": "Tài chính",
      "icon": "finance",
      "route": "/finance/receipts",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "finance",
      "level2Label": "Tài chính",
      "level3": "receipts",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__finance__refunds",
      "label": "Refunds",
      "description": "Tài chính",
      "icon": "finance",
      "route": "/finance/refunds",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "finance",
      "level2Label": "Tài chính",
      "level3": "refunds",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__07__marketplace__orders",
      "label": "Orders",
      "description": "Tài chính",
      "icon": "marketplace",
      "route": "/marketplace/orders",
      "level1": "07",
      "level1Label": "Tài chính",
      "level2": "marketplace",
      "level2Label": "Marketplace",
      "level3": "orders",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "marketplace.view"
      ],
      "featureFlags": [
        "VITE_MARKETPLACE_ENABLED"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "flag-gated",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__08__reports__reports-hub",
      "label": "Reports Hub",
      "description": "Báo cáo & Phân tích",
      "icon": "reports",
      "route": "/reports",
      "level1": "08",
      "level1Label": "Báo cáo & Phân tích",
      "level2": "reports",
      "level2Label": "Báo cáo",
      "level3": "reports-hub",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "statistics.view",
        "finance.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__09__ai-hub__assistant",
      "label": "Assistant",
      "description": "AI Assistant",
      "icon": "ai",
      "route": "/ai",
      "level1": "09",
      "level1Label": "AI Assistant",
      "level2": "ai-hub",
      "level2Label": "AI Assistant",
      "level3": "assistant",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [
        "VITE_ENABLE_AI_ENGINE"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "flag-gated",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__10__notifications__center",
      "label": "Center",
      "description": "Thông báo",
      "icon": "notifications",
      "route": "/notifications",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "notifications",
      "level2Label": "Thông báo",
      "level3": "center",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "header-icon",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__10__messaging__inbox",
      "label": "Tin nhắn",
      "description": "Messaging Experience — giao tiếp trực tiếp / CLB / cộng đồng",
      "icon": "chat",
      "route": "/messages",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "messaging",
      "level2Label": "Giao tiếp",
      "level3": "inbox",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "exact",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "AUTHENTICATED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ],
      "ownerDecision": "B01"
    },
    {
      "id": "nav__10__crm__crm-messages",
      "label": "CRM Messages",
      "description": "CRM outreach — soạn tin nhắn khách hàng (local)",
      "icon": "crm",
      "route": "/crm/messages",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "crm",
      "level2Label": "CRM & Chăm sóc KH",
      "level3": "crm-messages",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "booking.view",
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ],
      "ownerDecision": "B01"
    },
    {
      "id": "nav__10__crm__templates",
      "label": "Templates",
      "description": "Thông báo",
      "icon": "crm",
      "route": "/crm/templates",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "crm",
      "level2Label": "CRM & Chăm sóc KH",
      "level3": "templates",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__10__crm__campaigns",
      "label": "Campaigns",
      "description": "Thông báo",
      "icon": "crm",
      "route": "/crm/campaigns",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "crm",
      "level2Label": "CRM & Chăm sóc KH",
      "level3": "campaigns",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__10__crm__history",
      "label": "History",
      "description": "Thông báo",
      "icon": "crm",
      "route": "/crm/history",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "crm",
      "level2Label": "CRM & Chăm sóc KH",
      "level3": "history",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__10__crm__booking-reminders",
      "label": "Booking Reminders",
      "description": "Thông báo",
      "icon": "crm",
      "route": "/crm/reminders/booking",
      "level1": "10",
      "level1Label": "Thông báo",
      "level2": "crm",
      "level2Label": "CRM & Chăm sóc KH",
      "level3": "booking-reminders",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "booking.view",
        "customer.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "partial",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": {
        "label": "PARTIAL",
        "tone": "partial"
      },
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__13__support__hub",
      "label": "Hub",
      "description": "Hỗ trợ",
      "icon": "support",
      "route": "/support",
      "level1": "13",
      "level1Label": "Hỗ trợ",
      "level2": "support",
      "level2Label": "Hỗ trợ",
      "level3": "hub",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "support_ticket.manage",
        "billing.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__identity__users",
      "label": "Users",
      "description": "Quản trị nền tảng",
      "icon": "admin",
      "route": "/users",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "identity",
      "level2Label": "Identity / Users",
      "level3": "users",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "user.manage",
        "user.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__identity__player-verification",
      "label": "Player Verification",
      "description": "Quản trị nền tảng",
      "icon": "admin",
      "route": "/users/verification",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "identity",
      "level2Label": "Identity / Users",
      "level3": "player-verification",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "user.manage"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__identity__roles-permissions",
      "label": "Roles Permissions",
      "description": "Quản trị nền tảng",
      "icon": "admin",
      "route": "/admin/roles",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "identity",
      "level2Label": "Identity / Users",
      "level3": "roles-permissions",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "role.manage",
        "role.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__audit__activity-log",
      "label": "Activity Log",
      "description": "Quản trị nền tảng",
      "icon": "audit",
      "route": "/audit",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "audit",
      "level2Label": "Audit",
      "level3": "activity-log",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "activity_log.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__tenants__manage-tenants",
      "label": "Manage Tenants",
      "description": "Quản trị nền tảng",
      "icon": "tenant",
      "route": "/admin/tenants",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "tenants",
      "level2Label": "Tenants",
      "level3": "manage-tenants",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tenant.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__infrastructure__court-clusters",
      "label": "Court Clusters",
      "description": "Quản trị nền tảng",
      "icon": "admin",
      "route": "/admin/court-clusters",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "infrastructure",
      "level2Label": "Hạ tầng",
      "level3": "court-clusters",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "cluster.manage"
      ],
      "featureFlags": [
        "VITE_COURT_CLUSTERS_ENABLED"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__venue-config__operating-hours",
      "label": "Operating Hours",
      "description": "Quản trị nền tảng",
      "icon": "dashboard",
      "route": "/admin/hours",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "venue-config",
      "level2Label": "Venue Config",
      "level3": "operating-hours",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "venue.update"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__06__skill-approval__requests-queue",
      "label": "Requests Queue",
      "description": "Rating & Xếp hạng",
      "icon": "skill",
      "route": "/admin/skill-level-requests",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "skill-approval",
      "level2Label": "Duyệt trình độ",
      "level3": "requests-queue",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "system-tech",
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__06__vpr-admin__certify-tournaments",
      "label": "Certify Tournaments",
      "description": "Rating & Xếp hạng",
      "icon": "ranking",
      "route": "/admin/tournament-certifications",
      "level1": "06",
      "level1Label": "Rating & Xếp hạng",
      "level2": "vpr-admin",
      "level2Label": "VPR / Ranking",
      "level3": "certify-tournaments",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "tournament.certify"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__identity__staff",
      "label": "Staff",
      "description": "Quản trị nền tảng",
      "icon": "admin",
      "route": "/admin/staff",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "identity",
      "level2Label": "Identity / Users",
      "level3": "staff",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "user.manage"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__09__private-pairing__admin-rules",
      "label": "Admin Rules",
      "description": "AI Assistant",
      "icon": "pairing",
      "route": "/admin/ai-pairing/private-rules",
      "level1": "09",
      "level1Label": "AI Assistant",
      "level2": "private-pairing",
      "level2Label": "Private Pairing Rules",
      "level3": "admin-rules",
      "children": [],
      "requiredRoles": [
        "SUPER_ADMIN",
        "PLATFORM_ADMIN"
      ],
      "requiredPermissions": [
        "pairing.private_rules.view"
      ],
      "featureFlags": [
        "VITE_PRIVATE_PAIRING_RULES_ENABLED"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "SUPER_ADMIN"
      ],
      "sidebar": "super-admin-only",
      "guards": [
        "SuperAdminRouteGuard",
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__settings__venue-settings",
      "label": "Venue Settings",
      "description": "Quản trị nền tảng",
      "icon": "dashboard",
      "route": "/settings",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "settings",
      "level2Label": "Cài đặt",
      "level3": "venue-settings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "settings.view"
      ],
      "featureFlags": [],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": true,
      "guards": [
        "RouteAccessGate"
      ]
    },
    {
      "id": "nav__12__integrations__integration-settings",
      "label": "Integration Settings",
      "description": "Quản trị nền tảng",
      "icon": "dashboard",
      "route": "/settings/integrations",
      "level1": "12",
      "level1Label": "Quản trị nền tảng",
      "level2": "integrations",
      "level2Label": "Tích hợp",
      "level3": "integration-settings",
      "children": [],
      "requiredRoles": [],
      "requiredPermissions": [
        "integration.view"
      ],
      "featureFlags": [
        "VITE_API_ENABLED"
      ],
      "visibilityStatus": "live",
      "activeMatch": "prefix",
      "mobileVisible": true,
      "desktopVisible": true,
      "badge": null,
      "proposedCanonicalMenu": true,
      "classification": "CANONICAL",
      "rbacVisibility": [
        "RBAC_SCOPED"
      ],
      "sidebar": "system-tech",
      "guards": [
        "RouteAccessGate"
      ]
    }
  ]
});
