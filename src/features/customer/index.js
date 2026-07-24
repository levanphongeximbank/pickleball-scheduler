/**
 * Customer Management — public facade (CUSTOMER-01 + CUSTOMER-02).
 *
 * Exports approved contracts, constants, pure domain factories,
 * application service factory, in-memory repository, read projectors,
 * CRM directory adapter, and Platform Core adoption projections.
 *
 * Does NOT export:
 * - mutable repository internal maps
 * - Supabase clients / credentials
 * - UI / routes / SQL migrations
 * - legacy `src/models/customer.js` or `src/domain/customerService.js` as SoT
 *
 * Customer Management is the source of truth for customer master data,
 * but NOT for authentication, player sports profile, CRM workflow,
 * or financial transactions.
 *
 * Customer contact information is business master data. It is not an
 * authentication credential and does not prove ownership or verification
 * without trusted external evidence.
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
  CUSTOMER_CLASSIFICATION_KIND,
  CUSTOMER_CLASSIFICATION_KIND_VALUES,
  LEGACY_VENUE_CUSTOMER_TYPE,
  LEGACY_VENUE_CUSTOMER_TYPE_VALUES,
  isCustomerClassificationKind,
} from "./constants/classification.js";

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
  createCommunicationPreference,
  createConsentReference,
} from "./domain/communicationPreference.js";
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
} from "./repositories/index.js";

// Application
export {
  createCustomerApplicationService,
  createFailClosedCustomerApplication,
} from "./application/CustomerApplicationService.js";

// Projectors
export {
  projectCustomerSummary,
  projectCustomerDetails,
  projectCustomerProfileView,
  projectCustomerContactView,
  projectCustomerAddressSummary,
} from "./projectors/customerSummary.js";

// Adapters (boundary only)
export { createVenueCustomerDirectoryAdapter } from "./adapters/venueCustomerDirectoryAdapter.js";

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
  "createCustomerProfile",
  "createCustomerApplicationService",
  "createFailClosedCustomerApplication",
  "createInMemoryCustomerRepository",
  "createVenueCustomerDirectoryAdapter",
  "projectCustomerSummary",
  "projectCustomerDetails",
  "projectCustomerProfileView",
  "projectCustomerContactView",
  "normalizeCustomerEmail",
  "normalizeCustomerPhone",
  "projectCustomerSubject",
  "CUSTOMER_SUBJECT_TYPE",
  "createCustomerMergeProposal",
]);
