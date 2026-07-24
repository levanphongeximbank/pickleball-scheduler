export {
  CUSTOMER_REPOSITORY_PORTS,
  CUSTOMER_PORT_NAMES,
  createSystemCustomerClock,
  createSequentialCustomerIdGenerator,
} from "./ports.js";

export { createInMemoryCustomerRepository, cloneFrozen } from "./inMemory.js";
