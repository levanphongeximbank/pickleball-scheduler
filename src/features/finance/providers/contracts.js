/**
 * Shared provider operation context and request/result normalization.
 */

import { FINANCE_ERROR_CODES } from "../errors/codes.js";
import { FinanceError } from "../errors/FinanceError.js";
import { createMoney, serializeMoney } from "../domain/money.js";
import { requireSupportedCurrency } from "../domain/currency.js";
import {
  PROVIDER_PAYMENT_STATUS,
  PROVIDER_PAYMENT_STATUS_VALUES,
  PROVIDER_REFUND_STATUS,
  PROVIDER_REFUND_STATUS_VALUES,
  PROVIDER_WEBHOOK_EVENT_TYPE,
  PROVIDER_WEBHOOK_EVENT_TYPE_VALUES,
} from "./catalogue.js";
import { throwProviderError } from "./errors.js";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SECRET_KEY_RE =
  /(secret|password|token|authorization|api[_-]?key|private[_-]?key|webhook|credential)/i;
const FORBIDDEN_META_KEYS = Object.freeze([
  "secret",
  "password",
  "token",
  "authorization",
  "apiKey",
  "webhookSecret",
  "personalProfile",
  "fullName",
  "email",
  "phone",
  "cardNumber",
  "cvv",
  "eligible",
  "eligibility",
  "competitionEligible",
]);

const MAX_WEBHOOK_BODY_CHARS = 8192;
const MAX_EVIDENCE_REF_CHARS = 256;
const MAX_METADATA_ENTRIES = 16;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireProviderId(value, field) {
  if (value == null || typeof value !== "string" || !value.trim()) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} is required.`,
      { field }
    );
  }
  const trimmed = value.trim();
  if (!ID_RE.test(trimmed)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} has invalid format.`,
      { field }
    );
  }
  return trimmed;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string|null}
 */
export function optionalProviderId(value, field) {
  if (value == null || value === "") return null;
  return requireProviderId(value, field);
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireIso(value, field) {
  const raw = requireProviderId(value, field);
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `${field} must be a valid ISO-8601 timestamp.`,
      { field }
    );
  }
  return new Date(ms).toISOString();
}

/**
 * Explicit provider operation context — no implicit tenant/user.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createProviderOperationContext(input = {}) {
  return Object.freeze({
    tenantId: requireProviderId(input.tenantId, "tenantId"),
    operationId: requireProviderId(input.operationId, "operationId"),
    idempotencyKey: requireProviderId(input.idempotencyKey, "idempotencyKey"),
    correlationId: requireProviderId(input.correlationId, "correlationId"),
    causationId: optionalProviderId(input.causationId, "causationId"),
    providerCode: requireProviderId(input.providerCode, "providerCode"),
    paymentId: optionalProviderId(input.paymentId, "paymentId"),
    refundId: optionalProviderId(input.refundId, "refundId"),
    occurredAt: input.occurredAt != null ? requireIso(input.occurredAt, "occurredAt") : null,
  });
}

/**
 * @param {unknown} metadata
 * @returns {Readonly<Record<string, string|number|boolean|null>>}
 */
export function normalizeSafeMetadata(metadata) {
  if (metadata == null) return Object.freeze({});
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "metadata must be a plain object when provided.",
      { field: "metadata" }
    );
  }
  const keys = Object.keys(metadata);
  if (keys.length > MAX_METADATA_ENTRIES) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      `metadata exceeds ${MAX_METADATA_ENTRIES} entries.`,
      { field: "metadata" }
    );
  }
  /** @type {Record<string, string|number|boolean|null>} */
  const out = {};
  for (const key of keys.sort()) {
    if (FORBIDDEN_META_KEYS.includes(key) || SECRET_KEY_RE.test(key)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        `metadata key is not allowed: ${key}.`,
        { field: "metadata", key }
      );
    }
    const value = metadata[key];
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "metadata values must be string, number, boolean, or null.",
        { field: "metadata", key }
      );
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new FinanceError(
        FINANCE_ERROR_CODES.INVALID_INPUT,
        "metadata numeric values must be finite.",
        { field: "metadata", key }
      );
    }
    out[key] = typeof value === "string" ? value.trim() : value;
  }
  return Object.freeze(out);
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentInitiationRequest(input = {}) {
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );
  if (amount.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_MONEY,
      "Payment initiation amount must be positive.",
      { field: "amountMinor" }
    );
  }

  const description =
    input.description == null || input.description === ""
      ? null
      : typeof input.description === "string"
        ? input.description.trim().slice(0, 200) || null
        : (() => {
            throw new FinanceError(
              FINANCE_ERROR_CODES.INVALID_INPUT,
              "description must be a string when provided.",
              { field: "description" }
            );
          })();

  // Reject provider credentials / extensions outside controlled allowlist
  if (input.credentials != null || input.apiKey != null || input.secret != null) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_INPUT,
      "Provider credentials must not be included in initiation requests.",
      { field: "credentials" }
    );
  }

  return Object.freeze({
    tenantId: requireProviderId(input.tenantId, "tenantId"),
    paymentId: requireProviderId(input.paymentId, "paymentId"),
    paymentAttemptId: requireProviderId(
      input.paymentAttemptId ?? input.attemptId,
      "paymentAttemptId"
    ),
    amount: serializeMoney(amount),
    currency: amount.currency,
    idempotencyKey: requireProviderId(input.idempotencyKey, "idempotencyKey"),
    correlationId: requireProviderId(input.correlationId, "correlationId"),
    description,
    returnReference: optionalProviderId(input.returnReference, "returnReference"),
    expiresAt: input.expiresAt != null ? requireIso(input.expiresAt, "expiresAt") : null,
    metadata: normalizeSafeMetadata(input.metadata),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createNormalizedProviderEvidence(input = {}) {
  const evidenceRef = requireProviderId(input.evidenceRef, "evidenceRef");
  if (evidenceRef.length > MAX_EVIDENCE_REF_CHARS) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
      "evidenceRef exceeds size limit.",
      { field: "evidenceRef" }
    );
  }
  return Object.freeze({
    evidenceRef,
    auditEvidenceRef: optionalProviderId(
      input.auditEvidenceRef,
      "auditEvidenceRef"
    ),
    providerTransactionReference: optionalProviderId(
      input.providerTransactionReference,
      "providerTransactionReference"
    ),
    /** Explicit redacted digest only — never raw payloads. */
    redactedDigest:
      input.redactedDigest == null || input.redactedDigest === ""
        ? null
        : typeof input.redactedDigest === "string"
          ? input.redactedDigest.trim().slice(0, 128)
          : (() => {
              throwProviderError(
                FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
                "redactedDigest must be a string when provided."
              );
            })(),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentInitiationResult(input = {}) {
  const status = String(input.status || "").trim();
  if (!PROVIDER_PAYMENT_STATUS_VALUES.includes(status)) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_RESPONSE_INVALID,
      `Invalid provider payment status: ${status || "(empty)"}.`,
      { field: "status" }
    );
  }
  return Object.freeze({
    providerCode: requireProviderId(input.providerCode, "providerCode"),
    providerPaymentReference: requireProviderId(
      input.providerPaymentReference,
      "providerPaymentReference"
    ),
    providerAttemptReference: optionalProviderId(
      input.providerAttemptReference,
      "providerAttemptReference"
    ),
    status,
    expiresAt: input.expiresAt != null ? requireIso(input.expiresAt, "expiresAt") : null,
    presentationReference: optionalProviderId(
      input.presentationReference ?? input.redirectOrQrReference,
      "presentationReference"
    ),
    evidence: createNormalizedProviderEvidence(
      input.evidence || { evidenceRef: input.evidenceRef }
    ),
    metadata: normalizeSafeMetadata(input.metadata),
    receivedAt: requireIso(input.receivedAt, "receivedAt"),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createPaymentVerificationResult(input = {}) {
  const verified = Boolean(input.verified);
  const providerStatus = String(input.providerStatus || "").trim();
  if (!PROVIDER_PAYMENT_STATUS_VALUES.includes(providerStatus)) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_RESPONSE_INVALID,
      "Invalid providerStatus on verification result.",
      { field: "providerStatus" }
    );
  }
  let amount = null;
  let currency = null;
  if (input.amountMinor != null || input.amount != null || input.currency != null) {
    const money = createMoney(
      input.amountMinor ?? input.amount?.amountMinor,
      input.currency ?? input.amount?.currency
    );
    amount = serializeMoney(money);
    currency = money.currency;
  }
  return Object.freeze({
    verified,
    providerTransactionReference: optionalProviderId(
      input.providerTransactionReference,
      "providerTransactionReference"
    ),
    amount,
    currency,
    providerStatus,
    evidence: verified
      ? createNormalizedProviderEvidence(
          input.evidence || { evidenceRef: input.evidenceRef }
        )
      : input.evidenceRef || input.evidence
        ? createNormalizedProviderEvidence(
            input.evidence || { evidenceRef: input.evidenceRef }
          )
        : null,
    verifiedAt: input.verifiedAt != null ? requireIso(input.verifiedAt, "verifiedAt") : null,
    failureReason:
      input.failureReason == null || input.failureReason === ""
        ? null
        : String(input.failureReason).trim(),
    duplicate: Boolean(input.duplicate),
    /** Client-declared success is never authoritative alone. */
    clientDeclaredSuccess: Boolean(input.clientDeclaredSuccess),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createRefundInitiationRequest(input = {}) {
  const amount = createMoney(
    input.amountMinor ?? input.amount?.amountMinor,
    input.currency ?? input.amount?.currency
  );
  if (amount.amountMinor <= 0) {
    throw new FinanceError(
      FINANCE_ERROR_CODES.INVALID_REFUND_AMOUNT,
      "Refund amount must be positive.",
      { field: "amountMinor" }
    );
  }
  return Object.freeze({
    tenantId: requireProviderId(input.tenantId, "tenantId"),
    paymentId: requireProviderId(input.paymentId, "paymentId"),
    refundId: requireProviderId(input.refundId, "refundId"),
    providerPaymentReference: requireProviderId(
      input.providerPaymentReference,
      "providerPaymentReference"
    ),
    amount: serializeMoney(amount),
    currency: amount.currency,
    idempotencyKey: requireProviderId(input.idempotencyKey, "idempotencyKey"),
    correlationId: requireProviderId(input.correlationId, "correlationId"),
    reason:
      input.reason == null || input.reason === ""
        ? null
        : String(input.reason).trim().slice(0, 200),
    metadata: normalizeSafeMetadata(input.metadata),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createRefundProviderResult(input = {}) {
  const status = String(input.status || "").trim();
  if (!PROVIDER_REFUND_STATUS_VALUES.includes(status)) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_RESPONSE_INVALID,
      `Invalid provider refund status: ${status || "(empty)"}.`,
      { field: "status" }
    );
  }
  return Object.freeze({
    providerCode: requireProviderId(input.providerCode, "providerCode"),
    providerRefundReference: requireProviderId(
      input.providerRefundReference,
      "providerRefundReference"
    ),
    status,
    evidence:
      input.evidence || input.evidenceRef
        ? createNormalizedProviderEvidence(
            input.evidence || { evidenceRef: input.evidenceRef }
          )
        : null,
    receivedAt: requireIso(input.receivedAt, "receivedAt"),
    metadata: normalizeSafeMetadata(input.metadata),
  });
}

/**
 * Untrusted webhook input — never treats client tenant as authoritative.
 *
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createProviderWebhookInput(input = {}) {
  const body =
    input.body == null
      ? ""
      : typeof input.body === "string"
        ? input.body
        : (() => {
            throwProviderError(
              FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
              "Webhook body must be a string when provided.",
              { field: "body" }
            );
          })();
  if (body.length > MAX_WEBHOOK_BODY_CHARS) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      "Webhook body exceeds size limit.",
      { field: "body", maxChars: MAX_WEBHOOK_BODY_CHARS }
    );
  }

  const headers =
    input.headers && typeof input.headers === "object" && !Array.isArray(input.headers)
      ? Object.freeze(
          Object.fromEntries(
            Object.entries(input.headers)
              .filter(([k]) => !SECRET_KEY_RE.test(k))
              .map(([k, v]) => [
                String(k),
                typeof v === "string" ? v.slice(0, 256) : String(v).slice(0, 256),
              ])
          )
        )
      : Object.freeze({});

  const query =
    input.query && typeof input.query === "object" && !Array.isArray(input.query)
      ? Object.freeze(
          Object.fromEntries(
            Object.entries(input.query)
              .filter(([k]) => !SECRET_KEY_RE.test(k))
              .map(([k, v]) => [
                String(k),
                typeof v === "string" ? v.slice(0, 256) : String(v).slice(0, 256),
              ])
          )
        )
      : Object.freeze({});

  return Object.freeze({
    providerCode: requireProviderId(input.providerCode, "providerCode"),
    headers,
    query,
    body,
    receivedAt: requireIso(input.receivedAt, "receivedAt"),
    /** Hint only — never authoritative for tenant resolution. */
    tenantRoutingHint: optionalProviderId(
      input.tenantRoutingHint,
      "tenantRoutingHint"
    ),
  });
}

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createNormalizedWebhookEvent(input = {}) {
  const eventType = String(input.eventType || "").trim();
  if (!PROVIDER_WEBHOOK_EVENT_TYPE_VALUES.includes(eventType)) {
    throwProviderError(
      FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
      `Unsupported webhook event type: ${eventType || "(empty)"}.`,
      { field: "eventType" }
    );
  }
  return Object.freeze({
    providerCode: requireProviderId(input.providerCode, "providerCode"),
    eventType,
    verificationStatus: String(input.verificationStatus || "UNVERIFIED").trim(),
    providerPaymentReference: optionalProviderId(
      input.providerPaymentReference,
      "providerPaymentReference"
    ),
    providerRefundReference: optionalProviderId(
      input.providerRefundReference,
      "providerRefundReference"
    ),
    providerTransactionReference: optionalProviderId(
      input.providerTransactionReference,
      "providerTransactionReference"
    ),
    providerStatus: optionalProviderId(input.providerStatus, "providerStatus"),
    amount:
      input.amountMinor != null
        ? serializeMoney(
            createMoney(input.amountMinor, requireSupportedCurrency(input.currency))
          )
        : null,
    currency: input.currency ? requireSupportedCurrency(input.currency) : null,
    evidence:
      input.evidence || input.evidenceRef
        ? createNormalizedProviderEvidence(
            input.evidence || { evidenceRef: input.evidenceRef }
          )
        : null,
    /** Explicitly not authoritative. */
    tenantHintNotAuthoritative: true,
    tenantRoutingHint: optionalProviderId(
      input.tenantRoutingHint,
      "tenantRoutingHint"
    ),
    receivedAt: requireIso(input.receivedAt, "receivedAt"),
    metadata: normalizeSafeMetadata(input.metadata),
  });
}

export {
  PROVIDER_PAYMENT_STATUS,
  PROVIDER_REFUND_STATUS,
  PROVIDER_WEBHOOK_EVENT_TYPE,
  MAX_WEBHOOK_BODY_CHARS,
};
