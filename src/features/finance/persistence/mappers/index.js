/**
 * Bidirectional domain ↔ persistence record mappers (Phase 1E).
 * Do not silently repair corrupted stored records.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { createObligation, OBLIGATION_TERMINAL_STATUSES } from "../../domain/obligation.js";
import { createInvoice, INVOICE_TERMINAL_STATUSES } from "../../domain/invoice.js";
import { createPayment, PAYMENT_TERMINAL_STATUSES } from "../../domain/payment.js";
import { createPaymentAttempt, PAYMENT_ATTEMPT_TERMINAL_STATUSES } from "../../domain/paymentAttempt.js";
import { createReceipt } from "../../domain/receipt.js";
import { createRefund, REFUND_TERMINAL_STATUSES } from "../../domain/refund.js";
import { createFinanceEvent } from "../../events/envelope.js";
import {
  createObligationRecord,
  createInvoiceRecord,
  createPaymentRecord,
  createPaymentAttemptRecord,
  createReceiptRecord,
  createRefundRecord,
  createFinancialEventRecord,
  createIdempotencyRecord,
  IDEMPOTENCY_EXECUTION_STATUS,
} from "../records/index.js";
import {
  EXTERNAL_REFERENCE_KIND,
  externalReferencesFromDomainFields,
} from "../records/externalReference.js";

/**
 * @param {ReadonlyArray<{ kind: string, id: string }>} refs
 * @param {string} kind
 * @returns {string|null}
 */
function findRef(refs, kind) {
  const hit = (refs || []).find((r) => r.kind === kind);
  return hit ? hit.id : null;
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, idempotencyKey?: string, now?: string }} [meta]
 * @returns {Readonly<object>}
 */
export function obligationToRecord(domain, meta = {}) {
  const o = createObligation(domain);
  const createdAt = o.createdAt || meta.now;
  const updatedAt = o.updatedAt || createdAt || meta.now;
  if (!createdAt || !updatedAt) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Obligation persistence requires createdAt/updatedAt.",
      { field: "createdAt" }
    );
  }
  return createObligationRecord({
    id: o.obligationId,
    tenantId: o.tenantId,
    version: meta.version ?? 1,
    status: o.status,
    amountMinor: o.amount.amountMinor,
    currency: o.currency,
    settledAmountMinor: o.settledAmount.amountMinor,
    feeId: o.feeId,
    invoiceId: o.invoiceId,
    businessReference: o.subjectRef,
    externalReferences: externalReferencesFromDomainFields(o),
    dueAt: o.dueAt,
    settlementStarted: o.settlementStarted,
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    idempotencyKey: meta.idempotencyKey,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {object} record
 * @returns {Readonly<object>}
 */
export function obligationFromRecord(record) {
  let normalized;
  try {
    normalized = createObligationRecord(record);
  } catch (err) {
    if (err instanceof FinanceError && err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD) {
      throw err;
    }
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored obligation record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createObligation({
    obligationId: normalized.id,
    tenantId: normalized.tenantId,
    venueId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.VENUE),
    clubId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.CLUB),
    subjectRef: normalized.businessReference,
    feeId: normalized.feeId,
    invoiceId: normalized.invoiceId,
    competitionRef: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.COMPETITION),
    bookingRef: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.BOOKING),
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    settledAmountMinor: normalized.settledAmountMinor,
    status: normalized.status,
    dueAt: normalized.dueAt,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    settlementStarted: normalized.settlementStarted,
  });
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, idempotencyKey?: string, invoiceNumber?: string, now?: string }} [meta]
 */
export function invoiceToRecord(domain, meta = {}) {
  const inv = createInvoice(domain);
  const createdAt = inv.createdAt || meta.now;
  const updatedAt = inv.updatedAt || createdAt || meta.now;
  if (!createdAt || !updatedAt) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Invoice persistence requires createdAt/updatedAt.",
      { field: "createdAt" }
    );
  }
  return createInvoiceRecord({
    id: inv.invoiceId,
    tenantId: inv.tenantId,
    version: meta.version ?? 1,
    status: inv.status,
    invoiceNumber: meta.invoiceNumber ?? null,
    amountMinor: inv.total.amountMinor,
    currency: inv.currency,
    paidAmountMinor: inv.amountPaid?.amountMinor ?? 0,
    items: inv.items.map((item) => ({
      id: item.itemId,
      description: item.description,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmount.amountMinor,
      lineTotalMinor: item.lineTotal.amountMinor,
      currency: item.unitAmount.currency,
      feeId: item.feeId,
      obligationId: item.obligationId,
    })),
    externalReferences: externalReferencesFromDomainFields(inv),
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    idempotencyKey: meta.idempotencyKey,
    issuedAt: inv.issuedAt,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {object} record
 */
export function invoiceFromRecord(record) {
  let normalized;
  try {
    normalized = createInvoiceRecord(record);
  } catch (err) {
    if (err instanceof FinanceError && err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD) {
      throw err;
    }
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored invoice record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createInvoice({
    invoiceId: normalized.id,
    tenantId: normalized.tenantId,
    venueId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.VENUE),
    clubId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.CLUB),
    currency: normalized.currency,
    amountMinor: normalized.amountMinor,
    amountPaidMinor: normalized.paidAmountMinor,
    status: normalized.status,
    items: normalized.items.map((item) => ({
      itemId: item.id,
      description: item.description,
      quantity: item.quantity,
      amountMinor: item.unitAmountMinor,
      currency: item.currency,
      feeId: item.feeId,
      obligationId: item.obligationId,
    })),
    issuedAt: normalized.issuedAt,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  });
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, now?: string }} [meta]
 */
export function paymentAttemptToRecord(domain, meta = {}) {
  const a = createPaymentAttempt(domain);
  const createdAt = a.createdAt || meta.now || "1970-01-01T00:00:00.000Z";
  const updatedAt = a.updatedAt || createdAt;
  return createPaymentAttemptRecord({
    id: a.attemptId,
    tenantId: a.tenantId,
    version: meta.version ?? 1,
    paymentId: a.paymentId,
    attemptNumber: a.attemptNumber,
    status: a.status,
    amountMinor: a.amount.amountMinor,
    currency: a.currency,
    providerCode: a.providerReference,
    providerTransactionReference: a.providerTransactionReference,
    idempotencyKey: a.idempotencyKey,
    evidenceRef: a.evidenceRef,
    auditEvidenceRef: a.auditEvidenceRef,
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {object} record
 */
export function paymentAttemptFromRecord(record) {
  let normalized;
  try {
    normalized = createPaymentAttemptRecord(record);
  } catch (err) {
    if (err instanceof FinanceError && err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD) {
      throw err;
    }
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored payment attempt record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createPaymentAttempt({
    attemptId: normalized.id,
    paymentId: normalized.paymentId,
    tenantId: normalized.tenantId,
    attemptNumber: normalized.attemptNumber,
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    status: normalized.status,
    providerReference: normalized.providerCode,
    providerTransactionReference: normalized.providerTransactionReference,
    idempotencyKey: normalized.idempotencyKey,
    evidenceRef: normalized.evidenceRef,
    auditEvidenceRef: normalized.auditEvidenceRef,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  });
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, now?: string }} [meta]
 */
export function paymentToRecord(domain, meta = {}) {
  const p = createPayment(domain);
  const createdAt = p.createdAt || meta.now;
  const updatedAt = p.updatedAt || createdAt || meta.now;
  if (!createdAt || !updatedAt) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Payment persistence requires createdAt/updatedAt.",
      { field: "createdAt" }
    );
  }
  if (p.status === "CONFIRMED" && !p.evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Confirmed payment cannot be persisted without evidenceRef.",
      { field: "evidenceRef" }
    );
  }
  return createPaymentRecord({
    id: p.paymentId,
    tenantId: p.tenantId,
    version: meta.version ?? 1,
    paymentReference: p.paymentReference,
    status: p.status,
    amountMinor: p.amount.amountMinor,
    currency: p.currency,
    refundedAmountMinor: p.refundedAmount.amountMinor,
    invoiceId: p.invoiceId,
    obligationId: p.obligationId,
    providerCode: p.providerReference,
    providerTransactionReference: p.providerTransactionReference,
    confirmedAttemptId: p.confirmedAttemptId,
    idempotencyKey: p.idempotencyKey,
    evidenceRef: p.evidenceRef,
    auditEvidenceRef: p.auditEvidenceRef,
    externalReferences: externalReferencesFromDomainFields(p),
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    confirmedAt: p.confirmedAt,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {object} record
 */
export function paymentFromRecord(record) {
  let normalized;
  try {
    normalized = createPaymentRecord(record);
  } catch (err) {
    if (err instanceof FinanceError && err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD) {
      throw err;
    }
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored payment record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createPayment({
    paymentId: normalized.id,
    paymentReference: normalized.paymentReference,
    tenantId: normalized.tenantId,
    venueId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.VENUE),
    clubId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.CLUB),
    invoiceId: normalized.invoiceId,
    obligationId: normalized.obligationId,
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    refundedAmountMinor: normalized.refundedAmountMinor,
    status: normalized.status,
    providerReference: normalized.providerCode,
    providerTransactionReference: normalized.providerTransactionReference,
    idempotencyKey: normalized.idempotencyKey,
    evidenceRef: normalized.evidenceRef,
    auditEvidenceRef: normalized.auditEvidenceRef,
    confirmedAttemptId: normalized.confirmedAttemptId,
    attempts: [],
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    confirmedAt: normalized.confirmedAt,
  });
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, idempotencyKey?: string }} [meta]
 */
export function receiptToRecord(domain, meta = {}) {
  const r = createReceipt(domain);
  return createReceiptRecord({
    id: r.receiptId,
    tenantId: r.tenantId,
    version: meta.version ?? 1,
    paymentId: r.paymentId,
    paymentReference: r.paymentReference,
    amountMinor: r.amount.amountMinor,
    currency: r.currency,
    evidenceRef: r.evidenceRef,
    auditEvidenceRef: r.auditEvidenceRef,
    externalReferences: externalReferencesFromDomainFields(r),
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    idempotencyKey: meta.idempotencyKey,
    issuedAt: r.issuedAt,
    createdAt: r.issuedAt,
    updatedAt: r.issuedAt,
  });
}

/**
 * @param {object} record
 */
export function receiptFromRecord(record) {
  let normalized;
  try {
    normalized = createReceiptRecord(record);
  } catch (err) {
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored receipt record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createReceipt({
    receiptId: normalized.id,
    tenantId: normalized.tenantId,
    venueId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.VENUE),
    clubId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.CLUB),
    paymentId: normalized.paymentId,
    paymentReference: normalized.paymentReference,
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    issuedAt: normalized.issuedAt,
    evidenceRef: normalized.evidenceRef,
    auditEvidenceRef: normalized.auditEvidenceRef,
  });
}

/**
 * @param {object} domain
 * @param {{ version?: number, correlationId?: string, causationId?: string, idempotencyKey?: string, now?: string }} [meta]
 */
export function refundToRecord(domain, meta = {}) {
  const r = createRefund(domain);
  if (r.status === "COMPLETED" && !r.evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Completed refund cannot be persisted without evidenceRef.",
      { field: "evidenceRef" }
    );
  }
  const createdAt = r.requestedAt || meta.now || "1970-01-01T00:00:00.000Z";
  return createRefundRecord({
    id: r.refundId,
    tenantId: r.tenantId,
    version: meta.version ?? 1,
    paymentId: r.paymentId,
    status: r.status,
    amountMinor: r.amount.amountMinor,
    currency: r.currency,
    reason: r.reason,
    evidenceRef: r.evidenceRef,
    auditEvidenceRef: r.auditEvidenceRef,
    externalReferences: externalReferencesFromDomainFields(r),
    correlationId: meta.correlationId,
    causationId: meta.causationId,
    idempotencyKey: meta.idempotencyKey,
    requestedAt: r.requestedAt,
    approvedAt: r.approvedAt,
    rejectedAt: r.rejectedAt,
    completedAt: r.completedAt,
    createdAt,
    updatedAt: r.completedAt || r.rejectedAt || r.approvedAt || createdAt,
  });
}

/**
 * @param {object} record
 */
export function refundFromRecord(record) {
  let normalized;
  try {
    normalized = createRefundRecord(record);
  } catch (err) {
    if (err instanceof FinanceError && err.code === FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD) {
      throw err;
    }
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored refund record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createRefund({
    refundId: normalized.id,
    paymentId: normalized.paymentId,
    tenantId: normalized.tenantId,
    venueId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.VENUE),
    clubId: findRef(normalized.externalReferences, EXTERNAL_REFERENCE_KIND.CLUB),
    amountMinor: normalized.amountMinor,
    currency: normalized.currency,
    status: normalized.status,
    reason: normalized.reason,
    evidenceRef: normalized.evidenceRef,
    auditEvidenceRef: normalized.auditEvidenceRef,
    requestedAt: normalized.requestedAt,
    approvedAt: normalized.approvedAt,
    rejectedAt: normalized.rejectedAt,
    completedAt: normalized.completedAt,
  });
}

/**
 * @param {object} domainEvent
 * @param {{ recordedAt?: string }} [meta]
 */
export function eventToRecord(domainEvent, meta = {}) {
  const event = createFinanceEvent(domainEvent);
  return createFinancialEventRecord({
    id: event.eventId,
    tenantId: event.tenantId,
    version: 1,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    recordedAt: meta.recordedAt || event.occurredAt,
    correlationId: event.correlationId,
    causationId: event.causationId,
    idempotencyKey: event.idempotencyKey,
    privacyClassification: event.privacyClassification,
    amountMinor: event.amount?.amountMinor ?? null,
    currency: event.amount?.currency ?? event.currency ?? null,
    financialReferences: event.financialReferences || {},
    evidenceRefs: event.evidenceReferences || [],
    payloadSchemaVersion: 1,
    payload: event.payload || {},
    createdAt: meta.recordedAt || event.occurredAt,
    updatedAt: meta.recordedAt || event.occurredAt,
  });
}

/**
 * @param {object} record
 */
export function eventFromRecord(record) {
  let normalized;
  try {
    normalized = createFinancialEventRecord(record);
  } catch (err) {
    if (err instanceof FinanceError) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Stored financial event record is malformed and cannot be mapped.",
        { causeCode: err.code, ...(err.context || {}) }
      );
    }
    throw err;
  }
  return createFinanceEvent({
    eventId: normalized.id,
    eventType: normalized.eventType,
    eventVersion: normalized.eventVersion,
    occurredAt: normalized.occurredAt,
    tenantId: normalized.tenantId,
    correlationId: normalized.correlationId,
    causationId: normalized.causationId,
    idempotencyKey: normalized.idempotencyKey || `persist:${normalized.id}`,
    privacyClassification: normalized.privacyClassification,
    amountMinor: normalized.amountMinor ?? undefined,
    currency: normalized.currency ?? undefined,
    financialReferences: normalized.financialReferences,
    evidenceReferences: normalized.evidenceRefs,
    payload: normalized.payload,
    actor: { actorId: "persistence-mapper", actorType: "system" },
  });
}

/**
 * @param {object} input
 */
export function idempotencyToRecord(input = {}) {
  return createIdempotencyRecord(input);
}

/**
 * @param {object} record
 */
export function idempotencyFromRecord(record) {
  return createIdempotencyRecord(record);
}

/**
 * Terminal immutable aggregates cannot be mutated by version bump alone.
 *
 * @param {string} aggregate
 * @param {string} status
 */
export function assertMutableAggregateStatus(aggregate, status) {
  const terminal =
    (aggregate === "obligation" && OBLIGATION_TERMINAL_STATUSES.includes(status)) ||
    (aggregate === "invoice" && INVOICE_TERMINAL_STATUSES.includes(status)) ||
    (aggregate === "payment" && PAYMENT_TERMINAL_STATUSES.includes(status)) ||
    (aggregate === "paymentAttempt" && PAYMENT_ATTEMPT_TERMINAL_STATUSES.includes(status)) ||
    (aggregate === "refund" && REFUND_TERMINAL_STATUSES.includes(status)) ||
    aggregate === "receipt" ||
    aggregate === "financialEvent";

  if (terminal) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.IMMUTABLE_RECORD,
      `Terminal or immutable ${aggregate} record cannot be updated.`,
      { aggregate, status }
    );
  }
}

export { IDEMPOTENCY_EXECUTION_STATUS };
