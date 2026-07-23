/**
 * Versioned Finance event envelope (Phase 1B).
 *
 * Events confirm financial state only — never competition eligibility.
 * No runtime event bus, Notification wiring, or Billing webhook changes.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney } from "../domain/money.js";
import {
  FINANCE_EVENT_TYPE,
  FINANCE_EVENT_TYPE_VALUES,
  FINANCE_EVENT_VERSION,
  FINANCE_EVENTS_REQUIRING_AMOUNT,
  FINANCE_EVENTS_REQUIRING_EVIDENCE,
  FINANCE_OWNING_MODULE,
  FINANCE_PRIVACY_CLASSIFICATION,
  FINANCE_PRIVACY_CLASSIFICATION_VALUES,
  isFinanceEventType,
} from "./catalogue.js";

const FORBIDDEN_PAYLOAD_KEYS = Object.freeze([
  "eligible",
  "eligibility",
  "competitionEligible",
  "isEligible",
  "canCompete",
  "secret",
  "password",
  "accessToken",
  "refreshToken",
  "apiKey",
  "providerSecret",
  "rawProviderPayload",
  "cardNumber",
  "cvv",
  "ssn",
  "personalProfile",
  "fullName",
  "email",
  "phone",
  "dateOfBirth",
]);

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function optionalId(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      "Optional id must be a non-empty string when provided."
    );
  }
  return value.trim();
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireIso(value, field) {
  const raw = requireId(value, field);
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * @param {object} payload
 */
function assertSafePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      "Event payload must be a plain object."
    );
  }
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_PAYLOAD_KEYS.includes(key)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
        `Event payload must not include forbidden field: ${key}.`,
        { field: key }
      );
    }
  }
}

/**
 * @param {string} eventType
 * @param {object} input
 */
function assertEventSpecific(eventType, input) {
  switch (eventType) {
    case FINANCE_EVENT_TYPE.FINANCE_OBLIGATION_CREATED:
      if (!optionalId(input.financialReferences?.obligationId) && !optionalId(input.payload?.obligationId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          "FINANCE_OBLIGATION_CREATED requires obligationId.",
          { field: "obligationId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.INVOICE_CREATED:
    case FINANCE_EVENT_TYPE.INVOICE_ISSUED:
      if (!optionalId(input.financialReferences?.invoiceId) && !optionalId(input.payload?.invoiceId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          `${eventType} requires invoiceId.`,
          { field: "invoiceId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.PAYMENT_PENDING:
    case FINANCE_EVENT_TYPE.PAYMENT_CONFIRMED:
    case FINANCE_EVENT_TYPE.PAYMENT_FAILED:
    case FINANCE_EVENT_TYPE.PAYMENT_CANCELLED:
    case FINANCE_EVENT_TYPE.PAYMENT_EXPIRED:
      if (!optionalId(input.financialReferences?.paymentId) && !optionalId(input.payload?.paymentId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          `${eventType} requires paymentId.`,
          { field: "paymentId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.RECEIPT_ISSUED:
      if (!optionalId(input.financialReferences?.receiptId) && !optionalId(input.payload?.receiptId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          "RECEIPT_ISSUED requires receiptId.",
          { field: "receiptId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.REFUND_REQUESTED:
    case FINANCE_EVENT_TYPE.REFUND_APPROVED:
    case FINANCE_EVENT_TYPE.REFUND_REJECTED:
    case FINANCE_EVENT_TYPE.REFUND_COMPLETED:
      if (!optionalId(input.financialReferences?.refundId) && !optionalId(input.payload?.refundId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          `${eventType} requires refundId.`,
          { field: "refundId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.RECONCILIATION_COMPLETED:
      if (!optionalId(input.payload?.reconciliationId) && !optionalId(input.financialReferences?.reconciliationId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          "RECONCILIATION_COMPLETED requires reconciliationId.",
          { field: "reconciliationId" }
        );
      }
      break;
    case FINANCE_EVENT_TYPE.FINANCIAL_ADJUSTMENT_RECORDED:
      if (!optionalId(input.payload?.adjustmentId) && !optionalId(input.financialReferences?.adjustmentId)) {
        throw new FinanceError(
          FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
          "FINANCIAL_ADJUSTMENT_RECORDED requires adjustmentId.",
          { field: "adjustmentId" }
        );
      }
      break;
    default:
      break;
  }
}

/**
 * Create an immutable Finance event envelope.
 * Deterministic except for explicitly supplied IDs and timestamps.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createFinanceEvent(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      "Finance event input must be an object."
    );
  }

  const eventType = requireId(input.eventType, "eventType");
  if (!isFinanceEventType(eventType)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      `Unsupported Finance event type: ${eventType}.`,
      { field: "eventType", allowed: FINANCE_EVENT_TYPE_VALUES }
    );
  }

  const owningModule = input.owningModule == null
    ? FINANCE_OWNING_MODULE
    : String(input.owningModule).trim();
  if (owningModule !== FINANCE_OWNING_MODULE) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      `owningModule must be ${FINANCE_OWNING_MODULE}.`,
      { field: "owningModule", received: owningModule }
    );
  }

  const eventVersionRaw =
    input.eventVersion == null ? FINANCE_EVENT_VERSION : input.eventVersion;
  if (
    typeof eventVersionRaw !== "number" ||
    !Number.isInteger(eventVersionRaw) ||
    eventVersionRaw < 1
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      "eventVersion must be a positive integer.",
      { field: "eventVersion" }
    );
  }

  const privacyClassification =
    input.privacyClassification == null
      ? FINANCE_PRIVACY_CLASSIFICATION.INTERNAL
      : String(input.privacyClassification).trim();
  if (!FINANCE_PRIVACY_CLASSIFICATION_VALUES.includes(privacyClassification)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      "Invalid privacyClassification.",
      { field: "privacyClassification" }
    );
  }

  const payload =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? { ...input.payload }
      : {};
  assertSafePayload(payload);
  assertEventSpecific(eventType, { ...input, payload });

  let amount = null;
  let currency = null;
  const requiresAmount = FINANCE_EVENTS_REQUIRING_AMOUNT.includes(eventType);
  if (requiresAmount || input.amount != null || input.amountMinor != null) {
    const money = createMoney(
      input.amountMinor ?? input.amount?.amountMinor,
      input.currency ?? input.amount?.currency
    );
    amount = serializeMoney(money);
    currency = money.currency;
  } else if (eventType === FINANCE_EVENT_TYPE.RECONCILIATION_COMPLETED) {
    // amount optional for reconciliation summary events
    if (input.amount != null || input.amountMinor != null) {
      const money = createMoney(
        input.amountMinor ?? input.amount?.amountMinor,
        input.currency ?? input.amount?.currency
      );
      amount = serializeMoney(money);
      currency = money.currency;
    }
  }

  if (requiresAmount && !amount) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
      `${eventType} requires amount and currency.`,
      { field: "amount" }
    );
  }

  const evidenceReferences = Array.isArray(input.evidenceReferences)
    ? input.evidenceReferences.map((ref, i) => {
        if (typeof ref !== "string" || !ref.trim()) {
          throw new FinanceError(
            FINANCE_ERROR_CODES.INVALID_EVENT_PAYLOAD,
            "evidenceReferences entries must be non-empty strings.",
            { field: "evidenceReferences", index: i }
          );
        }
        return ref.trim();
      })
    : input.evidenceRef
      ? [requireId(input.evidenceRef, "evidenceRef")]
      : [];

  if (
    FINANCE_EVENTS_REQUIRING_EVIDENCE.includes(eventType) &&
    evidenceReferences.length === 0
  ) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.PAYMENT_EVIDENCE_REQUIRED,
      `${eventType} requires evidence references.`,
      { field: "evidenceReferences" }
    );
  }

  const subjectReferences =
    input.subjectReferences &&
    typeof input.subjectReferences === "object" &&
    !Array.isArray(input.subjectReferences)
      ? Object.freeze({ ...input.subjectReferences })
      : Object.freeze({});

  const financialReferences =
    input.financialReferences &&
    typeof input.financialReferences === "object" &&
    !Array.isArray(input.financialReferences)
      ? Object.freeze({ ...input.financialReferences })
      : Object.freeze({});

  const actor =
    input.actor && typeof input.actor === "object" && !Array.isArray(input.actor)
      ? Object.freeze({
          actorId: optionalId(input.actor.actorId),
          actorType: optionalId(input.actor.actorType),
        })
      : optionalId(input.actorId)
        ? Object.freeze({
            actorId: optionalId(input.actorId),
            actorType: optionalId(input.actorType),
          })
        : null;

  return Object.freeze({
    eventId: requireId(input.eventId, "eventId"),
    eventType,
    eventVersion: eventVersionRaw,
    occurredAt: requireIso(input.occurredAt, "occurredAt"),
    owningModule,
    tenantId: requireId(input.tenantId, "tenantId"),
    venueId: optionalId(input.venueId),
    clubId: optionalId(input.clubId),
    correlationId: requireId(input.correlationId, "correlationId"),
    causationId: optionalId(input.causationId),
    idempotencyKey: requireId(input.idempotencyKey, "idempotencyKey"),
    actor,
    subjectReferences,
    financialReferences,
    amount,
    currency,
    privacyClassification,
    evidenceReferences: Object.freeze(evidenceReferences.slice()),
    reason:
      input.reason == null || input.reason === ""
        ? null
        : String(input.reason).trim(),
    payload: Object.freeze({ ...payload }),
  });
}

/**
 * @param {object} event
 * @returns {object}
 */
export function serializeFinanceEvent(event) {
  const e = createFinanceEvent(event);
  return Object.freeze({
    eventId: e.eventId,
    eventType: e.eventType,
    eventVersion: e.eventVersion,
    occurredAt: e.occurredAt,
    owningModule: e.owningModule,
    tenantId: e.tenantId,
    venueId: e.venueId,
    clubId: e.clubId,
    correlationId: e.correlationId,
    causationId: e.causationId,
    idempotencyKey: e.idempotencyKey,
    actor: e.actor,
    subjectReferences: e.subjectReferences,
    financialReferences: e.financialReferences,
    amount: e.amount,
    currency: e.currency,
    privacyClassification: e.privacyClassification,
    evidenceReferences: e.evidenceReferences,
    reason: e.reason,
    payload: e.payload,
  });
}
