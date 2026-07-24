/**
 * COMMS-05 production-oriented Supabase Communication repository factory.
 *
 * Injected client only (typically service-role / trusted backend).
 * Client JWT RLS remains DEFERRED_FAIL_CLOSED until Staging activation.
 * Never returns raw Supabase rows from public methods.
 */

import { clonePlain } from "../../contracts/shared.js";
import { advanceReadCursor } from "../../domain/readCursorRules.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../../errors/errorCodes.js";
import { CommunicationFoundationError } from "../../errors/CommunicationFoundationError.js";
import { COMMUNICATION_RPC, COMMUNICATION_TABLES } from "../schema.js";
import { assertSupabaseCommunicationClient } from "./clientContract.js";
import { mapSupabaseCommunicationError, notFoundError } from "./errorMapping.js";
import {
  callRpc,
  fetchById,
  insertRow,
  applyPositionPagination,
  unwrapResult,
  upsertRow,
} from "./repositorySupport.js";
import {
  channelAggregateFromRows,
  communityRestrictionFromRow,
  communityRestrictionToRow,
  conversationToRow,
  directRequestFromRow,
  directRequestToRow,
  messageFromRow,
  messageReportFromRow,
  messageReportToRow,
  messageToRow,
  moderationActionFromRow,
  moderationActionToRow,
  participantToRow,
  pinnedMessageFromRow,
  pinnedMessageToRow,
  readCursorFromRow,
  userBlockFromRow,
  userBlockToRow,
} from "./rowMappers.js";

/**
 * @param {object} client
 * @param {string} conversationId
 */
async function loadParticipants(client, conversationId) {
  const data = await unwrapResult(
    client
      .from(COMMUNICATION_TABLES.participants)
      .select("*")
      .eq("conversation_id", conversationId),
    {
      entity: "Participant",
      conversationId,
      table: COMMUNICATION_TABLES.participants,
      operation: "listByConversation",
    }
  );
  return data || [];
}

/**
 * @param {object} client
 * @param {object} conversationRow
 * @param {"direct"|"club"|"community"} kind
 */
async function loadAggregate(client, conversationRow, kind) {
  if (!conversationRow) return null;
  const participants = await loadParticipants(
    client,
    conversationRow.conversation_id
  );
  return channelAggregateFromRows(conversationRow, participants, kind);
}

/**
 * @param {object} client
 * @param {object} aggregate
 * @param {object} meta
 * @param {"direct"|"club"|"community"} kind
 */
async function saveChannelAggregate(client, aggregate, meta, kind) {
  const conversationRow = conversationToRow(aggregate.conversation, meta);
  await upsertRow(
    client,
    COMMUNICATION_TABLES.conversations,
    conversationRow,
    kind === "direct" ? "DirectConversation" : kind === "club" ? "ClubChannel" : "CommunityChannel",
    {
      conversationId: aggregate.conversation.conversationId,
      pairKey: meta.pairKey,
      channelKey: meta.channelKey,
      clubId: meta.clubId,
      tenantId: meta.tenantId,
    }
  );

  for (const participant of aggregate.participants || []) {
    await upsertRow(
      client,
      COMMUNICATION_TABLES.participants,
      participantToRow(participant),
      "Participant",
      {
        conversationId: participant.conversationId,
        participantId: participant.participantId,
      }
    );
  }

  const stored = await fetchById(
    client,
    COMMUNICATION_TABLES.conversations,
    "conversation_id",
    aggregate.conversation.conversationId,
    "Conversation"
  );
  return loadAggregate(client, stored, kind);
}

/**
 * Shared message repository shape for Direct / Club / Community.
 * @param {object} client
 * @param {{ supportsFindLatestBySender?: boolean }} [opts]
 */
function createMessageRepository(client, opts = {}) {
  return Object.freeze({
    async findById(messageId) {
      const row = await fetchById(
        client,
        COMMUNICATION_TABLES.messages,
        "message_id",
        String(messageId),
        "Message",
        { messageId }
      );
      return row ? messageFromRow(row) : null;
    },
    async listByConversationId(conversationId, cursor = {}) {
      let query = client
        .from(COMMUNICATION_TABLES.messages)
        .select("*")
        .eq("conversation_id", String(conversationId));
      query = applyPositionPagination(query, {
        afterPosition: cursor.afterPosition,
        beforePosition: cursor.beforePosition,
        limit: cursor.limit,
        ascending: cursor.ascending !== false,
      });
      const rows = await unwrapResult(query, {
        entity: "Message",
        conversationId,
        table: COMMUNICATION_TABLES.messages,
        operation: "listByConversationId",
      });
      return (rows || []).map(messageFromRow);
    },
    async findLatestByConversationId(conversationId) {
      const rows = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.messages)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .order("position", { ascending: false })
          .limit(1),
        {
          entity: "Message",
          conversationId,
          table: COMMUNICATION_TABLES.messages,
          operation: "findLatestByConversationId",
        }
      );
      if (!rows || rows.length === 0) return null;
      return messageFromRow(rows[0]);
    },
    async findLatestBySender(conversationId, senderParticipantId) {
      if (!opts.supportsFindLatestBySender) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED,
          "findLatestBySender is only supported on CommunityMessageRepository",
          { conversationId, participantId: senderParticipantId }
        );
      }
      const rows = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.messages)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .eq("sender_participant_id", String(senderParticipantId))
          .order("position", { ascending: false })
          .limit(1),
        {
          entity: "Message",
          conversationId,
          participantId: senderParticipantId,
          table: COMMUNICATION_TABLES.messages,
          operation: "findLatestBySender",
        }
      );
      if (!rows || rows.length === 0) return null;
      return messageFromRow(rows[0]);
    },
    async save(message) {
      const existing = await this.findById(message.messageId);
      if (existing) {
        throw new CommunicationFoundationError(
          COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT,
          "Message already exists",
          { messageId: message.messageId, conversationId: message.conversationId }
        );
      }

      if (message.clientIdempotencyKey) {
        const prior = await unwrapResult(
          client
            .from(COMMUNICATION_TABLES.messages)
            .select("*")
            .eq("conversation_id", message.conversationId)
            .eq("client_idempotency_key", message.clientIdempotencyKey)
            .maybeSingle(),
          {
            entity: "Message",
            conversationId: message.conversationId,
            operation: "idempotentLookup",
          }
        );
        if (prior) return messageFromRow(prior);
      }

      const position = await callRpc(
        client,
        COMMUNICATION_RPC.allocateMessagePosition,
        { p_conversation_id: message.conversationId },
        { entity: "Message", conversationId: message.conversationId }
      );

      const row = messageToRow(message, {
        position: Number(position),
        clientIdempotencyKey: message.clientIdempotencyKey ?? null,
      });

      try {
        const inserted = await insertRow(
          client,
          COMMUNICATION_TABLES.messages,
          row,
          "Message",
          {
            conversationId: message.conversationId,
            messageId: message.messageId,
          }
        );
        return messageFromRow(inserted);
      } catch (err) {
        if (
          err instanceof CommunicationFoundationError &&
          err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT &&
          message.clientIdempotencyKey
        ) {
          const prior = await unwrapResult(
            client
              .from(COMMUNICATION_TABLES.messages)
              .select("*")
              .eq("conversation_id", message.conversationId)
              .eq("client_idempotency_key", message.clientIdempotencyKey)
              .maybeSingle(),
            {
              entity: "Message",
              conversationId: message.conversationId,
              operation: "idempotentReplay",
            }
          );
          if (prior) return messageFromRow(prior);
        }
        throw err;
      }
    },
  });
}

/**
 * @param {object} client
 * @param {{ useRpc?: boolean }} [opts]
 */
function createReadCursorRepository(client, opts = {}) {
  return Object.freeze({
    async find(conversationId, participantId) {
      const row = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.readCursors)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .eq("participant_id", String(participantId))
          .maybeSingle(),
        {
          entity: "ReadCursor",
          conversationId,
          participantId,
          table: COMMUNICATION_TABLES.readCursors,
          operation: "find",
        }
      );
      return row ? readCursorFromRow(row) : null;
    },
    async save(cursor) {
      const current = await this.find(cursor.conversationId, cursor.participantId);
      // Domain monotonic guard (also enforced by RPC when available)
      const advanced = advanceReadCursor(current, cursor);

      if (opts.useRpc !== false && typeof client.rpc === "function") {
        try {
          const row = await callRpc(
            client,
            COMMUNICATION_RPC.advanceReadCursor,
            {
              p_conversation_id: advanced.conversationId,
              p_participant_id: advanced.participantId,
              p_last_read_at: advanced.lastReadAt,
              p_last_read_message_id: advanced.lastReadMessageId ?? null,
              p_last_read_position: advanced.lastReadPosition ?? null,
            },
            {
              entity: "ReadCursor",
              conversationId: advanced.conversationId,
              participantId: advanced.participantId,
            }
          );
          return readCursorFromRow(row);
        } catch (err) {
          throw mapSupabaseCommunicationError(err, {
            entity: "ReadCursor",
            conversationId: advanced.conversationId,
            participantId: advanced.participantId,
          });
        }
      }

      const row = await upsertRow(
        client,
        COMMUNICATION_TABLES.readCursors,
        {
          conversation_id: advanced.conversationId,
          participant_id: advanced.participantId,
          last_read_at: advanced.lastReadAt,
          last_read_message_id: advanced.lastReadMessageId ?? null,
          last_read_position: advanced.lastReadPosition ?? null,
          updated_at: new Date().toISOString(),
        },
        "ReadCursor",
        {
          conversationId: advanced.conversationId,
          participantId: advanced.participantId,
        }
      );
      return readCursorFromRow(row);
    },
  });
}

/**
 * @param {object} client
 * @param {"club"|"community"} surface
 */
function createPinnedMessageRepository(client, surface) {
  return Object.freeze({
    async listByConversationId(conversationId) {
      const rows = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.pinnedMessages)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .order("pinned_at", { ascending: false }),
        {
          entity: "PinnedMessage",
          conversationId,
          table: COMMUNICATION_TABLES.pinnedMessages,
          operation: "listByConversationId",
        }
      );
      return (rows || []).map((row) => pinnedMessageFromRow(row, surface));
    },
    async find(conversationId, messageId) {
      const row = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.pinnedMessages)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .eq("message_id", String(messageId))
          .maybeSingle(),
        {
          entity: "PinnedMessage",
          conversationId,
          messageId,
          operation: "find",
        }
      );
      return row ? pinnedMessageFromRow(row, surface) : null;
    },
    async save(pin) {
      try {
        const row = await insertRow(
          client,
          COMMUNICATION_TABLES.pinnedMessages,
          pinnedMessageToRow(pin),
          "PinnedMessage",
          {
            conversationId: pin.conversationId,
            messageId: pin.messageId,
          }
        );
        return pinnedMessageFromRow(row, surface);
      } catch (err) {
        if (
          err instanceof CommunicationFoundationError &&
          (err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN ||
            err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT)
        ) {
          throw new CommunicationFoundationError(
            COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
            "Pin already exists for message in conversation",
            {
              conversationId: pin.conversationId,
              messageId: pin.messageId,
            }
          );
        }
        throw err;
      }
    },
    async remove(conversationId, messageId) {
      const deleted = await unwrapResult(
        client
          .from(COMMUNICATION_TABLES.pinnedMessages)
          .delete()
          .eq("conversation_id", String(conversationId))
          .eq("message_id", String(messageId))
          .select("*"),
        {
          entity: "PinnedMessage",
          conversationId,
          messageId,
          operation: "remove",
        }
      );
      return Array.isArray(deleted) ? deleted.length > 0 : Boolean(deleted);
    },
  });
}

/**
 * @param {object} client
 * @param {{ runAtomic?: Function }} [capabilities]
 */
export function createSupabaseCommunicationRepositories(client, capabilities = {}) {
  const c = assertSupabaseCommunicationClient(client);

  const directConversations = Object.freeze({
    port: "DirectConversationRepository",
    async findById(conversationId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.conversations,
        "conversation_id",
        String(conversationId),
        "DirectConversation",
        { conversationId }
      );
      if (!row || row.conversation_type !== "DIRECT") return null;
      return loadAggregate(c, row, "direct");
    },
    async findByPairKey(pairKey) {
      const row = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.conversations)
          .select("*")
          .eq("direct_pair_key", String(pairKey))
          .maybeSingle(),
        {
          entity: "DirectConversation",
          pairKey,
          operation: "findByPairKey",
        }
      );
      return loadAggregate(c, row, "direct");
    },
    async listByParticipantId(participantId) {
      const memberships = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.participants)
          .select("conversation_id")
          .eq("participant_id", String(participantId)),
        {
          entity: "Participant",
          participantId,
          operation: "listConversations",
        }
      );
      const ids = [...new Set((memberships || []).map((m) => m.conversation_id))];
      const out = [];
      for (const id of ids) {
        const aggregate = await this.findById(id);
        if (aggregate) out.push(aggregate);
      }
      return out;
    },
    async save(aggregate) {
      return saveChannelAggregate(
        c,
        aggregate,
        { pairKey: aggregate.pairKey },
        "direct"
      );
    },
  });

  const directRequests = Object.freeze({
    port: "DirectConversationRequestRepository",
    async findById(requestId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.directRequests,
        "request_id",
        String(requestId),
        "ConversationRequest",
        { requestId }
      );
      return row ? directRequestFromRow(row) : null;
    },
    async findPendingByPairKey(pairKey) {
      const row = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.directRequests)
          .select("*")
          .eq("pair_key", String(pairKey))
          .eq("status", "PENDING")
          .maybeSingle(),
        {
          entity: "ConversationRequest",
          pairKey,
          operation: "findPendingByPairKey",
        }
      );
      return row ? directRequestFromRow(row) : null;
    },
    async save(request) {
      const row = await insertRow(
        c,
        COMMUNICATION_TABLES.directRequests,
        directRequestToRow(request),
        "ConversationRequest",
        { requestId: request.requestId, pairKey: request.pairKey }
      );
      return directRequestFromRow(row);
    },
    async update(request) {
      const existing = await this.findById(request.requestId);
      if (!existing) {
        throw notFoundError("ConversationRequest", {
          requestId: request.requestId,
        });
      }
      const row = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.directRequests)
          .update(directRequestToRow(request))
          .eq("request_id", request.requestId)
          .select("*")
          .maybeSingle(),
        {
          entity: "ConversationRequest",
          requestId: request.requestId,
          operation: "update",
        }
      );
      return directRequestFromRow(row);
    },
  });

  const clubChannels = Object.freeze({
    port: "ClubChannelRepository",
    async findById(conversationId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.conversations,
        "conversation_id",
        String(conversationId),
        "ClubChannel",
        { conversationId }
      );
      if (!row || row.conversation_type !== "CLUB") return null;
      return loadAggregate(c, row, "club");
    },
    async findByChannelKey(channelKey) {
      const row = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.conversations)
          .select("*")
          .eq("channel_key", String(channelKey))
          .maybeSingle(),
        {
          entity: "ClubChannel",
          channelKey,
          operation: "findByChannelKey",
        }
      );
      if (!row || row.conversation_type !== "CLUB") return null;
      return loadAggregate(c, row, "club");
    },
    async listByClubId(clubId) {
      const rows = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.conversations)
          .select("*")
          .eq("club_id", String(clubId))
          .eq("conversation_type", "CLUB"),
        {
          entity: "ClubChannel",
          clubId,
          operation: "listByClubId",
        }
      );
      const out = [];
      for (const row of rows || []) {
        out.push(await loadAggregate(c, row, "club"));
      }
      return out;
    },
    async save(aggregate) {
      return saveChannelAggregate(
        c,
        aggregate,
        {
          clubId: aggregate.clubId,
          channelKey: aggregate.channelKey,
          channelKind: aggregate.channelKind,
          name: aggregate.name,
        },
        "club"
      );
    },
  });

  const communityChannels = Object.freeze({
    port: "CommunityChannelRepository",
    async findById(conversationId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.conversations,
        "conversation_id",
        String(conversationId),
        "CommunityChannel",
        { conversationId }
      );
      if (!row || row.conversation_type !== "COMMUNITY") return null;
      return loadAggregate(c, row, "community");
    },
    async findByChannelKey(channelKey) {
      const row = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.conversations)
          .select("*")
          .eq("channel_key", String(channelKey))
          .maybeSingle(),
        {
          entity: "CommunityChannel",
          channelKey,
          operation: "findByChannelKey",
        }
      );
      if (!row || row.conversation_type !== "COMMUNITY") return null;
      return loadAggregate(c, row, "community");
    },
    async listByTenantId(tenantId) {
      const rows = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.conversations)
          .select("*")
          .eq("tenant_id", String(tenantId))
          .eq("conversation_type", "COMMUNITY"),
        {
          entity: "CommunityChannel",
          tenantId,
          operation: "listByTenantId",
        }
      );
      const out = [];
      for (const row of rows || []) {
        out.push(await loadAggregate(c, row, "community"));
      }
      return out;
    },
    async save(aggregate) {
      return saveChannelAggregate(
        c,
        aggregate,
        {
          tenantId: aggregate.tenantId,
          channelKey: aggregate.channelKey,
          channelKind: aggregate.channelKind,
          name: aggregate.name,
          visibility: aggregate.visibility,
          lifecycleStatus: aggregate.lifecycleStatus,
          slowModeIntervalSeconds: aggregate.slowModeIntervalSeconds,
        },
        "community"
      );
    },
  });

  const directMessages = createMessageRepository(c);
  const clubMessages = createMessageRepository(c);
  const communityMessages = createMessageRepository(c, {
    supportsFindLatestBySender: true,
  });

  const directReadCursors = createReadCursorRepository(c);
  const clubReadCursors = createReadCursorRepository(c);
  const communityReadCursors = createReadCursorRepository(c);

  const clubPins = createPinnedMessageRepository(c, "club");
  const communityPins = createPinnedMessageRepository(c, "community");

  const communityRestrictions = Object.freeze({
    port: "CommunityRestrictionRepository",
    async find(tenantId, participantId, channelKey) {
      let query = c
        .from(COMMUNICATION_TABLES.communityRestrictions)
        .select("*")
        .eq("tenant_id", String(tenantId))
        .eq("participant_id", String(participantId));
      if (channelKey == null || channelKey === "") {
        query = query.eq("scope", "COMMUNITY").is("channel_key", null);
      } else {
        query = query.eq("scope", "CHANNEL").eq("channel_key", String(channelKey));
      }
      const row = await unwrapResult(query.maybeSingle(), {
        entity: "CommunityRestriction",
        tenantId,
        participantId,
        channelKey,
        operation: "find",
      });
      return row ? communityRestrictionFromRow(row) : null;
    },
    async save(restriction) {
      // Fake client upsert by delete+insert scoped key; production uses unique indexes.
      const existing = await this.find(
        restriction.tenantId,
        restriction.participantId,
        restriction.channelKey
      );
      if (existing) {
        let query = c
          .from(COMMUNICATION_TABLES.communityRestrictions)
          .update(communityRestrictionToRow(restriction))
          .eq("tenant_id", restriction.tenantId)
          .eq("participant_id", restriction.participantId);
        if (restriction.channelKey) {
          query = query.eq("channel_key", restriction.channelKey);
        } else {
          query = query.is("channel_key", null);
        }
        const row = await unwrapResult(query.select("*").maybeSingle(), {
          entity: "CommunityRestriction",
          tenantId: restriction.tenantId,
          participantId: restriction.participantId,
          operation: "update",
        });
        return communityRestrictionFromRow(row);
      }
      const row = await insertRow(
        c,
        COMMUNICATION_TABLES.communityRestrictions,
        communityRestrictionToRow(restriction),
        "CommunityRestriction",
        {
          tenantId: restriction.tenantId,
          participantId: restriction.participantId,
        }
      );
      return communityRestrictionFromRow(row);
    },
    async clear(tenantId, participantId, channelKey) {
      let query = c
        .from(COMMUNICATION_TABLES.communityRestrictions)
        .delete()
        .eq("tenant_id", String(tenantId))
        .eq("participant_id", String(participantId));
      if (channelKey == null || channelKey === "") {
        query = query.eq("scope", "COMMUNITY").is("channel_key", null);
      } else {
        query = query.eq("scope", "CHANNEL").eq("channel_key", String(channelKey));
      }
      const deleted = await unwrapResult(query.select("*"), {
        entity: "CommunityRestriction",
        tenantId,
        participantId,
        channelKey,
        operation: "clear",
      });
      return Array.isArray(deleted) ? deleted.length > 0 : Boolean(deleted);
    },
  });

  const communityReports = Object.freeze({
    port: "CommunityReportRepository",
    async save(report) {
      const row = await insertRow(
        c,
        COMMUNICATION_TABLES.messageReports,
        messageReportToRow(report),
        "MessageReport",
        {
          conversationId: report.conversationId,
          messageId: report.messageId,
        }
      );
      return messageReportFromRow(row);
    },
    async findById(reportId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.messageReports,
        "report_id",
        String(reportId),
        "MessageReport",
        { requestId: reportId }
      );
      return row ? messageReportFromRow(row) : null;
    },
  });

  const communityModerationActions = Object.freeze({
    port: "CommunityModerationActionRepository",
    async save(action) {
      const row = await insertRow(
        c,
        COMMUNICATION_TABLES.moderationActions,
        moderationActionToRow(action),
        "ModerationAction",
        { conversationId: action.conversationId }
      );
      return moderationActionFromRow(row);
    },
    async listByConversationId(conversationId) {
      const rows = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.moderationActions)
          .select("*")
          .eq("conversation_id", String(conversationId))
          .order("created_at", { ascending: true }),
        {
          entity: "ModerationAction",
          conversationId,
          operation: "listByConversationId",
        }
      );
      return (rows || []).map(moderationActionFromRow);
    },
  });

  const userBlocks = Object.freeze({
    port: "UserBlockRepository",
    async save(block) {
      const row = await insertRow(
        c,
        COMMUNICATION_TABLES.userBlocks,
        userBlockToRow(block),
        "UserBlock"
      );
      return userBlockFromRow(row);
    },
    async findById(blockId) {
      const row = await fetchById(
        c,
        COMMUNICATION_TABLES.userBlocks,
        "block_id",
        String(blockId),
        "UserBlock"
      );
      return row ? userBlockFromRow(row) : null;
    },
  });

  const blockState = Object.freeze({
    port: "BlockStateReader",
    async isBlockedEitherWay(a, b) {
      const left = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.userBlocks)
          .select("block_id")
          .eq("blocker_participant_id", String(a))
          .eq("blocked_participant_id", String(b))
          .maybeSingle(),
        { entity: "UserBlock", operation: "isBlockedEitherWay" }
      );
      if (left) return true;
      const right = await unwrapResult(
        c
          .from(COMMUNICATION_TABLES.userBlocks)
          .select("block_id")
          .eq("blocker_participant_id", String(b))
          .eq("blocked_participant_id", String(a))
          .maybeSingle(),
        { entity: "UserBlock", operation: "isBlockedEitherWay" }
      );
      return Boolean(right);
    },
  });

  /**
   * Optional unit-of-work: when capabilities.runAtomic is provided, callers may
   * group multi-row writes. Without it, adapters remain single-statement safe.
   */
  const unitOfWork = Object.freeze({
    supportsAtomicMultiRecord: typeof capabilities.runAtomic === "function",
    async run(fn) {
      if (typeof capabilities.runAtomic === "function") {
        return capabilities.runAtomic(fn);
      }
      return fn();
    },
  });

  return Object.freeze({
    isProductionOrientedAdapter: true,
    requiresTrustedBackendClient: true,
    clientRlsPolicy: "DEFERRED_FAIL_CLOSED",
    unitOfWork,
    // Direct
    directConversations,
    directRequests,
    directMessages,
    directReadCursors,
    blockState,
    userBlocks,
    // Club
    clubChannels,
    clubMessages,
    clubReadCursors,
    clubPins,
    // Community
    communityChannels,
    communityMessages,
    communityReadCursors,
    communityPins,
    communityRestrictions,
    communityReports,
    communityModerationActions,
    /** Port-shaped bundles matching application composers */
    asDirectMessagingRepositories() {
      return Object.freeze({
        conversations: directConversations,
        requests: directRequests,
        messages: directMessages,
        readCursors: directReadCursors,
        blockState,
      });
    },
    asClubCommunicationRepositories() {
      return Object.freeze({
        channels: clubChannels,
        messages: clubMessages,
        readCursors: clubReadCursors,
        pins: clubPins,
      });
    },
    asCommunityCommunicationRepositories() {
      return Object.freeze({
        channels: communityChannels,
        messages: communityMessages,
        readCursors: communityReadCursors,
        pins: communityPins,
        restrictions: communityRestrictions,
        reports: communityReports,
        moderationActions: communityModerationActions,
      });
    },
    /** Debug helper for tests — never part of public domain contract */
    __debugClonePlain: clonePlain,
  });
}
