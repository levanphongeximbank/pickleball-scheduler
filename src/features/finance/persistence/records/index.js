/**
 * Persistence record factories (Phase 1E).
 * Plain serializable records — no domain class instances.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import { OBLIGATION_STATUS_VALUES } from "../../domain/obligation.js";
import { INVOICE_STATUS_VALUES } from "../../domain/invoice.js";
import { PAYMENT_STATUS_VALUES } from "../../domain/payment.js";
import { PAYMENT_ATTEMPT_STATUS_VALUES } from "../../domain/paymentAttempt.js";
import { REFUND_STATUS_VALUES } from "../../domain/refund.js";
import {
  FINANCE_EVENT_TYPE_VALUES,
  FINANCE_PRIVACY_CLASSIFICATION_VALUES,
} from "../../events/catalogue.js";
import {
  optionalIsoTimestamp,
  optionalRecordId,
  requireCanonicalCurrency,
  requireIsoTimestamp,
  requireKnownStatus,
  requireOptimisticVersion,
  requireRecordId,
  requireSafeMinorAmount,
  requireSafeMetadata,
  requireTenantId,
  serializeRecordDeterministically,
} from "../validation/recordValidation.js";
import { assertNoSecretBearingValue } from "../validation/safeMetadata.js";
import {
  createExternalReference,
  normalizeExternalReferences,
} from "./externalReference.js";

export const IDEMPOTENCY_EXECUTION_STATUS = Object.freeze({
  STARTED: "STARTED",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
});

export const IDEMPOTENCY_EXECUTION_STATUS_VALUES = Object.freeze(
  Object.values(IDEMPOTENCY_EXECUTION_STATUS)
);

export const EVIDENCE_VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

export const EVIDENCE_VERIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(EVIDENCE_VERIFICATION_STATUS)
);

export const EVIDENCE_REDACTION_CLASSIFICATION = Object.freeze({
  NONE: "NONE",
  PARTIAL: "PARTIAL",
  FULL: "FULL",
});

export const EVIDENCE_REDACTION_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(EVIDENCE_REDACTION_CLASSIFICATION)
);

export const EVIDENCE_RETENTION_CLASSIFICATION = Object.freeze({
  STANDARD: "STANDARD",
  EXTENDED: "EXTENDED",
  LEGAL_HOLD: "LEGAL_HOLD",
});

export const EVIDENCE_RETENTION_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(EVIDENCE_RETENTION_CLASSIFICATION)
);

/**
 * @param {object} base
 * @returns {Readonly<object>}
 */
function freezeRecord(base) {
  return Object.freeze(base);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createObligationRecord(input = {}) {
  const tenantId = requireTenantId(input.tenantId);
  const status = requireKnownStatus(input.status, OBLIGATION_STATUS_VALUES);
  const amountMinor = requireSafeMinorAmount(input.amountMinor);
  const currency = requireCanonicalCurrency(input.currency);
  const settledAmountMinor = requireSafeMinorAmount(
    input.settledAmountMinor == null ? 0 : input.settledAmountMinor,
    "settledAmountMinor"
  );
  if (settledAmountMinor > amountMinor) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Obligation settledAmountMinor cannot exceed amountMinor.",
      { field: "settledAmountMinor" }
    );
  }

  return freezeRecord({
    recordType: "FinancialObligation",
    id: requireRecordId(input.id ?? input.obligationId, "id"),
    tenantId,
    version: requireOptimisticVersion(input.version ?? 1),
    status,
    amountMinor,
    currency,
    settledAmountMinor,
    feeId: optionalRecordId(input.feeId),
    invoiceId: optionalRecordId(input.invoiceId),
    businessReference: optionalRecordId(input.businessReference ?? input.subjectRef),
    externalReferences: normalizeExternalReferences(input.externalReferences),
    dueAt: optionalIsoTimestamp(input.dueAt, "dueAt"),
    settlementStarted: Boolean(input.settlementStarted),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    evidenceRefs: Object.freeze(
      Array.isArray(input.evidenceRefs)
        ? input.evidenceRefs.map((r) => requireRecordId(r, "evidenceRef"))
        : []
    ),
    createdAt: requireIsoTimestamp(input.createdAt, "createdAt"),
    updatedAt: requireIsoTimestamp(input.updatedAt ?? input.createdAt, "updatedAt"),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createInvoiceItemRecord(input = {}) {
  const quantity = input.quantity == null ? 1 : input.quantity;
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Invoice item quantity must be a positive safe integer.",
      { field: "quantity" }
    );
  }
  const unitAmountMinor = requireSafeMinorAmount(input.unitAmountMinor, "unitAmountMinor");
  const lineTotalMinor = requireSafeMinorAmount(
    input.lineTotalMinor == null ? unitAmountMinor * quantity : input.lineTotalMinor,
    "lineTotalMinor"
  );
  if (lineTotalMinor !== unitAmountMinor * quantity) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Invoice item lineTotalMinor must equal unitAmountMinor * quantity.",
      { field: "lineTotalMinor" }
    );
  }
  const currency = requireCanonicalCurrency(input.currency);
  return freezeRecord({
    recordType: "InvoiceItem",
    id: requireRecordId(input.id ?? input.itemId, "id"),
    description:
      input.description == null
        ? null
        : typeof input.description === "string"
          ? input.description.trim() || null
          : (() => {
              throw new FinanceError(
                FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
                "Invoice item description must be a string.",
                { field: "description" }
              );
            })(),
    quantity,
    unitAmountMinor,
    lineTotalMinor,
    currency,
    feeId: optionalRecordId(input.feeId),
    obligationId: optionalRecordId(input.obligationId),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createInvoiceRecord(input = {}) {
  const currency = requireCanonicalCurrency(input.currency);
  const items = Object.freeze(
    (Array.isArray(input.items) ? input.items : []).map((item) =>
      createInvoiceItemRecord({ ...item, currency: item.currency ?? currency })
    )
  );
  for (const item of items) {
    if (item.currency !== currency) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        "Invoice item currency must match invoice currency.",
        { field: "currency" }
      );
    }
  }
  const computedTotal = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const amountMinor =
    input.amountMinor == null ? computedTotal : requireSafeMinorAmount(input.amountMinor);
  if (items.length > 0 && amountMinor !== computedTotal) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Invoice amountMinor must equal the sum of item line totals.",
      {
        field: "amountMinor",
        declaredMinor: amountMinor,
        computedMinor: computedTotal,
      }
    );
  }
  const paidAmountMinor = requireSafeMinorAmount(
    input.paidAmountMinor == null ? 0 : input.paidAmountMinor,
    "paidAmountMinor"
  );
  if (paidAmountMinor > amountMinor) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Invoice paidAmountMinor cannot exceed amountMinor.",
      { field: "paidAmountMinor" }
    );
  }

  return freezeRecord({
    recordType: "Invoice",
    id: requireRecordId(input.id ?? input.invoiceId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    status: requireKnownStatus(input.status, INVOICE_STATUS_VALUES),
    invoiceNumber: optionalRecordId(input.invoiceNumber),
    amountMinor,
    currency,
    paidAmountMinor,
    items,
    businessReference: optionalRecordId(input.businessReference),
    externalReferences: normalizeExternalReferences(input.externalReferences),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    evidenceRefs: Object.freeze(
      Array.isArray(input.evidenceRefs)
        ? input.evidenceRefs.map((r) => requireRecordId(r, "evidenceRef"))
        : []
    ),
    issuedAt: optionalIsoTimestamp(input.issuedAt, "issuedAt"),
    createdAt: requireIsoTimestamp(input.createdAt, "createdAt"),
    updatedAt: requireIsoTimestamp(input.updatedAt ?? input.createdAt, "updatedAt"),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentAttemptRecord(input = {}) {
  const status = requireKnownStatus(input.status, PAYMENT_ATTEMPT_STATUS_VALUES);
  const evidenceRef = optionalRecordId(input.evidenceRef);
  if (status === "CONFIRMED" && !evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Confirmed payment attempt record requires evidenceRef.",
      { field: "evidenceRef" }
    );
  }
  const attemptNumber = input.attemptNumber == null ? 1 : input.attemptNumber;
  if (
    typeof attemptNumber !== "number" ||
    !Number.isSafeInteger(attemptNumber) ||
    attemptNumber < 1
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "attemptNumber must be a positive safe integer.",
      { field: "attemptNumber" }
    );
  }

  return freezeRecord({
    recordType: "PaymentAttempt",
    id: requireRecordId(input.id ?? input.attemptId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    paymentId: requireRecordId(input.paymentId, "paymentId"),
    attemptNumber,
    status,
    amountMinor: requireSafeMinorAmount(input.amountMinor),
    currency: requireCanonicalCurrency(input.currency),
    providerCode: optionalRecordId(input.providerCode ?? input.providerReference),
    providerTransactionReference: optionalRecordId(input.providerTransactionReference),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    evidenceRef,
    auditEvidenceRef: optionalRecordId(input.auditEvidenceRef),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    createdAt: requireIsoTimestamp(input.createdAt ?? "1970-01-01T00:00:00.000Z", "createdAt"),
    updatedAt: requireIsoTimestamp(
      input.updatedAt ?? input.createdAt ?? "1970-01-01T00:00:00.000Z",
      "updatedAt"
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentRecord(input = {}) {
  const status = requireKnownStatus(input.status, PAYMENT_STATUS_VALUES);
  const evidenceRef = optionalRecordId(input.evidenceRef);
  if (status === "CONFIRMED" && !evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Confirmed payment record requires evidenceRef.",
      { field: "evidenceRef" }
    );
  }
  const amountMinor = requireSafeMinorAmount(input.amountMinor);
  const refundedAmountMinor = requireSafeMinorAmount(
    input.refundedAmountMinor == null ? 0 : input.refundedAmountMinor,
    "refundedAmountMinor"
  );
  if (refundedAmountMinor > amountMinor) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Payment refundedAmountMinor cannot exceed amountMinor.",
      { field: "refundedAmountMinor" }
    );
  }

  return freezeRecord({
    recordType: "Payment",
    id: requireRecordId(input.id ?? input.paymentId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    paymentReference: optionalRecordId(input.paymentReference) || requireRecordId(input.id ?? input.paymentId, "id"),
    status,
    amountMinor,
    currency: requireCanonicalCurrency(input.currency),
    refundedAmountMinor,
    invoiceId: optionalRecordId(input.invoiceId),
    obligationId: optionalRecordId(input.obligationId),
    providerCode: optionalRecordId(input.providerCode ?? input.providerReference),
    providerTransactionReference: optionalRecordId(input.providerTransactionReference),
    confirmedAttemptId: optionalRecordId(input.confirmedAttemptId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    evidenceRef,
    auditEvidenceRef: optionalRecordId(input.auditEvidenceRef),
    externalReferences: normalizeExternalReferences(input.externalReferences),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    confirmedAt: optionalIsoTimestamp(input.confirmedAt, "confirmedAt"),
    createdAt: requireIsoTimestamp(input.createdAt, "createdAt"),
    updatedAt: requireIsoTimestamp(input.updatedAt ?? input.createdAt, "updatedAt"),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createReceiptRecord(input = {}) {
  return freezeRecord({
    recordType: "Receipt",
    id: requireRecordId(input.id ?? input.receiptId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    paymentId: requireRecordId(input.paymentId, "paymentId"),
    paymentReference: optionalRecordId(input.paymentReference) || requireRecordId(input.paymentId, "paymentId"),
    amountMinor: requireSafeMinorAmount(input.amountMinor),
    currency: requireCanonicalCurrency(input.currency),
    evidenceRef: requireRecordId(input.evidenceRef, "evidenceRef"),
    auditEvidenceRef: optionalRecordId(input.auditEvidenceRef),
    externalReferences: normalizeExternalReferences(input.externalReferences),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    issuedAt: requireIsoTimestamp(input.issuedAt, "issuedAt"),
    createdAt: requireIsoTimestamp(input.createdAt ?? input.issuedAt, "createdAt"),
    updatedAt: requireIsoTimestamp(
      input.updatedAt ?? input.createdAt ?? input.issuedAt,
      "updatedAt"
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createRefundRecord(input = {}) {
  const status = requireKnownStatus(input.status, REFUND_STATUS_VALUES);
  const evidenceRef = optionalRecordId(input.evidenceRef);
  if (status === "COMPLETED" && !evidenceRef) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
      "Completed refund record requires evidenceRef.",
      { field: "evidenceRef" }
    );
  }
  const amountMinor = requireSafeMinorAmount(input.amountMinor);
  if (amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Refund amountMinor must be positive.",
      { field: "amountMinor" }
    );
  }

  return freezeRecord({
    recordType: "Refund",
    id: requireRecordId(input.id ?? input.refundId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    paymentId: requireRecordId(input.paymentId, "paymentId"),
    status,
    amountMinor,
    currency: requireCanonicalCurrency(input.currency),
    reason: optionalRecordId(input.reason),
    evidenceRef,
    auditEvidenceRef: optionalRecordId(input.auditEvidenceRef),
    providerCode: optionalRecordId(input.providerCode),
    providerRefundReference: optionalRecordId(input.providerRefundReference),
    externalReferences: normalizeExternalReferences(input.externalReferences),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    requestedAt: optionalIsoTimestamp(input.requestedAt, "requestedAt"),
    approvedAt: optionalIsoTimestamp(input.approvedAt, "approvedAt"),
    rejectedAt: optionalIsoTimestamp(input.rejectedAt, "rejectedAt"),
    completedAt: optionalIsoTimestamp(input.completedAt, "completedAt"),
    createdAt: requireIsoTimestamp(
      input.createdAt ?? input.requestedAt ?? "1970-01-01T00:00:00.000Z",
      "createdAt"
    ),
    updatedAt: requireIsoTimestamp(
      input.updatedAt ?? input.createdAt ?? input.requestedAt ?? "1970-01-01T00:00:00.000Z",
      "updatedAt"
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createFinancialEventRecord(input = {}) {
  const eventType = requireKnownStatus(input.eventType, FINANCE_EVENT_TYPE_VALUES, "eventType");
  const privacyClassification = requireKnownStatus(
    input.privacyClassification ?? "INTERNAL",
    FINANCE_PRIVACY_CLASSIFICATION_VALUES,
    "privacyClassification"
  );

  return freezeRecord({
    recordType: "FinancialEvent",
    id: requireRecordId(input.id ?? input.eventId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    eventType,
    eventVersion:
      typeof input.eventVersion === "number" && Number.isSafeInteger(input.eventVersion)
        ? input.eventVersion
        : 1,
    occurredAt: requireIsoTimestamp(input.occurredAt, "occurredAt"),
    recordedAt: requireIsoTimestamp(input.recordedAt ?? input.occurredAt, "recordedAt"),
    correlationId: requireRecordId(input.correlationId, "correlationId"),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    privacyClassification,
    amountMinor:
      input.amountMinor == null ? null : requireSafeMinorAmount(input.amountMinor),
    currency: input.currency == null ? null : requireCanonicalCurrency(input.currency),
    financialReferences: freezeRecord({
      obligationId: optionalRecordId(input.financialReferences?.obligationId),
      invoiceId: optionalRecordId(input.financialReferences?.invoiceId),
      paymentId: optionalRecordId(input.financialReferences?.paymentId),
      attemptId: optionalRecordId(input.financialReferences?.attemptId),
      receiptId: optionalRecordId(input.financialReferences?.receiptId),
      refundId: optionalRecordId(input.financialReferences?.refundId),
    }),
    evidenceRefs: Object.freeze(
      Array.isArray(input.evidenceRefs)
        ? input.evidenceRefs.map((r) => requireRecordId(r, "evidenceRef"))
        : input.evidenceRef
          ? [requireRecordId(input.evidenceRef, "evidenceRef")]
          : []
    ),
    payloadSchemaVersion:
      typeof input.payloadSchemaVersion === "number" &&
      Number.isSafeInteger(input.payloadSchemaVersion) &&
      input.payloadSchemaVersion >= 1
        ? input.payloadSchemaVersion
        : 1,
    /** Safe normalized payload only — never unrestricted raw provider bodies. */
    payload: freezeRecord(
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? /** @type {Record<string, unknown>} */ (
            assertNoSecretBearingValue(input.payload, "payload")
          )
        : {}
    ),
    createdAt: requireIsoTimestamp(input.createdAt ?? input.recordedAt ?? input.occurredAt, "createdAt"),
    updatedAt: requireIsoTimestamp(
      input.updatedAt ?? input.createdAt ?? input.recordedAt ?? input.occurredAt,
      "updatedAt"
    ),
  });
}

/**
 * Durable idempotency record — fingerprint + safe result reference only.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createIdempotencyRecord(input = {}) {
  const executionStatus = requireKnownStatus(
    input.executionStatus ?? input.status ?? IDEMPOTENCY_EXECUTION_STATUS.STARTED,
    IDEMPOTENCY_EXECUTION_STATUS_VALUES,
    "executionStatus"
  );
  if (input.requestPayload != null || input.rawRequest != null || input.sensitivePayload != null) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Idempotency records must not persist request payloads.",
      { field: "requestPayload" }
    );
  }

  return freezeRecord({
    recordType: "IdempotencyRecord",
    id: requireRecordId(
      input.id ?? `${input.tenantId}:${input.operationType}:${input.idempotencyKey}`,
      "id"
    ),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    operationType: requireRecordId(input.operationType, "operationType"),
    idempotencyKey: requireRecordId(input.idempotencyKey, "idempotencyKey"),
    requestFingerprint: requireRecordId(input.requestFingerprint, "requestFingerprint"),
    executionStatus,
    resultReference: optionalRecordId(input.resultReference ?? input.resultRef),
    /** Opaque safe result pointer only — never full command payloads. */
    resultEntityType: optionalRecordId(input.resultEntityType),
    resultEntityId: optionalRecordId(input.resultEntityId),
    retentionPolicyRef: optionalRecordId(input.retentionPolicyRef) || "finance-idempotency-v1",
    createdAt: requireIsoTimestamp(input.createdAt, "createdAt"),
    completedAt: optionalIsoTimestamp(input.completedAt, "completedAt"),
    updatedAt: requireIsoTimestamp(input.updatedAt ?? input.createdAt, "updatedAt"),
    expiresAt: optionalIsoTimestamp(input.expiresAt, "expiresAt"),
  });
}

/**
 * Audit evidence reference — redaction-aware, no blob storage.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createAuditEvidenceRecord(input = {}) {
  if (
    input.rawPayload != null ||
    input.authorizationHeader != null ||
    input.token != null ||
    input.cvv != null ||
    input.cardNumber != null ||
    input.secrets != null
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PERSISTENCE_RECORD_INVALID,
      "Audit evidence must not include secrets or unrestricted raw payloads.",
      { field: "evidence" }
    );
  }

  return freezeRecord({
    recordType: "AuditEvidenceReference",
    id: requireRecordId(input.id ?? input.evidenceId, "id"),
    tenantId: requireTenantId(input.tenantId),
    version: requireOptimisticVersion(input.version ?? 1),
    evidenceType: requireRecordId(input.evidenceType, "evidenceType"),
    providerCode: optionalRecordId(input.providerCode),
    externalReference: optionalRecordId(input.externalReference),
    capturedAt: requireIsoTimestamp(input.capturedAt, "capturedAt"),
    verificationStatus: requireKnownStatus(
      input.verificationStatus ?? EVIDENCE_VERIFICATION_STATUS.UNVERIFIED,
      EVIDENCE_VERIFICATION_STATUS_VALUES,
      "verificationStatus"
    ),
    integrityDigest: optionalRecordId(input.integrityDigest ?? input.digest),
    redactionClassification: requireKnownStatus(
      input.redactionClassification ?? EVIDENCE_REDACTION_CLASSIFICATION.PARTIAL,
      EVIDENCE_REDACTION_CLASSIFICATION_VALUES,
      "redactionClassification"
    ),
    retentionClassification: requireKnownStatus(
      input.retentionClassification ?? EVIDENCE_RETENTION_CLASSIFICATION.STANDARD,
      EVIDENCE_RETENTION_CLASSIFICATION_VALUES,
      "retentionClassification"
    ),
    metadata: requireSafeMetadata(input.metadata),
    createdAt: requireIsoTimestamp(input.createdAt ?? input.capturedAt, "createdAt"),
    updatedAt: requireIsoTimestamp(
      input.updatedAt ?? input.createdAt ?? input.capturedAt,
      "updatedAt"
    ),
  });
}

export { serializeRecordDeterministically, createExternalReference };
