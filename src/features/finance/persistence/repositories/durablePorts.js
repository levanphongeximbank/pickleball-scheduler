/**
 * Durable Finance repository contracts and bounded query types (Phase 1E).
 *
 * No global unscoped lookup. No default tenant. No arbitrary filter objects.
 * No real database implementation in this phase.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { requireRecordId, requireOptimisticVersion } from "../validation/recordValidation.js";

export const FINANCE_DURABLE_REPOSITORY_PORTS = Object.freeze({
  FeeDefinitionDurableRepository: "FeeDefinitionDurableRepository",
  FinancialObligationDurableRepository: "FinancialObligationDurableRepository",
  InvoiceDurableRepository: "InvoiceDurableRepository",
  PaymentDurableRepository: "PaymentDurableRepository",
  PaymentAttemptDurableRepository: "PaymentAttemptDurableRepository",
  ReceiptDurableRepository: "ReceiptDurableRepository",
  RefundDurableRepository: "RefundDurableRepository",
  FinanceEventDurableRepository: "FinanceEventDurableRepository",
  IdempotencyDurableRepository: "IdempotencyDurableRepository",
  AuditEvidenceDurableRepository: "AuditEvidenceDurableRepository",
});

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;

/**
 * @param {unknown} tenantId
 * @returns {string}
 */
export function requireTenantScope(tenantId) {
  if (tenantId == null || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
      "Durable repository operations require an explicit tenantId.",
      { field: "tenantId" }
    );
  }
  return tenantId.trim();
}

/**
 * Bounded, deterministic list query contract.
 *
 * @param {object} input
 * @returns {Readonly<{
 *   tenantId: string,
 *   limit: number,
 *   cursor: string|null,
 *   status: string|null,
 *   businessReference: string|null,
 *   paymentId: string|null,
 *   occurredFrom: string|null,
 *   occurredTo: string|null,
 *   sort: 'createdAtAsc'|'createdAtDesc'|'occurredAtAsc'|'occurredAtDesc'
 * }>}
 */
export function createBoundedListQuery(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "List query must be a bounded query object.",
      { field: "query" }
    );
  }
  if (input.filter != null || input.where != null || input.filters != null) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Arbitrary filter objects are not permitted on durable list queries.",
      { field: "filter" }
    );
  }

  const tenantId = requireTenantScope(input.tenantId);
  const limitRaw = input.limit == null ? DEFAULT_LIST_LIMIT : input.limit;
  if (
    typeof limitRaw !== "number" ||
    !Number.isSafeInteger(limitRaw) ||
    limitRaw < 1 ||
    limitRaw > MAX_LIST_LIMIT
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      `List limit must be an integer between 1 and ${MAX_LIST_LIMIT}.`,
      { field: "limit" }
    );
  }

  const sort = input.sort == null ? "createdAtAsc" : String(input.sort);
  const allowedSort = [
    "createdAtAsc",
    "createdAtDesc",
    "occurredAtAsc",
    "occurredAtDesc",
  ];
  if (!allowedSort.includes(sort)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Unsupported list sort.",
      { field: "sort", received: sort }
    );
  }

  return Object.freeze({
    tenantId,
    limit: limitRaw,
    cursor: input.cursor == null || input.cursor === "" ? null : requireRecordId(input.cursor, "cursor"),
    status: input.status == null || input.status === "" ? null : requireRecordId(input.status, "status"),
    businessReference:
      input.businessReference == null || input.businessReference === ""
        ? null
        : requireRecordId(input.businessReference, "businessReference"),
    paymentId:
      input.paymentId == null || input.paymentId === ""
        ? null
        : requireRecordId(input.paymentId, "paymentId"),
    occurredFrom:
      input.occurredFrom == null || input.occurredFrom === ""
        ? null
        : requireRecordId(input.occurredFrom, "occurredFrom"),
    occurredTo:
      input.occurredTo == null || input.occurredTo === ""
        ? null
        : requireRecordId(input.occurredTo, "occurredTo"),
    sort,
  });
}

/**
 * @param {unknown} expectedVersion
 * @returns {number}
 */
export function requireExpectedVersion(expectedVersion) {
  return requireOptimisticVersion(expectedVersion, "expectedVersion");
}

/**
 * Typed helpers for durable repository error mapping.
 */
export function notFoundError(entity, tenantId, id) {
  return new FinanceError(
    FINANCE_ERROR_CODES.REPOSITORY_NOT_FOUND,
    `${entity} not found for tenant.`,
    { entity, tenantId, id }
  );
}

export function uniquenessConflictError(entity, details = {}) {
  return new FinanceError(
    FINANCE_ERROR_CODES.PERSISTENCE_UNIQUENESS_CONFLICT,
    `${entity} uniqueness conflict.`,
    { entity, ...details }
  );
}

export function versionConflictError(entity, details = {}) {
  return new FinanceError(
    FINANCE_ERROR_CODES.OPTIMISTIC_CONCURRENCY_CONFLICT,
    `${entity} optimistic concurrency conflict.`,
    { entity, ...details }
  );
}

export function tenantMismatchError(details = {}) {
  return new FinanceError(
    FINANCE_ERROR_CODES.TENANT_OWNERSHIP_MISMATCH,
    "Tenant ownership mismatch for durable Finance record.",
    details
  );
}

/**
 * @typedef {object} DurableUpdateCommand
 * @property {string} tenantId
 * @property {string} id
 * @property {number} expectedVersion
 * @property {object} record
 */

/**
 * Durable repository method contracts (documentation / JSDoc).
 *
 * FeeDefinitionDurableRepository:
 *   create(tenantId, record)
 *   getById(tenantId, id)
 *   findByBusinessReference(tenantId, businessReference)
 *   update(tenantId, id, expectedVersion, record)
 *   list(boundedQuery)
 *
 * FinancialObligationDurableRepository / InvoiceDurableRepository / RefundDurableRepository:
 *   create, getById, findByBusinessReference, update(expectedVersion), list(boundedQuery)
 *
 * PaymentDurableRepository:
 *   create, getById, update(expectedVersion), list(boundedQuery)
 *   findByProviderTransactionReference(tenantId, providerCode, providerTransactionReference)
 *
 * PaymentAttemptDurableRepository:
 *   create, getById, update(expectedVersion), listByPaymentId(tenantId, paymentId, boundedQuery)
 *   findByProviderTransactionReference(tenantId, providerCode, providerTransactionReference)
 *
 * ReceiptDurableRepository:
 *   create, getById, findByPaymentId(tenantId, paymentId), list(boundedQuery)
 *   (receipts are append-mostly; updates reject terminal immutability)
 *
 * FinanceEventDurableRepository:
 *   append(tenantId, eventRecord) — append-only
 *   getById(tenantId, eventId)
 *   list(boundedQuery) — tenant + bounds required
 *
 * IdempotencyDurableRepository:
 *   begin(tenantId, operationType, idempotencyKey, fingerprint, record)
 *   complete(tenantId, operationType, idempotencyKey, expectedVersion, resultReference)
 *   find(tenantId, operationType, idempotencyKey)
 *
 * AuditEvidenceDurableRepository:
 *   create(tenantId, record)
 *   getById(tenantId, evidenceId)
 */
