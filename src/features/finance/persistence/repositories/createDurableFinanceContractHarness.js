/**
 * In-memory durable-contract harness (Phase 1E).
 *
 * Proves tenant scope, optimistic concurrency, uniqueness, append-only events,
 * and idempotency semantics. NOT a production store. NOT Supabase. NOT durable.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createObligationRecord,
  createInvoiceRecord,
  createPaymentRecord,
  createPaymentAttemptRecord,
  createReceiptRecord,
  createRefundRecord,
  createFinancialEventRecord,
  createIdempotencyRecord,
  createAuditEvidenceRecord,
  IDEMPOTENCY_EXECUTION_STATUS,
} from "../records/index.js";
import {
  createBoundedListQuery,
  notFoundError,
  requireExpectedVersion,
  requireTenantScope,
  tenantMismatchError,
  uniquenessConflictError,
  versionConflictError,
} from "./durablePorts.js";
import { applyOptimisticUpdate } from "../transaction/optimisticConcurrency.js";

/**
 * @param {Map<string, object>} map
 * @param {string} tenantId
 * @param {string} id
 */
function tenantKey(tenantId, id) {
  return `${tenantId}::${id}`;
}

/**
 * @returns {object}
 */
export function createDurableFinanceContractHarness() {
  /** @type {Map<string, object>} */
  const obligations = new Map();
  /** @type {Map<string, object>} */
  const invoices = new Map();
  /** @type {Map<string, object>} */
  const payments = new Map();
  /** @type {Map<string, object>} */
  const attempts = new Map();
  /** @type {Map<string, object>} */
  const receipts = new Map();
  /** @type {Map<string, object>} */
  const refunds = new Map();
  /** @type {Map<string, object>} */
  const events = new Map();
  /** @type {Map<string, object>} */
  const idempotency = new Map();
  /** @type {Map<string, object>} */
  const evidence = new Map();
  /** @type {Map<string, string>} */
  const providerTxnIndex = new Map();
  /** @type {Map<string, string>} */
  const receiptByPayment = new Map();

  function assertSameTenant(record, tenantId) {
    if (record.tenantId !== tenantId) {
      throw tenantMismatchError({
        expectedTenantId: tenantId,
        actualTenantId: record.tenantId,
        id: record.id,
      });
    }
  }

  function clone(record) {
    return Object.freeze(JSON.parse(JSON.stringify(record)));
  }

  const obligationRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createObligationRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (obligations.has(key)) {
        throw uniquenessConflictError("FinancialObligation", { id: record.id, tenantId: tid });
      }
      obligations.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = obligations.get(tenantKey(tid, id));
      if (!record) throw notFoundError("FinancialObligation", tid, id);
      assertSameTenant(record, tid);
      return clone(record);
    },
    findById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = obligations.get(tenantKey(tid, id));
      return record ? clone(record) : null;
    },
    update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const current = obligations.get(tenantKey(tid, id));
      if (!current) throw notFoundError("FinancialObligation", tid, id);
      assertSameTenant(current, tid);
      const merged = createObligationRecord({
        ...current,
        ...nextInput,
        id: current.id,
        tenantId: tid,
        version: current.version,
        createdAt: current.createdAt,
      });
      const updated = createObligationRecord(
        applyOptimisticUpdate(current, merged, expectedVersion, {
          entity: "FinancialObligation",
          aggregate: "obligation",
        })
      );
      obligations.set(tenantKey(tid, id), updated);
      return clone(updated);
    },
    list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      let rows = [...obligations.values()].filter((r) => r.tenantId === query.tenantId);
      if (query.status) rows = rows.filter((r) => r.status === query.status);
      if (query.businessReference) {
        rows = rows.filter((r) => r.businessReference === query.businessReference);
      }
      rows.sort((a, b) =>
        query.sort === "createdAtDesc"
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt)
      );
      return Object.freeze(rows.slice(0, query.limit).map(clone));
    },
  };

  const paymentRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createPaymentRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (payments.has(key)) {
        throw uniquenessConflictError("Payment", { id: record.id, tenantId: tid });
      }
      if (record.providerTransactionReference) {
        const pKey = `${tid}::${record.providerCode || ""}::${record.providerTransactionReference}`;
        if (providerTxnIndex.has(pKey)) {
          throw uniquenessConflictError("Payment.providerTransactionReference", {
            tenantId: tid,
            providerTransactionReference: record.providerTransactionReference,
          });
        }
        providerTxnIndex.set(pKey, record.id);
      }
      payments.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = payments.get(tenantKey(tid, id));
      if (!record) throw notFoundError("Payment", tid, id);
      return clone(record);
    },
    findByProviderTransactionReference(tenantId, providerCode, providerTransactionReference) {
      const tid = requireTenantScope(tenantId);
      if (!providerTransactionReference) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
          "providerTransactionReference is required.",
          { field: "providerTransactionReference" }
        );
      }
      const pKey = `${tid}::${providerCode || ""}::${providerTransactionReference}`;
      const id = providerTxnIndex.get(pKey);
      if (!id) return null;
      const record = payments.get(tenantKey(tid, id));
      return record ? clone(record) : null;
    },
    update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const current = payments.get(tenantKey(tid, id));
      if (!current) throw notFoundError("Payment", tid, id);
      const merged = createPaymentRecord({
        ...current,
        ...nextInput,
        id: current.id,
        tenantId: tid,
        version: current.version,
        createdAt: current.createdAt,
      });
      const updated = createPaymentRecord(
        applyOptimisticUpdate(current, merged, expectedVersion, {
          entity: "Payment",
          aggregate: "payment",
        })
      );
      payments.set(tenantKey(tid, id), updated);
      return clone(updated);
    },
    list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      const rows = [...payments.values()]
        .filter((r) => r.tenantId === query.tenantId)
        .slice(0, query.limit)
        .map(clone);
      return Object.freeze(rows);
    },
  };

  const attemptRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createPaymentAttemptRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (attempts.has(key)) {
        throw uniquenessConflictError("PaymentAttempt", { id: record.id, tenantId: tid });
      }
      attempts.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = attempts.get(tenantKey(tid, id));
      if (!record) throw notFoundError("PaymentAttempt", tid, id);
      return clone(record);
    },
    update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const current = attempts.get(tenantKey(tid, id));
      if (!current) throw notFoundError("PaymentAttempt", tid, id);
      const merged = createPaymentAttemptRecord({
        ...current,
        ...nextInput,
        id: current.id,
        tenantId: tid,
        version: current.version,
        createdAt: current.createdAt,
      });
      const updated = createPaymentAttemptRecord(
        applyOptimisticUpdate(current, merged, expectedVersion, {
          entity: "PaymentAttempt",
          aggregate: "paymentAttempt",
        })
      );
      attempts.set(tenantKey(tid, id), updated);
      return clone(updated);
    },
    listByPaymentId(tenantId, paymentId, queryInput = {}) {
      const tid = requireTenantScope(tenantId);
      const query = createBoundedListQuery({ ...queryInput, tenantId: tid, paymentId });
      return Object.freeze(
        [...attempts.values()]
          .filter((r) => r.tenantId === tid && r.paymentId === paymentId)
          .slice(0, query.limit)
          .map(clone)
      );
    },
  };

  const receiptRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createReceiptRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (receipts.has(key)) {
        throw uniquenessConflictError("Receipt", { id: record.id, tenantId: tid });
      }
      const payKey = tenantKey(tid, record.paymentId);
      if (receiptByPayment.has(payKey)) {
        throw uniquenessConflictError("Receipt.paymentId", {
          tenantId: tid,
          paymentId: record.paymentId,
        });
      }
      receipts.set(key, record);
      receiptByPayment.set(payKey, record.id);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = receipts.get(tenantKey(tid, id));
      if (!record) throw notFoundError("Receipt", tid, id);
      return clone(record);
    },
    findByPaymentId(tenantId, paymentId) {
      const tid = requireTenantScope(tenantId);
      const id = receiptByPayment.get(tenantKey(tid, paymentId));
      if (!id) return null;
      return clone(receipts.get(tenantKey(tid, id)));
    },
    update() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Receipt records are immutable after create.",
        { entity: "Receipt" }
      );
    },
  };

  const refundRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createRefundRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (refunds.has(key)) {
        throw uniquenessConflictError("Refund", { id: record.id, tenantId: tid });
      }
      // Cross-tenant payment attach prevention: payment must exist in same tenant when present
      if (record.paymentId) {
        const payment = payments.get(tenantKey(tid, record.paymentId));
        if (payment && payment.tenantId !== tid) {
          throw tenantMismatchError({ paymentId: record.paymentId, tenantId: tid });
        }
      }
      refunds.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = refunds.get(tenantKey(tid, id));
      if (!record) throw notFoundError("Refund", tid, id);
      return clone(record);
    },
    update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const current = refunds.get(tenantKey(tid, id));
      if (!current) throw notFoundError("Refund", tid, id);
      const merged = createRefundRecord({
        ...current,
        ...nextInput,
        id: current.id,
        tenantId: tid,
        version: current.version,
        createdAt: current.createdAt,
      });
      const updated = createRefundRecord(
        applyOptimisticUpdate(current, merged, expectedVersion, {
          entity: "Refund",
          aggregate: "refund",
        })
      );
      refunds.set(tenantKey(tid, id), updated);
      return clone(updated);
    },
  };

  const invoiceRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createInvoiceRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (invoices.has(key)) {
        throw uniquenessConflictError("Invoice", { id: record.id, tenantId: tid });
      }
      invoices.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = invoices.get(tenantKey(tid, id));
      if (!record) throw notFoundError("Invoice", tid, id);
      return clone(record);
    },
    update(tenantId, id, expectedVersion, nextInput) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const current = invoices.get(tenantKey(tid, id));
      if (!current) throw notFoundError("Invoice", tid, id);
      const merged = createInvoiceRecord({
        ...current,
        ...nextInput,
        id: current.id,
        tenantId: tid,
        version: current.version,
        createdAt: current.createdAt,
        items: nextInput.items ?? current.items,
      });
      const updated = createInvoiceRecord(
        applyOptimisticUpdate(current, merged, expectedVersion, {
          entity: "Invoice",
          aggregate: "invoice",
        })
      );
      invoices.set(tenantKey(tid, id), updated);
      return clone(updated);
    },
  };

  const eventRepo = {
    append(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createFinancialEventRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (events.has(key)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.EVENT_APPEND_CONFLICT,
          "Duplicate Finance event id.",
          { tenantId: tid, eventId: record.id }
        );
      }
      events.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = events.get(tenantKey(tid, id));
      if (!record) throw notFoundError("FinancialEvent", tid, id);
      return clone(record);
    },
    update() {
      throw new FinanceError(
        FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
        "Financial events are append-only and cannot be mutated.",
        { entity: "FinancialEvent" }
      );
    },
    list(queryInput) {
      const query = createBoundedListQuery(queryInput);
      // Cross-tenant query rejected by requireTenantScope inside createBoundedListQuery
      let rows = [...events.values()].filter((r) => r.tenantId === query.tenantId);
      if (query.occurredFrom) {
        rows = rows.filter((r) => r.occurredAt >= query.occurredFrom);
      }
      if (query.occurredTo) {
        rows = rows.filter((r) => r.occurredAt <= query.occurredTo);
      }
      rows.sort((a, b) =>
        query.sort === "occurredAtDesc"
          ? b.occurredAt.localeCompare(a.occurredAt)
          : a.occurredAt.localeCompare(b.occurredAt)
      );
      return Object.freeze(rows.slice(0, query.limit).map(clone));
    },
  };

  const idempotencyRepo = {
    find(tenantId, operationType, idempotencyKey) {
      const tid = requireTenantScope(tenantId);
      const key = `${tid}::${operationType}::${idempotencyKey}`;
      const record = idempotency.get(key);
      return record ? clone(record) : null;
    },
    begin(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createIdempotencyRecord({
        ...input,
        tenantId: tid,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.STARTED,
      });
      const key = `${tid}::${record.operationType}::${record.idempotencyKey}`;
      const existing = idempotency.get(key);
      if (existing) {
        if (
          existing.executionStatus === IDEMPOTENCY_EXECUTION_STATUS.STARTED
        ) {
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
        // Same key + same fingerprint → replay existing (no concurrency side effect)
        return clone(existing);
      }
      idempotency.set(key, record);
      return clone(record);
    },
    complete(tenantId, operationType, idempotencyKey, expectedVersion, resultReference) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const key = `${tid}::${operationType}::${idempotencyKey}`;
      const current = idempotency.get(key);
      if (!current) throw notFoundError("IdempotencyRecord", tid, idempotencyKey);
      if (current.version !== expectedVersion) {
        throw versionConflictError("IdempotencyRecord", {
          expectedVersion,
          actualVersion: current.version,
        });
      }
      const updated = createIdempotencyRecord({
        ...current,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.COMPLETED,
        resultReference,
        completedAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        version: current.version + 1,
      });
      idempotency.set(key, updated);
      return clone(updated);
    },
    /**
     * Failed execution policy: mark FAILED; same key+fingerprint may retry by
     * replacing FAILED/ABANDONED with a new STARTED (explicit, not silent).
     */
    markFailed(tenantId, operationType, idempotencyKey, expectedVersion) {
      const tid = requireTenantScope(tenantId);
      requireExpectedVersion(expectedVersion);
      const key = `${tid}::${operationType}::${idempotencyKey}`;
      const current = idempotency.get(key);
      if (!current) throw notFoundError("IdempotencyRecord", tid, idempotencyKey);
      if (current.version !== expectedVersion) {
        throw versionConflictError("IdempotencyRecord", {
          expectedVersion,
          actualVersion: current.version,
        });
      }
      const updated = createIdempotencyRecord({
        ...current,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.FAILED,
        updatedAt: current.updatedAt,
        version: current.version + 1,
      });
      idempotency.set(key, updated);
      return clone(updated);
    },
    retryAfterFailure(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const probe = createIdempotencyRecord({
        ...input,
        tenantId: tid,
        executionStatus: IDEMPOTENCY_EXECUTION_STATUS.STARTED,
      });
      const key = `${tid}::${probe.operationType}::${probe.idempotencyKey}`;
      const existing = idempotency.get(key);
      if (!existing) return this.begin(tid, input);
      if (
        existing.executionStatus !== IDEMPOTENCY_EXECUTION_STATUS.FAILED &&
        existing.executionStatus !== IDEMPOTENCY_EXECUTION_STATUS.ABANDONED
      ) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
          "Only failed/abandoned idempotency executions may be retried explicitly.",
          { executionStatus: existing.executionStatus }
        );
      }
      if (existing.requestFingerprint !== probe.requestFingerprint) {
        throw uniquenessConflictError("IdempotencyRecord.fingerprint", {
          tenantId: tid,
          idempotencyKey: probe.idempotencyKey,
        });
      }
      const restarted = createIdempotencyRecord({
        ...probe,
        version: existing.version + 1,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      });
      idempotency.set(key, restarted);
      return clone(restarted);
    },
  };

  const evidenceRepo = {
    create(tenantId, input) {
      const tid = requireTenantScope(tenantId);
      const record = createAuditEvidenceRecord({ ...input, tenantId: tid });
      const key = tenantKey(tid, record.id);
      if (evidence.has(key)) {
        throw uniquenessConflictError("AuditEvidenceReference", {
          id: record.id,
          tenantId: tid,
        });
      }
      evidence.set(key, record);
      return clone(record);
    },
    getById(tenantId, id) {
      const tid = requireTenantScope(tenantId);
      const record = evidence.get(tenantKey(tid, id));
      if (!record) throw notFoundError("AuditEvidenceReference", tid, id);
      return clone(record);
    },
  };

  return Object.freeze({
    durabilityClaim: "contract-harness-only",
    isDurable: false,
    isSupabase: false,
    obligations: obligationRepo,
    invoices: invoiceRepo,
    payments: paymentRepo,
    paymentAttempts: attemptRepo,
    receipts: receiptRepo,
    refunds: refundRepo,
    events: eventRepo,
    idempotency: idempotencyRepo,
    auditEvidence: evidenceRepo,
    resetAllForTests() {
      obligations.clear();
      invoices.clear();
      payments.clear();
      attempts.clear();
      receipts.clear();
      refunds.clear();
      events.clear();
      idempotency.clear();
      evidence.clear();
      providerTxnIndex.clear();
      receiptByPayment.clear();
    },
  });
}
