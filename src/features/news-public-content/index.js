/**
 * News & Public Content — public facade (NEWS-01 … NEWS-04).
 *
 * NEWS-01: Domain, Editorial Lifecycle & Public Read Foundation.
 * NEWS-02: Durable Persistence, SQL, RLS & Editorial Authorization.
 * NEWS-03: Staging Apply & Live Public Read Integration.
 * NEWS-04: Public Portal adopts live public-read via Experience Channels
 *          (`getPublicNews` in public-portal). This barrel stays UI-free.
 *
 * Consumers must import from this index — not from internal file paths.
 *
 * Does NOT export / does NOT do:
 * - Public Portal UI / public news routes / layouts
 * - Silent mock fallback for live failures
 * - Production SQL apply
 * - browser storage durable adapters as SoT
 * - media upload
 * - scheduler worker
 * - runtime mock repository as production source of truth
 */

export { NEWS_PUBLIC_CONTENT_PHASE } from "./constants/index.js";

export {
  CONTENT_TYPE,
  CONTENT_TYPE_VALUES,
  isContentType,
  CONTENT_SCOPE,
  CONTENT_SCOPE_VALUES,
  isContentScope,
  EDITORIAL_STATUS,
  EDITORIAL_STATUS_VALUES,
  EDITORIAL_TERMINAL_STATUSES,
  EDITORIAL_ALLOWED_TRANSITIONS,
  isEditorialStatus,
  isEditorialTransitionAllowed,
  CONTENT_PROVENANCE,
  CONTENT_PROVENANCE_VALUES,
  isContentProvenance,
  PUBLIC_VISIBILITY,
  PUBLIC_VISIBILITY_VALUES,
  isPublicVisibility,
  isPubliclyReadableVisibility,
} from "./constants/index.js";

export {
  NEWS_PUBLIC_CONTENT_ERROR_CODE,
  NewsPublicContentError,
  isNewsPublicContentError,
  isNewsPublicContentErrorCode,
} from "./errors/index.js";

export {
  createContentId,
  createRevisionId,
  requireOpaqueId,
  createCategoryReference,
  createTagReference,
  MEDIA_KIND,
  MEDIA_KIND_VALUES,
  createMediaReference,
  SEO_ROBOTS,
  SEO_ROBOTS_VALUES,
  createSeoMetadata,
  createPublicationWindow,
  evaluatePublicationWindow,
  REVIEW_DECISION,
  REVIEW_DECISION_VALUES,
  createReviewDecision,
  APPROVAL_DECISION,
  APPROVAL_DECISION_VALUES,
  createApprovalDecision,
  isApprovalBoundToRevision,
  createBannerContentContract,
  createSponsorContentContract,
} from "./contracts/index.js";

export {
  validateScopeOwnership,
  assertPositiveVersion,
  assertVersionMatch,
  createContentRevision,
  assertLifecycleTransition,
  applyLifecycleTransition,
  evaluatePublicationEligibility,
  createDraftContent,
} from "./domain/index.js";

export {
  projectPublicContent,
  tryProjectPublicContent,
} from "./projections/index.js";

export {
  CLOCK_PORT_METHODS,
  ID_PROVIDER_PORT_METHODS,
  matchesClockPort,
  matchesIdProviderPort,
  createUnimplementedClockPort,
  createUnimplementedIdProviderPort,
  createFixedClockPort,
  createSequentialIdProviderPort,
  CONTENT_REPOSITORY_PORT_METHODS,
  NEWS_CONTENT_REPOSITORY_PORTS,
  matchesContentRepositoryPort,
  createUnimplementedContentRepositoryPort,
} from "./ports/index.js";

export {
  createNewsPublicContentFacade,
  newsPublicContentFacade,
  NEWS_PUBLIC_CONTENT_FACADE_METHODS,
} from "./application/index.js";

export {
  NEWS_PLATFORM_ADAPTER_ERROR,
  newsOk,
  newsFail,
  newsFailFromCaught,
  projectNewsActor,
  projectNewsTenantScope,
  projectNewsOperationInstant,
  assertNewsPlatformSurface,
  isOk,
  isFail,
} from "./platform/index.js";

export {
  NEWS_EDITORIAL_CAPABILITY,
  NEWS_EDITORIAL_CAPABILITY_VALUES,
  NEWS_PERMISSION,
  NEWS_AUTH_ACTOR_KIND,
  NEWS_AUTH_DECISION,
  NEWS_CAPABILITY_PERMISSION_MAP,
  getNews02CapabilityMatrix,
  authorizeNewsEditorialCapability,
  assertNewsEditorialCapability,
  rejectActorSpoofing,
} from "./authorization/index.js";

export {
  NEWS_TABLE,
  NEWS_TABLE_NAME_VALUES,
  NEWS_RPC,
  NEWS_SQL_PACKAGE_DIR,
  NEWS_SQL_PACKAGE_FILES,
  loadNews02SqlPackageManifest,
  assertNews02SqlApplyRefused,
  assertSupabaseNewsClient,
  createFakeSupabaseNewsClient,
  createSupabaseContentRepository,
  mapSupabaseNewsError,
} from "./persistence/index.js";

export const NEWS_PUBLIC_CONTENT_PUBLIC_EXPORTS = Object.freeze([
  "NEWS_PUBLIC_CONTENT_PHASE",
  "CONTENT_TYPE",
  "CONTENT_TYPE_VALUES",
  "isContentType",
  "CONTENT_SCOPE",
  "CONTENT_SCOPE_VALUES",
  "isContentScope",
  "EDITORIAL_STATUS",
  "EDITORIAL_STATUS_VALUES",
  "EDITORIAL_TERMINAL_STATUSES",
  "EDITORIAL_ALLOWED_TRANSITIONS",
  "isEditorialStatus",
  "isEditorialTransitionAllowed",
  "CONTENT_PROVENANCE",
  "CONTENT_PROVENANCE_VALUES",
  "isContentProvenance",
  "PUBLIC_VISIBILITY",
  "PUBLIC_VISIBILITY_VALUES",
  "isPublicVisibility",
  "isPubliclyReadableVisibility",
  "NEWS_PUBLIC_CONTENT_ERROR_CODE",
  "NewsPublicContentError",
  "isNewsPublicContentError",
  "isNewsPublicContentErrorCode",
  "createContentId",
  "createRevisionId",
  "requireOpaqueId",
  "createCategoryReference",
  "createTagReference",
  "MEDIA_KIND",
  "MEDIA_KIND_VALUES",
  "createMediaReference",
  "SEO_ROBOTS",
  "SEO_ROBOTS_VALUES",
  "createSeoMetadata",
  "createPublicationWindow",
  "evaluatePublicationWindow",
  "REVIEW_DECISION",
  "REVIEW_DECISION_VALUES",
  "createReviewDecision",
  "APPROVAL_DECISION",
  "APPROVAL_DECISION_VALUES",
  "createApprovalDecision",
  "isApprovalBoundToRevision",
  "createBannerContentContract",
  "createSponsorContentContract",
  "validateScopeOwnership",
  "assertPositiveVersion",
  "assertVersionMatch",
  "createContentRevision",
  "assertLifecycleTransition",
  "applyLifecycleTransition",
  "evaluatePublicationEligibility",
  "createDraftContent",
  "projectPublicContent",
  "tryProjectPublicContent",
  "CLOCK_PORT_METHODS",
  "ID_PROVIDER_PORT_METHODS",
  "matchesClockPort",
  "matchesIdProviderPort",
  "createUnimplementedClockPort",
  "createUnimplementedIdProviderPort",
  "createFixedClockPort",
  "createSequentialIdProviderPort",
  "CONTENT_REPOSITORY_PORT_METHODS",
  "NEWS_CONTENT_REPOSITORY_PORTS",
  "matchesContentRepositoryPort",
  "createUnimplementedContentRepositoryPort",
  "createNewsPublicContentFacade",
  "newsPublicContentFacade",
  "NEWS_PUBLIC_CONTENT_FACADE_METHODS",
  "NEWS_PLATFORM_ADAPTER_ERROR",
  "newsOk",
  "newsFail",
  "newsFailFromCaught",
  "projectNewsActor",
  "projectNewsTenantScope",
  "projectNewsOperationInstant",
  "assertNewsPlatformSurface",
  "isOk",
  "isFail",
  "NEWS_EDITORIAL_CAPABILITY",
  "NEWS_EDITORIAL_CAPABILITY_VALUES",
  "NEWS_PERMISSION",
  "NEWS_AUTH_ACTOR_KIND",
  "NEWS_AUTH_DECISION",
  "NEWS_CAPABILITY_PERMISSION_MAP",
  "getNews02CapabilityMatrix",
  "authorizeNewsEditorialCapability",
  "assertNewsEditorialCapability",
  "rejectActorSpoofing",
  "NEWS_TABLE",
  "NEWS_TABLE_NAME_VALUES",
  "NEWS_RPC",
  "NEWS_SQL_PACKAGE_DIR",
  "NEWS_SQL_PACKAGE_FILES",
  "loadNews02SqlPackageManifest",
  "assertNews02SqlApplyRefused",
  "assertSupabaseNewsClient",
  "createFakeSupabaseNewsClient",
  "createSupabaseContentRepository",
  "mapSupabaseNewsError",
  "NEWS_PUBLIC_CONTENT_PUBLIC_EXPORTS",
]);
