/**
 * Browser-safe HTTP Messaging Experience Gateway (COMMS-ACT-05).
 *
 * Calls /api/communication/* with the caller's JWT.
 * Never holds or reads service-role secrets.
 * Network failure → typed error (never local success).
 */

import { matchesCommunicationExperienceGateway } from "../experience/gatewayPort.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { PRODUCTION_GATEWAY_MARKER } from "../runtime/constants.js";
import {
  COMMUNICATION_TRUSTED_BACKEND_HOST,
  COMMUNICATION_TRUSTED_COMMAND,
} from "./constants.js";

function resolveCommandUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${COMMUNICATION_TRUSTED_BACKEND_HOST.commandPath}`;
  }
  return COMMUNICATION_TRUSTED_BACKEND_HOST.commandPath;
}

/**
 * @param {object} options
 * @param {() => Promise<string|null>|string|null} options.getAccessToken
 * @param {string} options.actorParticipantId
 */
export function createTrustedBackendHttpMessagingGateway(options = {}) {
  const actorParticipantId = String(options.actorParticipantId || "").trim();
  if (!actorParticipantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
      "Authenticated actor required for trusted-backend HTTP gateway",
      {}
    );
  }

  const tenantId = options.tenantId ? String(options.tenantId) : null;
  const clubId = options.clubId ? String(options.clubId) : null;
  const getAccessToken = options.getAccessToken;
  if (typeof getAccessToken !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "getAccessToken is required",
      {}
    );
  }

  async function invoke(command, payload = {}) {
    const token = await getAccessToken();
    if (!token) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
        "Missing access token for trusted backend",
        {}
      );
    }

    let response;
    try {
      response = await fetch(resolveCommandUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command, ...payload }),
      });
    } catch (err) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
        "Trusted backend network failure — not local success",
        { reason: err?.message || "network" }
      );
    }

    let body;
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (!response.ok || body?.ok === false) {
      throw new CommunicationFoundationError(
        body?.code || COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
        body?.error || "Trusted backend command failed",
        { httpStatus: response.status }
      );
    }
    return body.result ?? body;
  }

  function notWired(method) {
    return async () => {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED,
        `HTTP gateway method not activated for ACT-05 write smoke: ${method}`,
        { method }
      );
    };
  }

  const gateway = {
    getAdapterInfo() {
      return Object.freeze({
        ...PRODUCTION_GATEWAY_MARKER,
        transport: "trusted_backend_http",
        host: COMMUNICATION_TRUSTED_BACKEND_HOST.basePath,
        secretsInBrowser: false,
      });
    },
    getViewerContext() {
      return Object.freeze({
        viewerParticipantId: actorParticipantId,
        clubId,
        tenantId,
        profile: null,
      });
    },
    getUnreadBadge: notWired("getUnreadBadge"),
    listDirectConversations: notWired("listDirectConversations"),
    listDirectRequests: notWired("listDirectRequests"),
    listClubChannels: notWired("listClubChannels"),
    listCommunityChannels: async () => {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
        "Community remains BLOCKED_FAIL_CLOSED",
        {}
      );
    },
    loadMessages: notWired("loadMessages"),
    async sendMessage(input = {}) {
      if (input.scope === "COMMUNITY") {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
          "Community remains BLOCKED_FAIL_CLOSED",
          {}
        );
      }
      if (input.scope === "CLUB") {
        return invoke(COMMUNICATION_TRUSTED_COMMAND.SEND_CLUB_MESSAGE, {
          conversationId: input.conversationId,
          body: input.body,
          replyToMessageId: input.replyToMessageId,
          clubId,
          idempotencyKey: input.idempotencyKey,
        });
      }
      return invoke(COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE, {
        conversationId: input.conversationId,
        body: input.body,
        replyToMessageId: input.replyToMessageId,
        idempotencyKey: input.idempotencyKey,
      });
    },
    replyMessage(input = {}) {
      return gateway.sendMessage({
        ...input,
        replyToMessageId: input.replyToMessageId || input.parentMessageId,
      });
    },
    async markRead(input = {}) {
      return invoke(COMMUNICATION_TRUSTED_COMMAND.MARK_DIRECT_READ, {
        conversationId: input.conversationId,
        lastReadMessageId: input.lastReadMessageId,
      });
    },
    evaluateDirectAccess: notWired("evaluateDirectAccess"),
    async openOrResolveDirectConversation(input = {}) {
      return invoke(COMMUNICATION_TRUSTED_COMMAND.OPEN_OR_RESOLVE_DIRECT, {
        counterpartParticipantId: input.counterpartParticipantId,
      });
    },
    requestDirectConversation: notWired("requestDirectConversation"),
    acceptDirectRequest: notWired("acceptDirectRequest"),
    declineDirectRequest: notWired("declineDirectRequest"),
    cancelDirectRequest: notWired("cancelDirectRequest"),
    joinCommunityChannel: async () => {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
        "Community remains BLOCKED_FAIL_CLOSED",
        {}
      );
    },
    leaveCommunityChannel: async () => {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_MEMBERSHIP_DENIED,
        "Community remains BLOCKED_FAIL_CLOSED",
        {}
      );
    },
    blockUser: notWired("blockUser"),
    async reportMessage(input = {}) {
      if (input.scope === "CLUB") {
        return invoke(COMMUNICATION_TRUSTED_COMMAND.REPORT_CLUB_MESSAGE, input);
      }
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED,
        "Report scope not activated on HTTP gateway",
        {}
      );
    },
    async pinMessage(input = {}) {
      return invoke(COMMUNICATION_TRUSTED_COMMAND.PIN_CLUB_MESSAGE, input);
    },
    async unpinMessage(input = {}) {
      return invoke(COMMUNICATION_TRUSTED_COMMAND.UNPIN_CLUB_MESSAGE, input);
    },
    hideMessage: notWired("hideMessage"),
    suspendParticipant: notWired("suspendParticipant"),
    banParticipant: notWired("banParticipant"),
    restoreParticipant: notWired("restoreParticipant"),
    getConversationDetails: notWired("getConversationDetails"),
    getSlowModeState: notWired("getSlowModeState"),
    async subscribe() {
      return Object.freeze({
        conversationId: null,
        unsubscribe: () => {},
        manualRefreshOnly: true,
        realtimeBlocked: true,
      });
    },
    async unsubscribe() {
      return Object.freeze({ ok: true });
    },
  };

  if (!matchesCommunicationExperienceGateway(gateway)) {
    throw new Error("Trusted backend HTTP gateway missing required methods");
  }

  return Object.freeze(gateway);
}
