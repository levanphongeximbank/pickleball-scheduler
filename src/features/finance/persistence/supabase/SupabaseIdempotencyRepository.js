/**
 * Supabase Finance idempotency repository (Phase 1G).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  IDEMPOTENCY_EXECUTION_STATUS,
  createIdempotencyRecord,
} from "../records/index.js";
import {
  notFoundError,
  requireExpectedVersion,
  requireTenantScope,
  uniquenessConflictError,
  versionConflictError,
} from "../repositories/durablePorts.js";
import { FINANCE_TABLES } from "./schema.js";
import {
  idempotencyFromRow,
  idempotencyToRow,
  normalizeIdempotencyForWrite,
} from "./rowMappers.js";
import { applyTenantIdFilter } from "./queryBuilders.js";
import { insertRow, unwrapResult, updateWithExpectedVersion } from "./repositorySupport.js";

/**
 * @param {object} client
 */
export function createSupabaseIdempotencyRepository(client) {
  const table = FINANCE_TABLES.idempotency;

  async function findRow(tenantId, operationType, idempotencyKey) {
    const tid = requireTenantScope(tenantId);
    return unwrapResult(
      applyTenantIdFilter(client.from(table).select("*"), tid)
        .eq("operation_type", operationType)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle(),
      { entity: "IdempotencyRecord", tenantId: tid, table, operation: "find" }
    );
  }

  return Object.freeze({
    async find(tenantId, operationType, idempotencyKey) {
      const data = await findRow(tenantId, operationType, idempotencyKey);
      return data ? idempotencyFromRow(data) : null;
    },

    /**
     * begin(tenantId, input) — harness-compatible shape.
     * Also accepts begin(tenantId, operationType, idempotencyKey, fingerprint, record).
     */
    async begin(tenantId, inputOrOp, maybeKey, maybeFingerprint, maybeRecord) {
      const tid = requireTenantScope(tenantId);
      const input =
        typeof inputOrOp === "object" && inputOrOp != null
          ? inputOrOp
          : {
              ...(maybeRecord || {}),
              operationType: inputOrOp,
              idempotencyKey: maybeKey,
              requestFingerprint: maybeFingerprint,
            };

      const record = normalizeIdempotencyForWrite(
        {
          ...input,
          tenantId: tid,
          executionStatus: IDEMPOTENCY_EXECUTION_STATUS.STARTED,
        },
        tid
      );

      // Reject raw request bodies if present on input
      if (input.requestPayload != null || input.rawRequest != null || input.sensitivePayload != null) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
          "Idempotency records must not persist request payloads.",
          { field: "requestPayload" }
        );
      }

      const existingRow = await findRow(tid, record.operationType, record.idempotencyKey);
      if (existingRow) {
        const existing = idempotencyFromRow(existingRow);
        if (existing.executionStatus === IDEMPOTENCY_EXECUTION_STATUS.STARTED) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
            "Idempotency execution is already in progress.",
            {
              tenantId: tid,
              operationType: record.operationType,
              idempotencyKey: record.idempotencyKey,
            }
          );
        }
        if (existing.requestFingerprint !== record.requestFingerprint) {
          throw uniquenessConflictError("IdempotencyRecord.fingerprint", {
            tenantId: tid,
            idempotencyKey: record.idempotencyKey,
          });
        }
        // Same fingerprint → safe replay of stored record (COMPLETED / FAILED / ABANDONED)
        return existing;
      }

      const row = await insertRow(client, table, idempotencyToRow(record), "IdempotencyRecord", tid);
      return idempotencyFromRow(row);
    },

    async complete(tenantId, operationType, idempotencyKey, expectedVersion, resultReference) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const currentRow = await findRow(tid, operationType, idempotencyKey);
      if (!currentRow) throw notFoundError("IdempotencyRecord", tid, idempotencyKey);
      const current = idempotencyFromRow(currentRow);
      if (current.version !== expectedVersion) {
        throw versionConflictError("IdempotencyRecord", {
          expectedVersion,
          actualVersion: current.version,
        });
      }

      const resultEntityType =
        typeof resultReference === "object" && resultReference != null
          ? resultReference.entityType ?? resultReference.resultEntityType
          : current.resultEntityType;
      const resultEntityId =
        typeof resultReference === "object" && resultReference != null
          ? resultReference.entityId ?? resultReference.resultEntityId ?? resultReference.id
          : resultReference;

      const updated = createIdempotencyRecord({
        ...current,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.COMPLETED,
        resultEntityType,
        resultEntityId,
        resultReference: resultEntityId,
        completedAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        version: current.version,
      });

      const patch = idempotencyToRow({ ...updated, version: expectedVersion + 1 });
      // Lookup by id for optimistic update
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        current.id,
        expectedVersion,
        patch,
        "IdempotencyRecord"
      );
      return idempotencyFromRow(row);
    },

    async markFailed(tenantId, operationType, idempotencyKey, expectedVersion) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const currentRow = await findRow(tid, operationType, idempotencyKey);
      if (!currentRow) throw notFoundError("IdempotencyRecord", tid, idempotencyKey);
      const current = idempotencyFromRow(currentRow);
      const updated = createIdempotencyRecord({
        ...current,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.FAILED,
        version: current.version,
      });
      const patch = idempotencyToRow({ ...updated, version: expectedVersion + 1 });
      const row = await updateWithExpectedVersion(
        client,
        table,
        tid,
        current.id,
        expectedVersion,
        patch,
        "IdempotencyRecord"
      );
      return idempotencyFromRow(row);
    },
  });
}
