/**
 * Narrow CRM database client port (Phase 1G).
 *
 * Application services depend on repository contracts only.
 * Durable adapters depend on this port — never on a concrete Supabase client.
 * Injectable and testable. No module-global client. No live connection here.
 */

import { CRM_ERROR_CODES, CrmError } from "../constants/errorCodes.js";

/**
 * @typedef {object} CrmDatabaseClientPort
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
 * @param {Partial<CrmDatabaseClientPort>} client
 * @returns {CrmDatabaseClientPort}
 */
export function requireCrmDatabaseClientPort(client) {
  if (!client || typeof client !== "object") {
    throw new CrmError(
      CRM_ERROR_CODES.INVALID_INPUT,
      "CrmDatabaseClientPort is required."
    );
  }
  for (const method of ["select", "insert", "update", "delete", "rpc"]) {
    if (typeof client[method] !== "function") {
      throw new CrmError(
        CRM_ERROR_CODES.INVALID_INPUT,
        `CrmDatabaseClientPort.${method} must be a function.`
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

export const CRM_PHASE_1G_TABLES = Object.freeze({
  TAGS: "crm_tags",
  TAG_ASSIGNMENTS: "crm_tag_assignments",
  CONSENT_RECORDS: "crm_consent_records",
  PENDING_EVENTS: "crm_pending_events",
});

export const CRM_PHASE_1G_RPC = Object.freeze({
  CLAIM_PENDING_EVENTS: "crm_claim_pending_events",
  RELEASE_EXPIRED_CLAIMS: "crm_release_expired_pending_event_claims",
});
