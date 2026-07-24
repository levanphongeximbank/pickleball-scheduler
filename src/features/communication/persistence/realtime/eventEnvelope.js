/**
 * COMMS-05 deterministic realtime event envelope.
 * Persistence remains source of truth; realtime is delivery signal only.
 */

import { deepFreeze, requireNonEmptyString, requireValidTimestamp } from "../../contracts/shared.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";

export const COMMUNICATION_REALTIME_EVENT_TYPE = Object.freeze({
  MESSAGE_CREATED: "MESSAGE_CREATED",
  MESSAGE_UPDATED: "MESSAGE_UPDATED",
  MESSAGE_HIDDEN: "MESSAGE_HIDDEN",
  PARTICIPANT_CHANGED: "PARTICIPANT_CHANGED",
  ACCESS_CHANGED: "ACCESS_CHANGED",
  READ_STATE_CHANGED: "READ_STATE_CHANGED",
  PIN_CHANGED: "PIN_CHANGED",
  MODERATION_CHANGED: "MODERATION_CHANGED",
});

export const COMMUNICATION_REALTIME_EVENT_TYPE_VALUES = Object.freeze(
  Object.values(COMMUNICATION_REALTIME_EVENT_TYPE)
);

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createCommunicationRealtimeEventEnvelope(input = {}) {
  const conversationId = requireNonEmptyString(input.conversationId, "conversationId");
  const eventType = requireNonEmptyString(input.eventType, "eventType");
  if (!COMMUNICATION_REALTIME_EVENT_TYPE_VALUES.includes(eventType)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported realtime event type: ${eventType}`,
      { eventType }
    );
  }
  const eventId = requireNonEmptyString(input.eventId, "eventId");
  const occurredAt = requireValidTimestamp(input.occurredAt, "occurredAt");
  const catchUpCursor =
    input.catchUpCursor == null || input.catchUpCursor === ""
      ? `${conversationId}:${eventId}`
      : String(input.catchUpCursor);

  return deepFreeze({
    schemaVersion: 1,
    eventId,
    eventType,
    conversationId,
    tenantId: input.tenantId == null ? null : String(input.tenantId),
    clubId: input.clubId == null ? null : String(input.clubId),
    occurredAt,
    catchUpCursor,
    /** Signal only — clients must reload authoritative persistence state */
    signalOnly: true,
    payload:
      input.payload && typeof input.payload === "object"
        ? deepFreeze({ ...input.payload })
        : deepFreeze({}),
  });
}
