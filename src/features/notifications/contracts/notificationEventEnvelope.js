/**
 * Canonical Notification Event Envelope (Phase 1.1).
 *
 * Required: eventType, tenantId, idempotencyKey
 * Optional: eventId, occurredAt, venueId, clubId, competitionId, actorUserId,
 *           payload, recipientHints
 */

export const ENVELOPE_ERROR_CODES = Object.freeze({
  INVALID_ENVELOPE: "invalid_envelope",
  MISSING_TENANT_ID: "missing_tenant_id",
  MISSING_EVENT_TYPE: "missing_event_type",
  MISSING_IDEMPOTENCY_KEY: "missing_idempotency_key",
});

const EMPTY_RECIPIENT_HINTS = Object.freeze({
  userIds: Object.freeze([]),
  roles: Object.freeze([]),
  entryIds: Object.freeze([]),
});

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeString(value) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function normalizeRecipientHints(input) {
  const hints = input && typeof input === "object" ? input : {};
  return {
    userIds: Array.isArray(hints.userIds)
      ? hints.userIds.map(String).filter(Boolean)
      : [],
    roles: Array.isArray(hints.roles) ? hints.roles.map(String).filter(Boolean) : [],
    entryIds: Array.isArray(hints.entryIds)
      ? hints.entryIds.map(String).filter(Boolean)
      : [],
  };
}

/**
 * @typedef {object} NotificationRecipientHints
 * @property {string[]} userIds
 * @property {string[]} roles
 * @property {string[]} entryIds
 */

/**
 * @typedef {object} NotificationEventEnvelope
 * @property {string} eventId
 * @property {string} eventType
 * @property {string} occurredAt
 * @property {string} tenantId
 * @property {string|null} venueId
 * @property {string|null} clubId
 * @property {string|null} competitionId
 * @property {string|null} actorUserId
 * @property {string} idempotencyKey
 * @property {Record<string, unknown>} payload
 * @property {NotificationRecipientHints} recipientHints
 */

/**
 * Validate and normalize a domain notification event envelope.
 * @param {Partial<NotificationEventEnvelope>} input
 * @returns {{ ok: true, event: NotificationEventEnvelope } | { ok: false, code: string, error: string }}
 */
export function validateNotificationEventEnvelope(input) {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      code: ENVELOPE_ERROR_CODES.INVALID_ENVELOPE,
      error: "Event envelope is required.",
    };
  }

  if (!input.tenantId) {
    return {
      ok: false,
      code: ENVELOPE_ERROR_CODES.MISSING_TENANT_ID,
      error: "tenantId is required.",
    };
  }

  if (!input.eventType) {
    return {
      ok: false,
      code: ENVELOPE_ERROR_CODES.MISSING_EVENT_TYPE,
      error: "eventType is required.",
    };
  }

  if (!input.idempotencyKey) {
    return {
      ok: false,
      code: ENVELOPE_ERROR_CODES.MISSING_IDEMPOTENCY_KEY,
      error: "idempotencyKey is required.",
    };
  }

  const payload =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? { ...input.payload }
      : {};

  /** @type {NotificationEventEnvelope} */
  const event = {
    eventId: normalizeString(input.eventId) || createId("nevt"),
    eventType: String(input.eventType),
    occurredAt: normalizeString(input.occurredAt) || new Date().toISOString(),
    tenantId: String(input.tenantId),
    venueId: normalizeString(input.venueId),
    clubId: normalizeString(input.clubId),
    competitionId: normalizeString(input.competitionId),
    actorUserId: normalizeString(input.actorUserId),
    idempotencyKey: String(input.idempotencyKey),
    payload,
    recipientHints: normalizeRecipientHints(input.recipientHints),
  };

  return { ok: true, event };
}

/**
 * Build a normalized envelope (throws via result pattern — prefer validate).
 * @param {Partial<NotificationEventEnvelope>} input
 * @returns {NotificationEventEnvelope}
 */
export function createNotificationEventEnvelope(input = {}) {
  const result = validateNotificationEventEnvelope(input);
  if (!result.ok) {
    const err = new Error(result.error);
    err.code = result.code;
    throw err;
  }
  return result.event;
}

export function getEmptyRecipientHints() {
  return {
    userIds: [...EMPTY_RECIPIENT_HINTS.userIds],
    roles: [...EMPTY_RECIPIENT_HINTS.roles],
    entryIds: [...EMPTY_RECIPIENT_HINTS.entryIds],
  };
}
