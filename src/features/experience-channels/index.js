/**
 * Experience Channels — public facade (EC-00 + EC-01 re-exports).
 *
 * EC-00: Channel Architecture & Ownership Foundation.
 * EC-01: Public Portal Channel Readiness Certification (contracts only).
 *
 * Safe re-export only. No runtime wiring into router, main.jsx, App shell,
 * or provider trees in this phase.
 *
 * Does NOT export:
 * - React pages / layouts
 * - router registration helpers that mutate runtime routes
 * - Competition Engine adapters
 * - Platform Core providers
 * - Notification delivery / SQL / native mobile frameworks
 */

export const EXPERIENCE_CHANNELS_PHASE = Object.freeze({
  id: "EC-00",
  name: "experience-channel-architecture-ownership-foundation",
  wiredToRuntimeRouter: false,
  wiredToMainEntrypoint: false,
  wiredToProviderTree: false,
  structureComplete: true,
  nativeStoreRelease: false,
  iosReleasePercent: 0,
  androidReleasePercent: 0,
});

export const EXPERIENCE_CHANNELS_PUBLIC_EXPORTS = Object.freeze([
  "EXPERIENCE_CHANNELS_PHASE",
  "EXPERIENCE_CHANNEL_ID",
  "EXPERIENCE_CHANNEL_CLASSIFICATION",
  "EXPERIENCE_CHANNEL_VISIBILITY",
  "EXPERIENCE_CHANNEL_SURFACE",
  "listExperienceChannels",
  "getExperienceChannel",
  "getOwnershipSnapshot",
  "certifyExperienceChannelRegistry",
  "createExperienceChannelDescriptor",
  "EXPERIENCE_CHANNELS_EC01_PHASE",
  "listPublicPortalSurfaces",
  "certifyPublicPortalReadiness",
]);

export {
  EXPERIENCE_CHANNEL_CLASSIFICATION,
  EXPERIENCE_CHANNEL_CLASSIFICATION_VALUES,
  isExperienceChannelClassification,
  EXPERIENCE_CHANNEL_VISIBILITY,
  EXPERIENCE_CHANNEL_VISIBILITY_VALUES,
  isExperienceChannelVisibility,
  EXPERIENCE_CHANNEL_SURFACE,
  EXPERIENCE_CHANNEL_SURFACE_VALUES,
  EXPERIENCE_CHANNEL_FUTURE_SURFACES,
  isExperienceChannelSurface,
  isFutureOnlySurface,
  EXPERIENCE_CHANNEL_READINESS,
  EXPERIENCE_CHANNEL_READINESS_VALUES,
  EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS,
  EXPERIENCE_CHANNEL_IMPLEMENTATION_STATUS_VALUES,
  isExperienceChannelReadiness,
  isExperienceChannelImplementationStatus,
  EXPERIENCE_CHANNEL_CATEGORY,
  EXPERIENCE_CHANNEL_CATEGORY_VALUES,
  isExperienceChannelCategory,
  EXPERIENCE_PROVIDER_DEPENDENCY,
  EXPERIENCE_PROVIDER_DEPENDENCY_VALUES,
  isExperienceProviderDependency,
  EXPERIENCE_CHANNEL_ID,
  EXPERIENCE_CHANNEL_ID_VALUES,
  isExperienceChannelId,
} from "./constants/index.js";

export {
  deepFreeze,
  failContract,
  isNonEmptyString,
  isPlainObject,
  createExperienceChannelDescriptor,
  isExperienceChannelDescriptor,
  createRouteOwnershipDescriptor,
  createShellOwnershipDescriptor,
  createProviderOwnershipDescriptor,
} from "./contracts/index.js";

export {
  EXPERIENCE_CHANNEL_REGISTRY_ORDER,
  listExperienceChannels,
  getExperienceChannel,
  getExperienceChannelRegistryMap,
  EXPERIENCE_GLOBAL_HIGH_COLLISION_FILES,
  EXPERIENCE_COMPETITION_E2E_OWNED_PATH_HINTS,
  listRouteOwnership,
  listShellOwnership,
  listProviderOwnership,
  getOwnershipSnapshot,
} from "./registry/index.js";

export { certifyExperienceChannelRegistry } from "./validation/index.js";

export {
  EXPERIENCE_CHANNELS_EC01_PHASE,
  PUBLIC_PORTAL_READINESS_PUBLIC_EXPORTS,
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
  createPublicPortalSurfaceDescriptor,
  createPublicPortalBoundaryDescriptor,
  PUBLIC_PORTAL_SURFACE_REGISTRY_ORDER,
  PUBLIC_PORTAL_BOUNDARY_REGISTRY_ORDER,
  listPublicPortalSurfaces,
  getPublicPortalSurface,
  listPublicPortalBoundaryMarkers,
  getPublicPortalBoundaryMarker,
  getPublicPortalSharedReadinessEvidence,
  certifyPublicPortalReadiness,
} from "./public-portal/index.js";
