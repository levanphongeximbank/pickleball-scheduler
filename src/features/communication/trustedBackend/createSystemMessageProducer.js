/**
 * SYSTEM conversation producer — trusted internal producer only.
 * Browser / end-user JWT callers must never invoke this.
 */

import { CONVERSATION_TYPE } from "../constants/conversationTypes.js";
import { CONVERSATION_STATUS } from "../constants/conversationStatus.js";
import { CONVERSATION_ROLE } from "../constants/conversationRoles.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { MESSAGE_STATUS } from "../constants/messageLifecycle.js";
import { createConversationContract } from "../contracts/conversation.js";
import { createConversationParticipantContract } from "../contracts/participant.js";
import { createMessageContract } from "../contracts/message.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  COMMUNICATION_SYSTEM_ALLOWED_SOURCES,
  COMMUNICATION_SYSTEM_PRODUCER_ID,
} from "./constants.js";

/**
 * @param {object} options
 * @param {object} options.client — privileged Supabase client
 * @param {object} [options.idProvider]
 * @param {object} [options.clock]
 * @param {object} [options.idempotencyLedger]
 */
export function createSystemMessageProducer(options = {}) {
  const client = options.client;
  if (!client || typeof client.from !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "System producer requires an injected privileged client",
      {}
    );
  }

  const idProvider = options.idProvider || {
    nextId(kind = "id") {
      return `sys-${kind}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    },
  };
  const clock = options.clock || { now: () => new Date().toISOString() };
  const ledger = options.idempotencyLedger || null;
  const producerId =
    options.producerParticipantId || COMMUNICATION_SYSTEM_PRODUCER_ID;

  function assertAllowedSource(source) {
    const s = String(source || "").trim();
    if (!COMMUNICATION_SYSTEM_ALLOWED_SOURCES.includes(s)) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.AUTHORIZATION_DENIED,
        "System event source is not allowlisted",
        { source: s }
      );
    }
    return s;
  }

  return Object.freeze({
    producerId,
    allowedSources: COMMUNICATION_SYSTEM_ALLOWED_SOURCES,

    /**
     * @param {object} input
     */
    async produceSystemMessage(input = {}) {
      const source = assertAllowedSource(input.source);
      const recipientParticipantId = String(
        input.recipientParticipantId || ""
      ).trim();
      if (!recipientParticipantId) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_IDENTIFIER,
          "recipientParticipantId is required",
          {}
        );
      }

      // Reject browser-style actor spoofing: caller must not claim end-user sender.
      if (
        input.senderParticipantId != null &&
        String(input.senderParticipantId) !== producerId
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
          "System producer rejects sender spoofing",
          { claimedSender: String(input.senderParticipantId) }
        );
      }

      const tenantId = input.tenantId ? String(input.tenantId) : null;
      const body = String(input.body || "").trim();
      if (!body) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "System message body is required",
          {}
        );
      }

      const idempotencyKey = input.idempotencyKey
        ? String(input.idempotencyKey).trim()
        : null;
      if (ledger && idempotencyKey) {
        const prior = await ledger.find({
          operationType: "system_produce",
          idempotencyKey,
        });
        if (prior?.result_entity_id) {
          return Object.freeze({
            ok: true,
            replayed: true,
            messageId: prior.result_entity_id,
            conversationId: prior.conversation_id || null,
            producerId,
            source,
          });
        }
      }

      const contextRef = `system:${source}:${recipientParticipantId}`;
      const now = clock.now();

      // Resolve existing SYSTEM conversation by context_ref when present.
      const { data: existing, error: findError } = await client
        .from("communication_conversations")
        .select("*")
        .eq("conversation_type", CONVERSATION_TYPE.SYSTEM)
        .eq("context_ref", contextRef)
        .maybeSingle();
      if (findError) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
          "System conversation lookup failed",
          {}
        );
      }

      let conversationId = existing?.conversation_id;
      if (!conversationId) {
        conversationId = idProvider.nextId("sys-conv");
        const conversation = createConversationContract({
          conversationId,
          type: CONVERSATION_TYPE.SYSTEM,
          status: CONVERSATION_STATUS.ACTIVE,
          tenantId,
          clubId: null,
          contextRef,
          createdAt: now,
          createdByParticipantId: producerId,
        });
        const { error: insertConvError } = await client
          .from("communication_conversations")
          .insert({
            conversation_id: conversation.conversationId,
            conversation_type: conversation.type,
            status: conversation.status,
            tenant_id: conversation.tenantId,
            club_id: null,
            context_ref: conversation.contextRef,
            created_at: conversation.createdAt,
            created_by_participant_id: conversation.createdByParticipantId,
            updated_at: now,
          });
        if (insertConvError) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
            "System conversation create failed",
            {}
          );
        }

        const participants = [
          createConversationParticipantContract({
            conversationId,
            participantId: producerId,
            role: CONVERSATION_ROLE.OWNER,
            joinedAt: now,
            status: PARTICIPANT_STATUS.ACTIVE,
          }),
          createConversationParticipantContract({
            conversationId,
            participantId: recipientParticipantId,
            role: CONVERSATION_ROLE.MEMBER,
            joinedAt: now,
            status: PARTICIPANT_STATUS.ACTIVE,
          }),
        ];
        const { error: partError } = await client
          .from("communication_conversation_participants")
          .insert(
            participants.map((p) => ({
              conversation_id: p.conversationId,
              participant_id: p.participantId,
              role: p.role,
              joined_at: p.joinedAt,
              status: p.status,
            }))
          );
        if (partError) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
            "System participant create failed",
            {}
          );
        }
      }

      const messageId = input.messageId || idProvider.nextId("sys-msg");
      const message = createMessageContract({
        messageId,
        conversationId,
        senderParticipantId: producerId,
        body,
        status: MESSAGE_STATUS.VISIBLE,
        createdAt: now,
        replyToMessageId: null,
        attachmentRefs: [],
      });

      // Allocate position via RPC when available.
      let position = 1;
      if (typeof client.rpc === "function") {
        const { data: pos, error: rpcError } = await client.rpc(
          "communication_allocate_message_position",
          { p_conversation_id: conversationId }
        );
        if (rpcError) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
            "System message position allocation failed",
            {}
          );
        }
        position = Number(pos) || 1;
      }

      const { error: msgError } = await client
        .from("communication_messages")
        .insert({
          message_id: message.messageId,
          conversation_id: message.conversationId,
          sender_participant_id: message.senderParticipantId,
          body: message.body,
          status: message.status,
          created_at: message.createdAt,
          updated_at: null,
          reply_to_message_id: null,
          attachment_refs: [],
          position,
          client_idempotency_key: idempotencyKey,
        });
      if (msgError) {
        if (String(msgError.code) === "23505" && idempotencyKey) {
          return Object.freeze({
            ok: true,
            replayed: true,
            messageId,
            conversationId,
            producerId,
            source,
          });
        }
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
          "System message persist failed",
          {}
        );
      }

      if (ledger && idempotencyKey) {
        await ledger.record({
          operationType: "system_produce",
          idempotencyKey,
          conversationId,
          tenantId,
          resultEntityType: "message",
          resultEntityId: messageId,
        });
      }

      return Object.freeze({
        ok: true,
        replayed: false,
        messageId,
        conversationId,
        producerId,
        source,
      });
    },
  });
}
