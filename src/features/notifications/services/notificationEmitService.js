import { validateNotificationEventEnvelope } from "../contracts/notificationEventEnvelope.js";
import { createInboxNotificationRecord } from "../models/inboxNotification.js";
import { getEventClassification } from "../constants/eventClassification.js";
import { NOTIFICATION_CATEGORIES } from "../constants/notificationCategories.js";
import { NOTIFICATION_PRIORITIES } from "../constants/notificationPriorities.js";
import {
  loadIdempotencyIndex,
  loadInboxRecords,
  makeIdempotencyIndexKey,
  saveIdempotencyIndex,
  saveInboxRecords,
} from "../storage/notificationInboxStorage.js";

/**
 * Phase 1.1 low-level emit (single record, no recipient fan-out).
 * Prefer `emitDomainNotificationEvent` for domain pilots (Phase 1.2+).
 */
export function emitNotificationEvent(input = {}) {
  const validated = validateNotificationEventEnvelope(input);
  if (!validated.ok) {
    return { ok: false, code: validated.code, error: validated.error };
  }

  const event = validated.event;
  const indexKey = makeIdempotencyIndexKey(event.tenantId, event.idempotencyKey);
  const index = loadIdempotencyIndex();
  const existingId = index[indexKey];

  if (existingId) {
    const records = loadInboxRecords();
    const existing = records.find((r) => (r.notificationId || r.id) === existingId);
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        event,
        notification: existing,
      };
    }
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

  const notification = createInboxNotificationRecord({
    event,
    category: classification.category,
    priority: classification.priority,
    title: String(title),
    message: String(message),
    sourceEntityType: event.payload?.sourceEntityType || null,
    sourceEntityId: event.payload?.sourceEntityId || null,
    idempotencyKey: event.idempotencyKey,
  });

  const records = loadInboxRecords();
  records.unshift(notification);
  saveInboxRecords(records);

  index[indexKey] = notification.notificationId || notification.id;
  saveIdempotencyIndex(index);

  return {
    ok: true,
    duplicate: false,
    event,
    notification,
  };
}
