import { EVENT_TYPE } from "../constants/statuses.js";

function createEventId() {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function appendEvent(session, {
  eventType,
  message,
  entityType = null,
  entityId = null,
  metadata = {},
  createdBy = null,
} = {}) {
  const now = new Date().toISOString();
  const event = {
    id: createEventId(),
    sessionId: session.id,
    eventType: eventType || EVENT_TYPE.SESSION_CREATE,
    entityType,
    entityId,
    message: String(message || "").trim(),
    metadataJson: metadata,
    createdBy,
    createdAt: now,
  };

  return {
    ...session,
    events: [event, ...(session.events || [])].slice(0, 500),
    updatedAt: now,
  };
}

export function listRecentEvents(session, limit = 50) {
  return (session.events || []).slice(0, limit);
}
