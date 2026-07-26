/**
 * Webhook ingress receipt / result contract — immutable, no raw payload.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  IDEMPOTENCY_OUTCOME_VALUES,
  WEBHOOK_INGRESS_OUTCOME_VALUES,
  WEBHOOK_INGRESS_RECEIPT_VERSION,
  WEBHOOK_ROUTING_OUTCOME_VALUES,
  WEBHOOK_VERIFICATION_OUTCOME_VALUES,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireEnumMember,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const WEBHOOK_INGRESS_RECEIPT_ERROR = Object.freeze({
  INVALID: "WEBHOOK_INGRESS_RECEIPT_INVALID",
  VERSION_INVALID: "WEBHOOK_INGRESS_RECEIPT_VERSION_INVALID",
  REFERENCE_INVALID: "WEBHOOK_INGRESS_RECEIPT_REFERENCE_INVALID",
  OUTCOME_INVALID: "WEBHOOK_INGRESS_RECEIPT_OUTCOME_INVALID",
  TIMESTAMP_INVALID: "WEBHOOK_INGRESS_RECEIPT_TIMESTAMP_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookIngressReceipt(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_INGRESS_RECEIPT_ERROR.INVALID,
        "WebhookIngressReceipt input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_INGRESS_RECEIPT_VERSION,
    "contractVersion",
    WEBHOOK_INGRESS_RECEIPT_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const receiptId = requireNonEmptyString(
    input.receiptId ?? input.ingressId,
    "receiptId",
    WEBHOOK_INGRESS_RECEIPT_ERROR.REFERENCE_INVALID,
    "receiptId"
  );
  if (!receiptId.ok) return receiptId;

  const ingressId = requireNonEmptyString(
    input.ingressId,
    "ingressId",
    WEBHOOK_INGRESS_RECEIPT_ERROR.REFERENCE_INVALID,
    "ingressId"
  );
  if (!ingressId.ok) return ingressId;

  const outcome = requireEnumMember(
    input.outcome,
    WEBHOOK_INGRESS_OUTCOME_VALUES,
    "outcome",
    WEBHOOK_INGRESS_RECEIPT_ERROR.OUTCOME_INVALID,
    "outcome"
  );
  if (!outcome.ok) return outcome;

  const accepted = requireBoolean(
    input.accepted ??
      (outcome.value === "ACCEPTED" || outcome.value === "DUPLICATE"),
    "accepted",
    WEBHOOK_INGRESS_RECEIPT_ERROR.INVALID
  );
  if (!accepted.ok) return accepted;

  const completedAt = requireIsoInstant(
    input.completedAt ?? input.receivedAt ?? new Date().toISOString(),
    "completedAt",
    WEBHOOK_INGRESS_RECEIPT_ERROR.TIMESTAMP_INVALID
  );
  if (!completedAt.ok) return completedAt;

  /** @type {string|undefined} */
  let routeId;
  if ("routeId" in input && input.routeId !== undefined) {
    const route = requireNonEmptyString(
      input.routeId,
      "routeId",
      WEBHOOK_INGRESS_RECEIPT_ERROR.REFERENCE_INVALID,
      "routeId"
    );
    if (!route.ok) return route;
    routeId = route.value;
  }

  /** @type {string|undefined} */
  let subscriptionId;
  if ("subscriptionId" in input && input.subscriptionId !== undefined) {
    const sub = requireNonEmptyString(
      input.subscriptionId,
      "subscriptionId",
      WEBHOOK_INGRESS_RECEIPT_ERROR.REFERENCE_INVALID,
      "subscriptionId"
    );
    if (!sub.ok) return sub;
    subscriptionId = sub.value;
  }

  /** @type {string|undefined} */
  let verificationOutcome;
  if ("verificationOutcome" in input && input.verificationOutcome !== undefined) {
    const v = requireEnumMember(
      input.verificationOutcome,
      WEBHOOK_VERIFICATION_OUTCOME_VALUES,
      "verificationOutcome",
      WEBHOOK_INGRESS_RECEIPT_ERROR.OUTCOME_INVALID,
      "verificationOutcome"
    );
    if (!v.ok) return v;
    verificationOutcome = v.value;
  }

  /** @type {string|undefined} */
  let routingOutcome;
  if ("routingOutcome" in input && input.routingOutcome !== undefined) {
    const r = requireEnumMember(
      input.routingOutcome,
      WEBHOOK_ROUTING_OUTCOME_VALUES,
      "routingOutcome",
      WEBHOOK_INGRESS_RECEIPT_ERROR.OUTCOME_INVALID,
      "routingOutcome"
    );
    if (!r.ok) return r;
    routingOutcome = r.value;
  }

  /** @type {string|undefined} */
  let idempotencyOutcome;
  if ("idempotencyOutcome" in input && input.idempotencyOutcome !== undefined) {
    const i = requireEnumMember(
      input.idempotencyOutcome,
      IDEMPOTENCY_OUTCOME_VALUES,
      "idempotencyOutcome",
      WEBHOOK_INGRESS_RECEIPT_ERROR.OUTCOME_INVALID,
      "idempotencyOutcome"
    );
    if (!i.ok) return i;
    idempotencyOutcome = i.value;
  }

  /** @type {string|undefined} */
  let reason;
  if ("reason" in input && input.reason !== undefined) {
    const r = requireNonEmptyString(
      input.reason,
      "reason",
      WEBHOOK_INGRESS_RECEIPT_ERROR.REFERENCE_INVALID,
      "reason"
    );
    if (!r.ok) return r;
    reason = r.value;
  }

  let diagnostics = Object.freeze({});
  if ("diagnostics" in input && input.diagnostics !== undefined) {
    const redacted = createRedactedDiagnostics(input.diagnostics);
    if (!redacted.ok) return redacted;
    diagnostics = redacted.value;
  }

  /** @type {object|undefined} */
  let retryClassification;
  if ("retryClassification" in input && input.retryClassification !== undefined) {
    if (!isPlainObject(input.retryClassification)) {
      return fail(
        contractError(
          WEBHOOK_INGRESS_RECEIPT_ERROR.INVALID,
          "retryClassification must be a plain object",
          "retryClassification"
        )
      );
    }
    retryClassification = deepFreeze({
      code:
        typeof input.retryClassification.code === "string"
          ? input.retryClassification.code
          : "INTEGRATION_INTERNAL_FAILURE",
      retryable: Boolean(input.retryClassification.retryable),
      reason:
        typeof input.retryClassification.reason === "string"
          ? input.retryClassification.reason
          : "unspecified",
    });
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      receiptId: receiptId.value,
      ingressId: ingressId.value,
      outcome: outcome.value,
      accepted: accepted.value,
      completedAt: completedAt.value,
      ...(routeId ? { routeId } : {}),
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(verificationOutcome ? { verificationOutcome } : {}),
      ...(routingOutcome ? { routingOutcome } : {}),
      ...(idempotencyOutcome ? { idempotencyOutcome } : {}),
      ...(reason ? { reason } : {}),
      ...(retryClassification ? { retryClassification } : {}),
      diagnostics,
      productionBlocked: true,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isWebhookIngressReceipt(value) {
  return (
    isPlainObject(value) &&
    value.contractVersion === WEBHOOK_INGRESS_RECEIPT_VERSION &&
    typeof value.receiptId === "string" &&
    typeof value.ingressId === "string" &&
    typeof value.outcome === "string" &&
    typeof value.accepted === "boolean"
  );
}
