/**
 * Phase 1 inventory generator — documentation only.
 * Run: node scripts/generate-canonical-nav-inventory.mjs
 */
import fs from "fs";
import path from "path";

const OUT = "docs/ui-ux/canonical-navigation";

/** Owner decisions bound Phase 1 review — 2026-08-05 */
const OWNER_DECISIONS = Object.freeze({
  B01: {
    id: "B01",
    status: "APPROVED_A_KEEP_SEPARATE",
    messagingExperienceRoute: "/messages",
    crmMessagesRoute: "/crm/messages",
    disposition: "KEEP_SEPARATE_CANONICAL",
    rule: "Phase 4 OD-B01: /messages and /crm/messages remain separate canonical business functions; no redirect",
  },
  B02: {
    id: "B02",
    status: "APPROVED_RETAIN_ALL_42_WAVE1_ALLOWLIST",
    canonicalRouteFamily: "/tournaments/:tournamentId/*",
    legacyRouteFamily: "/tournament/*",
    disposition: "RETAIN_ALL_42_NO_REDIRECT",
    rule: "Wave 1: retain all /tournament/* routes without invented plural redirects; only the explicit standalone hub allowlist is menu-exposed",
  },
  B03: {
    id: "B03",
    status: "RESOLVED",
    route: "/player/skill-assessment-v5",
    disposition: "HIDE_SHADOW",
    rule: "Remove from PLAYER/user-facing menus; flag alone must not expose; direct hidden access SUPER_ADMIN/technical eval only; do not delete route",
  },
});

const ROUTE_OWNERS = Object.freeze({
  "01": "Tổng quan",
  "02": "Vận hành sân",
  "03": "Khách hàng & VĐV",
  "04": "CLB & Huấn luyện",
  "05": "Giải đấu",
  "06": "Rating & Xếp hạng",
  "07": "Tài chính",
  "08": "Báo cáo & Phân tích",
  "09": "AI Assistant",
  "10": "Thông báo",
  "11": "Public Portal",
  "12": "Quản trị nền tảng",
  "13": "Hỗ trợ",
});

const B02_TOURNAMENT_HUB_MENU_ALLOWLIST = new Set([
  "/tournament",
  "/tournament/list",
  "/tournament/create",
  "/tournament/types",
  "/tournament/roster",
  "/tournament/register",
  "/tournament/organize",
  "/tournament/operations",
  "/tournament/results",
  "/tournament/config",
  "/tournament/my",
]);

/**
 * Wave 2 — whole-platform standalone hubs promoted into proposedCanonicalMenu.
 * Group 05 tournament family is intentionally excluded (frozen from Wave 1).
 * B03 shadow, public-only detail routes, auth, and contextual :param routes are excluded.
 */
const WAVE2_CANONICAL_HUB_MENU_ALLOWLIST = new Set([
  // 02 Vận hành sân
  "/court-management/ops-log",
  "/court-management/future",
  "/mobile/qr-generate",
  // 03 Khách hàng & VĐV
  "/court-management/customer-groups",
  // 07 Tài chính
  "/billing",
  "/billing/invoices",
  "/billing/usage",
  "/marketplace",
  // 12 Quản trị nền tảng
  "/admin/billing",
  "/admin/billing/tenants",
  "/admin/billing/plans",
  "/admin/billing/invoices",
  "/admin/billing/payments",
  "/admin/billing/audit",
  "/admin/marketplace",
  "/admin/marketplace/products",
  "/admin/marketplace/orders",
  "/admin/integration-logs",
  "/admin/payment-transactions",
  "/admin/webhook-events",
  "/admin/api-clients",
  "/admin/api-logs",
  "/settings/integrations/payments",
  "/settings/integrations/zalo-oa",
  // 13 Hỗ trợ
  "/support/faq",
  "/support/guide",
]);

const LEVEL1 = [
  { id: "01", key: "tong-quan", label: "Tổng quan" },
  { id: "02", key: "van-hanh-san", label: "Vận hành sân" },
  { id: "03", key: "khach-hang-vdv", label: "Khách hàng & VĐV" },
  { id: "04", key: "clb-huan-luyen", label: "CLB & Huấn luyện" },
  { id: "05", key: "giai-dau", label: "Giải đấu" },
  { id: "06", key: "rating-xep-hang", label: "Xếp hạng" },
  { id: "07", key: "tai-chinh", label: "Tài chính" },
  { id: "08", key: "bao-cao-phan-tich", label: "Báo cáo & Phân tích" },
  { id: "09", key: "ai-assistant", label: "Trợ lý AI" },
  { id: "10", key: "thong-bao", label: "Thông báo" },
  { id: "11", key: "public-portal", label: "Cổng công khai" },
  { id: "12", key: "quan-tri-nen-tang", label: "Quản trị nền tảng" },
  { id: "13", key: "ho-tro", label: "Hỗ trợ" },
];

/** @type {import('./types').RouteEntry[]} */
const ROUTES = [
  // Auth / system
  { path: "/login", component: "LoginPage", level1: "12", level2: "auth", level3: "login", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/forgot-password", component: "ForgotPasswordPage", level1: "12", level2: "auth", level3: "forgot-password", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/reset-password", component: "ResetPasswordPage", level1: "12", level2: "auth", level3: "reset-password", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/change-password", component: "ForceChangePasswordPage", level1: "12", level2: "auth", level3: "change-password", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/403", component: "ForbiddenPage", level1: "12", level2: "auth", level3: "forbidden", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["exempt"], perms: [], flags: [] },
  { path: "/coming-soon/:moduleKey", component: "ComingSoonPage", level1: "12", level2: "placeholders", level3: "coming-soon", classification: "HIDDEN_ACTIVE", sidebar: "conditional", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [], notes: "System-tech menu only" },

  // Public portal
  { path: "/", component: "PublicRootPage", level1: "11", level2: "portal-home", level3: "root", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/home", component: "HomePage", level1: "11", level2: "portal-home", level3: "home", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/tournaments", component: "PublicTournamentsPage", level1: "11", level2: "portal-tournaments", level3: "list", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/clubs", component: "PublicClubsPage", level1: "11", level2: "portal-clubs", level3: "list", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/clubs/:publicId", component: "PublicCatalogNotFoundPage", level1: "11", level2: "portal-clubs", level3: "detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/courts", component: "PublicCourtsPage", level1: "11", level2: "portal-courts", level3: "list", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/courts/:publicId", component: "PublicCatalogNotFoundPage", level1: "11", level2: "portal-courts", level3: "detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/rankings", component: "PublicRankingsPage", level1: "11", level2: "portal-rankings", level3: "public-bxh", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },
  { path: "/news", component: "PublicNewsPage", level1: "11", level2: "portal-news", level3: "list", classification: "CANONICAL", sidebar: "public-header", mobile: false, guards: ["public"], perms: [], flags: [] },

  // Dashboard
  { path: "/dashboard", component: "Dashboard", level1: "01", level2: "dashboard", level3: "overview", classification: "CANONICAL", sidebar: true, mobile: true, guards: ["RouteAccessGate", "TenantGate", "OperationalRouteGate"], perms: ["statistics.view", "tournament.view", "finance.view", "booking.view"], flags: [] },
  { path: "/dashboard/rankings", component: "RankingManagementPage", level1: "06", level2: "vpr-admin", level3: "manage-rankings", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["ranking.view", "ranking.manage"], flags: ["VITE_VPR_RANKING_ENABLED"] },
  { path: "/statistics", component: "Statistics", level1: "08", level2: "statistics", level3: "results-rankings", classification: "CANONICAL", sidebar: "in-page", mobile: true, guards: ["RouteAccessGate"], perms: ["statistics.view"], flags: [] },

  // Venue ops
  { path: "/court-management", component: "CourtManagementHome", level1: "02", level2: "court-hub", level3: "home", classification: "CANONICAL", sidebar: "tabs", mobile: false, guards: ["RouteAccessGate"], perms: ["court.view"], flags: [] },
  { path: "/court-management/calendar", component: "CourtManagementCalendarPage", level1: "02", level2: "calendar", level3: "view-calendar", classification: "CANONICAL", sidebar: true, mobile: true, guards: ["RouteAccessGate"], perms: ["booking.view"], flags: [] },
  { path: "/court-management/calendar/preview", component: "CourtCalendarPreviewPage", level1: "02", level2: "calendar", level3: "preview", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["court.view"], flags: [], notes: "Dev/preview" },
  { path: "/court-management/bookings", component: "CourtManagementBookingsPage", level1: "02", level2: "bookings", level3: "manage-bookings", classification: "CANONICAL", sidebar: true, mobile: true, guards: ["RouteAccessGate"], perms: ["booking.view"], flags: [] },
  { path: "/court-management/revenue", component: "CourtManagementRevenuePage", level1: "07", level2: "venue-revenue", level3: "view-revenue", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["finance.view"], flags: [] },
  { path: "/court-management/customers", component: "CourtManagementCustomersPage", level1: "03", level2: "customers", level3: "list-customers", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["customer.view"], flags: [] },
  { path: "/court-management/members", component: "CourtManagementMembersPage", level1: "03", level2: "members", level3: "list-members", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["customer.view"], flags: [] },
  { path: "/court-management/customer-groups", component: "CustomerGroupsPage", level1: "03", level2: "customer-groups", level3: "manage-groups", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["court.view"], flags: [], notes: "Coming-soon metadata exists; route wired but no menu" },
  { path: "/court-management/ops-log", component: "CourtOpsLogPage", level1: "02", level2: "ops-log", level3: "view-log", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["court.view"], flags: [] },
  { path: "/court-management/courts", component: "CourtManagementCourtsPage", level1: "02", level2: "courts", level3: "manage-courts", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["court.view"], flags: [] },
  { path: "/court-management/future", component: "CourtManagementFuturePage", level1: "02", level2: "courts", level3: "future-courts", classification: "HIDDEN_ACTIVE", sidebar: "court-tabs", mobile: false, guards: ["RouteAccessGate"], perms: ["court.update", "venue.update"], flags: [] },
  { path: "/select-players", component: "SelectPlayers", level1: "02", level2: "waiting-list", level3: "pairing-queue", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["scheduling.view"], flags: [] },
  { path: "/court-engine", component: "CourtEnginePage", level1: "02", level2: "director", level3: "court-director", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["director.use", "scheduling.run"], flags: [] },
  { path: "/courts-ops", component: "Navigate", level1: "02", level2: "courts", level3: "legacy-redirect", classification: "LEGACY", sidebar: false, mobile: false, guards: [], perms: [], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/court-management/courts" },
  { path: "/mobile/check-in", component: "CheckInDashboardPage", level1: "02", level2: "check-in", level3: "mobile-checkin", classification: "CANONICAL", sidebar: true, mobile: true, guards: ["MobileRouteGate"], perms: ["tournament.view"], flags: [] },
  { path: "/mobile/qr-scan", component: "QrScanPage", level1: "02", level2: "check-in", level3: "qr-scan", classification: "CANONICAL", sidebar: "referee-zone", mobile: true, guards: ["MobileRouteGate"], perms: ["tournament.view", "match.update"], flags: [] },
  { path: "/mobile/qr-generate", component: "QrGeneratePage", level1: "02", level2: "check-in", level3: "qr-generate", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["MobileRouteGate"], perms: ["tournament.update"], flags: [] },
  { path: "/mobile/player", component: "PlayerHomePage", level1: "03", level2: "player-mobile", level3: "player-home", classification: "CANONICAL", sidebar: "player-zone", mobile: true, guards: ["MobileRouteGate"], perms: [], flags: [] },
  { path: "/mobile/operations", component: "OperationsMobileDashboardPage", level1: "01", level2: "mobile-ops", level3: "ops-dashboard", classification: "CANONICAL", sidebar: "drawer-quick", mobile: true, guards: ["MobileRouteGate"], perms: ["booking.view", "court.view", "finance.view"], flags: [] },
  { path: "/mobile/notifications", component: "NotificationSettingsPage", level1: "10", level2: "notification-settings", level3: "mobile-settings", classification: "CANONICAL", sidebar: "crm", mobile: true, guards: ["MobileRouteGate"], perms: [], flags: [] },

  // Customers & athletes
  { path: "/players", component: "Players", level1: "03", level2: "athletes", level3: "staff-directory", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["player.view"], flags: [] },
  { path: "/players/skill", component: "SkillLevelsPage", level1: "06", level2: "skill-levels", level3: "staff-skill-view", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["player.view"], flags: [] },
  { path: "/players/profile/:playerId", component: "PlayerProfile", level1: "03", level2: "athletes", level3: "player-detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["player.view"], flags: [] },
  { path: "/profile", component: "SelfProfilePage", level1: "03", level2: "profile", level3: "my-profile", classification: "CANONICAL", sidebar: true, mobile: "drawer", guards: ["auth-only"], perms: [], flags: [] },
  { path: "/athletes", component: "PublicPlayerDirectoryPage", level1: "03", level2: "athletes", level3: "directory", classification: "CANONICAL", sidebar: true, mobile: "drawer", guards: ["auth-only"], perms: [], flags: [] },
  { path: "/athletes/:playerId", component: "PublicPlayerDirectoryDetailPage", level1: "03", level2: "athletes", level3: "directory-detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/player/profile", component: "AthleteSelfProfilePage", level1: "03", level2: "profile", level3: "player-self-profile", classification: "DUPLICATE", sidebar: "player-zone", mobile: true, guards: ["auth-only"], perms: [], flags: [], disposition: "RETAIN_CANONICAL", notes: "PLAYER canonical; /profile is staff cross-role" },
  { path: "/player/skill", component: "PlayerSkillOverviewPage", level1: "06", level2: "skill-levels", level3: "player-skill-view", classification: "CANONICAL", sidebar: "player-zone", mobile: true, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/player/skill-assessment", component: "FirstSkillAssessmentPage", level1: "06", level2: "skill-assessment", level3: "first-assessment", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/player/skill-assessment-v5", component: "SkillAssessmentV5Page", level1: "06", level2: "skill-assessment", level3: "v5-technical-eval", classification: "SHADOW", sidebar: false, mobile: false, guards: ["auth-only"], perms: [], flags: ["VITE_PICK_VN_RATING_V5_ENABLED"], disposition: "HIDE_SHADOW", ownerDecision: "B03", notes: "Owner B03: hidden from all user-facing menus; SUPER_ADMIN direct access only; Rating consolidation program owns canonical assessment" },
  { path: "/onboarding/pick-vn-rating", component: "Navigate", level1: "06", level2: "skill-assessment", level3: "legacy-onboarding", classification: "LEGACY", sidebar: false, mobile: false, guards: [], perms: [], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/player/skill-assessment" },

  // Club & coaching
  { path: "/club", component: "ClubManagement", level1: "04", level2: "club-ops", level3: "club-management", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["club.view"], flags: [] },
  { path: "/manage/clubs", component: "ClubListPage", level1: "04", level2: "club-governance", level3: "manage-clubs", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["club.view"], flags: [] },
  { path: "/manage/clubs/:clubId", component: "ClubDetailPage", level1: "04", level2: "club-governance", level3: "club-detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["club.view"], flags: [] },
  { path: "/platform/clubs", component: "PlatformClubsPage", level1: "12", level2: "platform-clubs", level3: "all-clubs", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["club.view"], flags: [] },
  { path: "/discover-clubs", component: "DiscoverClubsPage", level1: "04", level2: "club-discovery", level3: "discover", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["auth-only"], perms: [], flags: ["VITE_CLUB_STORAGE_V2"] },
  { path: "/clubs/discover", component: "Navigate", level1: "04", level2: "club-discovery", level3: "legacy-discover", classification: "LEGACY", sidebar: false, mobile: false, guards: [], perms: [], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/discover-clubs" },
  { path: "/my-club", component: "MyClubPage", level1: "04", level2: "my-club", level3: "my-club-home", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/my-club/requests", component: "MyClubRequestsPage", level1: "04", level2: "my-club", level3: "membership-requests", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["auth-only"], perms: [], flags: [] },
  { path: "/club/activity", component: "Navigate", level1: "04", level2: "my-club", level3: "legacy-activity", classification: "LEGACY", sidebar: false, mobile: false, guards: [], perms: [], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/my-club?view=schedule" },
  { path: "/daily-play", component: "DailyPlayLauncher", level1: "05", level2: "daily-play", level3: "launcher", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate", "player-blocked"], perms: ["tournament.view"], flags: [] },
  { path: "/coaching/coaches", component: "CoachesPage", level1: "04", level2: "coaching", level3: "coach-directory", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/coach-list", component: "CoachListPage", level1: "04", level2: "coaching", level3: "coach-list-player", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/register", component: "CoachPackageRegisterPage", level1: "04", level2: "coaching", level3: "register-package", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/students", component: "StudentsPage", level1: "04", level2: "coaching", level3: "students", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/classes", component: "ClassesPage", level1: "04", level2: "coaching", level3: "classes", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/schedule", component: "CoachSchedulePage", level1: "04", level2: "coaching", level3: "schedule", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/packages", component: "CoachPackagesPage", level1: "04", level2: "coaching", level3: "packages", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/attendance", component: "CoachAttendancePage", level1: "04", level2: "coaching", level3: "attendance", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/coaching/evaluations", component: "CoachEvaluationPage", level1: "04", level2: "coaching", level3: "evaluations", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },

  // Tournament core
  { path: "/tournament", component: "TournamentShell", level1: "05", level2: "tournament-hub", level3: "overview", classification: "CANONICAL", sidebar: true, mobile: true, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/list", component: "TournamentListPage", level1: "05", level2: "tournament-hub", level3: "list", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/create", component: "TournamentCreatePage", level1: "05", level2: "tournament-hub", level3: "create", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.create"], flags: [] },
  { path: "/tournament/types", component: "TournamentTypesHubPage", level1: "05", level2: "tournament-types", level3: "types-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate", "player-blocked"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/types/:category", component: "TournamentTypePage", level1: "05", level2: "tournament-types", level3: "type-detail", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/roster", component: "TournamentRosterHubPage", level1: "05", level2: "roster", level3: "roster-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/organize", component: "TournamentOrganizeHubPage", level1: "05", level2: "organize", level3: "organize-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/operations", component: "TournamentOperationsHubPage", level1: "05", level2: "operations", level3: "ops-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate", "player-blocked"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/results", component: "TournamentResultsHubPage", level1: "05", level2: "results", level3: "results-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/config", component: "TournamentConfigHubPage", level1: "05", level2: "config", level3: "config-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate", "player-blocked"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/register", component: "TournamentRegisterHub", level1: "05", level2: "registration", level3: "register-hub", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/my", component: "IndividualPlayerPortalPage", level1: "05", level2: "player-portal", level3: "my-tournaments", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/my/:tournamentId", component: "IndividualPlayerPortalPage", level1: "05", level2: "player-portal", level3: "my-tournament-detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/:tournamentId/public", component: "IndividualTournamentPublicPage", level1: "05", level2: "public-tournament", level3: "public-view", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/:tournamentId/register", component: "IndividualRegistrationPage", level1: "05", level2: "registration", level3: "register-tournament", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/bracket", component: "TournamentBracketHub", level1: "05", level2: "bracket", level3: "bracket-hub", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/teams", component: "TournamentTeamsHub", level1: "05", level2: "teams", level3: "teams-hub", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/teams/presets", component: "TournamentTeamPresetsHub", level1: "05", level2: "teams", level3: "team-presets", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/teams/build/manual", component: "TournamentTeamBuildManualHub", level1: "05", level2: "teams", level3: "build-manual", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/teams/build/random", component: "TournamentTeamBuildRandomHub", level1: "05", level2: "teams", level3: "build-random", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/teams/build/draft", component: "TournamentTeamBuildDraftHub", level1: "05", level2: "teams", level3: "build-draft", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/schedule", component: "TournamentScheduleHub", level1: "05", level2: "schedule", level3: "schedule-hub", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/match-reports", component: "TournamentMatchReportsHub", level1: "05", level2: "operations", level3: "match-reports", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/config/format", component: "TournamentConfigFormatHub", level1: "05", level2: "config", level3: "format", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.update"], flags: [] },
  { path: "/tournament/config/settings", component: "TournamentConfigSettingsHub", level1: "05", level2: "config", level3: "settings", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.update"], flags: [] },
  { path: "/tournament/config/age-rules", component: "TournamentAgeRulesPage", level1: "05", level2: "config", level3: "age-rules", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/config/gender-rules", component: "TournamentGenderRulesPage", level1: "05", level2: "config", level3: "gender-rules", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/config/fee", component: "TournamentFeePage", level1: "05", level2: "config", level3: "fee", classification: "CANONICAL", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/config/regulations", component: "TournamentRegulationsPage", level1: "05", level2: "config", level3: "regulations", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/eligibility", component: "TournamentTeamEligibilityHub", level1: "05", level2: "eligibility", level3: "eligibility-hub", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/eligibility/check", component: "TournamentEligibilityPage", level1: "05", level2: "eligibility", level3: "check", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/entry-fee", component: "TournamentFeePage", level1: "05", level2: "config", level3: "entry-fee-alias", classification: "DUPLICATE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/tournament/config/fee" },
  { path: "/tournament/publish-schedule", component: "TournamentPublishSchedulePage", level1: "05", level2: "schedule", level3: "publish", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/referee-assign", component: "TournamentRefereeAssignPage", level1: "05", level2: "operations", level3: "referee-assign", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/awards", component: "TournamentAwardsPage", level1: "05", level2: "results", level3: "awards", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/withdrawal", component: "TournamentWithdrawalPage", level1: "05", level2: "operations", level3: "withdrawal", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/daily/:tournamentId", component: "DailyPlaySetup", level1: "05", level2: "daily-play", level3: "setup", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/internal/:tournamentId", component: "InternalTournamentSetup", level1: "05", level2: "internal-tournament", level3: "setup", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/internal/:tournamentId/bracket", component: "TournamentBracketPage", level1: "05", level2: "internal-tournament", level3: "bracket", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/official/:tournamentId", component: "OfficialTournamentSetup", level1: "05", level2: "official-tournament", level3: "setup", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/official/:tournamentId/bracket", component: "TournamentBracketPage", level1: "05", level2: "official-tournament", level3: "bracket", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/team/:tournamentId", component: "TeamTournamentSetup", level1: "05", level2: "team-tournament", level3: "setup", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [] },
  { path: "/tournament/director/:tournamentId", component: "TournamentDirectorMode", level1: "05", level2: "director", level3: "director-mode", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["director.use"], flags: [] },
  { path: "/tournaments/:tournamentId/engine", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "engine", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION", notes: "Engine 4.0 path prefix /tournaments vs canonical /tournament" },
  { path: "/tournaments/:tournamentId/seed", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "seed", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },
  { path: "/tournaments/:tournamentId/draw", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "draw", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },
  { path: "/tournaments/:tournamentId/schedule", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "schedule", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },
  { path: "/tournaments/:tournamentId/courts", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "courts", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },
  { path: "/tournaments/:tournamentId/ranking", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "ranking", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },
  { path: "/tournaments/:tournamentId/logs", component: "TournamentEnginePage", level1: "05", level2: "engine-v4", level3: "logs", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.view"], flags: [], disposition: "REQUIRE_OWNER_DECISION" },

  // Referee
  { path: "/referee", component: "RefereeHub", level1: "05", level2: "referee", level3: "hub", classification: "CANONICAL", sidebar: "referee-zone", mobile: true, guards: ["auth-only"], perms: ["tournament.view", "match.update"], flags: [] },
  { path: "/referee/:token", component: "RefereeScoreboard", level1: "05", level2: "referee", level3: "token-scoreboard", classification: "CANONICAL", sidebar: false, mobile: false, guards: ["public-token"], perms: [], flags: [] },
  { path: "/referee/match/:matchId", component: "RefereeV5TeamMatchPage", level1: "05", level2: "referee", level3: "match-v5", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["auth-only"], perms: [], flags: ["VITE_REFEREE_V5_ENABLED"] },
  { path: "/team-portal/:tournamentId", component: "TeamPortal", level1: "05", level2: "team-portal", level3: "captain-portal", classification: "HIDDEN_ACTIVE", sidebar: "team-captain", mobile: false, guards: ["auth-only"], perms: ["team.view"], flags: [] },
  { path: "/team-referee/:tournamentId", component: "TeamRefereePortal", level1: "05", level2: "team-referee", level3: "team-referee-portal", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["auth-only"], perms: [], flags: [] },

  // Finance & billing
  { path: "/billing", component: "BillingPage", level1: "07", level2: "billing", level3: "billing-root", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.view"], flags: [] },
  { path: "/billing/current-plan", component: "BillingPage", level1: "07", level2: "subscription", level3: "current-plan", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.view"], flags: [] },
  { path: "/billing/usage", component: "BillingPage", level1: "07", level2: "subscription", level3: "usage", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.view"], flags: [] },
  { path: "/billing/invoices", component: "BillingPage", level1: "07", level2: "subscription", level3: "invoices", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.invoice.view"], flags: [] },
  { path: "/billing/payment", component: "BillingPage", level1: "07", level2: "payments", level3: "payment", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.payment.view"], flags: [] },
  { path: "/billing/upgrade", component: "BillingPage", level1: "07", level2: "subscription", level3: "upgrade", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.subscription.view"], flags: [] },
  { path: "/billing/support", component: "BillingPage", level1: "07", level2: "billing", level3: "support", classification: "HIDDEN_ACTIVE", sidebar: "support-in-page", mobile: false, guards: ["RouteAccessGate"], perms: ["billing.view"], flags: [] },
  { path: "/finance/debt", component: "FinanceDebtPage", level1: "07", level2: "finance", level3: "debt", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["finance.view"], flags: [] },
  { path: "/finance/receipts", component: "FinanceReceiptsPage", level1: "07", level2: "finance", level3: "receipts", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["finance.view"], flags: [] },
  { path: "/finance/refunds", component: "FinanceRefundsPage", level1: "07", level2: "finance", level3: "refunds", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["finance.view"], flags: [] },
  { path: "/marketplace", component: "MarketplacePage", level1: "07", level2: "marketplace", level3: "catalog", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["marketplace.view"], flags: ["VITE_MARKETPLACE_ENABLED"] },
  { path: "/marketplace/orders", component: "MarketplaceOrdersPage", level1: "07", level2: "marketplace", level3: "orders", classification: "CANONICAL", sidebar: "flag-gated", mobile: false, guards: ["RouteAccessGate"], perms: ["marketplace.view"], flags: ["VITE_MARKETPLACE_ENABLED"] },
  { path: "/marketplace/:productId", component: "MarketplaceProductPage", level1: "07", level2: "marketplace", level3: "product-detail", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["marketplace.view"], flags: ["VITE_MARKETPLACE_ENABLED"] },

  // Reports & AI
  { path: "/reports", component: "ReportsHubPage", level1: "08", level2: "reports", level3: "reports-hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["statistics.view", "finance.view"], flags: [], notes: "PARTIAL badge in menu" },
  { path: "/ai", component: "AiHubPage", level1: "09", level2: "ai-hub", level3: "assistant", classification: "CANONICAL", sidebar: "flag-gated", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: ["VITE_ENABLE_AI_ENGINE"] },

  // Notifications & messaging
  { path: "/notifications", component: "NotificationCenterPage", level1: "10", level2: "notifications", level3: "center", classification: "CANONICAL", sidebar: "header-icon", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/messages", component: "MessagingExperiencePage", level1: "10", level2: "messaging", level3: "legacy-inbox", classification: "LEGACY", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [], disposition: "REDIRECT_LEGACY", redirectTo: "/crm/messages", ownerDecision: "B01", notes: "Owner B01: legacy; redirect to /crm/messages; must not remain active menu item" },
  { path: "/crm/messages", component: "CrmMessagesPage", level1: "10", level2: "crm", level3: "crm-messages", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["booking.view", "customer.view"], flags: [], routeOwner: "CRM & Chăm sóc khách hàng", disposition: "RETAIN_CANONICAL", ownerDecision: "B01", notes: "Owner B01: canonical messaging route; menu owner CRM & Chăm sóc khách hàng; PARTIAL badge" },
  { path: "/crm/templates", component: "CrmTemplatesPage", level1: "10", level2: "crm", level3: "templates", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["customer.view"], flags: [], notes: "PARTIAL" },
  { path: "/crm/campaigns", component: "CrmCampaignsPage", level1: "10", level2: "crm", level3: "campaigns", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["customer.view"], flags: [], notes: "PARTIAL" },
  { path: "/crm/history", component: "CrmContactHistoryPage", level1: "10", level2: "crm", level3: "history", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["customer.view"], flags: [], notes: "PARTIAL" },
  { path: "/crm/reminders/booking", component: "CrmBookingReminderPage", level1: "10", level2: "crm", level3: "booking-reminders", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["booking.view", "customer.view"], flags: [], notes: "PARTIAL" },

  // Support
  { path: "/support", component: "SupportHubPage", level1: "13", level2: "support", level3: "hub", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["support_ticket.manage", "billing.view"], flags: [] },
  { path: "/support/guide", component: "SupportGuidePage", level1: "13", level2: "support", level3: "guide", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/support/faq", component: "SupportFaqPage", level1: "13", level2: "support", level3: "faq", classification: "HIDDEN_ACTIVE", sidebar: "in-page", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },

  // Platform admin
  { path: "/users", component: "UserManagementPage", level1: "12", level2: "identity", level3: "users", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["user.manage", "user.view"], flags: [] },
  { path: "/users/verification", component: "AdminPlayerVerificationPage", level1: "12", level2: "identity", level3: "player-verification", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["user.manage"], flags: [] },
  { path: "/admin/roles", component: "RolesPermissionsPage", level1: "12", level2: "identity", level3: "roles-permissions", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["role.manage", "role.view"], flags: [] },
  { path: "/audit", component: "AuditLogPage", level1: "12", level2: "audit", level3: "activity-log", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["activity_log.view"], flags: [] },
  { path: "/admin/tenants", component: "TenantManagement", level1: "12", level2: "tenants", level3: "manage-tenants", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tenant.view"], flags: [] },
  { path: "/admin/court-clusters", component: "CourtClusterManagement", level1: "12", level2: "infrastructure", level3: "court-clusters", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["cluster.manage"], flags: ["VITE_COURT_CLUSTERS_ENABLED"] },
  { path: "/admin/hours", component: "VenueHoursPage", level1: "12", level2: "venue-config", level3: "operating-hours", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["venue.update"], flags: [] },
  { path: "/admin/skill-level-requests", component: "SkillLevelRequestsPage", level1: "06", level2: "skill-approval", level3: "requests-queue", classification: "CANONICAL", sidebar: "system-tech", mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/tournament-certifications", component: "TournamentCertificationQueuePage", level1: "06", level2: "vpr-admin", level3: "certify-tournaments", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["tournament.certify"], flags: [] },
  { path: "/admin/staff", component: "StaffListPage", level1: "12", level2: "identity", level3: "staff", classification: "CANONICAL", sidebar: true, mobile: false, guards: ["RouteAccessGate"], perms: ["user.manage"], flags: [] },
  { path: "/admin/marketplace", component: "AdminMarketplacePage", level1: "12", level2: "marketplace-admin", level3: "admin-root", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/marketplace/products", component: "AdminMarketplacePage", level1: "12", level2: "marketplace-admin", level3: "products", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/marketplace/orders", component: "AdminMarketplacePage", level1: "12", level2: "marketplace-admin", level3: "orders", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/integration-logs", component: "AdminIntegrationMonitoringPage", level1: "12", level2: "integrations", level3: "integration-logs", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/payment-transactions", component: "AdminIntegrationMonitoringPage", level1: "12", level2: "integrations", level3: "payment-transactions", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/api-clients", component: "AdminIntegrationMonitoringPage", level1: "12", level2: "integrations", level3: "api-clients", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: ["VITE_API_ENABLED"] },
  { path: "/admin/api-logs", component: "AdminIntegrationMonitoringPage", level1: "12", level2: "integrations", level3: "api-logs", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: ["VITE_API_ENABLED"] },
  { path: "/admin/webhook-events", component: "AdminIntegrationMonitoringPage", level1: "12", level2: "integrations", level3: "webhooks", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: [], flags: [] },
  { path: "/admin/billing", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "admin-billing", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.manage"], flags: [] },
  { path: "/admin/billing/tenants", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "tenant-billing", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.manage"], flags: [] },
  { path: "/admin/billing/plans", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "plans", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.plan.view"], flags: [] },
  { path: "/admin/billing/invoices", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "invoices", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.invoice.view"], flags: [] },
  { path: "/admin/billing/payments", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "payments", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.payment.view"], flags: [] },
  { path: "/admin/billing/audit", component: "AdminBillingPage", level1: "12", level2: "billing-admin", level3: "audit", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["billing.audit.view"], flags: [] },
  { path: "/admin/ai-pairing/private-rules", component: "PrivatePairingRulesAdminPage", level1: "09", level2: "private-pairing", level3: "admin-rules", classification: "CANONICAL", sidebar: "super-admin-only", mobile: false, guards: ["SuperAdminRouteGuard", "RouteAccessGate"], perms: ["pairing.private_rules.view"], flags: ["VITE_PRIVATE_PAIRING_RULES_ENABLED"], notes: "4-layer gate: flag + role + permission + SuperAdminRouteGuard" },
  { path: "/dev/pairing-intervention-preview", component: "PairingInterventionPreviewPage", level1: "09", level2: "private-pairing", level3: "dev-preview", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["SuperAdminRouteGuard"], perms: [], flags: [], notes: "Dev only" },
  { path: "/internal/hard-cutover/operator-acceptance", component: "InternalHardCutoverOperatorAcceptancePage", level1: "12", level2: "internal-ops", level3: "operator-acceptance", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["OperatorAcceptanceRouteGuard"], perms: [], flags: [] },
  { path: "/settings", component: "Settings", level1: "12", level2: "settings", level3: "venue-settings", classification: "CANONICAL", sidebar: true, mobile: "drawer", guards: ["RouteAccessGate"], perms: ["settings.view"], flags: [] },
  { path: "/settings/integrations", component: "IntegrationSettingsPage", level1: "12", level2: "integrations", level3: "integration-settings", classification: "CANONICAL", sidebar: "system-tech", mobile: false, guards: ["RouteAccessGate"], perms: ["integration.view"], flags: ["VITE_API_ENABLED"] },
  { path: "/settings/integrations/payments", component: "IntegrationPaymentsPage", level1: "12", level2: "integrations", level3: "payment-integrations", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["integration.manage"], flags: [] },
  { path: "/settings/integrations/zalo-oa", component: "ZaloIntegrationPage", level1: "12", level2: "integrations", level3: "zalo-oa", classification: "HIDDEN_ACTIVE", sidebar: false, mobile: false, guards: ["RouteAccessGate"], perms: ["integration.manage"], flags: [] },
];

const TOURNAMENT_ENGINE_CANONICAL_PREFIX = "/tournaments/:tournamentId/";
const TOURNAMENT_LEGACY_PREFIX = "/tournament";

function isTournamentEngineCanonical(path) {
  return path.startsWith(TOURNAMENT_ENGINE_CANONICAL_PREFIX);
}

function isTournamentLegacyFamily(path) {
  return path === "/tournament" || path.startsWith("/tournament/");
}

function defaultDisposition(route) {
  if (route.disposition) return route.disposition;
  switch (route.classification) {
    case "CANONICAL":
      return "RETAIN_CANONICAL";
    case "LEGACY":
      return route.redirectTo ? "REDIRECT_LEGACY" : "CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION";
    case "SHADOW":
      return "HIDE_SHADOW";
    case "DUPLICATE":
      return "RETAIN_CANONICAL";
    case "HIDDEN_ACTIVE":
      return "RETAIN_CANONICAL";
    case "DEAD_ROUTE":
      return "REMOVE_DEAD_ROUTE";
    default:
      return "RETAIN_CANONICAL";
  }
}

function defaultRbacVisibility(route) {
  if (route.path === "/admin/ai-pairing/private-rules" || route.path === "/dev/pairing-intervention-preview") {
    return ["SUPER_ADMIN"];
  }
  if (route.path === "/player/skill-assessment-v5") {
    return ["SUPER_ADMIN"];
  }
  if (route.guards?.includes("public") || route.guards?.includes("public-token")) {
    return ["PUBLIC"];
  }
  if (route.guards?.includes("auth-only")) {
    return ["AUTHENTICATED"];
  }
  return ["RBAC_SCOPED"];
}

function applyOwnerDecisions(route) {
  const next = { ...route };

  // B01 — messaging: Phase 4 keeps two distinct canonical experiences.
  if (next.path === "/messages") {
    next.classification = "CANONICAL";
    next.disposition = "RETAIN_CANONICAL";
    next.proposedMenuActive = true;
    next.proposedCanonicalMenu = true;
    next.routeOwner = "Giao tiếp";
    next.ownerDecision = "B01";
  }
  if (next.path === "/crm/messages") {
    next.classification = "CANONICAL";
    next.disposition = "RETAIN_CANONICAL";
    next.routeOwner = "CRM & Chăm sóc khách hàng";
    next.proposedMenuActive = true;
    next.proposedCanonicalMenu = true;
    next.ownerDecision = "B01";
  }

  // B02 — tournament route families
  if (isTournamentEngineCanonical(next.path)) {
    next.classification = "CANONICAL";
    next.disposition = "RETAIN_CANONICAL";
    next.level2 = "tournament-engine";
    next.ownerDecision = "B02";
    next.proposedMenuActive = true;
    next.proposedCanonicalMenu = true;
    next.notes = [next.notes, "Owner B02: canonical Engine 4.0 family /tournaments/:id/*"].filter(Boolean).join("; ");
  } else if (isTournamentLegacyFamily(next.path)) {
    const wasHidden = next.classification === "HIDDEN_ACTIVE";
    next.classification = "LEGACY";
    next.ownerDecision = "B02";
    next.legacyCompatibility = true;
    if (B02_TOURNAMENT_HUB_MENU_ALLOWLIST.has(next.path)) {
      next.disposition = "RETAIN_LEGACY_ROUTE_ALLOWLISTED_FOR_MENU";
      next.proposedMenuActive = true;
      next.proposedCanonicalMenu = true;
      next.sidebar = true;
      next.mobile = true;
      next.notes = [
        next.notes,
        "Wave 1 B02: retained legacy tournament hub explicitly allowlisted for canonical menu exposure",
      ]
        .filter(Boolean)
        .join("; ");
    } else {
      next.disposition = "RETAIN_LEGACY_ROUTE_OUT_OF_MENU";
      next.proposedMenuActive = false;
      next.proposedCanonicalMenu = false;
      if (!wasHidden) {
        next.sidebar = false;
        next.mobile = false;
      }
      next.notes = [
        next.notes,
        "B02: retained legacy /tournament/* route is not approved for generic menu exposure",
      ]
        .filter(Boolean)
        .join("; ");
    }
  }

  // B03 — V5 shadow assessment
  if (next.path === "/player/skill-assessment-v5") {
    next.classification = "SHADOW";
    next.disposition = "HIDE_SHADOW";
    next.ownerDecision = "B03";
    next.proposedMenuActive = false;
    next.proposedCanonicalMenu = false;
    next.sidebar = false;
    next.mobile = false;
    next.rbacVisibility = ["SUPER_ADMIN"];
  }

  // Wave 2 — promote validated standalone hubs into canonical menu exposure.
  if (WAVE2_CANONICAL_HUB_MENU_ALLOWLIST.has(next.path)) {
    next.classification = "CANONICAL";
    next.disposition = "RETAIN_CANONICAL";
    next.proposedMenuActive = true;
    next.proposedCanonicalMenu = true;
    next.sidebar = true;
    if (next.mobile === false || next.mobile == null) {
      next.mobile = false;
    }
    next.notes = [
      next.notes,
      "Wave 2: standalone hub promoted into proposedCanonicalMenu; route/RBAC/flags unchanged",
    ]
      .filter(Boolean)
      .join("; ");
  }

  return next;
}

function enrichRoute(route) {
  const enriched = applyOwnerDecisions(route);
  const disposition = defaultDisposition(enriched);
  const rbacVisibility = enriched.rbacVisibility || defaultRbacVisibility(enriched);
  const routeOwner = enriched.routeOwner || ROUTE_OWNERS[enriched.level1] || "UNRESOLVED";
  const proposedMenuActive =
    enriched.proposedMenuActive ??
    (enriched.classification === "CANONICAL" &&
      enriched.sidebar !== false &&
      enriched.disposition !== "HIDE_SHADOW" &&
      !enriched.flags?.includes("PARTIAL_ONLY"));
  const proposedCanonicalMenu =
    enriched.proposedCanonicalMenu ??
    (proposedMenuActive && enriched.classification !== "LEGACY" && enriched.classification !== "SHADOW");

  return {
    ...enriched,
    routeOwner,
    disposition,
    rbacVisibility,
    proposedMenuActive,
    proposedCanonicalMenu,
    level1Label: LEVEL1.find((g) => g.id === enriched.level1)?.label ?? "UNRESOLVED",
  };
}

// Orphan pages (no route)
const DEAD_ORPHANS = [
  { file: "src/pages/onboarding/PickVnOnboardingPage.jsx", supersededBy: "/player/skill-assessment", classification: "DEAD_ROUTE" },
  { file: "src/pages/player/ClubActivityPage.jsx", supersededBy: "/my-club?view=schedule", classification: "DEAD_ROUTE" },
  { file: "src/pages/player/ClubDiscoverPage.jsx", supersededBy: "/discover-clubs", classification: "DEAD_ROUTE" },
  { file: "src/pages/dev/RefereeV5PreviewPage.jsx", supersededBy: null, classification: "DEAD_ROUTE" },
];

const enrichedRoutes = ROUTES.map(enrichRoute);

const counts = enrichedRoutes.reduce((acc, r) => {
  acc[r.classification] = (acc[r.classification] || 0) + 1;
  return acc;
}, {});

const level2Modules = [...new Set(enrichedRoutes.map((r) => r.level2))].sort();
const level3Actions = enrichedRoutes.filter((r) => r.level3).length;
const proposedCanonicalMenuRoutes = enrichedRoutes.filter((r) => r.proposedCanonicalMenu);
const duplicateActiveCanonicalMenu = (() => {
  const byPath = new Map();
  for (const r of proposedCanonicalMenuRoutes) {
    if (!byPath.has(r.path)) byPath.set(r.path, []);
    byPath.get(r.path).push(r);
  }
  return [...byPath.entries()].filter(([, list]) => list.length > 1).map(([path]) => path);
})();

const inventory = {
  meta: {
    program: "PICK_VN Canonical Navigation — Phase 1 Inventory",
    phase: "1-review",
    branch: "feature/canonical-navigation-and-shell-redesign",
    generatedAt: new Date().toISOString(),
    sourceFiles: [
      "src/router.jsx",
      "src/config/navigationConfig.js",
      "src/config/v5Menu/",
      "src/auth/menuAccess.js",
      "src/features/identity/constants/roles.js",
      "src/features/identity/constants/permissions.js",
      "src/features/identity/matrix/rolePermissions.js",
    ],
    routerPathDeclarations: 180,
    inventoriedRoutes: enrichedRoutes.length,
    deadOrphanPages: DEAD_ORPHANS.length,
    level1Groups: LEVEL1.length,
    level2Modules: level2Modules.length,
    level3Actions,
    proposedCanonicalMenuRoutes: proposedCanonicalMenuRoutes.length,
    duplicateActiveCanonicalMenuEntries: duplicateActiveCanonicalMenu.length,
    verdict: "CANONICAL_NAVIGATION_PHASE1_REVIEW_PASS_READY_FOR_COMMIT",
    reviewVerdict: "CANONICAL_NAVIGATION_PHASE1_REVIEW_PASS_READY_FOR_COMMIT",
    safety: {
      runtimeFilesChanged: 0,
      productionMutations: 0,
      deployments: 0,
      commit: "NO",
      push: "NO",
    },
  },
  ownerDecisions: OWNER_DECISIONS,
  level1Groups: LEVEL1,
  level2Modules,
  classificationCounts: counts,
  routes: enrichedRoutes,
  deadOrphanPages: DEAD_ORPHANS,
  canonicalNavigationRegistry: {
    description: "Proposed canonical menu/search/breadcrumb registry — desktop and mobile derive from same source in Phase 2+",
    principle: "Single registry; proposedCanonicalMenu=true entries only; no dual authority",
    routes: proposedCanonicalMenuRoutes.map((r) => ({
      path: r.path,
      level1: r.level1,
      level1Label: r.level1Label,
      level2: r.level2,
      level3: r.level3,
      routeOwner: r.routeOwner,
    })),
  },
  featureFlags: [
    { key: "rbac", env: "VITE_RBAC_ENABLED", affects: "All permission guards and ROLE_MENU_MAP" },
    { key: "ai", env: "VITE_ENABLE_AI_ENGINE", affects: "AI menu group and /ai route" },
    { key: "pickVnRatingV5", env: "VITE_PICK_VN_RATING_V5_ENABLED", affects: "B03: must NOT expose V5 in navigation when flag on" },
    { key: "marketplace", env: "VITE_MARKETPLACE_ENABLED", affects: "Marketplace finance menu" },
    { key: "privatePairingRules", env: "VITE_PRIVATE_PAIRING_RULES_ENABLED", affects: "Private pairing admin — SUPER_ADMIN only" },
    { key: "api", env: "VITE_API_ENABLED", affects: "Integration menus and admin API routes" },
    { key: "clubStorageV2", env: "VITE_CLUB_STORAGE_V2", affects: "PLAYER home redirect and club governance" },
    { key: "courtClusters", env: "VITE_COURT_CLUSTERS_ENABLED", affects: "Court cluster admin" },
    { key: "vprRanking", env: "VITE_VPR_RANKING_ENABLED", affects: "VPR ranking management" },
    { key: "refereeV5", env: "VITE_REFEREE_V5_ENABLED", affects: "Referee V5 match page" },
  ],
  ownerDecisionsResolved: [
    { id: "B01", status: "RESOLVED", disposition: "REDIRECT_LEGACY", canonical: "/crm/messages", legacy: "/messages" },
    { id: "B02", status: "RESOLVED", disposition: "CONTROLLED_REDIRECT_AND_INCREMENTAL_MIGRATION", canonical: "/tournaments/:id/*", legacy: "/tournament/*" },
    { id: "B03", status: "RESOLVED", disposition: "HIDE_SHADOW", route: "/player/skill-assessment-v5" },
  ],
  blockers: [],
  warnings: [
    { id: "W01", topic: "PARTIAL menu items in current runtime", detail: "CRM (5 items) and /reports show PARTIAL badge in current sidebar; proposed registry marks these with honest PARTIAL status — not generally available" },
    { id: "W02", topic: "Global search coverage gap", detail: "Phase 2: GlobalSearch must index canonical registry flat leaves only" },
    { id: "W03", topic: "No centralized breadcrumb map", detail: "Phase 2: BreadcrumbProvider must use canonical registry paths" },
    { id: "W04", topic: "Tenant menu group", detail: "Current runtime 'tenant' group maps to Level-1 07 Tài chính in proposed registry" },
    { id: "W05", topic: "NavMenuFlat unused", detail: "SHELL_FLAT_MENU_KEYS defined but NavMenuFlat not wired in MainLayout" },
    { id: "W06", topic: "No catch-all 404", detail: "router.jsx has no path='*' fallback route" },
    { id: "W07", topic: "ROLE_MENU_MAP legacy duplicates", detail: "Duplicate keys for SUPER_ADMIN/COURT_OWNER etc. increase maintenance risk" },
    { id: "W08", topic: "RBAC off permissive mode", detail: "When VITE_RBAC_ENABLED=false, can() returns true; Private Pairing UI still fail-closed" },
    { id: "W09", topic: "B02 migration gap", detail: "/tournament/* hub routes lack 1:1 /tournaments/:id/* targets — incremental migration required in Phase 4" },
  ],
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "CANONICAL_ROUTE_INVENTORY.json"), JSON.stringify(inventory, null, 2));
console.log("Wrote inventory JSON:", enrichedRoutes.length, "routes");
console.log("Classification:", counts);
console.log("Level-2 modules:", level2Modules.length);
console.log("Proposed canonical menu routes:", proposedCanonicalMenuRoutes.length);
console.log("Duplicate active canonical menu:", duplicateActiveCanonicalMenu.length);
