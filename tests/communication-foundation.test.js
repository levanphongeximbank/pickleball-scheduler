import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as communication from "../src/features/communication/index.js";
import {
  COMMUNICATION_FOUNDATION_PHASE,
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  CommunicationFoundationError,
  CONVERSATION_TYPE,
  CONVERSATION_STATUS,
  CONVERSATION_ROLE,
  PARTICIPANT_STATUS,
  MESSAGE_STATUS,
  MODERATION_ACTION_TYPE,
  createValidConversation,
  assertConversationType,
  transitionConversationStatus,
  addParticipant,
  updateParticipantRole,
  transitionParticipantStatus,
  suspendOrRemoveParticipant,
  assertCanSendMessage,
  createMessageForConversation,
  assertReplyTargetInConversation,
  transitionMessageStatus,
  advanceReadCursor,
  validateAttachmentReference,
  validateReaction,
  validateUserBlock,
  validateMessageReport,
  validateModerationAction,
  createConversationContract,
  createMessageContract,
  createConversationParticipantContract,
  createUnimplementedIdentityActorPort,
  createUnimplementedPlayerDisplayPort,
  createUnimplementedClubMembershipPort,
  createUnimplementedTenantScopePort,
  createUnimplementedNotificationEmitPort,
  createUnimplementedRealtimeDeliveryPort,
  createUnimplementedFileStoragePort,
  createUnimplementedAuditEventPort,
  createUnimplementedClockPort,
  createUnimplementedIdProviderPort,
  matchesIdentityActorPort,
  matchesNotificationEmitPort,
  matchesRealtimeDeliveryPort,
} from "../src/features/communication/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../src/features/communication");
const NOW = "2026-07-24T00:00:00.000Z";
const LATER = "2026-07-24T01:00:00.000Z";
const EARLIER = "2026-07-23T23:00:00.000Z";

/**
 * @param {() => unknown} fn
 * @param {string} code
 */
function expectCode(fn, code) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof CommunicationFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

test("public communication exports are present and phase is unwired", () => {
  const required = [
    "COMMUNICATION_FOUNDATION_PHASE",
    "COMMUNICATION_FOUNDATION_ERROR_CODE",
    "CommunicationFoundationError",
    "CONVERSATION_TYPE",
    "createValidConversation",
    "createMessageForConversation",
    "advanceReadCursor",
    "createUnimplementedIdentityActorPort",
    "createUnimplementedClubMembershipPort",
    "createUnimplementedNotificationEmitPort",
    "createUnimplementedRealtimeDeliveryPort",
    "CLUB_CHANNEL_KIND",
    "createClubCommunicationApplication",
    "createInMemoryClubCommunicationRepositories",
    "createUnimplementedClubMembershipReader",
    "COMMUNITY_CHANNEL_KIND",
    "createCommunityCommunicationApplication",
    "createInMemoryCommunityCommunicationRepositories",
    "createUnimplementedCommunityMembershipReader",
    "createSupabaseCommunicationRepositories",
    "createInMemoryRealtimeDeliveryAdapter",
    "getCommunicationActivationSnapshot",
  ];
  for (const name of required) {
    assert.ok(name in communication, `missing export: ${name}`);
  }
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-06");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.priorPhase, "COMMS-05");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.wiredToProductionRuntime, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasPersistence, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.persistenceApplied, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasRealtime, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.realtimePublicationEnabled, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasUi, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasInMemoryTestDoubles, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasProductionOrientedAdapters, true);
  assert.deepEqual([...Object.values(CONVERSATION_TYPE)], [
    "DIRECT",
    "CLUB",
    "COMMUNITY",
    "SYSTEM",
  ]);
});

test("happy path — DIRECT conversation, participants, message, read cursor", () => {
  const seeded = createValidConversation({
    conversationId: "conv-1",
    type: CONVERSATION_TYPE.DIRECT,
    createdAt: NOW,
    createdByParticipantId: "user-a",
    participants: [
      {
        participantId: "user-a",
        role: CONVERSATION_ROLE.OWNER,
        joinedAt: NOW,
      },
      {
        participantId: "user-b",
        role: CONVERSATION_ROLE.MEMBER,
        joinedAt: NOW,
      },
    ],
  });
  assert.equal(seeded.conversation.type, "DIRECT");
  assert.equal(seeded.participants.length, 2);
  assert.ok(Object.isFrozen(seeded.conversation));

  const sender = seeded.participants[0];
  const message = createMessageForConversation(seeded.conversation, sender, {
    messageId: "msg-1",
    body: "Hello",
    createdAt: NOW,
  });
  assert.equal(message.status, MESSAGE_STATUS.VISIBLE);
  assert.equal(message.senderParticipantId, "user-a");

  const cursor = advanceReadCursor(null, {
    conversationId: "conv-1",
    participantId: "user-b",
    lastReadAt: NOW,
    lastReadMessageId: "msg-1",
  });
  const advanced = advanceReadCursor(cursor, {
    conversationId: "conv-1",
    participantId: "user-b",
    lastReadAt: LATER,
    lastReadMessageId: "msg-1",
  });
  assert.equal(advanced.lastReadAt, LATER);
});

test("invalid identifiers and contracts fail closed with typed errors", () => {
  expectCode(
    () => createConversationContract({ type: CONVERSATION_TYPE.DIRECT, createdAt: NOW }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_IDENTIFIER
  );
  expectCode(
    () => assertConversationType("GROUP_CHAT"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_TYPE
  );
  expectCode(
    () =>
      createValidConversation({
        conversationId: "conv-club",
        type: CONVERSATION_TYPE.CLUB,
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
  expectCode(
    () =>
      createValidConversation({
        conversationId: "conv-community",
        type: CONVERSATION_TYPE.COMMUNITY,
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
  expectCode(
    () =>
      createMessageContract({
        messageId: "m1",
        conversationId: "c1",
        senderParticipantId: "u1",
        body: "   ",
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
});

test("duplicate participants rejected", () => {
  expectCode(
    () =>
      createValidConversation({
        conversationId: "conv-dup",
        type: CONVERSATION_TYPE.SYSTEM,
        createdAt: NOW,
        participants: [
          { participantId: "user-a", joinedAt: NOW },
          { participantId: "user-a", joinedAt: NOW },
        ],
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT
  );

  const { conversation, participants } = createValidConversation({
    conversationId: "conv-2",
    type: CONVERSATION_TYPE.SYSTEM,
    tenantId: "tenant-1",
    createdAt: NOW,
    participants: [{ participantId: "user-a", joinedAt: NOW }],
  });
  expectCode(
    () =>
      addParticipant(participants, {
        participantId: "user-a",
        conversationId: conversation.conversationId,
        joinedAt: LATER,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT
  );
});

test("unauthorized sender rejected deterministically", () => {
  const { conversation, participants } = createValidConversation({
    conversationId: "conv-3",
    type: CONVERSATION_TYPE.DIRECT,
    createdAt: NOW,
    participants: [
      { participantId: "user-a", joinedAt: NOW },
      { participantId: "user-b", joinedAt: NOW },
    ],
  });
  const muted = transitionParticipantStatus(
    participants[0],
    PARTICIPANT_STATUS.MUTED
  );
  expectCode(
    () => assertCanSendMessage(conversation, muted),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );

  const closed = transitionConversationStatus(
    conversation,
    CONVERSATION_STATUS.CLOSED
  );
  expectCode(
    () => assertCanSendMessage(closed, participants[0]),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );

  const foreign = createConversationParticipantContract({
    participantId: "user-a",
    conversationId: "other-conv",
    joinedAt: NOW,
  });
  expectCode(
    () => assertCanSendMessage(conversation, foreign),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
  );
});

test("invalid lifecycle transitions rejected", () => {
  const conversation = createConversationContract({
    conversationId: "conv-4",
    type: CONVERSATION_TYPE.SYSTEM,
    createdAt: NOW,
  });
  const closed = transitionConversationStatus(
    conversation,
    CONVERSATION_STATUS.CLOSED
  );
  expectCode(
    () => transitionConversationStatus(closed, CONVERSATION_STATUS.ACTIVE),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONVERSATION_TRANSITION
  );

  const participant = createConversationParticipantContract({
    participantId: "user-a",
    conversationId: "conv-4",
    joinedAt: NOW,
  });
  const removed = suspendOrRemoveParticipant(
    participant,
    PARTICIPANT_STATUS.REMOVED
  );
  expectCode(
    () =>
      transitionParticipantStatus(removed, PARTICIPANT_STATUS.ACTIVE),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_PARTICIPANT_TRANSITION
  );

  const message = createMessageContract({
    messageId: "msg-2",
    conversationId: "conv-4",
    senderParticipantId: "user-a",
    body: "hi",
    createdAt: NOW,
  });
  const deleted = transitionMessageStatus(message, MESSAGE_STATUS.DELETED);
  expectCode(
    () => transitionMessageStatus(deleted, MESSAGE_STATUS.VISIBLE),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MESSAGE_TRANSITION
  );

  const edited = transitionMessageStatus(message, MESSAGE_STATUS.EDITED, {
    body: "hi edited",
    updatedAt: LATER,
  });
  assert.equal(edited.status, MESSAGE_STATUS.EDITED);
  assert.equal(edited.body, "hi edited");
});

test("cross-conversation reply rejected", () => {
  const replyTarget = createMessageContract({
    messageId: "msg-other",
    conversationId: "conv-other",
    senderParticipantId: "user-x",
    body: "other",
    createdAt: NOW,
  });
  expectCode(
    () =>
      assertReplyTargetInConversation(
        { replyToMessageId: "msg-other" },
        replyTarget,
        "conv-5"
      ),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY
  );
  expectCode(
    () =>
      assertReplyTargetInConversation(
        { replyToMessageId: "msg-missing" },
        null,
        "conv-5"
      ),
    COMMUNICATION_FOUNDATION_ERROR_CODE.REPLY_TARGET_NOT_FOUND
  );

  const same = createMessageContract({
    messageId: "msg-ok",
    conversationId: "conv-5",
    senderParticipantId: "user-a",
    body: "parent",
    createdAt: NOW,
  });
  assert.equal(
    assertReplyTargetInConversation(
      { replyToMessageId: "msg-ok" },
      same,
      "conv-5"
    ),
    true
  );
});

test("read cursor is monotonic — regression rejected", () => {
  const current = advanceReadCursor(null, {
    conversationId: "conv-6",
    participantId: "user-a",
    lastReadAt: NOW,
  });
  expectCode(
    () =>
      advanceReadCursor(current, {
        conversationId: "conv-6",
        participantId: "user-a",
        lastReadAt: EARLIER,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION
  );
});

test("attachment / reaction / block / report / moderation validation", () => {
  const attachment = validateAttachmentReference({
    attachmentRefId: "att-1",
    path: "tenant-1/comms/file.png",
    contentType: "image/png",
    sizeBytes: 128,
  });
  assert.equal(attachment.path, "tenant-1/comms/file.png");
  expectCode(
    () =>
      validateAttachmentReference({
        attachmentRefId: "att-bad",
        path: "x",
        sizeBytes: -1,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_ATTACHMENT_REF
  );

  const reaction = validateReaction({
    reactionId: "rx-1",
    messageId: "msg-1",
    conversationId: "conv-1",
    participantId: "user-a",
    emoji: "👍",
    createdAt: NOW,
  });
  assert.equal(reaction.emoji, "👍");
  expectCode(
    () =>
      validateReaction({
        reactionId: "rx-bad",
        messageId: "msg-1",
        conversationId: "conv-1",
        participantId: "user-a",
        emoji: "x".repeat(64),
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_REACTION
  );

  expectCode(
    () =>
      validateUserBlock({
        blockId: "blk-1",
        blockerParticipantId: "user-a",
        blockedParticipantId: "user-a",
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_USER_BLOCK
  );
  const block = validateUserBlock({
    blockId: "blk-2",
    blockerParticipantId: "user-a",
    blockedParticipantId: "user-b",
    createdAt: NOW,
  });
  assert.equal(block.blockedParticipantId, "user-b");

  const report = validateMessageReport({
    reportId: "rpt-1",
    messageId: "msg-1",
    conversationId: "conv-1",
    reporterParticipantId: "user-b",
    reason: "spam",
    createdAt: NOW,
  });
  assert.equal(report.reason, "spam");

  const moderation = validateModerationAction({
    actionId: "mod-1",
    type: MODERATION_ACTION_TYPE.REMOVE_MESSAGE,
    conversationId: "conv-1",
    actorParticipantId: "mod-user",
    targetMessageId: "msg-1",
    createdAt: NOW,
  });
  assert.equal(moderation.type, "REMOVE_MESSAGE");
  expectCode(
    () =>
      validateModerationAction({
        actionId: "mod-bad",
        type: MODERATION_ACTION_TYPE.MUTE_PARTICIPANT,
        conversationId: "conv-1",
        actorParticipantId: "mod-user",
        createdAt: NOW,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_MODERATION_ACTION
  );
});

test("role update and participant add happy paths", () => {
  const { conversation, participants } = createValidConversation({
    conversationId: "conv-7",
    type: CONVERSATION_TYPE.CLUB,
    clubId: "club-1",
    tenantId: "tenant-1",
    createdAt: NOW,
    participants: [
      {
        participantId: "owner-1",
        role: CONVERSATION_ROLE.OWNER,
        joinedAt: NOW,
      },
    ],
  });
  const promoted = updateParticipantRole(
    participants[0],
    CONVERSATION_ROLE.MODERATOR
  );
  assert.equal(promoted.role, CONVERSATION_ROLE.MODERATOR);
  const added = addParticipant(participants, {
    participantId: "member-2",
    conversationId: conversation.conversationId,
    role: CONVERSATION_ROLE.MEMBER,
    joinedAt: LATER,
  });
  assert.equal(added.participantId, "member-2");
});

test("DIRECT seed requires exactly two participants when provided", () => {
  expectCode(
    () =>
      createValidConversation({
        conversationId: "conv-direct-bad",
        type: CONVERSATION_TYPE.DIRECT,
        createdAt: NOW,
        participants: [{ participantId: "only-one", joinedAt: NOW }],
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
});

test("adapter ports are unimplemented and not runtime-coupled", async () => {
  const ports = [
    createUnimplementedIdentityActorPort(),
    createUnimplementedPlayerDisplayPort(),
    createUnimplementedClubMembershipPort(),
    createUnimplementedTenantScopePort(),
    createUnimplementedNotificationEmitPort(),
    createUnimplementedRealtimeDeliveryPort(),
    createUnimplementedFileStoragePort(),
    createUnimplementedAuditEventPort(),
    createUnimplementedClockPort(),
    createUnimplementedIdProviderPort(),
  ];

  assert.equal(matchesIdentityActorPort(ports[0]), true);
  assert.equal(matchesNotificationEmitPort(ports[4]), true);
  assert.equal(matchesRealtimeDeliveryPort(ports[5]), true);
  assert.equal(matchesIdentityActorPort({}), false);

  await assert.rejects(
    () => ports[0].resolveActor("user-a"),
    (err) => {
      assert.ok(err instanceof CommunicationFoundationError);
      assert.equal(
        err.code,
        COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
      );
      return true;
    }
  );
  assert.throws(() => ports[8].now(), (err) => {
    assert.equal(
      err.code,
      COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
    );
    return true;
  });

  // No foreign module imports under communication feature tree.
  const sourceFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) sourceFiles.push(full);
    }
  }
  walk(MODULE_ROOT);
  const forbidden = [
    "features/identity/",
    "features/player/",
    "features/club/",
    "features/notifications/",
    "features/crm/",
    "features/competition-core/",
    "@supabase",
    "supabaseClient",
  ];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const needle of forbidden) {
      assert.equal(
        text.includes(needle),
        false,
        `${path.relative(MODULE_ROOT, file)} must not reference ${needle}`
      );
    }
  }
});

test("typed error helpers are deterministic", () => {
  const err = new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER,
    "denied",
    { participantId: "user-a" }
  );
  assert.equal(err.name, "CommunicationFoundationError");
  assert.equal(err.details.participantId, "user-a");
  assert.equal(
    communication.isCommunicationFoundationError(err),
    true
  );
  assert.equal(
    communication.isCommunicationFoundationErrorCode(
      COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_SENDER
    ),
    true
  );
  assert.equal(
    communication.isCommunicationFoundationErrorCode("NOT_A_CODE"),
    false
  );
});
