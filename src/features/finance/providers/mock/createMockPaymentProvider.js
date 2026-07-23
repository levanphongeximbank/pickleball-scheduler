/**
 * Deterministic MOCK PaymentProviderPort — tests / development only.
 *
 * NOT a production provider. No network, no localStorage, no Date.now,
 * no random IDs unless injected. Isolated per factory call (no shared singleton).
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { FINANCE_PROVIDER_CODE, PROVIDER_OPERATION, PROVIDER_PAYMENT_STATUS, PROVIDER_REFUND_STATUS, PROVIDER_WEBHOOK_EVENT_TYPE } from "../catalogue.js";
import {
  assertProviderCurrencySupported,
  assertProviderOperationSupported,
  createProviderCapabilities,
} from "../capabilities.js";
import {
  createNormalizedWebhookEvent,
  createPaymentInitiationRequest,
  createPaymentInitiationResult,
  createPaymentVerificationResult,
  createProviderOperationContext,
  createProviderWebhookInput,
  createRefundInitiationRequest,
  createRefundProviderResult,
  requireProviderId,
} from "../contracts.js";
import { throwProviderError } from "../errors.js";
import { assertPaymentProviderPort } from "../PaymentProviderPort.js";

/**
 * @param {object} [options]
 * @param {() => string} [options.idGenerator]
 * @param {object} [options.capabilities]
 * @param {string} [options.defaultOutcome] — INITIATED|PENDING|CONFIRMED|FAILED|...
 * @param {Map<string, string>|Record<string, string>} [options.outcomeByIdempotencyKey]
 * @returns {object}
 */
export function createMockPaymentProvider(options = {}) {
  const idGenerator =
    typeof options.idGenerator === "function"
      ? options.idGenerator
      : (() => {
          let n = 0;
          return (kind = "ref") => {
            n += 1;
            return `mock-${kind}-${String(n).padStart(4, "0")}`;
          };
        })();

  const capabilities = createProviderCapabilities({
    paymentInitiation: true,
    synchronousConfirmation: true,
    asynchronousConfirmation: true,
    paymentStatusQuery: true,
    cancellation: true,
    partialRefund: true,
    fullRefund: true,
    refundStatusQuery: true,
    webhookDelivery: true,
    idempotencySupport: true,
    supportedCurrencies: ["VND"],
    ...(options.capabilities || {}),
    providerCode: FINANCE_PROVIDER_CODE.MOCK,
  });

  /** @type {Map<string, object>} */
  const initiationsByKey = new Map();
  /** @type {Map<string, object>} */
  const paymentsByRef = new Map();
  /** @type {Map<string, object>} */
  const refundsByKey = new Map();
  /** @type {Map<string, object>} */
  const refundsByRef = new Map();

  const outcomeMap =
    options.outcomeByIdempotencyKey instanceof Map
      ? options.outcomeByIdempotencyKey
      : new Map(Object.entries(options.outcomeByIdempotencyKey || {}));

  function resolveOutcome(idempotencyKey, fallback) {
    return outcomeMap.get(idempotencyKey) || options.defaultOutcome || fallback;
  }

  function requireCapability(operation) {
    assertProviderOperationSupported(capabilities, operation);
  }

  const provider = {
    kind: "mock",
    /** Explicitly not production. */
    productionReady: false,

    getCapabilities() {
      return capabilities;
    },

    initiatePayment(rawCtx, rawRequest) {
      requireCapability(PROVIDER_OPERATION.INITIATE_PAYMENT);
      const ctx = createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      const request = createPaymentInitiationRequest(rawRequest);
      assertProviderCurrencySupported(capabilities, request.currency);

      if (ctx.tenantId !== request.tenantId) {
        throwProviderError(
          FINANCE_ERROR_CODES.INVALID_REFERENCE,
          "Provider context tenantId must match initiation request tenantId.",
          { tenantId: ctx.tenantId }
        );
      }

      const mapKey = `${ctx.tenantId}|${ctx.idempotencyKey}`;
      const existing = initiationsByKey.get(mapKey);
      if (existing) {
        if (
          existing.request.paymentId !== request.paymentId ||
          existing.request.amount.amountMinor !== request.amount.amountMinor ||
          existing.request.currency !== request.currency ||
          existing.request.paymentAttemptId !== request.paymentAttemptId
        ) {
          throwProviderError(
            FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
            "Mock provider idempotency key reused with conflicting request.",
            { tenantId: ctx.tenantId, idempotencyKey: ctx.idempotencyKey }
          );
        }
        return existing.result;
      }

      const outcome = resolveOutcome(ctx.idempotencyKey, PROVIDER_PAYMENT_STATUS.PENDING);
      if (outcome === "UNAVAILABLE") {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_UNAVAILABLE,
          "Mock provider unavailable.",
          { providerCode: FINANCE_PROVIDER_CODE.MOCK }
        );
      }
      if (outcome === "TIMEOUT") {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_TIMEOUT,
          "Mock provider timeout.",
          { providerCode: FINANCE_PROVIDER_CODE.MOCK }
        );
      }
      if (outcome === "REJECTED") {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_REJECTED,
          "Mock provider rejected initiation.",
          { providerCode: FINANCE_PROVIDER_CODE.MOCK }
        );
      }

      const receivedAt = ctx.occurredAt || "1970-01-01T00:00:00.000Z";
      const providerPaymentReference = idGenerator("pay");
      const result = createPaymentInitiationResult({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        providerPaymentReference,
        providerAttemptReference: idGenerator("att"),
        status:
          outcome === PROVIDER_PAYMENT_STATUS.INITIATED ||
          outcome === PROVIDER_PAYMENT_STATUS.PENDING ||
          outcome === PROVIDER_PAYMENT_STATUS.FAILED
            ? outcome
            : PROVIDER_PAYMENT_STATUS.PENDING,
        expiresAt: request.expiresAt,
        presentationReference: idGenerator("present"),
        evidenceRef: `mock-ev-init-${providerPaymentReference}`,
        metadata: { paymentId: request.paymentId },
        receivedAt,
      });

      const stored = {
        request,
        result,
        tenantId: ctx.tenantId,
        status: result.status,
        amount: request.amount,
        currency: request.currency,
        paymentId: request.paymentId,
        paymentAttemptId: request.paymentAttemptId,
        boundTxn: null,
        verifiedOnce: false,
      };
      initiationsByKey.set(mapKey, { request, result });
      paymentsByRef.set(providerPaymentReference, stored);
      return result;
    },

    queryPaymentStatus(rawCtx, query = {}) {
      requireCapability(PROVIDER_OPERATION.QUERY_PAYMENT_STATUS);
      createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      const ref = requireProviderId(
        query.providerPaymentReference,
        "providerPaymentReference"
      );
      const stored = paymentsByRef.get(ref);
      if (!stored) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_STATUS_UNKNOWN,
          "Unknown provider payment reference.",
          { providerPaymentReference: ref }
        );
      }
      const forced = resolveOutcome(`status:${ref}`, stored.status);
      return Object.freeze({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        providerPaymentReference: ref,
        status: forced,
        amount: stored.amount,
        currency: stored.currency,
        paymentId: stored.paymentId,
        receivedAt: rawCtx.occurredAt || "1970-01-01T00:00:00.000Z",
      });
    },

    verifyPaymentConfirmation(rawCtx, evidence = {}) {
      requireCapability(PROVIDER_OPERATION.VERIFY_PAYMENT_CONFIRMATION);
      const ctx = createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });

      // Client-declared success alone is never enough.
      if (evidence.clientDeclaredSuccess === true && !evidence.evidenceRef) {
        return createPaymentVerificationResult({
          verified: false,
          providerStatus: PROVIDER_PAYMENT_STATUS.UNKNOWN,
          clientDeclaredSuccess: true,
          failureReason: "CLIENT_DECLARED_SUCCESS_INSUFFICIENT",
          verifiedAt: null,
        });
      }

      const evidenceRef = evidence.evidenceRef;
      if (!evidenceRef || typeof evidenceRef !== "string" || !evidenceRef.trim()) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Verification requires evidenceRef.",
          { field: "evidenceRef" }
        );
      }

      const ref = requireProviderId(
        evidence.providerPaymentReference ?? evidence.providerTransactionReference,
        "providerPaymentReference"
      );
      const stored = paymentsByRef.get(ref);
      if (!stored) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Unknown provider payment reference for verification.",
          { providerPaymentReference: ref }
        );
      }
      if (ctx.tenantId !== stored.tenantId) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Verification tenant does not match provider payment tenant.",
          { tenantId: ctx.tenantId }
        );
      }
      if (
        evidence.paymentId != null &&
        String(evidence.paymentId).trim() !== stored.paymentId
      ) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Verification paymentId does not match provider record.",
          { paymentId: evidence.paymentId }
        );
      }
      if (
        evidence.amountMinor != null &&
        Number(evidence.amountMinor) !== stored.amount.amountMinor
      ) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Verification amount does not match provider record.",
          {
            expectedMinor: stored.amount.amountMinor,
            receivedMinor: evidence.amountMinor,
          }
        );
      }
      if (
        evidence.currency != null &&
        String(evidence.currency).trim() !== stored.currency
      ) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Verification currency does not match provider record.",
          { expected: stored.currency, received: evidence.currency }
        );
      }

      const forced = resolveOutcome(
        `verify:${ctx.idempotencyKey}`,
        resolveOutcome(ctx.idempotencyKey, PROVIDER_PAYMENT_STATUS.CONFIRMED)
      );
      if (forced === "INVALID_EVIDENCE") {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_EVIDENCE_INVALID,
          "Mock verification rejected evidence.",
          { providerPaymentReference: ref }
        );
      }
      if (forced === PROVIDER_PAYMENT_STATUS.FAILED) {
        return createPaymentVerificationResult({
          verified: false,
          providerTransactionReference: ref,
          amountMinor: stored.amount.amountMinor,
          currency: stored.currency,
          providerStatus: PROVIDER_PAYMENT_STATUS.FAILED,
          evidenceRef: String(evidenceRef).trim(),
          failureReason: "PROVIDER_FAILED",
          verifiedAt: ctx.occurredAt,
        });
      }

      const txn =
        evidence.providerTransactionReference != null
          ? requireProviderId(
              evidence.providerTransactionReference,
              "providerTransactionReference"
            )
          : ref;

      // Conflict if caller supplies a conflicting txn already bound differently
      if (
        stored.boundTxn &&
        evidence.providerTransactionReference &&
        stored.boundTxn !== txn
      ) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_REFERENCE_CONFLICT,
          "Provider transaction reference conflict.",
          { providerPaymentReference: ref }
        );
      }
      stored.boundTxn = txn;
      stored.status = PROVIDER_PAYMENT_STATUS.CONFIRMED;

      const duplicate = Boolean(evidence.duplicateHint) || stored.verifiedOnce === true;
      stored.verifiedOnce = true;

      return createPaymentVerificationResult({
        verified: true,
        providerTransactionReference: txn,
        amountMinor: stored.amount.amountMinor,
        currency: stored.currency,
        providerStatus: PROVIDER_PAYMENT_STATUS.CONFIRMED,
        evidenceRef: String(evidenceRef).trim(),
        verifiedAt: ctx.occurredAt || "1970-01-01T00:00:00.000Z",
        duplicate,
      });
    },

    cancelPayment(rawCtx, request = {}) {
      requireCapability(PROVIDER_OPERATION.CANCEL_PAYMENT);
      createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      const ref = requireProviderId(
        request.providerPaymentReference,
        "providerPaymentReference"
      );
      const stored = paymentsByRef.get(ref);
      if (!stored) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_STATUS_UNKNOWN,
          "Cannot cancel unknown provider payment.",
          { providerPaymentReference: ref }
        );
      }
      if (stored.status === PROVIDER_PAYMENT_STATUS.CONFIRMED) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_REJECTED,
          "Cannot cancel a confirmed provider payment.",
          { providerPaymentReference: ref }
        );
      }
      stored.status = PROVIDER_PAYMENT_STATUS.CANCELLED;
      return Object.freeze({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        providerPaymentReference: ref,
        status: PROVIDER_PAYMENT_STATUS.CANCELLED,
        receivedAt: rawCtx.occurredAt || "1970-01-01T00:00:00.000Z",
      });
    },

    initiateRefund(rawCtx, rawRequest) {
      requireCapability(PROVIDER_OPERATION.INITIATE_REFUND);
      const ctx = createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      const request = createRefundInitiationRequest(rawRequest);
      assertProviderCurrencySupported(capabilities, request.currency);

      const payment = paymentsByRef.get(request.providerPaymentReference);
      if (!payment || payment.status !== PROVIDER_PAYMENT_STATUS.CONFIRMED) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_REJECTED,
          "Refund requires a confirmed provider payment.",
          { providerPaymentReference: request.providerPaymentReference }
        );
      }

      const isPartial =
        request.amount.amountMinor < payment.amount.amountMinor;
      if (isPartial && !capabilities.partialRefund) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_OPERATION,
          "Partial refunds are not supported by this provider.",
          { providerCode: FINANCE_PROVIDER_CODE.MOCK }
        );
      }
      if (!isPartial && !capabilities.fullRefund) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_UNSUPPORTED_OPERATION,
          "Full refunds are not supported by this provider.",
          { providerCode: FINANCE_PROVIDER_CODE.MOCK }
        );
      }
      if (request.amount.amountMinor > payment.amount.amountMinor) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_REJECTED,
          "Refund amount exceeds provider payment amount.",
          {
            paymentMinor: payment.amount.amountMinor,
            refundMinor: request.amount.amountMinor,
          }
        );
      }

      const mapKey = `${ctx.tenantId}|${ctx.idempotencyKey}`;
      const existing = refundsByKey.get(mapKey);
      if (existing) {
        if (
          existing.request.refundId !== request.refundId ||
          existing.request.amount.amountMinor !== request.amount.amountMinor
        ) {
          throwProviderError(
            FINANCE_ERROR_CODES.IDEMPOTENCY_CONFLICT,
            "Mock refund idempotency key reused with conflicting request.",
            { tenantId: ctx.tenantId, idempotencyKey: ctx.idempotencyKey }
          );
        }
        return existing.result;
      }

      const outcome = resolveOutcome(
        `refund:${ctx.idempotencyKey}`,
        PROVIDER_REFUND_STATUS.PENDING
      );
      const providerRefundReference = idGenerator("refund");
      const result = createRefundProviderResult({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        providerRefundReference,
        status:
          outcome === PROVIDER_REFUND_STATUS.COMPLETED
            ? PROVIDER_REFUND_STATUS.PENDING
            : outcome === PROVIDER_REFUND_STATUS.FAILED ||
                outcome === PROVIDER_REFUND_STATUS.REJECTED
              ? outcome
              : PROVIDER_REFUND_STATUS.PENDING,
        evidenceRef: `mock-ev-refund-${providerRefundReference}`,
        receivedAt: ctx.occurredAt || "1970-01-01T00:00:00.000Z",
        metadata: { refundId: request.refundId },
      });
      const mutable = {
        request,
        result,
        status: result.status,
        tenantId: ctx.tenantId,
      };
      refundsByKey.set(mapKey, { request, result });
      refundsByRef.set(providerRefundReference, mutable);
      return result;
    },

    queryRefundStatus(rawCtx, query = {}) {
      requireCapability(PROVIDER_OPERATION.QUERY_REFUND_STATUS);
      createProviderOperationContext({
        ...rawCtx,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      const ref = requireProviderId(
        query.providerRefundReference,
        "providerRefundReference"
      );
      const stored = refundsByRef.get(ref);
      if (!stored) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_STATUS_UNKNOWN,
          "Unknown provider refund reference.",
          { providerRefundReference: ref }
        );
      }
      const forced = resolveOutcome(`refund-status:${ref}`, stored.status);
      if (forced === PROVIDER_REFUND_STATUS.COMPLETED) {
        stored.status = PROVIDER_REFUND_STATUS.COMPLETED;
      }
      return createRefundProviderResult({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        providerRefundReference: ref,
        status: stored.status,
        evidenceRef: stored.result.evidence?.evidenceRef || `mock-ev-refund-${ref}`,
        receivedAt: rawCtx.occurredAt || "1970-01-01T00:00:00.000Z",
      });
    },

    parseWebhook(rawInput) {
      requireCapability(PROVIDER_OPERATION.PARSE_WEBHOOK);
      const input = createProviderWebhookInput({
        ...rawInput,
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
      });
      if (!input.body.trim()) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
          "Webhook body is empty.",
          { field: "body" }
        );
      }

      let parsed;
      try {
        parsed = JSON.parse(input.body);
      } catch {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
          "Webhook body is not valid JSON.",
          { field: "body" }
        );
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
          "Webhook body must be a JSON object.",
          { field: "body" }
        );
      }

      const eventType = String(parsed.eventType || "").trim();
      if (
        eventType !== PROVIDER_WEBHOOK_EVENT_TYPE.PAYMENT_STATUS_CHANGED &&
        eventType !== PROVIDER_WEBHOOK_EVENT_TYPE.REFUND_STATUS_CHANGED
      ) {
        throwProviderError(
          FINANCE_ERROR_CODES.PROVIDER_WEBHOOK_INVALID,
          "Unsupported webhook event type.",
          { field: "eventType", eventType }
        );
      }

      // Never return secrets even if present in body
      return createNormalizedWebhookEvent({
        providerCode: FINANCE_PROVIDER_CODE.MOCK,
        eventType,
        verificationStatus: parsed.signatureValid === true ? "VERIFIED" : "UNVERIFIED",
        providerPaymentReference: parsed.providerPaymentReference,
        providerRefundReference: parsed.providerRefundReference,
        providerTransactionReference: parsed.providerTransactionReference,
        providerStatus: parsed.providerStatus,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        evidenceRef: parsed.evidenceRef || `mock-wh-${Date.parse(input.receivedAt)}`,
        tenantRoutingHint: input.tenantRoutingHint,
        receivedAt: input.receivedAt,
        metadata: {
          normalized: true,
        },
      });
    },

    /** Test-only: force a stored payment into confirmed/expired/failed. */
    _setPaymentStatusForTests(providerPaymentReference, status) {
      const stored = paymentsByRef.get(providerPaymentReference);
      if (!stored) return false;
      stored.status = status;
      return true;
    },

    _resetForTests() {
      initiationsByKey.clear();
      paymentsByRef.clear();
      refundsByKey.clear();
      refundsByRef.clear();
    },
  };

  assertPaymentProviderPort(provider);
  return provider;
}
