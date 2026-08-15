/**
 * Canonical Competition Adapter Contracts — shared kernel, 14 owned contracts,
 * official 16-contract catalog, conformance, and reuse bindings.
 *
 * Court and Referee remain owned by their merged workstreams.
 */

export {
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  COMPETITION_ADAPTER_CONTRACT_LOCKED,
  CAPABILITY_KIND,
  CAPABILITY_KIND_VALUES,
  ADAPTER_DIRECTION,
  RUNTIME_CLASSIFICATION,
  PRODUCTION_BINDING_STATUS,
  SHARED_ADAPTER_ERROR_CODE,
  SHARED_ADAPTER_ERROR_CODE_VALUES,
  FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
  SHARED_FORBIDDEN_METHODS,
  CANONICAL_CONTEXT_FIELDS,
  FUZZY_IDENTITY_FIELDS,
  DISTINCT_SCOPE_KEYS,
  OFFICIAL_CONTRACT_COUNT,
  THIS_WORKSTREAM_CONTRACT_COUNT,
  WORKSTREAM_OWNED_CONTRACT_IDS,
  COURT_CONTRACT_PROTECTED_PATHS,
  REFEREE_CONTRACT_PROTECTED_PATHS,
  PRIVATE_PERSISTENCE_IMPORT_PATTERNS,
  isNonEmptyString,
  isPlainObject,
  deepFreeze,
  clonePlain,
  freezeClone,
  freezeArray,
  CompetitionAdapterContractError,
  isCompetitionAdapterContractError,
  isSharedAdapterErrorCode,
  failCompetitionAdapter,
  looksLikeFuzzyIdentity,
  requireAdapterContext,
  distinguishScopeIds,
  requireCanonicalTenantId,
  EVIDENCE_STATUS,
  assertEvidencePayload,
  freezeEvidence,
  assertContractDefinition,
  assertCanonicalAdapterDoesNotOwnAuthority,
  assertCompetitionAdapter,
  freezeAdapterView,
  createContractAdapter,
} from "./kernel/index.js";

export {
  IDENTITY_ACCESS_CONTRACT,
  TENANT_ORGANIZATION_CONTRACT,
  PARTICIPANT_CONTRACT,
  CLUB_TEAM_MEMBERSHIP_CONTRACT,
  RATING_CONTRACT,
  RANKING_CONTRACT,
  FINANCE_PAYMENT_CONTRACT,
  NOTIFICATION_COMMUNICATION_CONTRACT,
  FILE_MEDIA_CONTRACT,
  STREAMING_SCOREBOARD_CONTRACT,
  FEDERATION_EXTERNAL_AUTHORITY_CONTRACT,
  CRM_SPONSOR_CONTRACT,
  ANALYTICS_REPORTING_CONTRACT,
  AUDIT_CONTRACT,
  WORKSTREAM_CONTRACT_DEFINITIONS,
  WORKSTREAM_CONTRACTS_BY_ID,
  getWorkstreamContractDefinition,
} from "./definitions.js";

export {
  createCompetitionAdapterContractCatalog,
  OFFICIAL_COMPETITION_ADAPTER_CATALOG,
  getCompetitionAdapterContract,
  listCompetitionAdapterContracts,
  assertKnownCompetitionAdapterContract,
  OFFICIAL_CATALOG_META,
} from "./catalog.js";

export {
  createIdentityAccessBinding,
  createTenantOrganizationBinding,
  createParticipantBinding,
  createClubTeamMembershipBinding,
  createRatingBinding,
  createRankingBinding,
  createFinancePaymentBinding,
  createNotificationCommunicationBinding,
  createFileMediaBinding,
  createStreamingScoreboardBinding,
  createFederationExternalAuthorityBinding,
  createCrmSponsorBinding,
  createAnalyticsReportingBinding,
  createAuditBinding,
  createNotConfiguredContractAdapter,
  createDefaultWorkstreamAdapters,
  createCompetitionAdapterImplementationRegistry,
} from "./bindings.js";

export { runCompetitionAdapterConformance } from "./conformance.js";

export {
  collectAlternateContractDefinitions,
  collectPrivatePersistenceImports,
  lockedContractIdSet,
  lockedDefinitions,
  courtAuthoritativePath,
  refereeContractId,
  isProtectedCourtOrRefereePath,
} from "./architectureLock.js";

export const COMPETITION_CANONICAL_ADAPTER_CONTRACTS_V1 = Object.freeze({
  id: "competition-canonical-adapters-14-foundation-01",
  version: "1.0.0",
  locked: true,
  officialContractCount: 16,
  thisWorkstreamContractCount: 14,
  ownsCourtContract: false,
  ownsRefereeContract: false,
});
