/**
 * RealtimeDeliveryPort — Communication-owned chat event delivery abstraction.
 * Must not reuse match-live / referee / team-tournament channels.
 */

import { matchesPortMethods, throwPortUnimplemented } from "./portHelpers.js";

/**
 * @typedef {Object} RealtimeDeliveryPort
 * @property {(conversationId: string, event: unknown) => Promise<void>} publishConversationEvent
 * @property {(conversationId: string, handler: Function) => Promise<{ unsubscribe: Function }>} subscribeConversation
 */

export const REALTIME_DELIVERY_PORT_METHODS = Object.freeze([
  "publishConversationEvent",
  "subscribeConversation",
]);

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesRealtimeDeliveryPort(port) {
  return matchesPortMethods(port, REALTIME_DELIVERY_PORT_METHODS);
}

/**
 * @returns {RealtimeDeliveryPort}
 */
export function createUnimplementedRealtimeDeliveryPort() {
  return {
    async publishConversationEvent() {
      throwPortUnimplemented(
        "RealtimeDeliveryPort",
        "publishConversationEvent"
      );
    },
    async subscribeConversation() {
      throwPortUnimplemented("RealtimeDeliveryPort", "subscribeConversation");
    },
  };
}
