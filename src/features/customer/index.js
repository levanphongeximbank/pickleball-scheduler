/**
 * Customer Management — public facade
 * (CUSTOMER-01 + CUSTOMER-02 + CUSTOMER-03 + CUSTOMER-04 + CUSTOMER-05).
 *
 * Exports approved contracts, constants, pure domain factories,
 * application service factories, in-memory repositories, durable repository
 * adapter factories, runtime composition, read projectors, CRM/Notification/
 * Identity/Player boundary adapters, and Platform Core adoption projections.
 *
 * Does NOT export:
 * - mutable repository internal maps
 * - Supabase clients / credentials / service-role keys
 * - UI / routes / SQL migration runners
 * - raw evidence payloads
 * - Identity credentials / full Player profiles / full CRM internals
 * - legacy `src/models/customer.js` or `src/domain/customerService.js` as SoT
 *
 * Customer Management is the source of truth for customer master data,
 * but NOT for authentication, player sports profile, CRM workflow,
 * or financial transactions.
 *
 * Customer Management owns the customer-side linkage record, but Identity,
 * Player Management and CRM remain the source of truth for their own entities.
 *
 * Matching email, phone or name is not sufficient evidence to create a
 * canonical Customer linkage.
 *
 * Customer contact information is business master data. It is not an
 * authentication credential and does not prove ownership or verification
 * without trusted external evidence.
 *
 * Customer persistence is durable business master data and must never
 * silently fall back to an in-memory repository in Production.
 *
 * Customer Management stores consent and communication preference facts.
 * It does not independently determine legal permission when Platform
 * Governance policy input is required.
 *
 * Notification may consume communication eligibility but must not mutate
 * Customer consent state directly.
 */

// Errors
export {
  CUSTOMER_ERROR_CODES,
  CUSTOMER_ERROR_CODE_VALUES,
  isCustomerErrorCode,
  CustomerError,
  throwCustomerError,
  isCustomerError,
} from "./errors/index.js";

// Constants
export {
  CUSTOMER_TYPE,
  CUSTOMER_TYPE_VALUES,
  isCustomerType,
} from "./constants/customerTypes.js";
export {
  CUSTOMER_STATUS,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TERMINAL_STATUSES,
  CUSTOMER_ALLOWED_STATUS_TRANSITIONS,
  isCustomerStatus,
  isCustomerTerminalStatus,
  isAllowedCustomerStatusTransition,
} from "./constants/customerStatuses.js";
export {
  CONTACT_POINT_TYPE,
  CONTACT_POINT_TYPE_VALUES,
  CONTACT_POINT_VERIFICATION_STATE,
  CONTACT_POINT_VERIFICATION_STATE_VALUES,
  CONTACT_POINT_STATUS,
  CONTACT_POINT_STATUS_VALUES,
  CONTACT_POINT_PURPOSE,
  CONTACT_POINT_PURPOSE_VALUES,
  isContactPointType,
  isContactPointVerificationState,
  isContactPointStatus,
  isContactPointPurpose,
} from "./constants/contactPointTypes.js";
export {
  CUSTOMER_ADDRESS_TYPE,
  CUSTOMER_ADDRESS_TYPE_VALUES,
  CUSTOMER_ADDRESS_STATUS,
  CUSTOMER_ADDRESS_STATUS_VALUES,
  isCustomerAddressType,
  isCustomerAddressStatus,
} from "./constants/addressTypes.js";
export {
  CUSTOMER_COMMUNICATION_CHANNEL,
  CUSTOMER_COMMUNICATION_CHANNEL_VALUES,
  isCustomerCommunicationChannel,
} from "./constants/communicationChannels.js";
export {
  CUSTOMER_CONSENT_STATE,
  CUSTOMER_CONSENT_STATE_VALUES,
  isCustomerConsentState,
} from "./constants/consentStates.js";
export {
  CUSTOMER_CONSENT_STATUS,
  CUSTOMER_CONSENT_STATUS_VALUES,
  isCustomerConsentStatus,
} from "./constants/consentStatuses.js";
export {
  CUSTOMER_PREFERENCE_STATUS,
  CUSTOMER_PREFERENCE_STATUS_VALUES,
  isCustomerPreferenceStatus,
} from "./constants/preferenceStatuses.js";
export {
  CUSTOMER_COMMUNICATION_PURPOSE,
  CUSTOMER_COMMUNICATION_PURPOSE_VALUES,
  CUSTOMER_PURPOSES_REQUIRING_EXPLICIT_CONSENT,
  isCustomerCommunicationPurpose,
} from "./constants/communicationPurposes.js";
export {
  CUSTOMER_COMMUNICATION_ELIGIBILITY,
  CUSTOMER_COMMUNICATION_ELIGIBILITY_VALUES,
  isCustomerCommunicationEligibility,
} from "./constants/eligibilityResults.js";
export {
  CUSTOMER_ELIGIBILITY_REASON,
  CUSTOMER_ELIGIBILITY_REASON_VALUES,
  isCustomerEligibilityReason,
} from "./constants/eligibilityReasonCodes.js";
export {
  CUSTOMER_CONSENT_SOURCE,
  CUSTOMER_CONSENT_SOURCE_VALUES,
  isCustomerConsentSource,
} from "./constants/consentSources.js";
export {
  CUSTOMER_CLASSIFICATION_KIND,
  CUSTOMER_CLASSIFICATION_KIND_VALUES,
  LEGACY_VENUE_CUSTOMER_TYPE,
  LEGACY_VENUE_CUSTOMER_TYPE_VALUES,
  isCustomerClassificationKind,
} from "./constants/classification.js";
export {
  CUSTOMER_LINKAGE_TYPE,
  CUSTOMER_LINKAGE_TYPE_VALUES,
  CUSTOMER_LINKAGE_EXTERNAL_SYSTEM,
  isCustomerLinkageType,
} from "./constants/linkageTypes.js";
export {
  CUSTOMER_LINKAGE_STATUS,
  CUSTOMER_LINKAGE_STATUS_VALUES,
  isCustomerLinkageStatus,
  isActiveCustomerLinkageStatus,
} from "./constants/linkageStatuses.js";
export {
  CUSTOMER_LINKAGE_SOURCE,
  CUSTOMER_LINKAGE_SOURCE_VALUES,
  isCustomerLinkageSource,
} from "./constants/linkageSources.js";
export {
  CUSTOMER_LINKAGE_ACTION,
  CUSTOMER_LINKAGE_ACTION_VALUES,
  isCustomerLinkageAction,
} from "./constants/linkageActions.js";

// Domain
export {
  CUSTOMER_ID_PREFIX,
  CUSTOMER_NUMBER_PREFIX,
  requireOpaqueId,
  optionalOpaqueId,
  isCustomerId,
  mintCustomerId,
  mintCustomerNumber,
} from "./domain/identifiers.js";
export {
  createCustomerScope,
  scopesMatch,
  assertScopeOwnership,
} from "./domain/scope.js";
export {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
} from "./domain/normalization.js";
export {
  createContactPoint,
  assertPrimaryContactUniqueness,
  assertNoDuplicateContactValues,
  assertContactPointInvariants,
} from "./domain/contactPoint.js";
export {
  createCustomerAddress,
  assertPrimaryAddressUniqueness,
} from "./domain/address.js";
export {
  createIndividualProfile,
  createOrganizationProfile,
  resolveDisplayName,
  assertProfileTypeConsistency,
} from "./domain/profileNames.js";
export {
  createAccountLinkage,
  createPlayerLinkage,
  createOrganizationLinkage,
} from "./domain/linkages.js";
export {
  createCustomerLinkageRecord,
  activateCustomerLinkage,
  endCustomerLinkage,
  createCustomerLinkageHistoryRecord,
  defaultExternalSystemForLinkageType,
  defaultExternalReferenceType,
} from "./domain/linkageRecord.js";
export {
  createCommunicationPreference,
  createConsentReference,
} from "./domain/communicationPreference.js";
export {
  createCustomerConsentRecord,
  transitionCustomerConsent,
  createCustomerConsentHistoryRecord,
  isAllowedCustomerConsentTransition,
  CUSTOMER_CONSENT_ALLOWED_TRANSITIONS,
} from "./domain/consentRecord.js";
export {
  createCustomerPreferenceRecord,
  setCustomerPreferenceStatus,
  createCustomerPreferenceHistoryRecord,
  preferenceScopeKey,
} from "./domain/preferenceRecord.js";
export { evaluateCommunicationEligibility } from "./domain/communicationEligibility.js";
export {
  createClassificationEntry,
  createSegmentReference,
  normalizeControlledTags,
} from "./domain/classification.js";
export {
  CUSTOMER_MERGE_STATUS,
  CUSTOMER_MERGE_STATUS_VALUES,
  CUSTOMER_DEDUPE_MATCH_KIND,
  CUSTOMER_DEDUPE_MATCH_KIND_VALUES,
  createCustomerMergeProposal,
} from "./domain/mergeContract.js";
export {
  createCustomerProfile,
  updateCustomerProfileFields,
  changeCustomerStatus,
  addCustomerContactPoint,
  updateCustomerContactPoint,
  removeCustomerContactPoint,
  deactivateCustomerContactPoint,
  setPrimaryCustomerContactPoint,
  addCustomerAddress,
  updateCustomerAddress,
  removeCustomerAddress,
  setPrimaryCustomerAddress,
  setCustomerLinkage,
} from "./domain/customerProfile.js";

// Repositories
export {
  CUSTOMER_REPOSITORY_PORTS,
  CUSTOMER_PORT_NAMES,
  createSystemCustomerClock,
  createSequentialCustomerIdGenerator,
  createInMemoryCustomerRepository,
  cloneFrozen,
  CUSTOMER_CONSENT_REPOSITORY_PORTS,
  createInMemoryConsentPreferenceRepository,
  CUSTOMER_LINKAGE_REPOSITORY_PORTS,
  createInMemoryCustomerLinkageRepository,
  CUSTOMER_LINKAGE_DIRECTORY_PORTS,
  createInMemoryIdentityAccountDirectory,
  createInMemoryPlayerDirectory,
  createInMemoryCrmContactDirectory,
} from "./repositories/index.js";

// Application
export {
  createCustomerApplicationService,
  createFailClosedCustomerApplication,
} from "./application/CustomerApplicationService.js";
export {
  createConsentPreferenceApplicationService,
  createFailClosedConsentPreferenceApplication,
} from "./application/ConsentPreferenceApplicationService.js";
export {
  createLinkageApplicationService,
  createFailClosedLinkageApplication,
} from "./application/LinkageApplicationService.js";

// Projectors
export {
  projectCustomerSummary,
  projectCustomerDetails,
  projectCustomerProfileView,
  projectCustomerContactView,
  projectCustomerAddressSummary,
} from "./projectors/customerSummary.js";
export {
  projectCustomerConsentView,
  projectCustomerCommunicationPreferenceView,
  projectCommunicationEligibilityView,
  projectCustomerConsentPreferenceSummary,
} from "./projectors/consentPreferenceViews.js";
export {
  projectCustomerLinkageView,
  projectCustomerIdentityLinkView,
  projectCustomerPlayerLinkView,
  projectCustomerCrmLinkView,
  projectCustomerLinkageHistoryView,
  projectCustomerLinkageLookupView,
} from "./projectors/linkageViews.js";

// Adapters (boundary only)
export { createVenueCustomerDirectoryAdapter } from "./adapters/venueCustomerDirectoryAdapter.js";
export { createCustomerNotificationEligibilityAdapter } from "./adapters/notificationEligibilityAdapter.js";
export { createCustomerCrmConsentPreferenceAdapter } from "./adapters/crmConsentPreferenceAdapter.js";
export { createCustomerIdentityLinkageAdapter } from "./adapters/identityLinkageAdapter.js";
export { createCustomerPlayerLinkageAdapter } from "./adapters/playerLinkageAdapter.js";
export { createCustomerCrmLinkageAdapter } from "./adapters/crmLinkageAdapter.js";

// Persistence (CUSTOMER-03 / CUSTOMER-04 / CUSTOMER-05) — ports + durable adapter; no live client
export {
  CUSTOMER_PHASE_3_TABLES,
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_4_TABLES,
  CUSTOMER_PHASE_4_RPC,
  CUSTOMER_PHASE_5_TABLES,
  CUSTOMER_PHASE_5_RPC,
  requireCustomerDatabaseClientPort,
  createDurableCustomerRepository,
  createDurableConsentPreferenceRepository,
  createDurableCustomerLinkageRepository,
  createFakeCustomerDatabaseClient,
  mapCustomerDomainToSavePayload,
  mapCustomerRowsToDomain,
} from "./persistence/index.js";

// Runtime composition (CUSTOMER-03 + CUSTOMER-04 + CUSTOMER-05)
export {
  CUSTOMER_RUNTIME_MODE,
  CUSTOMER_RUNTIME_ENVIRONMENT,
  validateCustomerRuntimeConfig,
  createCustomerRuntime,
  createCustomerRuntimeTestHarness,
} from "./runtime/index.js";

// Platform Core adoption
export {
  CUSTOMER_PLATFORM_ADAPTER_ERROR,
  CUSTOMER_SUBJECT_TYPE,
  projectCustomerActor,
  projectCustomerTenantScope,
  projectCustomerSubject,
  projectCustomerPermission,
  projectCustomerSecurityContext,
  projectCustomerOperationIdentity,
  projectCustomerErrorDescriptor,
  projectCustomerEventEnvelope,
} from "./platform/index.js";

/** Frozen public export allowlist for certification. */
export const CUSTOMER_PUBLIC_EXPORTS = Object.freeze([
  "CUSTOMER_ERROR_CODES",
  "CUSTOMER_TYPE",
  "CUSTOMER_STATUS",
  "CONTACT_POINT_TYPE",
  "CONTACT_POINT_STATUS",
  "CONTACT_POINT_VERIFICATION_STATE",
  "CUSTOMER_ADDRESS_TYPE",
  "CUSTOMER_COMMUNICATION_CHANNEL",
  "CUSTOMER_CONSENT_STATE",
  "CUSTOMER_CONSENT_STATUS",
  "CUSTOMER_PREFERENCE_STATUS",
  "CUSTOMER_COMMUNICATION_PURPOSE",
  "CUSTOMER_COMMUNICATION_ELIGIBILITY",
  "CUSTOMER_ELIGIBILITY_REASON",
  "CUSTOMER_LINKAGE_TYPE",
  "CUSTOMER_LINKAGE_STATUS",
  "CUSTOMER_LINKAGE_SOURCE",
  "CUSTOMER_LINKAGE_ACTION",
  "createCustomerProfile",
  "createCustomerApplicationService",
  "createFailClosedCustomerApplication",
  "createConsentPreferenceApplicationService",
  "createFailClosedConsentPreferenceApplication",
  "createLinkageApplicationService",
  "createFailClosedLinkageApplication",
  "createInMemoryCustomerRepository",
  "createInMemoryConsentPreferenceRepository",
  "createInMemoryCustomerLinkageRepository",
  "createInMemoryIdentityAccountDirectory",
  "createInMemoryPlayerDirectory",
  "createInMemoryCrmContactDirectory",
  "createDurableCustomerRepository",
  "createDurableConsentPreferenceRepository",
  "createDurableCustomerLinkageRepository",
  "createCustomerRuntime",
  "createCustomerRuntimeTestHarness",
  "createVenueCustomerDirectoryAdapter",
  "createCustomerNotificationEligibilityAdapter",
  "createCustomerCrmConsentPreferenceAdapter",
  "createCustomerIdentityLinkageAdapter",
  "createCustomerPlayerLinkageAdapter",
  "createCustomerCrmLinkageAdapter",
  "projectCustomerSummary",
  "projectCustomerDetails",
  "projectCustomerProfileView",
  "projectCustomerContactView",
  "projectCustomerConsentView",
  "projectCustomerCommunicationPreferenceView",
  "projectCommunicationEligibilityView",
  "projectCustomerLinkageView",
  "projectCustomerIdentityLinkView",
  "projectCustomerPlayerLinkView",
  "projectCustomerCrmLinkView",
  "evaluateCommunicationEligibility",
  "normalizeCustomerEmail",
  "normalizeCustomerPhone",
  "projectCustomerSubject",
  "CUSTOMER_SUBJECT_TYPE",
  "createCustomerMergeProposal",
  "CUSTOMER_PHASE_3_TABLES",
  "CUSTOMER_PHASE_4_TABLES",
  "CUSTOMER_PHASE_5_TABLES",
  "CUSTOMER_RUNTIME_MODE",
]);
