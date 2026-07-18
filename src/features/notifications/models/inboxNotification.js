import { NOTIFICATION_STATUSES } from "../constants/notificationStatuses.js";

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Inbox / notification record derived from a validated event envelope.
 * @param {object} input
 * @param {import("../contracts/notificationEventEnvelope.js").NotificationEventEnvelope} input.event
 * @param {string} [input.status]
 */
export function createInboxNotificationRecord({ event, status } = {}) {
  if (!event) {
    throw new Error("event is required to create an inbox notification record.");
  }
  const now = new Date().toISOString();
  return {
    id: createId("nrec"),
    eventId: event.eventId,
    eventType: event.eventType,
    tenantId: event.tenantId,
    venueId: event.venueId ?? null,
    clubId: event.clubId ?? null,
    competitionId: event.competitionId ?? null,
    actorUserId: event.actorUserId ?? null,
    idempotencyKey: event.idempotencyKey,
    payload: event.payload && typeof event.payload === "object" ? { ...event.payload } : {},
    recipientHints: {
      userIds: [...(event.recipientHints?.userIds || [])],
      roles: [...(event.recipientHints?.roles || [])],
      entryIds: [...(event.recipientHints?.entryIds || [])],
    },
    status: status || NOTIFICATION_STATUSES.CREATED,
    createdAt: now,
    updatedAt: now,
    readAt: null,
  };
}
