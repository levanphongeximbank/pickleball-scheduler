/**
 * Customer persistence facade (CUSTOMER-03 + CUSTOMER-04 + CUSTOMER-05 + CUSTOMER-06).
 */

export {
  CUSTOMER_PHASE_3_TABLES,
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_4_TABLES,
  CUSTOMER_PHASE_4_RPC,
  CUSTOMER_PHASE_5_TABLES,
  CUSTOMER_PHASE_5_RPC,
  CUSTOMER_PHASE_6_TABLES,
  CUSTOMER_PHASE_6_RPC,
  requireCustomerDatabaseClientPort,
} from "./databaseClientPort.js";

export {
  translateCustomerPersistenceError,
  withCustomerPersistenceErrors,
} from "./errorTranslation.js";

export {
  mapCustomerDomainToRootRow,
  mapContactDomainToRow,
  mapAddressDomainToRow,
  mapContactRowToDomain,
  mapAddressRowToDomain,
  mapCustomerRowsToDomain,
  mapCustomerDomainToSavePayload,
} from "./mapping/customerMapping.js";

export {
  mapConsentDomainToRow,
  mapConsentRowToDomain,
  mapConsentHistoryDomainToRow,
  mapConsentHistoryRowToDomain,
  mapPreferenceDomainToRow,
  mapPreferenceRowToDomain,
  mapPreferenceHistoryDomainToRow,
  mapPreferenceHistoryRowToDomain,
} from "./mapping/consentPreferenceMapping.js";

export {
  mapLinkageDomainToRow,
  mapLinkageRowToDomain,
  mapLinkageHistoryDomainToRow,
  mapLinkageHistoryRowToDomain,
} from "./mapping/linkageMapping.js";

export {
  mapCandidateDomainToRow,
  mapCandidateRowToDomain,
  mapProposalDomainToRow,
  mapProposalRowToDomain,
  mapMergeHistoryDomainToRow,
  mapMergeHistoryRowToDomain,
} from "./mapping/mergeMapping.js";

export { createDurableCustomerRepository } from "./durable/durableCustomerRepository.js";
export { createDurableConsentPreferenceRepository } from "./durable/durableConsentPreferenceRepository.js";
export { createDurableCustomerLinkageRepository } from "./durable/durableCustomerLinkageRepository.js";
export { createDurableCustomerMergeRepository } from "./durable/durableMergeRepository.js";
export { createFakeCustomerDatabaseClient } from "./createFakeCustomerDatabaseClient.js";
