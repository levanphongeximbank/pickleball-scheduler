/**
 * Experience Channel registry (EC-00).
 * Frozen descriptors only — no page/router/provider imports.
 */

import {
  EXPERIENCE_CHANNEL_CATEGORY,
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS,
  EXPERIENCE_CHANNEL_READINESS,
  EXPERIENCE_CHANNEL_SURFACE,
  EXPERIENCE_CHANNEL_VISIBILITY,
  EXPERIENCE_PROVIDER_DEPENDENCY,
} from "../constants/index.js";
import { createExperienceChannelDescriptor, deepFreeze } from "../contracts/index.js";

const WEB_PWA_FUTURE = Object.freeze([
  EXPERIENCE_CHANNEL_SURFACE.WEB,
  EXPERIENCE_CHANNEL_SURFACE.PWA,
  EXPERIENCE_CHANNEL_SURFACE.IOS_FUTURE,
  EXPERIENCE_CHANNEL_SURFACE.ANDROID_FUTURE,
]);

const WEB_PWA = Object.freeze([
  EXPERIENCE_CHANNEL_SURFACE.WEB,
  EXPERIENCE_CHANNEL_SURFACE.PWA,
]);

/**
 * Deterministic channel order (stable for certification snapshots).
 */
export const EXPERIENCE_CHANNEL_REGISTRY_ORDER = Object.freeze([
  EXPERIENCE_CHANNEL_ID.EXPERIENCE_CHANNELS_FOUNDATION,
  EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
  EXPERIENCE_CHANNEL_ID.AUTH,
  EXPERIENCE_CHANNEL_ID.APP_SHELL,
  EXPERIENCE_CHANNEL_ID.DASHBOARD,
  EXPERIENCE_CHANNEL_ID.PLAYER,
  EXPERIENCE_CHANNEL_ID.CLUB,
  EXPERIENCE_CHANNEL_ID.VENUE_OPS,
  EXPERIENCE_CHANNEL_ID.CUSTOMER_OPS,
  EXPERIENCE_CHANNEL_ID.NOTIFICATIONS,
  EXPERIENCE_CHANNEL_ID.MESSAGING,
  EXPERIENCE_CHANNEL_ID.MOBILE,
  EXPERIENCE_CHANNEL_ID.PWA,
  EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS,
  EXPERIENCE_CHANNEL_ID.PLATFORM_ADMIN,
  EXPERIENCE_CHANNEL_ID.COMPETITION_ENGINE_E2E,
]);

const CHANNEL_DESCRIPTORS = deepFreeze({
  [EXPERIENCE_CHANNEL_ID.EXPERIENCE_CHANNELS_FOUNDATION]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.EXPERIENCE_CHANNELS_FOUNDATION,
    name: "Experience Channels Foundation",
    category: EXPERIENCE_CHANNEL_CATEGORY.FOUNDATION,
    intendedAudience: "Platform architects and Experience Channel implementers",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PLATFORM_ADMIN,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "(none — contracts only)",
    shellOwner: "none",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.OWNED,
    readiness: EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.FOUNDATION_ONLY,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.SAFE_CHANNEL_FOUNDATION,
    ownerModule: "src/features/experience-channels",
    notes: "EC-00 contracts/registry. Not wired into router, main.jsx, or provider tree.",
  }),

  [EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    name: "Public Portal",
    category: EXPERIENCE_CHANNEL_CATEGORY.PUBLIC,
    intendedAudience: "Anonymous visitors and public discovery users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/|/home|/tournaments|/clubs|/courts|/rankings|/news|/athletes",
    shellOwner: "src/layouts/public/PublicLayout.jsx",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/pages/public + src/features/public-portal",
    notes: "Live-first publicPortalService with mock fallback (MOCK_OR_PREVIEW data path).",
  }),

  [EXPERIENCE_CHANNEL_ID.AUTH]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.AUTH,
    name: "Authentication Screens",
    category: EXPERIENCE_CHANNEL_CATEGORY.AUTHENTICATION,
    intendedAudience: "Unauthenticated and password-reset users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    supportedSurfaces: WEB_PWA,
    routeNamespace: "/login|/forgot-password|/reset-password|/change-password|/403",
    shellOwner: "standalone (no MainLayout)",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/pages auth + src/features/identity",
  }),

  [EXPERIENCE_CHANNEL_ID.APP_SHELL]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.APP_SHELL,
    name: "Authenticated App Shell",
    category: EXPERIENCE_CHANNEL_CATEGORY.APP_SHELL,
    intendedAudience: "Authenticated tenant users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "(MainLayout wrap — global)",
    shellOwner: "src/layouts/MainLayout.jsx",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    readiness: EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    ownerModule: "src/layouts/MainLayout.jsx + Sidebar/Header",
    notes: "EC-00 must not edit shell. Future channel UX adopts shell boundaries via registry.",
    deferReason: "Global shared high-collision shell — deferred for EC runtime wiring.",
  }),

  [EXPERIENCE_CHANNEL_ID.DASHBOARD]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.DASHBOARD,
    name: "Dashboard",
    category: EXPERIENCE_CHANNEL_CATEGORY.DASHBOARD,
    intendedAudience: "Authenticated operators and club staff",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/dashboard|/dashboard/rankings",
    shellOwner: "src/layouts/MainLayout.jsx",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/pages/Dashboard + src/features/dashboard-analytics",
  }),

  [EXPERIENCE_CHANNEL_ID.PLAYER]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.PLAYER,
    name: "Player Experience",
    category: EXPERIENCE_CHANNEL_CATEGORY.PLAYER,
    intendedAudience: "Players and athletes",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/players*|/player/*|/athletes*|/profile",
    shellOwner: "src/layouts/MainLayout.jsx (+ PublicLayout for /athletes)",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/pages/player + src/features/player",
  }),

  [EXPERIENCE_CHANNEL_ID.CLUB]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.CLUB,
    name: "Club Experience",
    category: EXPERIENCE_CHANNEL_CATEGORY.CLUB,
    intendedAudience: "Club members and club managers",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/my-club*|/discover-clubs|/manage/clubs*|/club|/platform/clubs",
    shellOwner: "src/layouts/MainLayout.jsx",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/features/club + club pages",
    notes: "Public /clubs is owned by public-portal; manage/my-club are authenticated club surfaces.",
  }),

  [EXPERIENCE_CHANNEL_ID.VENUE_OPS]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.VENUE_OPS,
    name: "Venue / Court Operations",
    category: EXPERIENCE_CHANNEL_CATEGORY.VENUE,
    intendedAudience: "Venue operators",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/court-management/*|/admin/hours|/admin/court-clusters",
    shellOwner: "src/layouts/MainLayout.jsx + CourtManagementLayout",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/features/venue-court + court-management pages",
  }),

  [EXPERIENCE_CHANNEL_ID.CUSTOMER_OPS]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.CUSTOMER_OPS,
    name: "Customer Operations UI",
    category: EXPERIENCE_CHANNEL_CATEGORY.CUSTOMER,
    intendedAudience: "Venue staff managing customers",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED,
    supportedSurfaces: WEB_PWA,
    routeNamespace: "/court-management/customers",
    shellOwner: "CourtManagementLayout",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.LEGACY_ACTIVE,
    ownerModule: "src/features/customer (domain) + court-management customers UI",
    notes: "Customer domain is foundation-safe; UI remains under venue ops layout.",
  }),

  [EXPERIENCE_CHANNEL_ID.NOTIFICATIONS]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.NOTIFICATIONS,
    name: "Notification Presentation",
    category: EXPERIENCE_CHANNEL_CATEGORY.NOTIFICATION,
    intendedAudience: "Authenticated users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/notifications|/mobile/notifications",
    shellOwner: "MainLayout / Mobile shell",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/pages/NotificationCenterPage + src/features/notifications (presentation)",
    notes: "Notification backend/delivery remains owned by Notification module — EC owns presentation inventory only.",
  }),

  [EXPERIENCE_CHANNEL_ID.MESSAGING]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.MESSAGING,
    name: "Messaging Experience",
    category: EXPERIENCE_CHANNEL_CATEGORY.MESSAGING,
    intendedAudience: "Authenticated messaging users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/messages",
    shellOwner: "MainLayout + MessagingShell",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/features/communication/experience",
    notes: "COMMS already delivered messaging experience; EC owns cross-channel architecture map.",
  }),

  [EXPERIENCE_CHANNEL_ID.MOBILE]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.MOBILE,
    name: "Mobile Shell Experience",
    category: EXPERIENCE_CHANNEL_CATEGORY.MOBILE,
    intendedAudience: "Mobile web / PWA users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    supportedSurfaces: WEB_PWA_FUTURE,
    routeNamespace: "/mobile/*",
    shellOwner: "MobileBottomNav + MobileDrawer + MobileRouteGate",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    ownerModule: "src/features/mobile",
    notes: "Native iOS/Android store release not started — future surfaces are metadata only.",
  }),

  [EXPERIENCE_CHANNEL_ID.PWA]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.PWA,
    name: "PWA Runtime",
    category: EXPERIENCE_CHANNEL_CATEGORY.PWA,
    intendedAudience: "Installable web app users",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    supportedSurfaces: Object.freeze([
      EXPERIENCE_CHANNEL_SURFACE.PWA,
      EXPERIENCE_CHANNEL_SURFACE.WEB,
      EXPERIENCE_CHANNEL_SURFACE.IOS_FUTURE,
      EXPERIENCE_CHANNEL_SURFACE.ANDROID_FUTURE,
    ]),
    routeNamespace: "(service-worker / manifest — bootstrap)",
    shellOwner: "vite-plugin-pwa + src/main.jsx registerSW",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    ownerModule: "public/manifest* + vite PWA + main.jsx registration",
    notes: "EC-00 must not change PWA registration entrypoint.",
    deferReason: "PWA registration lives in global high-collision entrypoint (src/main.jsx).",
  }),

  [EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS,
    name: "Tournament Operations UI",
    category: EXPERIENCE_CHANNEL_CATEGORY.TOURNAMENT,
    intendedAudience: "Tournament directors, referees, team captains",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.TENANT_SCOPED,
    supportedSurfaces: WEB_PWA,
    routeNamespace:
      "/tournament*|/tournaments/:id/*|/daily-play|/team-portal/*|/team-referee/*|/referee*",
    shellOwner: "MainLayout (+ token referee standalone)",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    readiness: EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.LEGACY,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED,
    ownerModule: "src/pages/tournament + tournament/team features",
    notes: "Active competition UX on main. Competition Engine E2E owns engine integration, not these pages.",
    deferReason:
      "Legacy-active tournament UI; high collision with Competition workstreams. EC must not edit in EC-00.",
  }),

  [EXPERIENCE_CHANNEL_ID.PLATFORM_ADMIN]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.PLATFORM_ADMIN,
    name: "Platform Admin",
    category: EXPERIENCE_CHANNEL_CATEGORY.PLATFORM_ADMIN,
    intendedAudience: "Platform administrators",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PLATFORM_ADMIN,
    supportedSurfaces: WEB_PWA,
    routeNamespace: "/admin/*|/users*|/audit|/billing/*|/settings*",
    shellOwner: "src/layouts/MainLayout.jsx",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    readiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.ACTIVE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.LEGACY_ACTIVE,
    ownerModule: "admin/settings/billing pages + identity admin",
  }),

  [EXPERIENCE_CHANNEL_ID.COMPETITION_ENGINE_E2E]: createExperienceChannelDescriptor({
    channelId: EXPERIENCE_CHANNEL_ID.COMPETITION_ENGINE_E2E,
    name: "Competition Engine E2E Integration",
    category: EXPERIENCE_CHANNEL_CATEGORY.COMPETITION_ENGINE,
    intendedAudience: "Competition Engine integrators (non-UX)",
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PLATFORM_ADMIN,
    supportedSurfaces: Object.freeze([EXPERIENCE_CHANNEL_SURFACE.WEB]),
    routeNamespace: "(none — no UX routes on main)",
    shellOwner: "none",
    providerDependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    readiness: EXPERIENCE_CHANNEL_READINESS.DEFERRED,
    implementationStatus: EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS.OWNED_ELSEWHERE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.COMPETITION_E2E_OWNED,
    ownerModule: "src/features/competition-engine (feature/competition-e2e-01-*)",
    notes: "Marker only. EC must not open or edit Competition E2E worktree files.",
    deferReason: "Owned by Competition E2E workstream; out of Experience Channels scope.",
  }),
});

/**
 * @returns {ReadonlyArray<Readonly<import("../contracts/channelDescriptor.js").ExperienceChannelDescriptorInput>>}
 */
export function listExperienceChannels() {
  return deepFreeze(
    EXPERIENCE_CHANNEL_REGISTRY_ORDER.map((id) => CHANNEL_DESCRIPTORS[id])
  );
}

/**
 * @param {unknown} channelId
 * @returns {Readonly<import("../contracts/channelDescriptor.js").ExperienceChannelDescriptorInput> | null}
 */
export function getExperienceChannel(channelId) {
  const id = String(channelId ?? "").trim();
  return CHANNEL_DESCRIPTORS[id] ?? null;
}

/**
 * @returns {Readonly<Record<string, Readonly<import("../contracts/channelDescriptor.js").ExperienceChannelDescriptorInput>>>}
 */
export function getExperienceChannelRegistryMap() {
  return CHANNEL_DESCRIPTORS;
}
