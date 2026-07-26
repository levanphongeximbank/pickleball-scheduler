/**
 * Public Portal surface registry (EC-01).
 * Frozen readiness inventory — no page/router/provider imports.
 */

import {
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_CHANNEL_READINESS,
  EXPERIENCE_CHANNEL_VISIBILITY,
} from "../../constants/index.js";
import { deepFreeze } from "../../contracts/shared.js";
import {
  PUBLIC_PORTAL_AUTH_DEPENDENCY,
  PUBLIC_PORTAL_BOUNDARY_ID,
  PUBLIC_PORTAL_COMPETITION_MARKER,
  PUBLIC_PORTAL_DATA_SOURCE,
  PUBLIC_PORTAL_SURFACE_ID,
  PUBLIC_PORTAL_TENANT_DEPENDENCY,
} from "../constants/index.js";
import {
  createPublicPortalBoundaryDescriptor,
  createPublicPortalSurfaceDescriptor,
} from "../contracts/index.js";

const SHELL = "src/layouts/public/PublicLayout.jsx";
const SERVICE = "src/features/public-portal/services/publicPortalService.js";
const MOCK = "src/data/public/mockPublicData.js";
const ROUTER = "src/router.jsx PublicLayout group";

/**
 * Deterministic surface order (stable for certification snapshots).
 */
export const PUBLIC_PORTAL_SURFACE_REGISTRY_ORDER = Object.freeze([
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_ROOT,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
  PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS,
]);

export const PUBLIC_PORTAL_BOUNDARY_REGISTRY_ORDER = Object.freeze([
  PUBLIC_PORTAL_BOUNDARY_ID.ATHLETES_DIRECTORY,
  PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW,
]);

const SURFACE_DESCRIPTORS = deepFreeze({
  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_ROOT]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_ROOT,
    routePattern: "/",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "Guest renders HomePage (mixed live/mock). Authenticated users Navigate to /dashboard — no portal data fetch while authLoading returns null.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.OPTIONAL_CONSUMED,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.NONE,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.NOT_VERIFIED,
    seoState: EXPERIENCE_CHANNEL_READINESS.MISSING,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.MISSING,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.MISSING,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.MISSING,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    deferReason: "",
    pagePathHint: "src/pages/public/PublicRootPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [ROUTER, "src/pages/public/PublicRootPage.jsx", SHELL],
    notes:
      "PWA start_url=/ interacts with auth redirect. Shell edits are GLOBAL_SHARED_HIGH_COLLISION.",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_HOME,
    routePattern: "/home",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "EC-05/EC-06: Home sections via publicHomeDataSource — reuses EC-03/04 Clubs/Courts/Tournaments results; mock live-scores/schedule/results/sponsors/events labeled MOCK; news projects NEWS-04 typed result without silent empty-on-error. EC-06: no certified remote LIVE cutover for composite Home.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.OPTIONAL_CONSUMED,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.CONSUMED_SHARED,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.PRESENTATION_ONLY,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    pagePathHint: "src/pages/public/HomePage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/HomePage.jsx",
      "src/features/public-portal/services/publicHomeDataSource.js",
      SERVICE,
      MOCK,
      "src/components/public/sections/HeroSection.jsx",
      "src/components/public/sections/LiveDataHubSection.jsx",
      "src/components/public/usePublicDocumentTitle.js",
    ],
    notes:
      "EC-05 data-source honesty: section provenance + PublicDataSourceNotice + EC-02 states. Presentation-only cards; no standings/scoring. Mock hub titles honest (no LIVE/HÔM NAY/MỚI NHẤT). Shell remains high-collision.",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_TOURNAMENTS,
    routePattern: "/tournaments",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "EC-04/EC-06: getPublicTournamentsResult via resolvePublicListDataResult — local club blob tournaments with mock fallback (min 3). MIXED when fallback used. EC-06: NO_REMOTE_SOURCE — mock fallback retained.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.CONSUMED_SHARED,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.PRESENTATION_ONLY,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.MISSING,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    pagePathHint: "src/pages/public/TournamentsPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/TournamentsPage.jsx",
      SERVICE,
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js",
      MOCK,
      "src/components/public/states/PublicPresentationStates.jsx",
      "src/components/public/states/PublicDataSourceNotice.jsx",
      "src/features/experience-channels/public-portal/data-source/",
    ],
    notes:
      "EC-04: PublicDataSourceNotice + error/empty/unavailable wired. Does not recalculate standings. Deep links stay on list (/tournaments). Competition /tournament/:id/public remains deferred. Loading still MISSING (sync).",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_CLUBS,
    routePattern: "/clubs",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "EC-03 local path + mock fallback retained for Production/Home. PUBLIC-PORTAL-01C: Clubs page may use Staging remote public_catalog_list_clubs when VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote (LIVE, no mock fallback, productionReady=false). EC-06 Production cutover still NO_REMOTE_SOURCE.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.CONSUMED_SHARED,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    pagePathHint: "src/pages/public/ClubsPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/ClubsPage.jsx",
      SERVICE,
      MOCK,
      "src/components/public/states/PublicPresentationStates.jsx",
      "src/components/public/states/PublicDataSourceNotice.jsx",
      "src/features/experience-channels/public-portal/data-source/",
      "docs/public-portal/public-portal-01c/",
    ],
    notes:
      "PUBLIC-PORTAL-01C: async Clubs page loader with PublicLoadingState; Staging remote opt-in. Production default remains local MIXED-capable path. Not Production-ready.",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_COURTS,
    routePattern: "/courts",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "EC-03 local path + mock fallback retained for Production/Home. PUBLIC-PORTAL-01C: Courts page may use Staging remote public_catalog_list_courts when VITE_PUBLIC_CLUBS_COURTS_SOURCE=remote (LIVE, no mock fallback, productionReady=false). EC-06 Production cutover still NO_REMOTE_SOURCE.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.CONSUMED_SHARED,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    pagePathHint: "src/pages/public/CourtsPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/CourtsPage.jsx",
      SERVICE,
      MOCK,
      "src/components/public/states/PublicPresentationStates.jsx",
      "src/components/public/states/PublicDataSourceNotice.jsx",
      "src/features/experience-channels/public-portal/data-source/",
      "docs/public-portal/public-portal-01c/",
    ],
    notes:
      "PUBLIC-PORTAL-01C: async Courts page loader with PublicLoadingState; Staging remote opt-in. Production default remains local MIXED-capable path. Not Production-ready.",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_RANKINGS,
    routePattern: "/rankings",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    dataSourceNotes:
      "EC-04/EC-06: getPublicRankingsResult — VPR flag off → explicit MOCK; VPR on → local leaderboard with MIXED mock fallback. EC-06: LIVE_SOURCE_NOT_CERTIFIED (not remote public RPC). UI presents canonical rows only.",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.NONE,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.PRESENTATION_ONLY,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.MISSING,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: false,
    pagePathHint: "src/pages/public/RankingsPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/RankingsPage.jsx",
      SERVICE,
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js",
      MOCK,
      "tests/ui/rankings.smoke.test.jsx",
      "src/components/public/states/PublicPresentationStates.jsx",
      "src/components/public/states/PublicDataSourceNotice.jsx",
      "src/features/experience-channels/public-portal/data-source/",
    ],
    notes:
      "EC-04: silent catch removed; PublicDataSourceNotice + error/empty/unavailable wired. Canonical rank order preserved. Loading still MISSING (sync). Not production-ready while MOCK/MIXED.",
  }),

  [PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS]: createPublicPortalSurfaceDescriptor({
    surfaceId: PUBLIC_PORTAL_SURFACE_ID.PUBLIC_NEWS,
    routePattern: "/news",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PUBLIC_PORTAL,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.PUBLIC,
    collisionClassification:
      EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    dataSource: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
    dataSourceNotes:
      "NEWS-04/EC-06: getPublicNews → News facade → news_public_content_query_public. Explicit mock/preview only; no silent fallback. EC-06: ALREADY_LIVE_NO_CHANGE (productionReady evidence incomplete for cutover claim).",
    authenticationDependency: PUBLIC_PORTAL_AUTH_DEPENDENCY.NONE,
    tenantDependency: PUBLIC_PORTAL_TENANT_DEPENDENCY.NONE,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
    responsiveState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    accessibilityState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    seoState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    loadingStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    errorStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    emptyStateReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    offlinePwaState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    testCoverageState: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    overallReadiness: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
    safeForRemediation: true,
    pagePathHint: "src/pages/public/NewsPage.jsx",
    shellPathHint: SHELL,
    evidenceReferences: [
      "src/pages/public/NewsPage.jsx",
      "src/features/public-portal/services/publicNewsService.js",
      SERVICE,
      "src/components/public/states/PublicPresentationStates.jsx",
      "docs/news-public-content/news-04/00_NEWS_04_ARCHITECTURE_DECISION.md",
    ],
    notes:
      "NEWS-04 live provenance adoption. MOCK/PREVIEW require explicit source. NEWS-05: implementation certified; Production not deployed.",
  }),
});

const BOUNDARY_DESCRIPTORS = deepFreeze({
  [PUBLIC_PORTAL_BOUNDARY_ID.ATHLETES_DIRECTORY]: createPublicPortalBoundaryDescriptor({
    boundaryId: PUBLIC_PORTAL_BOUNDARY_ID.ATHLETES_DIRECTORY,
    routePattern: "/athletes|/athletes/:playerId",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.PLAYER,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.CANONICAL_CHANNEL_SURFACE,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.NONE,
    safeForRemediation: false,
    deferReason:
      "Authenticated MainLayout + RouteAccessGate player directory — not anonymous Public Portal. EC-00 channelRegistry overclaims /athletes on PUBLIC_PORTAL; ownershipRegistry correctly assigns PLAYER.",
    evidenceReferences: [
      "src/pages/PublicPlayerDirectoryPage.jsx",
      "src/router.jsx /athletes*",
      "src/features/experience-channels/registry/ownershipRegistry.js",
    ],
    notes: "DUPLICATED ownership claim between channelRegistry routeNamespace and ownershipRegistry.",
  }),

  [PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW]: createPublicPortalBoundaryDescriptor({
    boundaryId: PUBLIC_PORTAL_BOUNDARY_ID.TOURNAMENT_PUBLIC_VIEW,
    routePattern: "/tournament/:tournamentId/public",
    ownerChannelId: EXPERIENCE_CHANNEL_ID.TOURNAMENT_OPS,
    visibility: EXPERIENCE_CHANNEL_VISIBILITY.AUTHENTICATED,
    collisionClassification: EXPERIENCE_CHANNEL_CLASSIFICATION.DEFERRED,
    competitionOwnershipMarker: PUBLIC_PORTAL_COMPETITION_MARKER.TOURNAMENT_OPS_DEFERRED,
    safeForRemediation: false,
    deferReason:
      "MainLayout-gated tournament ops UX; recalculates individual standings via individual-tournament helpers. Not Competition Engine module, but out of Public Portal remediation scope.",
    evidenceReferences: [
      "src/pages/tournament/IndividualTournamentPublicPage.jsx",
      "src/router.jsx /tournament/:tournamentId/public",
    ],
    notes:
      "No competition-engine imports observed; still DEFERRED for EC-01. Public portal cards do not deep-link here.",
  }),
});

/**
 * @returns {ReadonlyArray<Readonly<import("../contracts/publicPortalSurfaceDescriptor.js").PublicPortalSurfaceDescriptorInput>>}
 */
export function listPublicPortalSurfaces() {
  return deepFreeze(
    PUBLIC_PORTAL_SURFACE_REGISTRY_ORDER.map((id) => SURFACE_DESCRIPTORS[id])
  );
}

/**
 * @param {unknown} surfaceId
 * @returns {Readonly<import("../contracts/publicPortalSurfaceDescriptor.js").PublicPortalSurfaceDescriptorInput> | null}
 */
export function getPublicPortalSurface(surfaceId) {
  const id = String(surfaceId ?? "").trim();
  return SURFACE_DESCRIPTORS[id] ?? null;
}

/**
 * @returns {ReadonlyArray<Readonly<import("../contracts/publicPortalSurfaceDescriptor.js").PublicPortalBoundaryDescriptorInput>>}
 */
export function listPublicPortalBoundaryMarkers() {
  return deepFreeze(
    PUBLIC_PORTAL_BOUNDARY_REGISTRY_ORDER.map((id) => BOUNDARY_DESCRIPTORS[id])
  );
}

/**
 * @param {unknown} boundaryId
 * @returns {Readonly<import("../contracts/publicPortalSurfaceDescriptor.js").PublicPortalBoundaryDescriptorInput> | null}
 */
export function getPublicPortalBoundaryMarker(boundaryId) {
  const id = String(boundaryId ?? "").trim();
  return BOUNDARY_DESCRIPTORS[id] ?? null;
}

/**
 * SEO / PWA / shell shared evidence (global — not remediable in EC-01).
 */
export function getPublicPortalSharedReadinessEvidence() {
  return deepFreeze({
    seo: {
      state: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
      notes:
        "App-wide index.html title/description remain global. EC-02 adds page-local document.title via usePublicDocumentTitle on selected public pages. No Helmet, OG/Twitter, sitemap, or robots.",
      evidenceReferences: [
        "index.html",
        "src/components/public/usePublicDocumentTitle.js",
      ],
      remediableInEc01: false,
      deferReason:
        "Global SEO (Helmet/OG/sitemap/robots) needs high-collision entrypoints or new dependencies — deferred beyond EC-02 page-local titles.",
    },
    pwa: {
      state: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
      notes:
        "manifest.webmanifest start_url=/; vite-plugin-pwa + main.jsx registerSW. iOS/Android future surfaces are metadata only — not native store claims.",
      evidenceReferences: [
        "public/manifest.webmanifest",
        "vite.config.js VitePWA",
        "src/main.jsx registerSW",
      ],
      remediableInEc01: false,
      deferReason: "PWA registration is GLOBAL_SHARED_HIGH_COLLISION (src/main.jsx / vite.config.js).",
      nativeStoreRelease: false,
      iosReleasePercent: 0,
      androidReleasePercent: 0,
    },
    shell: {
      state: EXPERIENCE_CHANNEL_READINESS.IMPLEMENTED,
      notes: "PublicLayout + PublicHeader/Footer with landmarks (header/main/footer pattern via AppBar + main Box).",
      evidenceReferences: [
        SHELL,
        "src/components/public/PublicHeader.jsx",
        "src/components/public/PublicFooter.jsx",
      ],
      remediableInEc01: false,
      deferReason: "PublicLayout.jsx listed in EXPERIENCE_GLOBAL_HIGH_COLLISION_FILES.",
    },
    orphanComponents: {
      state: EXPERIENCE_CHANNEL_READINESS.PARTIAL,
      notes: "EcosystemCard.jsx and LiveScorePreview.jsx exist under components/public but are unused by pages/public.",
      evidenceReferences: [
        "src/components/public/sections/EcosystemCard.jsx",
        "src/components/public/sections/LiveScorePreview.jsx",
      ],
      remediableInEc01: false,
      deferReason: "Cleanup deferred — visual/runtime change outside certification-only slice.",
    },
  });
}
