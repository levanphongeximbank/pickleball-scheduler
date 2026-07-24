/**
 * Narrow Customer database client port (CUSTOMER-03).
 *
 * Application services depend on CustomerRepository only.
 * Durable adapters depend on this port — never on a concrete Supabase client.
 * Injectable and testable. No module-global client. No live connection here.
 */

import { CUSTOMER_ERROR_CODES } from "../errors/codes.js";
import { CustomerError } from "../errors/CustomerError.js";

/**
 * @typedef {object} CustomerDatabaseClientPort
 * @property {(request: {
 *   table: string,
 *   columns?: string,
 *   filters?: object,
 *   order?: Array<{ column: string, ascending?: boolean }>,
 *   limit?: number,
 * }) => Promise<object[]>} select
 * @property {(request: {
 *   table: string,
 *   rows: object|object[],
 *   returning?: boolean,
 * }) => Promise<object[]>} insert
 * @property {(request: {
 *   table: string,
 *   values: object,
 *   filters: object,
 *   returning?: boolean,
 * }) => Promise<object[]>} update
 * @property {(request: {
 *   table: string,
 *   filters: object,
 * }) => Promise<number>} delete
 * @property {(request: {
 *   fn: string,
 *   args?: object,
 * }) => Promise<unknown>} rpc
 */

/**
 * Validate and freeze an injectable database client port.
 * @param {Partial<CustomerDatabaseClientPort>} client
 * @returns {CustomerDatabaseClientPort}
 */
export function requireCustomerDatabaseClientPort(client) {
  if (!client || typeof client !== "object") {
    throw new CustomerError(
      CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
      "CustomerDatabaseClientPort is required for durable Customer persistence.",
      { adapter: "CustomerDatabaseClientPort" }
    );
  }
  for (const method of ["select", "insert", "update", "delete", "rpc"]) {
    if (typeof client[method] !== "function") {
      throw new CustomerError(
        CUSTOMER_ERROR_CODES.RUNTIME_NOT_CONFIGURED,
        `CustomerDatabaseClientPort.${method} must be a function.`,
        { adapter: "CustomerDatabaseClientPort", method }
      );
    }
  }
  return Object.freeze({
    select: client.select.bind(client),
    insert: client.insert.bind(client),
    update: client.update.bind(client),
    delete: client.delete.bind(client),
    rpc: client.rpc.bind(client),
  });
}

export const CUSTOMER_PHASE_3_TABLES = Object.freeze({
  CUSTOMERS: "customers",
  CONTACT_POINTS: "customer_contact_points",
  ADDRESSES: "customer_addresses",
});

export const CUSTOMER_PHASE_3_RPC = Object.freeze({
  SAVE_AGGREGATE: "customer_save_aggregate",
});
