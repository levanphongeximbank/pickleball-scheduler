import { validateNotificationEventEnvelope } from "../contracts/notificationEventEnvelope.js";
import { createInboxNotificationRecord } from "../models/inboxNotification.js";
import { getEventClassification } from "../constants/eventClassification.js";
import { NOTIFICATION_CATEGORIES } from "../constants/notificationCategories.js";
import { NOTIFICATION_PRIORITIES } from "../constants/notificationPriorities.js";
import { getNotificationRepository } from "../repositories/notificationRepository.js";

/**
 * Phase 1.1 low-level emit (single record, no recipient fan-out).
 * Prefer `emitDomainNotificationEvent` for domain pilots.
 */
export async function emitNotificationEvent(input = {}) {
  const validated = validateNotificationEventEnvelope(input);
  if (!validated.ok) {
    return { ok: false, code: validated.code, error: validated.error };
  }

  const event = validated.event;
  const repo = input.repository || getNotificationRepository();

  const existing = await repo.findByIdempotencyKey({
    tenantId: event.tenantId,
    idempotencyKey: event.idempotencyKey,
  });
  if (existing.notification) {
    return {
      ok: true,
      duplicate: true,
      event,
      notification: existing.notification,
    };
  }

  const classification =
    getEventClassification(event.eventType) || {
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
    };

  const title =
    (event.payload && (event.payload.title || event.payload.subject)) ||
    event.eventType;
  const message =
    (event.payload && (event.payload.message || event.payload.body)) ||
    event.eventType;

  const draft = createInboxNotificationRecord({
    event,
    category: classification.category,
    priority: classification.priority,
    title: String(title),
    message: String(message),
    sourceEntityType: event.payload?.sourceEntityType || null,
    sourceEntityId: event.payload?.sourceEntityId || null,
    idempotencyKey: event.idempotencyKey,
  });

  const saved = await repo.create(draft);
  if (!saved.ok) {
    return { ok: false, error: saved.error || "Failed to create notification." };
  }

  return {
    ok: true,
    duplicate: Boolean(saved.duplicate),
    event,
    notification: saved.notification,
  };
}
