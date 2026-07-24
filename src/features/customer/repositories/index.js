export {
  CUSTOMER_REPOSITORY_PORTS,
  CUSTOMER_PORT_NAMES,
  createSystemCustomerClock,
  createSequentialCustomerIdGenerator,
} from "./ports.js";

export { createInMemoryCustomerRepository, cloneFrozen } from "./inMemory.js";

export { CUSTOMER_CONSENT_REPOSITORY_PORTS } from "./consentPreferencePorts.js";
export { createInMemoryConsentPreferenceRepository } from "./inMemoryConsentPreference.js";

export { CUSTOMER_LINKAGE_REPOSITORY_PORTS } from "./linkagePorts.js";
export { createInMemoryCustomerLinkageRepository } from "./inMemoryLinkage.js";
export {
  CUSTOMER_LINKAGE_DIRECTORY_PORTS,
  createInMemoryIdentityAccountDirectory,
  createInMemoryPlayerDirectory,
  createInMemoryCrmContactDirectory,
} from "./linkageDirectoryPorts.js";
