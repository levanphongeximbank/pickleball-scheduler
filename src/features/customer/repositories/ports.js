/**
 * Customer repository ports (CUSTOMER-01).
 * Provider-neutral and persistence-neutral. No Supabase types.
 */

export const CUSTOMER_REPOSITORY_PORTS = Object.freeze({
  CustomerRepository: "CustomerRepository",
});

/**
 * @typedef {{ tenantId: string, venueId: string }} CustomerScope
 */

/**
 * @typedef {object} CustomerSearchQuery
 * @property {string} [text]
 * @property {string} [customerId]
 * @property {string} [customerNumber]
 * @property {string} [email]
 * @property {string} [phone]
 * @property {string} [normalizedEmail]
 * @property {string} [normalizedPhone]
 * @property {{ type: string, id: string }} [externalReference]
 * @property {string} [customerType]
 * @property {string} [status]
 * @property {number} [limit]
 * @property {number} [offset]
 * @property {boolean} [includeMerged]
 */

/**
 * @typedef {object} CustomerRepository
 * @property {(scope: CustomerScope, customerId: string) => object|null|Promise<object|null>} getById
 * @property {(scope: CustomerScope, customerNumber: string) => object|null|Promise<object|null>} findByCustomerNumber
 * @property {(scope: CustomerScope, query?: CustomerSearchQuery) => object[]|Promise<object[]>} search
 * @property {(scope: CustomerScope, query?: CustomerSearchQuery) => { items: object[], total: number, limit: number, offset: number }|Promise<{ items: object[], total: number, limit: number, offset: number }>} list
 * @property {(customer: object) => object|Promise<object>} save
 * @property {(scope: CustomerScope, customerId: string) => boolean|Promise<boolean>} exists
 * @property {(scope: CustomerScope, criteria: object) => object|null|Promise<object|null>} findDuplicate
 */

export const CUSTOMER_PORT_NAMES = Object.freeze([
  "CustomerRepository",
  "CustomerClock",
  "CustomerIdGenerator",
]);

/**
 * @typedef {object} CustomerClock
 * @property {() => string} nowIso
 */

/**
 * @typedef {object} CustomerIdGenerator
 * @property {(prefix: string) => string} nextId
 */

/**
 * @returns {CustomerClock}
 */
export function createSystemCustomerClock() {
  return {
    nowIso() {
      return new Date().toISOString();
    },
  };
}

/**
 * @param {() => string} [entropy]
 * @returns {CustomerIdGenerator}
 */
export function createSequentialCustomerIdGenerator(
  entropy = () => String(Date.now())
) {
  let seq = 0;
  return {
    nextId(prefix) {
      seq += 1;
      return `${prefix}_${entropy()}_${seq}`;
    },
  };
}
