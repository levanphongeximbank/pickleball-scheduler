/**
 * Delivery identity / idempotency helpers — Phase 1.5.
 * Identity: logical notification key + recipient + channel + provider.
 */

export function buildDeliveryIdempotencyKey({
  notificationIdempotencyKey,
  recipientUserId,
  channel,
  provider,
} = {}) {
  const parts = [
    String(notificationIdempotencyKey || "").trim(),
    String(recipientUserId || "").trim(),
    String(channel || "").trim(),
    String(provider || "").trim(),
  ];
  if (parts.some((p) => !p)) {
    return null;
  }
  return parts.join(":");
}

export function mapPriorityToQueueRank(priority) {
  const p = String(priority || "NORMAL").toUpperCase();
  if (p === "URGENT" || p === "CRITICAL") return 10;
  if (p === "HIGH") return 30;
  if (p === "LOW") return 200;
  return 100;
}
