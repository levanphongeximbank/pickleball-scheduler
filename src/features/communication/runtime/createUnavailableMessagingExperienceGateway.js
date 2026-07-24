/**
 * Fail-closed unavailable Communication Experience Gateway (COMMS-07).
 * Satisfies the gateway port but never returns demo / fake conversation data.
 */

import { COMMUNICATION_EXPERIENCE_GATEWAY_METHODS } from "../experience/gatewayPort.js";
import { matchesCommunicationExperienceGateway } from "../experience/gatewayPort.js";
import { createUnreadBadgeVm } from "../experience/viewModels.js";
import {
  UNAVAILABLE_GATEWAY_MARKER,
  COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
} from "./constants.js";
import { createRuntimeNotActivatedError } from "./experienceErrors.js";

/**
 * @param {object} [options]
 * @param {string|null} [options.viewerParticipantId]
 * @param {string|null} [options.tenantId]
 * @param {string|null} [options.clubId]
 * @param {string|null} [options.correlationId]
 * @param {string} [options.reason]
 */
export function createUnavailableMessagingExperienceGateway(options = {}) {
  const correlationId = options.correlationId || null;
  const reason = options.reason || "RUNTIME_UNAVAILABLE";

  function notActivated() {
    const err = createRuntimeNotActivatedError(correlationId);
    err.details = { ...err.details, reason };
    throw err;
  }

  const gateway = {
    getAdapterInfo() {
      return Object.freeze({
        ...UNAVAILABLE_GATEWAY_MARKER,
        reason,
        userMessage: COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
      });
    },

    getViewerContext() {
      return Object.freeze({
        viewerParticipantId: options.viewerParticipantId
          ? String(options.viewerParticipantId)
          : null,
        clubId: options.clubId ? String(options.clubId) : null,
        tenantId: options.tenantId ? String(options.tenantId) : null,
        profile: null,
        runtimeUnavailable: true,
      });
    },

    async getUnreadBadge() {
      const badge = createUnreadBadgeVm({
        direct: 0,
        club: 0,
        community: 0,
        requests: 0,
      });
      return Object.freeze({ ...badge, unavailable: true });
    },

    async listDirectConversations() {
      notActivated();
    },
    async listDirectRequests() {
      notActivated();
    },
    async listClubChannels() {
      notActivated();
    },
    async listCommunityChannels() {
      notActivated();
    },
    async loadMessages() {
      notActivated();
    },
    async sendMessage() {
      notActivated();
    },
    async replyMessage() {
      notActivated();
    },
    async markRead() {
      notActivated();
    },
    async evaluateDirectAccess() {
      notActivated();
    },
    async openOrResolveDirectConversation() {
      notActivated();
    },
    async requestDirectConversation() {
      notActivated();
    },
    async acceptDirectRequest() {
      notActivated();
    },
    async declineDirectRequest() {
      notActivated();
    },
    async cancelDirectRequest() {
      notActivated();
    },
    async joinCommunityChannel() {
      notActivated();
    },
    async leaveCommunityChannel() {
      notActivated();
    },
    async blockUser() {
      notActivated();
    },
    async reportMessage() {
      notActivated();
    },
    async pinMessage() {
      notActivated();
    },
    async unpinMessage() {
      notActivated();
    },
    async hideMessage() {
      notActivated();
    },
    async suspendParticipant() {
      notActivated();
    },
    async banParticipant() {
      notActivated();
    },
    async restoreParticipant() {
      notActivated();
    },
    async getConversationDetails() {
      notActivated();
    },
    async getSlowModeState() {
      notActivated();
    },

    async subscribe() {
      // No remote realtime while unavailable — return inert handle.
      return Object.freeze({
        conversationId: null,
        unsubscribe: () => undefined,
        unavailable: true,
      });
    },

    async unsubscribe() {
      return Object.freeze({ ok: true, unavailable: true });
    },
  };

  for (const method of COMMUNICATION_EXPERIENCE_GATEWAY_METHODS) {
    if (typeof gateway[method] !== "function") {
      throw new Error(`Unavailable gateway missing method: ${method}`);
    }
  }

  if (!matchesCommunicationExperienceGateway(gateway)) {
    throw new Error(
      "Unavailable gateway missing required Communication Experience methods"
    );
  }

  return Object.freeze(gateway);
}
