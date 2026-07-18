import { validateNotificationEventEnvelope } from "../contracts/notificationEventEnvelope.js";
import { createInboxNotificationRecord } from "../models/inboxNotification.js";
import {
  loadIdempotencyIndex,
  loadInboxRecords,
  makeIdempotencyIndexKey,
  saveIdempotencyIndex,
  saveInboxRecords,
} from "../storage/notificationInboxStorage.js";

/**
 * Emit a domain notification event into the Notification Module.
 * Domain modules should call only this entry point — never providers/storage.
 *
 * Idempotency: same tenantId + idempotencyKey returns the existing record
 * without creating a duplicate.
 *
 * @param {Partial<import("../contracts/notificationEventEnvelope.js").NotificationEventEnvelope>} input
 * @returns {{
 *   ok: true,
 *   duplicate: boolean,
 *   event: import("../contracts/notificationEventEnvelope.js").NotificationEventEnvelope,
 *   notification: object
 * } | {
 *   ok: false,
 *   code: string,
 *   error: string
 * }}
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
    const existing = records.find((r) => r.id === existingId);
    if (existing) {
      return {
        ok: true,
        duplicate: true,
        event,
        notification: existing,
      };
    }
  }

  const notification = createInboxNotificationRecord({ event });
  const records = loadInboxRecords();
  records.unshift(notification);
  saveInboxRecords(records);

  index[indexKey] = notification.id;
  saveIdempotencyIndex(index);

  return {
    ok: true,
    duplicate: false,
    event,
    notification,
  };
}
