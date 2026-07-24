/**
 * Route / shell / provider ownership map (EC-00).
 * Path hints are evidence strings only — not imported modules.
 */

import {
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_PROVIDER_DEPENDENCY,
} from "../constants/index.js";
import {
  createProviderOwnershipDescriptor,
  createRouteOwnershipDescriptor,
  createShellOwnershipDescriptor,
  deepFreeze,
} from "../contracts/index.js";

const ROUTE_OWNERSHIP = deepFreeze([
  createRouteOwnershipDescriptor({
    routeNamespace: "/home|/tournaments|/clubs|/courts|/rankings|/news",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    notes: "PublicLayout group in src/router.jsx",
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/login|/forgot-password|/reset-password|/change-password|/403",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.AUTH,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/dashboard*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.DASHBOARD,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/players*|/player/*|/athletes*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PLAYER,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/my-club*|/discover-clubs|/manage/clubs*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.CLUB,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/court-management/*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.VENUE_OPS,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/notifications|/mobile/notifications",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.NOTIFICATIONS,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/messages",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.MESSAGING,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/mobile/*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.MOBILE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/tournament*|/daily-play|/team-portal/*|/team-referee/*|/referee*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED,
    notes: "Deferred for EC edits; active legacy tournament UX.",
  }),
  createRouteOwnershipDescriptor({
    routeNamespace: "/admin/*|/users*|/audit|/billing/*|/settings*",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PLATFORM_ADMIN,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.LEGACY_ACTIVE,
  }),
]);

const SHELL_OWNERSHIP = deepFreeze([
  createShellOwnershipDescriptor({
    shellId: "public-layout",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    pathHints: ["src/layouts/public/PublicLayout.jsx"],
  }),
  createShellOwnershipDescriptor({
    shellId: "main-layout",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.APP_SHELL,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    pathHints: ["src/layouts/MainLayout.jsx", "src/components/Sidebar.jsx"],
    notes: "EC-00 must not modify.",
  }),
  createShellOwnershipDescriptor({
    shellId: "mobile-chrome",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.MOBILE,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    pathHints: [
      "src/features/mobile/layout/MobileBottomNav.jsx",
      "src/features/mobile/layout/MobileDrawer.jsx",
    ],
  }),
  createShellOwnershipDescriptor({
    shellId: "messaging-shell",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.MESSAGING,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    pathHints: ["src/features/communication/experience/components/MessagingShell.jsx"],
  }),
]);

const PROVIDER_OWNERSHIP = deepFreeze([
  createProviderOwnershipDescriptor({
    providerId: "theme-bootstrap",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    pathHints: ["src/main.jsx", "src/theme/theme.js"],
  }),
  createProviderOwnershipDescriptor({
    providerId: "platform-runtime",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    pathHints: ["src/core/platform/app/PlatformRuntimeProvider.jsx"],
  }),
  createProviderOwnershipDescriptor({
    providerId: "auth",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    pathHints: ["src/context/AuthContext.jsx", "src/router.jsx"],
  }),
  createProviderOwnershipDescriptor({
    providerId: "tenant-club-season",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.FORBIDDEN_FOR_EC00,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.GLOBAL_SHARED_HIGH_COLLISION,
    pathHints: ["src/layouts/MainLayout.jsx"],
  }),
  createProviderOwnershipDescriptor({
    providerId: "notification-runtime",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.DEFERRED,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED,
    pathHints: ["src/features/notifications/runtime/NotificationRuntimeProvider.jsx"],
    notes: "Presentation inventory only in EC-00; runtime provider edits deferred.",
  }),
  createProviderOwnershipDescriptor({
    providerId: "communication-runtime",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.DEFERRED,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED,
    pathHints: ["src/features/communication/runtime/CommunicationRuntimeProvider.jsx"],
  }),
  createProviderOwnershipDescriptor({
    providerId: "messaging-experience",
    dependency: EXPERIENCE_PROVIDER_DEPENDENCY.CONSUMED_SHARED,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    pathHints: ["src/features/communication/experience/MessagingExperienceProvider.jsx"],
  }),
]);

/**
 * High-collision files EC-00 must not modify.
 */
export const EXPERIENCE_GLOBAL_HIGH_COLLISION_FILES = Object.freeze([
  "src/main.jsx",
  "src/App.jsx",
  "src/router.jsx",
  "src/layouts/MainLayout.jsx",
  "src/layouts/public/PublicLayout.jsx",
  "src/components/Sidebar.jsx",
  "src/theme/theme.js",
  "package.json",
  "package-lock.json",
  "vite.config.js",
]);

/**
 * Competition E2E ownership markers (do not edit from EC).
 */
export const EXPERIENCE_COMPETITION_E2E_OWNED_PATH_HINTS = Object.freeze([
  "src/features/competition-engine/",
  "docs/competition-engine/e2e-01/",
  "tests/competition-engine-e2e-01-integration-foundation.test.js",
]);

export function listRouteOwnership() {
  return ROUTE_OWNERSHIP;
}

export function listShellOwnership() {
  return SHELL_OWNERSHIP;
}

export function listProviderOwnership() {
  return PROVIDER_OWNERSHIP;
}

export function getOwnershipSnapshot() {
  return deepFreeze({
    routes: ROUTE_OWNERSHIP,
    shells: SHELL_OWNERSHIP,
    providers: PROVIDER_OWNERSHIP,
    globalHighCollisionFiles: EXPERIENCE_GLOBAL_HIGH_COLLISION_FILES,
    competitionE2eOwnedPathHints: EXPERIENCE_COMPETITION_E2E_OWNED_PATH_HINTS,
  });
}
