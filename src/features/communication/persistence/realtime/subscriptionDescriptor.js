/**
 * COMMS-05 conversation-scoped realtime subscription descriptors.
 * Does not open websockets or remote channels by itself.
 */

import { deepFreeze, requireNonEmptyString } from "../../contracts/shared.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";
import { COMMUNICATION_TABLES } from "../schema.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function createConversationRealtimeSubscriptionDescriptor(input = {}) {
  const conversationId = requireNonEmptyString(input.conversationId, "conversationId");
  const actorParticipantId = requireNonEmptyString(
    input.actorParticipantId,
    "actorParticipantId"
  );

  if (input.authorized !== true) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_SUBSCRIPTION_DENIED,
      "Realtime subscription requires prior conversation authorization",
      { conversationId, participantId: actorParticipantId }
    );
  }

  const catchUpCursor =
    input.catchUpCursor == null || input.catchUpCursor === ""
      ? null
      : String(input.catchUpCursor);

  return deepFreeze({
    schemaVersion: 1,
    scope: "conversation",
    conversationId,
    actorParticipantId,
    tenantId: input.tenantId == null ? null : String(input.tenantId),
    clubId: input.clubId == null ? null : String(input.clubId),
    /** Narrow table scope — never whole-table unscoped subscribe */
    table: COMMUNICATION_TABLES.messages,
    filter: `conversation_id=eq.${conversationId}`,
    channelName: `comms:conversation:${conversationId}`,
    catchUpCursor,
    /** Remote publication must remain disabled until activation gate clears */
    remotePublicationEnabled: false,
    reconnect: deepFreeze({
      strategy: "invalidate-and-reload",
      useCatchUpCursor: true,
    }),
  });
}
