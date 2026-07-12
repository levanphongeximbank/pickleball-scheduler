export const ENGINE_ERROR = Object.freeze({
  VERSION_CONFLICT: "VERSION_CONFLICT",
  SEQUENCE_GAP: "SEQUENCE_GAP",
  INVALID_EVENT: "INVALID_EVENT",
  MATCH_LOCKED: "MATCH_LOCKED",
  MATCH_NOT_STARTED: "MATCH_NOT_STARTED",
  INVALID_RALLY_WINNER: "INVALID_RALLY_WINNER",
  UNDO_NOT_ALLOWED: "UNDO_NOT_ALLOWED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
});

export function createEngineError(code, message) {
  return { ok: false, code, error: message || code };
}

export function createEngineSuccess(payload) {
  return { ok: true, ...payload };
}

export function normalizeIncomingEvent(event) {
  return {
    eventId: String(event?.eventId || ""),
    eventType: String(event?.eventType || ""),
    sequence: Number(event?.sequence),
    expectedVersion: Number(event?.expectedVersion),
    actorId: String(event?.actorId || ""),
    payload: event?.payload && typeof event.payload === "object" ? { ...event.payload } : {},
  };
}
