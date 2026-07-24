/**
 * Direct Messaging application service (COMMS-02).
 *
 * Persistence-agnostic command handlers over COMMS-01 contracts.
 * No SQL, Supabase, realtime, notification delivery, or UI.
 */

import { CONVERSATION_TYPE } from "../constants/conversationTypes.js";
import { CONVERSATION_ROLE } from "../constants/conversationRoles.js";
import { CONVERSATION_REQUEST_STATUS } from "../constants/conversationRequestStatus.js";
import { DIRECT_MESSAGING_ACCESS_DECISION } from "../constants/directMessagingAccess.js";
import { PARTICIPANT_STATUS } from "../constants/participantLifecycle.js";
import { createConversationRequestContract } from "../contracts/conversationRequest.js";
import { createParticipantId } from "../contracts/identifiers.js";
import {
  assertActorInDirectPair,
  assertDirectAccessAllowed,
  evaluateDirectMessagingAccess,
  resolveCanonicalDirectPair,
} from "../domain/directAccessRules.js";
import {
  acceptOrDeclineConversationRequest,
  cancelConversationRequest,
} from "../domain/conversationRequestRules.js";
import {
  buildDirectConversationSummary,
  findActiveDirectParticipants,
  sortDirectConversationSummaries,
} from "../domain/directMessagingProjection.js";
import {
  assertCanSendMessage,
  createValidConversation,
  findActiveParticipant,
} from "../domain/conversationRules.js";
import {
  assertReplyTargetInConversation,
  createMessageForConversation,
} from "../domain/messageRules.js";
import { advanceReadCursor } from "../domain/readCursorRules.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { createAllowAllDirectMessagingAccessPolicy } from "../ports/directMessagingPolicyPorts.js";

/**
 * @param {object} deps
 * @returns {object}
 */
export function createDirectMessagingApplicationService(deps = {}) {
  const conversations = deps.conversationRepository;
  const requests = deps.requestRepository;
  const messages = deps.messageRepository;
  const readCursors = deps.readCursorRepository;
  const blockState = deps.blockStateReader;
  const identity = deps.identityActorPort;
  const accessPolicy =
    deps.accessPolicy || createAllowAllDirectMessagingAccessPolicy();
  const clock = deps.clock;
  const ids = deps.idProvider;

  if (!conversations || !requests || !messages || !readCursors) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Direct messaging repositories are required"
    );
  }
  if (!blockState || !identity || !clock || !ids) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "blockStateReader, identityActorPort, clock, and idProvider are required"
    );
  }

  async function loadIdentityFlags(participantId) {
    const actor = await identity.resolveActor(participantId);
    if (!actor) {
      return { found: false, active: false };
    }
    const active = await identity.isAccountActive(participantId);
    return { found: true, active: Boolean(active) };
  }

  async function decideAccess(actorParticipantId, counterpartParticipantId) {
    const pair = resolveCanonicalDirectPair(
      actorParticipantId,
      counterpartParticipantId
    );
    assertActorInDirectPair(pair, actorParticipantId);

    const blocked = await blockState.isBlockedEitherWay(
      actorParticipantId,
      counterpartParticipantId
    );
    const actorIdentity = await loadIdentityFlags(actorParticipantId);
    const counterpartIdentity = await loadIdentityFlags(
      counterpartParticipantId
    );
    const policy = await accessPolicy.evaluate({
      actorParticipantId: createParticipantId(actorParticipantId),
      counterpartParticipantId: createParticipantId(counterpartParticipantId),
      pairKey: pair.pairKey,
    });

    const decision = evaluateDirectMessagingAccess({
      actorParticipantId,
      counterpartParticipantId,
      blocked,
      actorIdentityFound: actorIdentity.found,
      counterpartIdentityFound: counterpartIdentity.found,
      actorActive: actorIdentity.active,
      counterpartActive: counterpartIdentity.active,
      policyDecision: policy?.decision,
      policyReasonCode: policy?.reasonCode ?? null,
    });

    return { pair, decision };
  }

  async function createDirectAggregate(pair, createdByParticipantId, at) {
    const conversationId = ids.nextId("conv");
    const seeded = createValidConversation({
      conversationId,
      type: CONVERSATION_TYPE.DIRECT,
      createdAt: at,
      createdByParticipantId,
      participants: [
        {
          participantId: pair.participantIdA,
          role:
            pair.participantIdA === createdByParticipantId
              ? CONVERSATION_ROLE.OWNER
              : CONVERSATION_ROLE.MEMBER,
          joinedAt: at,
        },
        {
          participantId: pair.participantIdB,
          role:
            pair.participantIdB === createdByParticipantId
              ? CONVERSATION_ROLE.OWNER
              : CONVERSATION_ROLE.MEMBER,
          joinedAt: at,
        },
      ],
    });
    return conversations.save({
      conversation: seeded.conversation,
      participants: seeded.participants,
      pairKey: pair.pairKey,
    });
  }

  return Object.freeze({
    /**
     * Evaluate typed access decision (ALLOW | REQUEST_REQUIRED | DENY).
     */
    async evaluateAccess(input = {}) {
      const { pair, decision } = await decideAccess(
        input.actorParticipantId,
        input.counterpartParticipantId
      );
      return Object.freeze({ pair, decision });
    },

    /**
     * Create a PENDING conversation request when policy requires it.
     */
    async requestDirectConversation(input = {}) {
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const counterpartParticipantId = createParticipantId(
        input.counterpartParticipantId
      );
      const { pair, decision } = await decideAccess(
        actorParticipantId,
        counterpartParticipantId
      );

      if (decision.decision === DIRECT_MESSAGING_ACCESS_DECISION.DENY) {
        assertDirectAccessAllowed(decision, { pairKey: pair.pairKey });
      }
      if (decision.decision === DIRECT_MESSAGING_ACCESS_DECISION.ALLOW) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          "Conversation request is not required when access is ALLOW; use openOrResolveDirectConversation",
          { pairKey: pair.pairKey, decision: decision.decision }
        );
      }

      const existingConversation = await conversations.findByPairKey(
        pair.pairKey
      );
      if (existingConversation) {
        return Object.freeze({
          outcome: "CONVERSATION_EXISTS",
          conversation: existingConversation,
          request: null,
        });
      }

      const existingPending = await requests.findPendingByPairKey(pair.pairKey);
      if (existingPending) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST,
          "A pending conversation request already exists for this pair",
          {
            pairKey: pair.pairKey,
            existingRequestId: existingPending.requestId,
          }
        );
      }

      const now = clock.now();
      const request = createConversationRequestContract({
        requestId: ids.nextId("req"),
        pairKey: pair.pairKey,
        requesterParticipantId: actorParticipantId,
        recipientParticipantId: counterpartParticipantId,
        status: CONVERSATION_REQUEST_STATUS.PENDING,
        createdAt: now,
        message: input.message ?? null,
      });
      const saved = await requests.save(request);
      return Object.freeze({
        outcome: "REQUEST_CREATED",
        conversation: null,
        request: saved,
      });
    },

    async acceptDirectConversationRequest(input = {}) {
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const request = await requests.findById(input.requestId);
      if (!request) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
          `Conversation request not found: ${String(input.requestId)}`,
          { requestId: input.requestId }
        );
      }
      const now = clock.now();
      const accepted = acceptOrDeclineConversationRequest(
        request,
        actorParticipantId,
        CONVERSATION_REQUEST_STATUS.ACCEPTED,
        now
      );
      const updated = await requests.update(accepted);

      const pair = resolveCanonicalDirectPair(
        updated.requesterParticipantId,
        updated.recipientParticipantId
      );
      let aggregate = await conversations.findByPairKey(pair.pairKey);
      let created = false;
      if (!aggregate) {
        aggregate = await createDirectAggregate(
          pair,
          updated.requesterParticipantId,
          now
        );
        created = true;
      }
      return Object.freeze({
        request: updated,
        conversation: aggregate,
        created,
      });
    },

    async declineDirectConversationRequest(input = {}) {
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const request = await requests.findById(input.requestId);
      if (!request) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
          `Conversation request not found: ${String(input.requestId)}`,
          { requestId: input.requestId }
        );
      }
      const now = clock.now();
      const declined = acceptOrDeclineConversationRequest(
        request,
        actorParticipantId,
        CONVERSATION_REQUEST_STATUS.DECLINED,
        now
      );
      const updated = await requests.update(declined);
      return Object.freeze({ request: updated });
    },

    async cancelDirectConversationRequest(input = {}) {
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const request = await requests.findById(input.requestId);
      if (!request) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.REQUEST_NOT_FOUND,
          `Conversation request not found: ${String(input.requestId)}`,
          { requestId: input.requestId }
        );
      }
      const now = clock.now();
      const cancelled = cancelConversationRequest(
        request,
        actorParticipantId,
        now
      );
      const updated = await requests.update(cancelled);
      return Object.freeze({ request: updated });
    },

    /**
     * Idempotent open/resolve for ALLOW (or after ACCEPTED request).
     */
    async openOrResolveDirectConversation(input = {}) {
      const actorParticipantId = createParticipantId(input.actorParticipantId);
      const counterpartParticipantId = createParticipantId(
        input.counterpartParticipantId
      );
      const { pair, decision } = await decideAccess(
        actorParticipantId,
        counterpartParticipantId
      );

      if (decision.decision === DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED) {
        const pending = await requests.findPendingByPairKey(pair.pairKey);
        // Allow open only if an accepted request exists historically or conversation already exists
        const existing = await conversations.findByPairKey(pair.pairKey);
        if (existing) {
          return Object.freeze({
            conversation: existing,
            created: false,
            pair,
          });
        }
        // If caller explicitly acknowledges an accepted request id, verify it
        if (input.acceptedRequestId) {
          const accepted = await requests.findById(input.acceptedRequestId);
          if (
            !accepted ||
            accepted.pairKey !== pair.pairKey ||
            accepted.status !== CONVERSATION_REQUEST_STATUS.ACCEPTED
          ) {
            assertDirectAccessAllowed(decision, { pairKey: pair.pairKey });
          }
        } else if (pending) {
          assertDirectAccessAllowed(decision, {
            pairKey: pair.pairKey,
            pendingRequestId: pending.requestId,
          });
        } else {
          assertDirectAccessAllowed(decision, { pairKey: pair.pairKey });
        }
      } else {
        assertDirectAccessAllowed(decision, { pairKey: pair.pairKey });
      }

      const existing = await conversations.findByPairKey(pair.pairKey);
      if (existing) {
        return Object.freeze({
          conversation: existing,
          created: false,
          pair,
        });
      }

      const now = clock.now();
      const created = await createDirectAggregate(
        pair,
        actorParticipantId,
        now
      );
      return Object.freeze({
        conversation: created,
        created: true,
        pair,
      });
    },

    async sendDirectMessage(input = {}) {
      const senderParticipantId = createParticipantId(
        input.senderParticipantId
      );
      const aggregate = await conversations.findById(input.conversationId);
      if (!aggregate) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
          `Conversation not found: ${String(input.conversationId)}`,
          { conversationId: input.conversationId }
        );
      }
      if (aggregate.conversation.type !== CONVERSATION_TYPE.DIRECT) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_DIRECT,
          "sendDirectMessage requires a DIRECT conversation",
          {
            conversationId: aggregate.conversation.conversationId,
            type: aggregate.conversation.type,
          }
        );
      }

      if (
        !Array.isArray(aggregate.participants) ||
        aggregate.participants.length !== 2
      ) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DIRECT_PAIR_INVALID,
          "DIRECT conversation must have exactly two participants",
          {
            conversationId: aggregate.conversation.conversationId,
            participantCount: aggregate.participants?.length ?? 0,
          }
        );
      }

      const pair = resolveCanonicalDirectPair(
        aggregate.participants[0].participantId,
        aggregate.participants[1].participantId
      );
      if (aggregate.pairKey !== pair.pairKey) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.DIRECT_PAIR_INVALID,
          "Stored pairKey does not match participants",
          { conversationId: aggregate.conversation.conversationId }
        );
      }

      let sender;
      try {
        sender = findActiveParticipant(
          aggregate.participants,
          senderParticipantId,
          aggregate.conversation.conversationId
        );
      } catch (err) {
        if (
          err instanceof CommunicationFoundationError &&
          err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_NOT_FOUND
        ) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
            "Sender is not a participant of this direct conversation",
            {
              conversationId: aggregate.conversation.conversationId,
              senderParticipantId,
            }
          );
        }
        throw err;
      }

      assertActorInDirectPair(pair, senderParticipantId);

      const counterpartId =
        pair.participantIdA === senderParticipantId
          ? pair.participantIdB
          : pair.participantIdA;

      const blocked = await blockState.isBlockedEitherWay(
        senderParticipantId,
        counterpartId
      );
      if (blocked) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.BLOCKED_PARTICIPANT,
          "Cannot send direct message while blocked",
          {
            conversationId: aggregate.conversation.conversationId,
            senderParticipantId,
            counterpartId,
          }
        );
      }

      const activeParticipants = findActiveDirectParticipants(
        aggregate.participants,
        aggregate.conversation.conversationId
      );
      if (activeParticipants.length !== 2) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
          "Both direct participants must be ACTIVE to send",
          {
            conversationId: aggregate.conversation.conversationId,
            activeCount: activeParticipants.length,
          }
        );
      }

      if (sender.status !== PARTICIPANT_STATUS.ACTIVE) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INACTIVE_PARTICIPANT,
          `Sender participant is not ACTIVE (${sender.status})`,
          {
            senderParticipantId,
            status: sender.status,
          }
        );
      }

      assertCanSendMessage(aggregate.conversation, sender);

      let replyTarget = null;
      if (input.replyToMessageId) {
        replyTarget = await messages.findById(input.replyToMessageId);
        assertReplyTargetInConversation(
          { replyToMessageId: input.replyToMessageId },
          replyTarget,
          aggregate.conversation.conversationId
        );
      }

      const now = clock.now();
      const message = createMessageForConversation(
        aggregate.conversation,
        sender,
        {
          messageId: input.messageId || ids.nextId("msg"),
          body: input.body,
          createdAt: input.createdAt ?? now,
          replyToMessageId: input.replyToMessageId ?? null,
          attachmentRefs: input.attachmentRefs ?? [],
        }
      );
      const saved = await messages.save(message);
      return Object.freeze({ message: saved, conversation: aggregate });
    },

    async markDirectConversationRead(input = {}) {
      const participantId = createParticipantId(input.participantId);
      const aggregate = await conversations.findById(input.conversationId);
      if (!aggregate) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
          `Conversation not found: ${String(input.conversationId)}`,
          { conversationId: input.conversationId }
        );
      }
      findActiveParticipant(
        aggregate.participants,
        participantId,
        aggregate.conversation.conversationId
      );

      const current = await readCursors.find(
        aggregate.conversation.conversationId,
        participantId
      );
      const next = advanceReadCursor(current, {
        conversationId: aggregate.conversation.conversationId,
        participantId,
        lastReadAt: input.lastReadAt ?? clock.now(),
        lastReadMessageId: input.lastReadMessageId ?? null,
      });
      const saved = await readCursors.save(next);
      return Object.freeze({ readCursor: saved });
    },

    /**
     * Build one summary for a viewer + conversation.
     */
    async buildDirectConversationSummary(input = {}) {
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregate = await conversations.findById(input.conversationId);
      if (!aggregate) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CONVERSATION_NOT_FOUND,
          `Conversation not found: ${String(input.conversationId)}`,
          { conversationId: input.conversationId }
        );
      }
      const pair = resolveCanonicalDirectPair(
        aggregate.participants[0].participantId,
        aggregate.participants[1].participantId
      );
      assertActorInDirectPair(pair, viewerParticipantId);
      const messageList = await messages.listByConversationId(
        aggregate.conversation.conversationId
      );
      const readCursor = await readCursors.find(
        aggregate.conversation.conversationId,
        viewerParticipantId
      );
      return buildDirectConversationSummary({
        conversation: aggregate.conversation,
        pair,
        viewerParticipantId,
        messages: messageList,
        readCursor,
      });
    },

    /**
     * Deterministic inbox projection for a viewer.
     */
    async listDirectConversationSummaries(input = {}) {
      const viewerParticipantId = createParticipantId(
        input.viewerParticipantId
      );
      const aggregates =
        await conversations.listByParticipantId(viewerParticipantId);
      const summaries = [];
      for (const aggregate of aggregates) {
        if (aggregate.conversation.type !== CONVERSATION_TYPE.DIRECT) continue;
        const pair = resolveCanonicalDirectPair(
          aggregate.participants[0].participantId,
          aggregate.participants[1].participantId
        );
        const messageList = await messages.listByConversationId(
          aggregate.conversation.conversationId
        );
        const readCursor = await readCursors.find(
          aggregate.conversation.conversationId,
          viewerParticipantId
        );
        summaries.push(
          buildDirectConversationSummary({
            conversation: aggregate.conversation,
            pair,
            viewerParticipantId,
            messages: messageList,
            readCursor,
          })
        );
      }
      return sortDirectConversationSummaries(summaries);
    },
  });
}
