/**
 * Build deterministic idempotency keys for notification events.
 * Never use random UUIDs as idempotencyKey.
 *
 * Format: `{tenantId}:{eventType}:{entityId}:{version}`
 */
export function buildNotificationIdempotencyKey({
  tenantId,
  eventType,
  entityId,
  version,
} = {}) {
  if (!tenantId || !eventType || !entityId || version === undefined || version === null || version === "") {
    throw new Error(
      "buildNotificationIdempotencyKey requires tenantId, eventType, entityId, and version."
    );
  }
  return `${tenantId}:${eventType}:${entityId}:${version}`;
}

export function buildRecipientIdempotencyKey(eventIdempotencyKey, recipientUserId) {
  if (!eventIdempotencyKey || !recipientUserId) {
    throw new Error("eventIdempotencyKey and recipientUserId are required.");
  }
  return `${eventIdempotencyKey}:recipient:${recipientUserId}`;
}
