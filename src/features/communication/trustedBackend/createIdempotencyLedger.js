/**
 * Command idempotency ledger over communication_idempotency (trusted backend).
 */

import { COMMUNICATION_TABLES } from "../persistence/schema.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";

/**
 * @param {object} client — injected privileged Supabase client
 */
export function createIdempotencyLedger(client) {
  if (!client || typeof client.from !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Idempotency ledger requires an injected Supabase client",
      {}
    );
  }

  return Object.freeze({
    /**
     * @param {{ operationType: string, idempotencyKey: string }} input
     * @returns {Promise<object|null>}
     */
    async find(input = {}) {
      const operationType = String(input.operationType || "").trim();
      const idempotencyKey = String(input.idempotencyKey || "").trim();
      if (!operationType || !idempotencyKey) return null;
      const { data, error } = await client
        .from(COMMUNICATION_TABLES.idempotency)
        .select("*")
        .eq("operation_type", operationType)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (error) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
          "Idempotency lookup failed",
          { operationType }
        );
      }
      return data || null;
    },

    /**
     * @param {object} input
     */
    async record(input = {}) {
      const operationType = String(input.operationType || "").trim();
      const idempotencyKey = String(input.idempotencyKey || "").trim();
      if (!operationType || !idempotencyKey) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "operationType and idempotencyKey are required",
          {}
        );
      }
      const row = {
        operation_type: operationType,
        idempotency_key: idempotencyKey,
        conversation_id: input.conversationId || null,
        tenant_id: input.tenantId || null,
        club_id: input.clubId || null,
        result_entity_type: input.resultEntityType || null,
        result_entity_id: input.resultEntityId || null,
        request_fingerprint: input.requestFingerprint || null,
        completed_at: new Date().toISOString(),
      };
      const { error } = await client
        .from(COMMUNICATION_TABLES.idempotency)
        .upsert(row, { onConflict: "operation_type,idempotency_key" });
      if (error) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
          "Idempotency record failed",
          { operationType }
        );
      }
      return Object.freeze({ ok: true, operationType, idempotencyKey });
    },
  });
}

/**
 * In-memory ledger for unit tests (no network).
 */
export function createMemoryIdempotencyLedger() {
  /** @type {Map<string, object>} */
  const store = new Map();
  function key(operationType, idempotencyKey) {
    return `${operationType}\u0000${idempotencyKey}`;
  }
  return Object.freeze({
    async find(input = {}) {
      return (
        store.get(key(String(input.operationType), String(input.idempotencyKey))) ||
        null
      );
    },
    async record(input = {}) {
      const operationType = String(input.operationType || "").trim();
      const idempotencyKey = String(input.idempotencyKey || "").trim();
      const row = Object.freeze({
        operation_type: operationType,
        idempotency_key: idempotencyKey,
        conversation_id: input.conversationId || null,
        tenant_id: input.tenantId || null,
        club_id: input.clubId || null,
        result_entity_type: input.resultEntityType || null,
        result_entity_id: input.resultEntityId || null,
        request_fingerprint: input.requestFingerprint || null,
        completed_at: new Date().toISOString(),
      });
      store.set(key(operationType, idempotencyKey), row);
      return Object.freeze({ ok: true, operationType, idempotencyKey });
    },
    __size: () => store.size,
  });
}
