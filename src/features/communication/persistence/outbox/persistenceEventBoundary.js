/**
 * COMMS-05 minimal persistence event / outbox boundary.
 *
 * Not a global event bus. Not Notification delivery.
 * Message commit + event intent should share a trusted unit-of-work when available.
 */

import { deepFreeze, requireNonEmptyString, requireValidTimestamp } from "../../contracts/shared.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";
import { COMMUNICATION_REALTIME_EVENT_TYPE_VALUES } from "../realtime/eventEnvelope.js";
import { COMMUNICATION_TABLES } from "../schema.js";
import { assertSupabaseCommunicationClient } from "../supabase/clientContract.js";
import { insertRow } from "../supabase/repositorySupport.js";

export const COMMUNICATION_DELIVERY_INTENT = Object.freeze({
  REALTIME_SIGNAL: "REALTIME_SIGNAL",
  DEFERRED_NOTIFICATION: "DEFERRED_NOTIFICATION",
  DEFERRED_AUDIT: "DEFERRED_AUDIT",
});

/**
 * @param {object} input
 */
export function createCommunicationPersistenceEventIntent(input = {}) {
  const eventId = requireNonEmptyString(input.eventId, "eventId");
  const conversationId = requireNonEmptyString(input.conversationId, "conversationId");
  const eventType = requireNonEmptyString(input.eventType, "eventType");
  if (!COMMUNICATION_REALTIME_EVENT_TYPE_VALUES.includes(eventType)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported persistence event type: ${eventType}`,
      { eventType }
    );
  }
  const deliveryIntent =
    input.deliveryIntent == null
      ? COMMUNICATION_DELIVERY_INTENT.REALTIME_SIGNAL
      : String(input.deliveryIntent);
  if (!Object.values(COMMUNICATION_DELIVERY_INTENT).includes(deliveryIntent)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported delivery intent: ${deliveryIntent}`,
      { deliveryIntent }
    );
  }
  if (
    deliveryIntent === COMMUNICATION_DELIVERY_INTENT.DEFERRED_NOTIFICATION ||
    deliveryIntent === COMMUNICATION_DELIVERY_INTENT.DEFERRED_AUDIT
  ) {
    // Explicit deferred integration gate — record intent only; do not deliver.
  }

  return deepFreeze({
    eventId,
    conversationId,
    eventType,
    eventVersion: input.eventVersion == null ? 1 : Number(input.eventVersion),
    occurredAt: requireValidTimestamp(input.occurredAt, "occurredAt"),
    catchUpCursor:
      input.catchUpCursor == null
        ? `${conversationId}:${eventId}`
        : String(input.catchUpCursor),
    payload:
      input.payload && typeof input.payload === "object" ? { ...input.payload } : {},
    deliveryIntent,
  });
}

/**
 * @param {object} client
 */
export function createCommunicationPersistenceEventRepository(client) {
  const c = assertSupabaseCommunicationClient(client);
  return Object.freeze({
    async append(intentInput) {
      const intent = createCommunicationPersistenceEventIntent(intentInput);
      const row = {
        event_id: intent.eventId,
        conversation_id: intent.conversationId,
        event_type: intent.eventType,
        event_version: intent.eventVersion,
        occurred_at: intent.occurredAt,
        recorded_at: new Date().toISOString(),
        catch_up_cursor: intent.catchUpCursor,
        payload: intent.payload,
        delivery_intent: intent.deliveryIntent,
      };
      await insertRow(
        c,
        COMMUNICATION_TABLES.persistenceEvents,
        row,
        "PersistenceEvent",
        { conversationId: intent.conversationId }
      );
      return intent;
    },
  });
}

export const COMMUNICATION_OUTBOX_INTEGRATION_GATES = Object.freeze({
  NOTIFICATION_DELIVERY: "DEFERRED_INTEGRATION_GATE",
  PLATFORM_AUDIT: "DEFERRED_INTEGRATION_GATE",
  NOTE:
    "Persist REALTIME_SIGNAL intents with message commits when unit-of-work is available. Do not call NotificationEmitPort delivery from this boundary in COMMS-05.",
});
