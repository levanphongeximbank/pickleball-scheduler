import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";
import { NOTIFICATION_PRIORITIES } from "../constants/notificationPriorities.js";
import { NOTIFICATION_CATEGORIES } from "../constants/notificationCategories.js";

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Phase 1.2 inbox notification record (per recipient).
 *
 * @param {object} input
 * @param {import("../contracts/notificationEventEnvelope.js").NotificationEventEnvelope} input.event
 * @param {string} input.recipientUserId
 * @param {string} input.category
 * @param {string} input.priority
 * @param {string} input.title
 * @param {string} input.message
 * @param {string} [input.status]
 * @param {string|null} [input.sourceEntityType]
 * @param {string|null} [input.sourceEntityId]
 * @param {Record<string, unknown>} [input.metadata]
 * @param {string} [input.idempotencyKey] — per-recipient key
 */
export function createInboxNotificationRecord({
  event,
  recipientUserId = null,
  category = NOTIFICATION_CATEGORIES.SYSTEM,
  priority = NOTIFICATION_PRIORITIES.NORMAL,
  title = "",
  message = "",
  status,
  sourceEntityType = null,
  sourceEntityId = null,
  metadata = {},
  idempotencyKey = null,
} = {}) {
  if (!event) {
    throw new Error("event is required to create an inbox notification record.");
  }
  const now = new Date().toISOString();
  const notificationId = createId("nrec");

  return {
    notificationId,
    id: notificationId, // Phase 1.1 alias
    eventId: event.eventId,
    eventType: event.eventType,
    category,
    priority,
    tenantId: event.tenantId,
    venueId: event.venueId ?? null,
    clubId: event.clubId ?? null,
    competitionId: event.competitionId ?? null,
    recipientUserId: recipientUserId ? String(recipientUserId) : null,
    actorUserId: event.actorUserId ?? null,
    title: title || "",
    message: message || "",
    status: status || NOTIFICATION_STATUSES.CREATED,
    readAt: null,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: idempotencyKey || event.idempotencyKey,
    sourceEntityType: sourceEntityType || null,
    sourceEntityId: sourceEntityId || null,
    metadata: metadata && typeof metadata === "object" ? { ...metadata } : {},
    // Phase 1.1 compat fields
    payload: event.payload && typeof event.payload === "object" ? { ...event.payload } : {},
    recipientHints: {
      userIds: [...(event.recipientHints?.userIds || [])],
      roles: [...(event.recipientHints?.roles || [])],
      entryIds: [...(event.recipientHints?.entryIds || [])],
    },
  };
}
