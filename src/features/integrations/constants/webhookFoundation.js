/**
 * Phase 11A — webhook foundation design (no ingress, no network).
 * Table: webhook_events (Sprint 10). webhook_endpoints → Phase 11B.
 */

export const WEBHOOK_EVENT_STATUS = Object.freeze({
  RECEIVED: "received",
  PROCESSING: "processing",
  PROCESSED: "processed",
  FAILED: "failed",
  DEAD_LETTER: "dead_letter",
});

/** Retry policy design — enforcement in Phase 11B worker/edge. */
export const WEBHOOK_RETRY_POLICY = Object.freeze({
  maxAttempts: 5,
  backoffMs: [60_000, 300_000, 900_000, 3_600_000, 14_400_000],
  deadLetterAfterAttempts: 5,
});

/** Signature verification design — provider-specific in Phase 11B. */
export const WEBHOOK_SIGNATURE_MODES = Object.freeze({
  VNPAY_HMAC_SHA512: "vnpay_hmac_sha512",
  MOMO_HMAC_SHA256: "momo_hmac_sha256",
  STRIPE_SIGNING_SECRET: "stripe_signing_secret",
  GENERIC_HMAC_SHA256: "generic_hmac_sha256",
});

export const WEBHOOK_EVENT_TYPES = Object.freeze({
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  MARKETPLACE_ORDER_PAID: "marketplace.order.paid",
  NOTIFICATION_DELIVERED: "notification.delivered",
  NOTIFICATION_FAILED: "notification.failed",
});

export function buildWebhookIdempotencyKey(provider, eventType, externalId) {
  return `${provider}:${eventType}:${String(externalId || "").trim()}`;
}
