/**
 * Explicit snake_case ↔ camelCase row projection for Finance tables (Phase 1G).
 * Reuses Phase 1E record factories for validation — no second mapper system.
 */

import { createFeeDefinition } from "../../domain/feeDefinition.js";
import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FinanceError } from "../../errors/FinanceError.js";
import {
  createObligationRecord,
  createInvoiceRecord,
  createInvoiceItemRecord,
  createPaymentRecord,
  createPaymentAttemptRecord,
  createReceiptRecord,
  createRefundRecord,
  createFinancialEventRecord,
  createIdempotencyRecord,
  createAuditEvidenceRecord,
} from "../records/index.js";
import {
  requireOptimisticVersion,
  requireIsoTimestamp,
  requireSafeMetadata,
  optionalRecordId,
} from "../validation/recordValidation.js";
import { assertNoSecretBearingValue } from "../validation/safeMetadata.js";
import { EXTERNAL_REFERENCE_KIND } from "../records/externalReference.js";
import { malformedRowError } from "./errorMapping.js";
import {
  SUBJECT_COLUMN_MAP,
  FEE_DEFINITION_COLUMNS,
  OBLIGATION_COLUMNS,
  INVOICE_COLUMNS,
  INVOICE_ITEM_COLUMNS,
  PAYMENT_COLUMNS,
  PAYMENT_ATTEMPT_COLUMNS,
  RECEIPT_COLUMNS,
  REFUND_COLUMNS,
  EVENT_COLUMNS,
  IDEMPOTENCY_COLUMNS,
  AUDIT_EVIDENCE_COLUMNS,
} from "./schema.js";

const FORBIDDEN_ROW_KEYS = Object.freeze([
  "raw_payload",
  "rawPayload",
  "authorization_header",
  "access_token",
  "refresh_token",
  "webhook_secret",
  "cvv",
  "card_number",
  "api_key",
  "secret",
]);

/**
 * @param {object} row
 */
export function assertNoForbiddenRowFields(row) {
  if (!row || typeof row !== "object") return;
  for (const key of FORBIDDEN_ROW_KEYS) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] != null) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.CORRUPT_FINANCIAL_RECORD,
        `Forbidden persistence field present: ${key}.`,
        { field: key }
      );
    }
  }
}

/**
 * @param {Record<string, string>} columnMap
 * @param {object} record
 * @returns {Record<string, unknown>}
 */
export function projectRecordToRow(columnMap, record) {
  /** @type {Record<string, unknown>} */
  const row = {};
  for (const [camel, snake] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(record, camel)) {
      row[snake] = record[camel];
    }
  }
  assertNoForbiddenRowFields(row);
  if (row.metadata != null) assertNoSecretBearingValue(row.metadata, "metadata");
  if (row.payload != null) assertNoSecretBearingValue(row.payload, "payload");
  return row;
}

/**
 * @param {Record<string, string>} columnMap
 * @param {object} row
 * @returns {Record<string, unknown>}
 */
export function projectRowToCamel(columnMap, row) {
  assertNoForbiddenRowFields(row);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [camel, snake] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(row, snake)) {
      out[camel] = row[snake];
    }
  }
  return out;
}

/**
 * @param {object} record
 * @returns {object}
 */
function subjectsFromExternalReferences(record) {
  /** @type {Record<string, string|null>} */
  const subjects = {
    subjectVenueId: null,
    subjectClubId: null,
    subjectCompetitionId: null,
    subjectRegistrationId: null,
    subjectEntryId: null,
    subjectBookingId: null,
    subjectPlayerId: null,
    subjectCustomerId: null,
  };
  const refs = Array.isArray(record.externalReferences) ? record.externalReferences : [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object") continue;
    switch (ref.kind) {
      case EXTERNAL_REFERENCE_KIND.VENUE:
        subjects.subjectVenueId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.CLUB:
        subjects.subjectClubId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.COMPETITION:
        subjects.subjectCompetitionId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.REGISTRATION:
        subjects.subjectRegistrationId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.ENTRY:
        subjects.subjectEntryId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.BOOKING:
        subjects.subjectBookingId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.PLAYER:
        subjects.subjectPlayerId = ref.id;
        break;
      case EXTERNAL_REFERENCE_KIND.CUSTOMER:
        subjects.subjectCustomerId = ref.id;
        break;
      default:
        break;
    }
  }
  // Prefer explicit subject_* already on record
  for (const camel of Object.keys(SUBJECT_COLUMN_MAP)) {
    if (record[camel] != null) subjects[camel] = record[camel];
  }
  return subjects;
}

/**
 * @param {object} camel
 * @returns {Array<{kind: string, id: string}>}
 */
function externalReferencesFromSubjects(camel) {
  /** @type {Array<{kind: string, id: string}>} */
  const refs = [];
  const push = (kind, id) => {
    if (id != null && String(id).trim()) refs.push({ kind, id: String(id).trim() });
  };
  push(EXTERNAL_REFERENCE_KIND.VENUE, camel.subjectVenueId);
  push(EXTERNAL_REFERENCE_KIND.CLUB, camel.subjectClubId);
  push(EXTERNAL_REFERENCE_KIND.COMPETITION, camel.subjectCompetitionId);
  push(EXTERNAL_REFERENCE_KIND.REGISTRATION, camel.subjectRegistrationId);
  push(EXTERNAL_REFERENCE_KIND.ENTRY, camel.subjectEntryId);
  push(EXTERNAL_REFERENCE_KIND.BOOKING, camel.subjectBookingId);
  push(EXTERNAL_REFERENCE_KIND.PLAYER, camel.subjectPlayerId);
  push(EXTERNAL_REFERENCE_KIND.CUSTOMER, camel.subjectCustomerId);
  return refs;
}

/**
 * Normalize fee definition for persistence (domain createFeeDefinition + version timestamps).
 *
 * @param {object} input
 * @param {string} tenantId
 */
export function normalizeFeeDefinitionRecord(input, tenantId) {
  const fee = createFeeDefinition({
    ...input,
    tenantId,
    feeId: input.id ?? input.feeId,
    venueId: input.venueId ?? input.subjectVenueId,
    clubId: input.clubId ?? input.subjectClubId,
    competitionRef: input.competitionRef ?? input.subjectCompetitionId,
  });
  const createdAt = requireIsoTimestamp(
    input.createdAt ?? "1970-01-01T00:00:00.000Z",
    "createdAt"
  );
  return Object.freeze({
    id: fee.feeId,
    tenantId: fee.tenantId,
    version: requireOptimisticVersion(input.version ?? 1),
    status: fee.status,
    feeType: fee.feeType,
    name: fee.name || fee.feeType,
    description: input.description == null ? null : String(input.description),
    amountMinor: fee.amountMinor,
    currency: fee.currency,
    policyVersion: fee.policyVersion,
    effectiveFrom: fee.effectiveFrom,
    effectiveTo: fee.effectiveTo,
    subjectVenueId: fee.venueId,
    subjectClubId: fee.clubId,
    subjectCompetitionId: fee.competitionRef,
    subjectRegistrationId: optionalRecordId(input.subjectRegistrationId),
    subjectEntryId: optionalRecordId(input.subjectEntryId),
    subjectBookingId: optionalRecordId(input.bookingRef ?? input.subjectBookingId ?? fee.bookingRef),
    subjectPlayerId: optionalRecordId(input.subjectPlayerId),
    subjectCustomerId: optionalRecordId(input.subjectCustomerId),
    correlationId: optionalRecordId(input.correlationId),
    causationId: optionalRecordId(input.causationId),
    idempotencyKey: optionalRecordId(input.idempotencyKey),
    metadata: requireSafeMetadata(input.metadata) ?? {},
    createdAt,
    updatedAt: requireIsoTimestamp(input.updatedAt ?? createdAt, "updatedAt"),
  });
}

/**
 * @param {object} row
 */
export function feeDefinitionFromRow(row) {
  try {
    assertNoForbiddenRowFields(row);
    const camel = projectRowToCamel(FEE_DEFINITION_COLUMNS, row);
    return normalizeFeeDefinitionRecord(camel, /** @type {string} */ (camel.tenantId));
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("FeeDefinition", { cause: "parse" });
  }
}

/**
 * @param {object} record
 */
export function feeDefinitionToRow(record) {
  return projectRecordToRow(FEE_DEFINITION_COLUMNS, record);
}

/**
 * @param {object} input
 * @param {string} tenantId
 */
export function normalizeObligationForWrite(input, tenantId) {
  const subjects = subjectsFromExternalReferences(input);
  return createObligationRecord({
    ...input,
    ...subjects,
    tenantId,
    externalReferences: input.externalReferences ?? externalReferencesFromSubjects({ ...input, ...subjects }),
  });
}

/**
 * @param {object} row
 */
export function obligationFromRow(row) {
  try {
    const camel = projectRowToCamel(OBLIGATION_COLUMNS, row);
    return createObligationRecord({
      ...camel,
      externalReferences: externalReferencesFromSubjects(camel),
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("FinancialObligation");
  }
}

/**
 * @param {object} record
 */
export function obligationToRow(record) {
  const subjects = subjectsFromExternalReferences(record);
  return projectRecordToRow(OBLIGATION_COLUMNS, { ...record, ...subjects });
}

/**
 * @param {object} input
 * @param {string} tenantId
 */
export function normalizeInvoiceForWrite(input, tenantId) {
  const subjects = subjectsFromExternalReferences(input);
  return createInvoiceRecord({
    ...input,
    ...subjects,
    tenantId,
    externalReferences: input.externalReferences ?? externalReferencesFromSubjects({ ...input, ...subjects }),
  });
}

/**
 * @param {object} row
 * @param {object[]} [itemRows]
 */
export function invoiceFromRow(row, itemRows = []) {
  try {
    const camel = projectRowToCamel(INVOICE_COLUMNS, row);
    const items = itemRows.map((itemRow) => {
      const itemCamel = projectRowToCamel(INVOICE_ITEM_COLUMNS, itemRow);
      return createInvoiceItemRecord(itemCamel);
    });
    return createInvoiceRecord({
      ...camel,
      items,
      externalReferences: externalReferencesFromSubjects(camel),
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("Invoice");
  }
}

/**
 * @param {object} record
 */
export function invoiceToRow(record) {
  const subjects = subjectsFromExternalReferences(record);
  const rest = { ...record };
  delete rest.items;
  return projectRecordToRow(INVOICE_COLUMNS, { ...rest, ...subjects });
}

/**
 * @param {object} item
 * @param {string} tenantId
 * @param {string} invoiceId
 */
export function invoiceItemToRow(item, tenantId, invoiceId) {
  const record = createInvoiceItemRecord(item);
  return projectRecordToRow(INVOICE_ITEM_COLUMNS, {
    ...record,
    tenantId,
    invoiceId,
    createdAt: item.createdAt ?? "1970-01-01T00:00:00.000Z",
  });
}

/**
 * @param {object} input
 * @param {string} tenantId
 */
export function normalizePaymentForWrite(input, tenantId) {
  const subjects = subjectsFromExternalReferences(input);
  return createPaymentRecord({
    ...input,
    ...subjects,
    tenantId,
    externalReferences: input.externalReferences ?? externalReferencesFromSubjects({ ...input, ...subjects }),
  });
}

/**
 * @param {object} row
 */
export function paymentFromRow(row) {
  try {
    const camel = projectRowToCamel(PAYMENT_COLUMNS, row);
    return createPaymentRecord({
      ...camel,
      externalReferences: externalReferencesFromSubjects(camel),
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("Payment");
  }
}

/**
 * @param {object} record
 */
export function paymentToRow(record) {
  const subjects = subjectsFromExternalReferences(record);
  return projectRecordToRow(PAYMENT_COLUMNS, { ...record, ...subjects });
}

export function normalizePaymentAttemptForWrite(input, tenantId) {
  return createPaymentAttemptRecord({ ...input, tenantId });
}

export function paymentAttemptFromRow(row) {
  try {
    return createPaymentAttemptRecord(projectRowToCamel(PAYMENT_ATTEMPT_COLUMNS, row));
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("PaymentAttempt");
  }
}

export function paymentAttemptToRow(record) {
  return projectRecordToRow(PAYMENT_ATTEMPT_COLUMNS, record);
}

export function normalizeReceiptForWrite(input, tenantId) {
  const subjects = subjectsFromExternalReferences(input);
  return createReceiptRecord({
    ...input,
    ...subjects,
    tenantId,
    externalReferences: input.externalReferences ?? externalReferencesFromSubjects({ ...input, ...subjects }),
  });
}

export function receiptFromRow(row) {
  try {
    const camel = projectRowToCamel(RECEIPT_COLUMNS, row);
    return createReceiptRecord({
      ...camel,
      externalReferences: externalReferencesFromSubjects(camel),
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("Receipt");
  }
}

export function receiptToRow(record) {
  const subjects = subjectsFromExternalReferences(record);
  return projectRecordToRow(RECEIPT_COLUMNS, { ...record, ...subjects });
}

export function normalizeRefundForWrite(input, tenantId) {
  const subjects = subjectsFromExternalReferences(input);
  return createRefundRecord({
    ...input,
    ...subjects,
    tenantId,
    externalReferences: input.externalReferences ?? externalReferencesFromSubjects({ ...input, ...subjects }),
  });
}

export function refundFromRow(row) {
  try {
    const camel = projectRowToCamel(REFUND_COLUMNS, row);
    return createRefundRecord({
      ...camel,
      externalReferences: externalReferencesFromSubjects(camel),
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("Refund");
  }
}

export function refundToRow(record) {
  const subjects = subjectsFromExternalReferences(record);
  return projectRecordToRow(REFUND_COLUMNS, { ...record, ...subjects });
}

export function normalizeEventForWrite(input, tenantId) {
  return createFinancialEventRecord({ ...input, tenantId });
}

export function eventFromRow(row) {
  try {
    const camel = projectRowToCamel(EVENT_COLUMNS, row);
    return createFinancialEventRecord({
      ...camel,
      financialReferences: {
        obligationId: camel.obligationId,
        invoiceId: camel.invoiceId,
        paymentId: camel.paymentId,
        attemptId: camel.attemptId,
        receiptId: camel.receiptId,
        refundId: camel.refundId,
      },
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("FinancialEvent");
  }
}

export function eventToRow(record) {
  const refs = record.financialReferences || {};
  return projectRecordToRow(EVENT_COLUMNS, {
    ...record,
    obligationId: refs.obligationId ?? record.obligationId ?? null,
    invoiceId: refs.invoiceId ?? record.invoiceId ?? null,
    paymentId: refs.paymentId ?? record.paymentId ?? null,
    attemptId: refs.attemptId ?? record.attemptId ?? null,
    receiptId: refs.receiptId ?? record.receiptId ?? null,
    refundId: refs.refundId ?? record.refundId ?? null,
  });
}

export function normalizeIdempotencyForWrite(input, tenantId) {
  return createIdempotencyRecord({ ...input, tenantId });
}

export function idempotencyFromRow(row) {
  try {
    const camel = projectRowToCamel(IDEMPOTENCY_COLUMNS, row);
    return createIdempotencyRecord({
      ...camel,
      resultReference: camel.resultEntityId,
    });
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("IdempotencyRecord");
  }
}

export function idempotencyToRow(record) {
  return projectRecordToRow(IDEMPOTENCY_COLUMNS, {
    ...record,
    resultEntityType: record.resultEntityType,
    resultEntityId: record.resultEntityId ?? record.resultReference ?? null,
  });
}

export function normalizeAuditEvidenceForWrite(input, tenantId) {
  return createAuditEvidenceRecord({ ...input, tenantId });
}

export function auditEvidenceFromRow(row) {
  try {
    return createAuditEvidenceRecord(projectRowToCamel(AUDIT_EVIDENCE_COLUMNS, row));
  } catch (err) {
    if (err instanceof FinanceError) throw err;
    throw malformedRowError("AuditEvidence");
  }
}

export function auditEvidenceToRow(record) {
  return projectRecordToRow(AUDIT_EVIDENCE_COLUMNS, record);
}

/**
 * Fields that must never be updated via optimistic concurrency patch.
 */
export const IMMUTABLE_UPDATE_FIELDS = Object.freeze([
  "id",
  "tenantId",
  "tenant_id",
  "createdAt",
  "created_at",
]);
