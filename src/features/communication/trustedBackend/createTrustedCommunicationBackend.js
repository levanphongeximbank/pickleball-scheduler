/**
 * Trusted Communication backend composition root (COMMS-ACT-05).
 *
 * Receives an injected privileged Supabase client — never reads
 * SUPABASE_SERVICE_ROLE_KEY from env itself (server host does that).
 * Never returns the privileged client to callers beyond the command API.
 */

import { createDirectMessagingApplication } from "../application/createDirectMessagingApplication.js";
import { createClubCommunicationApplication } from "../application/createClubCommunicationApplication.js";
import { createSupabaseCommunicationRepositories } from "../persistence/supabase/createSupabaseCommunicationRepositories.js";
import { createSupabaseClubMembershipReader } from "../adapters/createSupabaseClubMembershipReader.js";
import {
  createClubManagerAccessPolicy,
  createClubManagerTeamAccessPolicy,
} from "../adapters/createClubManagerAccessPolicy.js";
import { createMessageReportContract } from "../contracts/messageReport.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import { COMMUNICATION_TABLES } from "../persistence/schema.js";
import {
  createFixedClock,
  createMemoryIdentityActorPort,
  createSequentialIdProvider,
} from "../application/createDirectMessagingApplication.js";
import {
  COMMUNICATION_SERVER_ONLY_BOUNDARY,
  COMMUNICATION_TRUSTED_COMMAND,
} from "./constants.js";
import { createIdempotencyLedger } from "./createIdempotencyLedger.js";
import { createSystemMessageProducer } from "./createSystemMessageProducer.js";

export { COMMUNICATION_SERVER_ONLY_BOUNDARY };

/**
 * @param {object} options
 * @param {object} options.client — privileged Supabase client (required)
 * @param {string} options.actorParticipantId — verified auth.uid()
 * @param {string|null} [options.tenantId] — from server profile SoT
 */
export function createTrustedCommunicationBackend(options = {}) {
  const client = options.client;
  if (!client || typeof client.from !== "function") {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
      "Trusted backend requires an injected privileged client",
      {}
    );
  }

  const actorParticipantId = String(options.actorParticipantId || "").trim();
  if (!actorParticipantId) {
    throw new CommunicationFoundationError(
      COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE,
      "Verified actor is required",
      {}
    );
  }

  const tenantId = options.tenantId ? String(options.tenantId) : null;
  const clock = options.clock || createFixedClock(new Date().toISOString());
  const idProvider =
    options.idProvider || createSequentialIdProvider("comms-act05");

  const repos =
    options.repositories || createSupabaseCommunicationRepositories(client);
  const membershipReader =
    options.membershipReader || createSupabaseClubMembershipReader(client);
  const identityActorPort =
    options.identityActorPort ||
    createMemoryIdentityActorPort([[actorParticipantId, true]]);

  const directApp =
    options.directApp ||
    createDirectMessagingApplication({
      repositories: repos.asDirectMessagingRepositories(),
      identityActorPort,
      clock,
      idProvider,
      useInMemoryRepositories: false,
    });

  const clubApp =
    options.clubApp ||
    createClubCommunicationApplication({
      repositories: repos.asClubCommunicationRepositories(),
      membershipReader,
      accessPolicy:
        options.accessPolicy || createClubManagerAccessPolicy(),
      teamAccessPolicy:
        options.teamAccessPolicy || createClubManagerTeamAccessPolicy(),
      clock,
      idProvider,
      useInMemoryRepositories: false,
    });

  const ledger =
    options.idempotencyLedger || createIdempotencyLedger(client);
  const systemProducer =
    options.systemProducer ||
    createSystemMessageProducer({
      client,
      idProvider,
      clock,
      idempotencyLedger: ledger,
    });

  /**
   * Resolve actor from JWT only — reject browser-claimed overrides.
   * @param {object} input
   * @param {string} field
   */
  function resolveActorId(input, field = "actorParticipantId") {
    const claimed = input?.[field];
    if (claimed != null && String(claimed).trim() !== actorParticipantId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
        "Caller cannot spoof actor identity",
        { field, claimed: String(claimed) }
      );
    }
    return actorParticipantId;
  }

  function resolveSenderId(input) {
    const claimed = input?.senderParticipantId;
    if (claimed != null && String(claimed).trim() !== actorParticipantId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
        "Sender spoofing denied",
        { claimed: String(claimed) }
      );
    }
    return actorParticipantId;
  }

  async function withIdempotency(operationType, key, conversationId, clubId, fn) {
    const idempotencyKey = key ? String(key).trim() : "";
    if (!idempotencyKey) return fn();
    const prior = await ledger.find({ operationType, idempotencyKey });
    if (prior?.result_entity_id) {
      return {
        replayed: true,
        resultEntityId: prior.result_entity_id,
        conversationId: prior.conversation_id || conversationId || null,
        prior,
      };
    }
    const result = await fn();
    const resultEntityId =
      result?.message?.messageId ||
      result?.messageId ||
      result?.conversation?.conversation?.conversationId ||
      result?.conversationId ||
      null;
    await ledger.record({
      operationType,
      idempotencyKey,
      conversationId:
        result?.message?.conversationId ||
        result?.conversation?.conversation?.conversationId ||
        conversationId ||
        null,
      tenantId,
      clubId: clubId || null,
      resultEntityType: result?.message ? "message" : "command",
      resultEntityId,
    });
    return { replayed: false, result };
  }

  async function reportClubMessage(input = {}) {
    const actorId = resolveActorId(input);
    const conversationId = String(input.conversationId || "").trim();
    const messageId = String(input.messageId || "").trim();
    if (!conversationId || !messageId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
        "conversationId and messageId are required",
        {}
      );
    }

    const channel = await clubApp.repositories.channels.findById(conversationId);
    if (!channel) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_NOT_FOUND,
        "Club channel not found",
        { conversationId }
      );
    }

    const membership = await membershipReader.getMembership(
      channel.clubId,
      actorId
    );
    if (membership.status !== "ACTIVE") {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
        "Inactive or non-member cannot report",
        { clubId: channel.clubId, status: membership.status }
      );
    }

    const message = await clubApp.repositories.messages.findById(messageId);
    if (!message || message.conversationId !== conversationId) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.REPORT_TARGET_INVALID,
        "Report target must belong to the club channel",
        { conversationId, messageId }
      );
    }

    const report = createMessageReportContract({
      reportId: idProvider.nextId("report"),
      messageId,
      conversationId,
      reporterParticipantId: actorId,
      reason: input.reason || "inappropriate",
      createdAt: clock.now(),
      details: input.details || null,
    });

    const { error } = await client.from(COMMUNICATION_TABLES.messageReports).insert({
      report_id: report.reportId,
      message_id: report.messageId,
      conversation_id: report.conversationId,
      reporter_participant_id: report.reporterParticipantId,
      reason: report.reason,
      created_at: report.createdAt,
      details: report.details,
    });
    if (error) {
      throw new CommunicationFoundationError(
        COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_UNAVAILABLE,
        "Club report persist failed",
        {}
      );
    }
    return Object.freeze({
      reportId: report.reportId,
      messageId: report.messageId,
      conversationId: report.conversationId,
      reason: report.reason,
    });
  }

  const commands = {
    async [COMMUNICATION_TRUSTED_COMMAND.OPEN_OR_RESOLVE_DIRECT](input = {}) {
      const actorId = resolveActorId(input);
      return directApp.directMessaging.openOrResolveDirectConversation({
        actorParticipantId: actorId,
        counterpartParticipantId: input.counterpartParticipantId,
        acceptedRequestId: input.acceptedRequestId,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.SEND_DIRECT_MESSAGE](input = {}) {
      const senderId = resolveSenderId(input);
      const wrapped = await withIdempotency(
        "send_direct_message",
        input.idempotencyKey,
        input.conversationId,
        null,
        () =>
          directApp.directMessaging.sendDirectMessage({
            conversationId: input.conversationId,
            senderParticipantId: senderId,
            body: input.body,
            messageId: input.messageId,
            replyToMessageId: input.replyToMessageId,
            attachmentRefs: input.attachmentRefs,
            clientIdempotencyKey: input.idempotencyKey || null,
          })
      );
      if (wrapped.replayed) {
        return Object.freeze({
          replayed: true,
          messageId: wrapped.resultEntityId,
          conversationId: wrapped.conversationId,
        });
      }
      return wrapped.result;
    },

    async [COMMUNICATION_TRUSTED_COMMAND.MARK_DIRECT_READ](input = {}) {
      const participantId = resolveActorId(input, "participantId");
      return directApp.directMessaging.markDirectConversationRead({
        conversationId: input.conversationId,
        participantId,
        lastReadAt: input.lastReadAt,
        lastReadMessageId: input.lastReadMessageId,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.SEND_CLUB_MESSAGE](input = {}) {
      const senderId = resolveSenderId(input);
      // clubId from body is a hint only — domain validates against channel.clubId
      const wrapped = await withIdempotency(
        "send_club_message",
        input.idempotencyKey,
        input.conversationId,
        input.clubId || null,
        () =>
          clubApp.clubCommunication.sendClubMessage({
            conversationId: input.conversationId,
            senderParticipantId: senderId,
            body: input.body,
            clubId: input.clubId,
            messageId: input.messageId,
            replyToMessageId: input.replyToMessageId,
            attachmentRefs: input.attachmentRefs,
            clientIdempotencyKey: input.idempotencyKey || null,
          })
      );
      if (wrapped.replayed) {
        return Object.freeze({
          replayed: true,
          messageId: wrapped.resultEntityId,
          conversationId: wrapped.conversationId,
        });
      }
      return wrapped.result;
    },

    async [COMMUNICATION_TRUSTED_COMMAND.PIN_CLUB_MESSAGE](input = {}) {
      return clubApp.clubCommunication.pinClubMessage({
        conversationId: input.conversationId,
        messageId: input.messageId,
        actorParticipantId: resolveActorId(input),
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.UNPIN_CLUB_MESSAGE](input = {}) {
      return clubApp.clubCommunication.unpinClubMessage({
        conversationId: input.conversationId,
        messageId: input.messageId,
        actorParticipantId: resolveActorId(input),
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.ADD_CLUB_PARTICIPANT](input = {}) {
      return clubApp.clubCommunication.addClubChannelParticipant({
        conversationId: input.conversationId,
        actorParticipantId: resolveActorId(input),
        participantId: input.participantId,
        role: input.role,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.SUSPEND_CLUB_PARTICIPANT](input = {}) {
      return clubApp.clubCommunication.suspendClubChannelParticipant({
        conversationId: input.conversationId,
        actorParticipantId: resolveActorId(input),
        participantId: input.participantId,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.REMOVE_CLUB_PARTICIPANT](input = {}) {
      return clubApp.clubCommunication.removeClubChannelParticipant({
        conversationId: input.conversationId,
        actorParticipantId: resolveActorId(input),
        participantId: input.participantId,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.CHANGE_CLUB_PARTICIPANT_ROLE](
      input = {}
    ) {
      return clubApp.clubCommunication.changeClubChannelParticipantRole({
        conversationId: input.conversationId,
        actorParticipantId: resolveActorId(input),
        participantId: input.participantId,
        role: input.role,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.REPORT_CLUB_MESSAGE](input = {}) {
      return reportClubMessage(input);
    },

    async [COMMUNICATION_TRUSTED_COMMAND.CREATE_OR_RESOLVE_DEFAULT_CLUB_CHANNELS](
      input = {}
    ) {
      const actorId = resolveActorId(input);
      const clubId = String(input.clubId || "").trim();
      if (!clubId) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ID_REQUIRED,
          "clubId is required",
          {}
        );
      }
      const membership = await membershipReader.getMembership(clubId, actorId);
      if (membership.status !== "ACTIVE") {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
          "Active club membership required",
          { clubId, status: membership.status }
        );
      }
      return clubApp.clubCommunication.createOrResolveDefaultClubChannels({
        clubId,
        actorParticipantId: actorId,
      });
    },

    async [COMMUNICATION_TRUSTED_COMMAND.COMMUNITY_ANY]() {
      const err = new Error(
        "Community Communication remains BLOCKED_FAIL_CLOSED"
      );
      err.code = "COMMUNITY_BLOCKED_FAIL_CLOSED";
      throw err;
    },
  };

  return Object.freeze({
    boundary: COMMUNICATION_SERVER_ONLY_BOUNDARY,
    actorParticipantId,
    tenantId,
    directApp,
    clubApp,
    membershipReader,
    systemProducer,
    ledger,
    /**
     * @param {string} command
     * @param {object} [payload]
     */
    async execute(command, payload = {}) {
      const name = String(command || "").trim();
      const handler = commands[name];
      if (!handler) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT,
          `Unknown trusted command: ${name}`,
          { command: name }
        );
      }
      return handler(payload);
    },
    /** Never expose privileged client. */
    getPublicDiagnostic() {
      return Object.freeze({
        host: "trusted_communication_backend",
        actorParticipantId,
        tenantId,
        hasSystemProducer: Boolean(systemProducer),
        secretsExposed: false,
      });
    },
  });
}
