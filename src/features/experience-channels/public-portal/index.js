/**
 * Experience Channels — Public Portal readiness (EC-01).
 *
 * Certification contracts only. Not wired into router, main.jsx, App shell,
 * or provider trees. Reuses EC-00 channel IDs / classifications / readiness enums.
 *
 * Does NOT export React pages, router helpers, Competition Engine adapters,
 * or business ranking/scoring/standings logic.
 */

export const EXPERIENCE_CHANNELS_EC01_PHASE = Object.freeze({
  id: "EC-01",
  name: "public-portal-channel-readiness-certification",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  certificationComplete: true,
  uiRemediationInScope: false,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const EXPERIENCE_CHANNELS_EC03_PHASE = Object.freeze({
  id: "EC-03",
  name: "public-portal-data-source-honesty",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  dataResultContractComplete: true,
  clubsCourtsAdapterRemediation: true,
  tournamentsRankingsDeferred: true,
  mockFallbackRemoved: false,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const EXPERIENCE_CHANNELS_EC04_PHASE = Object.freeze({
  id: "EC-04",
  name: "public-portal-list-surface-data-honesty",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  reusesEc03DataResultContract: true,
  tournamentsRankingsAdapterRemediation: true,
  homeDeferred: true,
  mockFallbackRemoved: false,
  competitionPublicDetailUntouched: true,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const EXPERIENCE_CHANNELS_EC05_PHASE = Object.freeze({
  id: "EC-05",
  name: "public-portal-home-data-source-honesty",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  reusesEc03DataResultContract: true,
  reusesEc02PresentationStates: true,
  reusesEc03Ec04ListAdapters: true,
  homeDataHonestyRemediation: true,
  mockFallbackRemoved: false,
  liveCutover: false,
  competitionEngineUntouched: true,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const EXPERIENCE_CHANNELS_EC06_PHASE = Object.freeze({
  id: "EC-06",
  name: "public-portal-certified-live-cutover",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  reusesEc02PresentationStates: true,
  reusesEc03DataResultContract: true,
  reusesEc03Ec04Ec05Adapters: true,
  auditComplete: true,
  certifiedLiveCutoverCount: 0,
  mockFallbackRemoved: false,
  liveCutover: false,
  forcedUncertifiedLive: false,
  competitionEngineUntouched: true,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const PUBLIC_PORTAL_READINESS_PUBLIC_EXPORTS = Object.freeze([
  "EXPERIENCE_CHANNELS_EC01_PHASE",
  "EXPERIENCE_CHANNELS_EC03_PHASE",
  "EXPERIENCE_CHANNELS_EC04_PHASE",
  "EXPERIENCE_CHANNELS_EC05_PHASE",
  "EXPERIENCE_CHANNELS_EC06_PHASE",
  "PUBLIC_PORTAL_SURFACE_ID",
  "PUBLIC_PORTAL_DATA_SOURCE",
  "PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION",
  "PUBLIC_DATA_RESULT_STATUS",
  "listPublicPortalSurfaces",
  "getPublicPortalSurface",
  "listPublicPortalBoundaryMarkers",
  "getPublicPortalSharedReadinessEvidence",
  "certifyPublicPortalReadiness",
  "certifyPublicPortalLiveCutover",
  "listPublicPortalLiveCutoverMatrix",
  "createPublicPortalSurfaceDescriptor",
  "createLiveResult",
  "certifyPublicDataResult",
]);

export {
  PUBLIC_PORTAL_DATA_SOURCE,
  PUBLIC_PORTAL_DATA_SOURCE_VALUES,
  isPublicPortalDataSource,
  PUBLIC_PORTAL_AUTH_DEPENDENCY,
  PUBLIC_PORTAL_AUTH_DEPENDENCY_VALUES,
  isPublicPortalAuthDependency,
  PUBLIC_PORTAL_TENANT_DEPENDENCY,
  PUBLIC_PORTAL_TENANT_DEPENDENCY_VALUES,
  isPublicPortalTenantDependency,
  PUBLIC_PORTAL_COMPETITION_MARKER,
  PUBLIC_PORTAL_COMPETITION_MARKER_VALUES,
  isPublicPortalCompetitionMarker,
  PUBLIC_PORTAL_SURFACE_ID,
  PUBLIC_PORTAL_SURFACE_ID_VALUES,
  isPublicPortalSurfaceId,
  PUBLIC_PORTAL_BOUNDARY_ID,
  PUBLIC_PORTAL_BOUNDARY_ID_VALUES,
  isPublicPortalBoundaryId,
  PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION,
  PUBLIC_PORTAL_LIVE_CUTOVER_CLASSIFICATION_VALUES,
  isPublicPortalLiveCutoverClassification,
} from "./constants/index.js";

export {
  createPublicPortalSurfaceDescriptor,
  createPublicPortalBoundaryDescriptor,
} from "./contracts/index.js";

export {
  PUBLIC_PORTAL_SURFACE_REGISTRY_ORDER,
  PUBLIC_PORTAL_BOUNDARY_REGISTRY_ORDER,
  listPublicPortalSurfaces,
  getPublicPortalSurface,
  listPublicPortalBoundaryMarkers,
  getPublicPortalBoundaryMarker,
  getPublicPortalSharedReadinessEvidence,
} from "./registry/index.js";

export {
  PUBLIC_PORTAL_LIVE_CUTOVER_MATRIX,
  listPublicPortalLiveCutoverMatrix,
  getPublicPortalLiveCutoverRow,
  listCertifiedLiveCutoverRows,
} from "./certification/index.js";

export {
  certifyPublicPortalReadiness,
  certifyPublicPortalLiveCutover,
} from "./validation/index.js";

export {
  PUBLIC_DATA_RESULT_STATUS,
  PUBLIC_DATA_RESULT_STATUS_VALUES,
  isPublicDataResultStatus,
  PUBLIC_DATA_FALLBACK_REASON,
  PUBLIC_DATA_FALLBACK_REASON_VALUES,
  isPublicDataFallbackReason,
  sanitizePublicDataErrorMessage,
  normalizePublicDataError,
  createLiveResult,
  createMockResult,
  createPreviewResult,
  createMixedResult,
  createEmptyResult,
  createErrorResult,
  createUnavailableResult,
  certifyPublicDataResult,
  resolvePublicListDataResult,
} from "./data-source/index.js";
