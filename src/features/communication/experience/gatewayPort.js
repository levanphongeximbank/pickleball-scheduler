/**
 * Communication Experience Gateway port (COMMS-06).
 * UI must depend on this boundary — not SQL / Supabase rows / Notification inbox.
 */

export const COMMUNICATION_EXPERIENCE_GATEWAY_METHODS = Object.freeze([
  "getAdapterInfo",
  "getViewerContext",
  "getUnreadBadge",
  "listDirectConversations",
  "listDirectRequests",
  "listClubChannels",
  "listCommunityChannels",
  "loadMessages",
  "sendMessage",
  "replyMessage",
  "markRead",
  "evaluateDirectAccess",
  "openOrResolveDirectConversation",
  "requestDirectConversation",
  "acceptDirectRequest",
  "declineDirectRequest",
  "cancelDirectRequest",
  "joinCommunityChannel",
  "leaveCommunityChannel",
  "blockUser",
  "reportMessage",
  "pinMessage",
  "unpinMessage",
  "hideMessage",
  "suspendParticipant",
  "banParticipant",
  "restoreParticipant",
  "getConversationDetails",
  "getSlowModeState",
  "subscribe",
  "unsubscribe",
]);

/**
 * @param {unknown} candidate
 * @returns {boolean}
 */
export function matchesCommunicationExperienceGateway(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  return COMMUNICATION_EXPERIENCE_GATEWAY_METHODS.every(
    (method) => typeof candidate[method] === "function"
  );
}
