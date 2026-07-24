/**
 * Customer persistence facade (CUSTOMER-03).
 */

export {
  CUSTOMER_PHASE_3_TABLES,
  CUSTOMER_PHASE_3_RPC,
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

export { createDurableCustomerRepository } from "./durable/durableCustomerRepository.js";
export { createFakeCustomerDatabaseClient } from "./createFakeCustomerDatabaseClient.js";
