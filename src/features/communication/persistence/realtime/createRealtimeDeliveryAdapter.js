/**
 * In-memory RealtimeDeliveryPort for COMMS-05 tests / local foundation.
 * No remote websocket. No Notification delivery.
 */

import { matchesRealtimeDeliveryPort } from "../../ports/realtimeDeliveryPort.js";
import { createCommunicationRealtimeEventEnvelope } from "./eventEnvelope.js";
import { createConversationRealtimeSubscriptionDescriptor } from "./subscriptionDescriptor.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";
import { requireNonEmptyString } from "../../contracts/shared.js";

/**
 * @param {{
 *   authorizeSubscribe?: (conversationId: string, actorParticipantId?: string) => boolean|Promise<boolean>,
 *   idProvider?: { nextId: (prefix?: string) => string },
 *   clock?: { now: () => string|number },
 * }} [options]
 */
export function createInMemoryRealtimeDeliveryAdapter(options = {}) {
  /** @type {Map<string, Set<Function>>} */
  const handlersByConversation = new Map();
  /** @type {object[]} */
  const published = [];

  async function assertAuthorized(conversationId, actorParticipantId) {
    if (typeof options.authorizeSubscribe !== "function") {
      // Fail closed without explicit authorizer
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_UNAUTHORIZED,
        "Realtime subscribe requires an authorizeSubscribe gate",
        { conversationId, participantId: actorParticipantId }
      );
    }
    const ok = await options.authorizeSubscribe(conversationId, actorParticipantId);
    if (!ok) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_SUBSCRIPTION_DENIED,
        "Actor is not authorized to subscribe to this conversation",
        { conversationId, participantId: actorParticipantId }
      );
    }
  }

  const port = {
    async publishConversationEvent(conversationId, event) {
      const id = String(conversationId);
      requireNonEmptyString(id, "conversationId");
      const envelope =
        event && event.schemaVersion === 1 && event.signalOnly === true
          ? event
          : createCommunicationRealtimeEventEnvelope({
              conversationId: id,
              eventId:
                event?.eventId ||
                (options.idProvider
                  ? options.idProvider.nextId("evt")
                  : `evt-${published.length + 1}`),
              eventType: event?.eventType || "MESSAGE_CREATED",
              occurredAt:
                event?.occurredAt ||
                (options.clock ? options.clock.now() : new Date().toISOString()),
              tenantId: event?.tenantId,
              clubId: event?.clubId,
              catchUpCursor: event?.catchUpCursor,
              payload: event?.payload || event || {},
            });
      published.push(envelope);
      const handlers = handlersByConversation.get(id);
      if (handlers) {
        for (const handler of handlers) {
          await handler(envelope);
        }
      }
    },
    /**
     * @param {string} conversationId
     * @param {Function} handler
     * @param {{ actorParticipantId?: string, tenantId?: string, clubId?: string, catchUpCursor?: string }} [subscribeOptions]
     */
    async subscribeConversation(conversationId, handler, subscribeOptions = {}) {
      const id = String(conversationId);
      requireNonEmptyString(id, "conversationId");
      if (typeof handler !== "function") {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "subscribeConversation handler must be a function",
          { conversationId: id }
        );
      }
      const actorParticipantId = subscribeOptions.actorParticipantId;
      await assertAuthorized(id, actorParticipantId);

      const descriptor = createConversationRealtimeSubscriptionDescriptor({
        conversationId: id,
        actorParticipantId: actorParticipantId || "authorized-actor",
        authorized: true,
        tenantId: subscribeOptions.tenantId,
        clubId: subscribeOptions.clubId,
        catchUpCursor: subscribeOptions.catchUpCursor,
      });

      if (!handlersByConversation.has(id)) {
        handlersByConversation.set(id, new Set());
      }
      handlersByConversation.get(id).add(handler);

      return {
        descriptor,
        unsubscribe() {
          const set = handlersByConversation.get(id);
          if (set) {
            set.delete(handler);
            if (set.size === 0) handlersByConversation.delete(id);
          }
        },
      };
    },
    /** Test helpers */
    getPublished() {
      return published.slice();
    },
    clear() {
      published.length = 0;
      handlersByConversation.clear();
    },
  };

  if (!matchesRealtimeDeliveryPort(port)) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "In-memory realtime adapter must match RealtimeDeliveryPort"
    );
  }

  return Object.freeze(port);
}

/**
 * Descriptor-only scoped adapter scaffold for future Supabase postgres_changes wiring.
 * Does NOT connect remotely. Throws if remote subscribe is attempted while gated.
 *
 * @param {{ authorizeSubscribe: Function }} options
 */
export function createScopedRealtimeDeliveryAdapter(options) {
  if (typeof options?.authorizeSubscribe !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_UNAUTHORIZED,
      "Scoped realtime adapter requires authorizeSubscribe"
    );
  }

  return createInMemoryRealtimeDeliveryAdapter({
    authorizeSubscribe: options.authorizeSubscribe,
    idProvider: options.idProvider,
    clock: options.clock,
  });
}
