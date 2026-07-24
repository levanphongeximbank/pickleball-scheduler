/**
 * Customer persistence facade (CUSTOMER-03 + CUSTOMER-04).
 */

export {
  CUSTOMER_PHASE_3_TABLES,
  CUSTOMER_PHASE_3_RPC,
  CUSTOMER_PHASE_4_TABLES,
  CUSTOMER_PHASE_4_RPC,
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

export { createDurableCustomerRepository } from "./durable/durableCustomerRepository.js";
export { createDurableConsentPreferenceRepository } from "./durable/durableConsentPreferenceRepository.js";
export { createFakeCustomerDatabaseClient } from "./createFakeCustomerDatabaseClient.js";
