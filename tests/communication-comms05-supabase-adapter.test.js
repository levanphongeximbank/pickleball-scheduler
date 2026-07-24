/**
 * COMMS-05 Supabase Communication adapter unit tests (fake client; no network).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  COMMUNICATION_TABLES,
  createFakeSupabaseCommunicationClient,
  createSupabaseCommunicationRepositories,
  createCommunicationRealtimeEventEnvelope,
  mapSupabaseCommunicationError,
  matchesDirectConversationRepository,
  matchesClubChannelRepository,
  matchesCommunityMessageRepository,
} from "../src/features/communication/index.js";

function baseConversation(overrides = {}) {
  return {
    conversationId: "conv-direct-1",
    type: "DIRECT",
    status: "ACTIVE",
    tenantId: null,
    clubId: null,
    contextRef: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    createdByParticipantId: "user-a",
    ...overrides,
  };
}

function baseParticipant(overrides = {}) {
  return {
    participantId: "user-a",
    conversationId: "conv-direct-1",
    role: "MEMBER",
    status: "ACTIVE",
    joinedAt: "2026-07-24T00:00:00.000Z",
    playerId: null,
    mutedUntil: null,
    ...overrides,
  };
}

test("adapter factory maps ports and refuses missing client", () => {
  assert.throws(
    () => createSupabaseCommunicationRepositories(null),
    (err) =>
      err.code ===
      COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CAPABILITY_UNSUPPORTED
  );
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  assert.equal(repos.requiresTrustedBackendClient, true);
  assert.equal(repos.clientRlsPolicy, "DEFERRED_FAIL_CLOSED");
  assert.equal(matchesDirectConversationRepository(repos.directConversations), true);
  assert.equal(matchesClubChannelRepository(repos.clubChannels), true);
  assert.equal(matchesCommunityMessageRepository(repos.communityMessages), true);
});

test("direct pair uniqueness and aggregate mapping without raw row leakage", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  const aggregate = {
    conversation: baseConversation(),
    participants: [
      baseParticipant({ participantId: "user-a" }),
      baseParticipant({ participantId: "user-b" }),
    ],
    pairKey: "user-a\u0000user-b",
  };
  const saved = await repos.directConversations.save(aggregate);
  assert.equal(saved.conversation.conversationId, "conv-direct-1");
  assert.equal(saved.pairKey, "user-a\u0000user-b");
  assert.equal(Object.prototype.hasOwnProperty.call(saved, "conversation_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved.conversation, "conversation_type"), false);

  const found = await repos.directConversations.findByPairKey("user-a\u0000user-b");
  assert.ok(found);
  assert.equal(found.participants.length, 2);

  await assert.rejects(
    () =>
      repos.directConversations.save({
        ...aggregate,
        conversation: baseConversation({ conversationId: "conv-direct-2" }),
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION ||
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT
  );
});

test("message ordering is deterministic via server position and idempotent retry", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  await repos.directConversations.save({
    conversation: baseConversation(),
    participants: [baseParticipant(), baseParticipant({ participantId: "user-b" })],
    pairKey: "user-a\u0000user-b",
  });

  const m1 = await repos.directMessages.save({
    messageId: "msg-1",
    conversationId: "conv-direct-1",
    senderParticipantId: "user-a",
    body: "hello",
    status: "VISIBLE",
    createdAt: "2026-07-24T01:00:00.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
    clientIdempotencyKey: "retry-1",
  });
  assert.equal(m1.position, 1);

  const m2 = await repos.directMessages.save({
    messageId: "msg-2",
    conversationId: "conv-direct-1",
    senderParticipantId: "user-b",
    body: "world",
    status: "VISIBLE",
    createdAt: "2026-07-24T00:30:00.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
  });
  assert.equal(m2.position, 2);

  const latest = await repos.directMessages.findLatestByConversationId("conv-direct-1");
  assert.equal(latest.messageId, "msg-2");
  assert.equal(latest.position, 2);

  const replay = await repos.directMessages.save({
    messageId: "msg-1-retry",
    conversationId: "conv-direct-1",
    senderParticipantId: "user-a",
    body: "hello",
    status: "VISIBLE",
    createdAt: "2026-07-24T01:00:01.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
    clientIdempotencyKey: "retry-1",
  });
  assert.equal(replay.messageId, "msg-1");

  await assert.rejects(
    () =>
      repos.directMessages.save({
        messageId: "msg-1",
        conversationId: "conv-direct-1",
        senderParticipantId: "user-a",
        body: "dup",
        status: "VISIBLE",
        createdAt: "2026-07-24T02:00:00.000Z",
        updatedAt: null,
        replyToMessageId: null,
        attachmentRefs: [],
      }),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT
  );
});

test("read cursor monotonic strategy rejects regression", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  await repos.directConversations.save({
    conversation: baseConversation(),
    participants: [baseParticipant(), baseParticipant({ participantId: "user-b" })],
    pairKey: "user-a\u0000user-b",
  });
  await repos.directMessages.save({
    messageId: "msg-c1",
    conversationId: "conv-direct-1",
    senderParticipantId: "user-a",
    body: "hi",
    status: "VISIBLE",
    createdAt: "2026-07-24T01:00:00.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
  });

  const advanced = await repos.directReadCursors.save({
    conversationId: "conv-direct-1",
    participantId: "user-a",
    lastReadAt: "2026-07-24T02:00:00.000Z",
    lastReadMessageId: "msg-c1",
    lastReadPosition: 1,
  });
  assert.equal(advanced.lastReadAt, "2026-07-24T02:00:00.000Z");

  await assert.rejects(
    () =>
      repos.directReadCursors.save({
        conversationId: "conv-direct-1",
        participantId: "user-a",
        lastReadAt: "2026-07-24T01:00:00.000Z",
        lastReadMessageId: "msg-c1",
      }),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION
  );
});

test("default club GENERAL and community LOBBY uniqueness", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);

  await repos.clubChannels.save({
    conversation: {
      conversationId: "club-gen-1",
      type: "CLUB",
      status: "ACTIVE",
      tenantId: null,
      clubId: "club-1",
      contextRef: null,
      createdAt: "2026-07-24T00:00:00.000Z",
      createdByParticipantId: "owner-1",
    },
    participants: [],
    clubId: "club-1",
    channelKind: "GENERAL",
    channelKey: "club:club-1:GENERAL",
    name: "General",
  });

  await assert.rejects(
    () =>
      repos.clubChannels.save({
        conversation: {
          conversationId: "club-gen-2",
          type: "CLUB",
          status: "ACTIVE",
          tenantId: null,
          clubId: "club-1",
          contextRef: null,
          createdAt: "2026-07-24T00:00:00.000Z",
          createdByParticipantId: "owner-1",
        },
        participants: [],
        clubId: "club-1",
        channelKind: "GENERAL",
        channelKey: "club:club-1:GENERAL",
        name: "General dup",
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL ||
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT
  );

  await repos.communityChannels.save({
    conversation: {
      conversationId: "lobby-1",
      type: "COMMUNITY",
      status: "ACTIVE",
      tenantId: "tenant-1",
      clubId: null,
      contextRef: null,
      createdAt: "2026-07-24T00:00:00.000Z",
      createdByParticipantId: "mod-1",
    },
    participants: [],
    tenantId: "tenant-1",
    channelKind: "LOBBY",
    visibility: "PUBLIC",
    channelKey: "community:tenant-1:LOBBY",
    name: "Lobby",
    lifecycleStatus: "ACTIVE",
    slowModeIntervalSeconds: 0,
  });

  const listed = await repos.communityChannels.listByTenantId("tenant-1");
  assert.equal(listed.length, 1);
  assert.equal(listed[0].channelKey, "community:tenant-1:LOBBY");
});

test("pending direct request uniqueness and typed not-found", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  await repos.directRequests.save({
    requestId: "req-1",
    pairKey: "user-a\u0000user-b",
    requesterParticipantId: "user-a",
    recipientParticipantId: "user-b",
    status: "PENDING",
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: null,
    message: "hi",
  });
  await assert.rejects(
    () =>
      repos.directRequests.save({
        requestId: "req-2",
        pairKey: "user-a\u0000user-b",
        requesterParticipantId: "user-a",
        recipientParticipantId: "user-b",
        status: "PENDING",
        createdAt: "2026-07-24T00:01:00.000Z",
        updatedAt: null,
        message: null,
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PENDING_REQUEST ||
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_CONFLICT
  );

  await assert.rejects(
    () =>
      repos.directRequests.update({
        requestId: "missing",
        pairKey: "user-a\u0000user-b",
        requesterParticipantId: "user-a",
        recipientParticipantId: "user-b",
        status: "CANCELLED",
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:02:00.000Z",
        message: null,
      }),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.PERSISTENCE_NOT_FOUND
  );
});

test("pin uniqueness and community findLatestBySender", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  await repos.communityChannels.save({
    conversation: {
      conversationId: "comm-1",
      type: "COMMUNITY",
      status: "ACTIVE",
      tenantId: "tenant-1",
      clubId: null,
      contextRef: null,
      createdAt: "2026-07-24T00:00:00.000Z",
      createdByParticipantId: "mod-1",
    },
    participants: [],
    tenantId: "tenant-1",
    channelKind: "TOPIC",
    visibility: "PUBLIC",
    channelKey: "community:tenant-1:TOPIC:news",
    name: "News",
    lifecycleStatus: "ACTIVE",
    slowModeIntervalSeconds: 30,
  });
  await repos.communityMessages.save({
    messageId: "cmsg-1",
    conversationId: "comm-1",
    senderParticipantId: "user-a",
    body: "post",
    status: "VISIBLE",
    createdAt: "2026-07-24T01:00:00.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
  });
  await repos.communityMessages.save({
    messageId: "cmsg-2",
    conversationId: "comm-1",
    senderParticipantId: "user-a",
    body: "post2",
    status: "VISIBLE",
    createdAt: "2026-07-24T01:05:00.000Z",
    updatedAt: null,
    replyToMessageId: null,
    attachmentRefs: [],
  });
  const latestBySender = await repos.communityMessages.findLatestBySender(
    "comm-1",
    "user-a"
  );
  assert.equal(latestBySender.messageId, "cmsg-2");

  await repos.communityPins.save({
    conversationId: "comm-1",
    messageId: "cmsg-1",
    pinnedByParticipantId: "mod-1",
    pinnedAt: "2026-07-24T01:10:00.000Z",
  });
  await assert.rejects(
    () =>
      repos.communityPins.save({
        conversationId: "comm-1",
        messageId: "cmsg-1",
        pinnedByParticipantId: "mod-1",
        pinnedAt: "2026-07-24T01:11:00.000Z",
      }),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN
  );
});

test("error mapping uniqueness and no raw row on malformed", () => {
  const err = mapSupabaseCommunicationError(
    { code: "23505", details: "communication_conversations_direct_pair_uidx" },
    { entity: "DirectConversation" }
  );
  assert.equal(
    err.code,
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_DIRECT_CONVERSATION
  );
  assert.ok(!JSON.stringify(err).includes("auth.users"));
});

test("block state reader either-way", async () => {
  const client = createFakeSupabaseCommunicationClient();
  const repos = createSupabaseCommunicationRepositories(client);
  await repos.userBlocks.save({
    blockId: "blk-1",
    blockerParticipantId: "user-a",
    blockedParticipantId: "user-b",
    createdAt: "2026-07-24T00:00:00.000Z",
    reason: null,
  });
  assert.equal(await repos.blockState.isBlockedEitherWay("user-a", "user-b"), true);
  assert.equal(await repos.blockState.isBlockedEitherWay("user-b", "user-a"), true);
  assert.equal(await repos.blockState.isBlockedEitherWay("user-a", "user-c"), false);
});

test("table allowlist constants cover communication_* only", () => {
  for (const name of Object.values(COMMUNICATION_TABLES)) {
    assert.match(name, /^communication_/);
  }
});

test("event envelope deterministic", () => {
  const a = createCommunicationRealtimeEventEnvelope({
    eventId: "evt-1",
    conversationId: "conv-1",
    eventType: "MESSAGE_CREATED",
    occurredAt: "2026-07-24T00:00:00.000Z",
    payload: { messageId: "m1" },
  });
  const b = createCommunicationRealtimeEventEnvelope({
    eventId: "evt-1",
    conversationId: "conv-1",
    eventType: "MESSAGE_CREATED",
    occurredAt: "2026-07-24T00:00:00.000Z",
    payload: { messageId: "m1" },
  });
  assert.deepEqual(a, b);
  assert.equal(a.signalOnly, true);
  assert.equal(a.catchUpCursor, "conv-1:evt-1");
});
