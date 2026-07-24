import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_FOUNDATION_PHASE,
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  CommunicationFoundationError,
  CONVERSATION_TYPE,
  CONVERSATION_STATUS,
  PARTICIPANT_STATUS,
  MODERATION_ACTION_TYPE,
  COMMUNITY_CHANNEL_KIND,
  COMMUNITY_CHANNEL_VISIBILITY,
  COMMUNITY_CHANNEL_LIFECYCLE,
  COMMUNITY_MEMBERSHIP_STATUS,
  COMMUNITY_COMMUNICATION_ACCESS_DECISION,
  COMMUNITY_COMMUNICATION_ACCESS_ACTION,
  COMMUNITY_COMMUNICATION_DENY_REASON,
  createConversationContract,
  buildCommunityLobbyChannelKey,
  resolveCommunityChannelIdentity,
  evaluateCommunityChannelAccess,
  evaluateCommunitySlowMode,
  createCommunityCommunicationApplication,
  createMemoryCommunityMembershipReader,
  createMemoryIdentityActorPort,
  createAllowAllCommunityAccessPolicy,
  createDefaultCommunityAccessPolicy,
  createDenyAllCommunityModerationPolicy,
  createAllowAllCommunityModerationPolicy,
  createBypassSlowModeCommunityModerationPolicy,
  createUnimplementedCommunityChannelRepository,
  createUnimplementedCommunityMessageRepository,
  createUnimplementedCommunityMembershipReader,
  createUnimplementedCommunityAccessPolicy,
  createUnimplementedCommunityModerationPolicy,
  createUnimplementedCommunityRestrictionRepository,
  matchesCommunityChannelRepository,
  matchesCommunityMessageRepository,
  matchesCommunityMembershipReader,
  matchesCommunityAccessPolicy,
  matchesCommunityModerationPolicy,
  matchesCommunityRestrictionRepository,
  createInMemoryCommunityCommunicationRepositories,
} from "../src/features/communication/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../src/features/communication");
const T0 = "2026-07-24T12:00:00.000Z";
const T1 = "2026-07-24T12:00:30.000Z";
const T2 = "2026-07-24T12:01:00.000Z";

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

/**
 * @param {() => Promise<unknown>} fn
 * @param {string} code
 */
async function expectCodeAsync(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.ok(err instanceof CommunicationFoundationError);
    assert.equal(err.code, code);
    return true;
  });
}

function createApp(options = {}) {
  const membershipReader =
    options.membershipReader ||
    createMemoryCommunityMembershipReader([
      ["tenant-1", "user-a", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
      ["tenant-1", "user-b", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
      ["tenant-1", "mod-a", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
      ["tenant-1", "banned-a", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
      ["tenant-1", "inactive-a", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
      ["tenant-2", "other-tenant-user", COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
    ]);

  const identityActorPort =
    options.identityActorPort ||
    createMemoryIdentityActorPort([
      ["user-a", true],
      ["user-b", true],
      ["mod-a", true],
      ["banned-a", true],
      ["inactive-a", false],
      ["other-tenant-user", true],
    ]);

  return createCommunityCommunicationApplication({
    useInMemoryRepositories: true,
    membershipReader,
    identityActorPort,
    accessPolicy:
      options.accessPolicy || createAllowAllCommunityAccessPolicy(),
    moderationPolicy:
      options.moderationPolicy || createAllowAllCommunityModerationPolicy(),
    ...options,
  });
}

async function resolveLobby(app, tenantId = "tenant-1") {
  const result =
    await app.communityCommunication.createOrResolveCommunityLobby({
      tenantId,
      actorParticipantId: "mod-a",
    });
  assert.ok(result.channel);
  return result.channel;
}

test("COMMS-06 phase metadata and public exports (Community capability retained)", () => {
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-06");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.name, "messaging-experience");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.priorPhase, "COMMS-05");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasPersistence, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasRealtime, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.realtimePublicationEnabled, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasUi, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasInMemoryTestDoubles, true);
});

test("COMMUNITY conversation requires tenantId", () => {
  expectCode(
    () =>
      createConversationContract({
        conversationId: "c1",
        type: CONVERSATION_TYPE.COMMUNITY,
        createdAt: T0,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
});

test("invalid channel kind is rejected", () => {
  expectCode(
    () =>
      resolveCommunityChannelIdentity({
        tenantId: "tenant-1",
        channelKind: "GENERAL",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_KIND
  );
});

test("invalid visibility is rejected", () => {
  expectCode(
    () =>
      resolveCommunityChannelIdentity({
        tenantId: "tenant-1",
        channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
        visibility: "SECRET",
        channelSuffix: "sports",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_COMMUNITY_CHANNEL_VISIBILITY
  );
});

test("LOBBY resolve is idempotent", async () => {
  const app = createApp();
  const a =
    await app.communityCommunication.createOrResolveCommunityLobby({
      tenantId: "tenant-1",
    });
  const b =
    await app.communityCommunication.createOrResolveCommunityLobby({
      tenantId: "tenant-1",
    });
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(
    a.channel.conversation.conversationId,
    b.channel.conversation.conversationId
  );
  assert.equal(a.channel.channelKey, buildCommunityLobbyChannelKey("tenant-1"));
  assert.equal(a.channel.channelKind, COMMUNITY_CHANNEL_KIND.LOBBY);
});

test("no duplicate LOBBY for same tenant", async () => {
  const app = createApp();
  await app.communityCommunication.createOrResolveCommunityLobby({
    tenantId: "tenant-1",
  });
  const again = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.LOBBY,
    name: "Different Display Name",
  });
  assert.equal(again.created, false);
  assert.equal(
    again.channel.channelKey,
    buildCommunityLobbyChannelKey("tenant-1")
  );
});

test("channelKey does not depend on channel name", () => {
  const a = resolveCommunityChannelIdentity({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    channelSuffix: "pickleball",
    name: "Alpha",
  });
  const b = resolveCommunityChannelIdentity({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    channelSuffix: "pickleball",
    name: "Beta Renamed",
  });
  assert.equal(a.channelKey, b.channelKey);
  assert.notEqual(a.name, b.name);
});

test("cannot move channel to another tenant", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await expectCodeAsync(
    () =>
      app.communityCommunication.updateCommunityChannelMetadata({
        conversationId: lobby.conversation.conversationId,
        actorParticipantId: "mod-a",
        tenantId: "tenant-2",
        name: "x",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH
  );
});

test("inactive identity is denied", () => {
  const decision = evaluateCommunityChannelAccess({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.LOBBY,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    participantId: "inactive-a",
    action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND,
    identityActive: false,
  });
  assert.equal(
    decision.decision,
    COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY
  );
  assert.equal(
    decision.reasonCode,
    COMMUNITY_COMMUNICATION_DENY_REASON.IDENTITY_INACTIVE
  );
});

test("inactive identity cannot send via application", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        senderParticipantId: "inactive-a",
        body: "hi",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE
  );
});

test("banned user is DENY", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.banCommunityParticipant({
    conversationId: lobby.conversation.conversationId,
    actorParticipantId: "mod-a",
    participantId: "banned-a",
    reasonCode: "SPAM",
  });
  const decision = await app.communityCommunication
    .buildCommunityChannelSummary({
      conversationId: lobby.conversation.conversationId,
      viewerParticipantId: "banned-a",
    })
    .then(() =>
      evaluateCommunityChannelAccess({
        tenantId: "tenant-1",
        channelKind: COMMUNITY_CHANNEL_KIND.LOBBY,
        visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
        participantId: "banned-a",
        action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND,
        identityActive: true,
        communityRestrictionStatus: "BANNED",
      })
    );
  assert.equal(
    decision.decision,
    COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY
  );
  assert.equal(
    decision.reasonCode,
    COMMUNITY_COMMUNICATION_DENY_REASON.COMMUNITY_BANNED
  );

  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        senderParticipantId: "banned-a",
        body: "blocked",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED
  );
});

test("PUBLIC read access is ALLOW", () => {
  const decision = evaluateCommunityChannelAccess({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.LOBBY,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    participantId: "user-a",
    action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ,
    identityActive: true,
  });
  assert.equal(
    decision.decision,
    COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW
  );
});

test("JOIN_REQUIRED returns JOIN_REQUIRED decision without membership", () => {
  const decision = evaluateCommunityChannelAccess({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED,
    participantId: "guest",
    membershipStatus: COMMUNITY_MEMBERSHIP_STATUS.NOT_MEMBER,
    action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.SEND,
    identityActive: true,
  });
  assert.equal(
    decision.decision,
    COMMUNITY_COMMUNICATION_ACCESS_DECISION.JOIN_REQUIRED
  );
  assert.equal(
    decision.reasonCode,
    COMMUNITY_COMMUNICATION_DENY_REASON.JOIN_REQUIRED
  );
});

test("RESTRICTED requires explicit or policy access", () => {
  const denied = evaluateCommunityChannelAccess({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.SUPPORT,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED,
    participantId: "user-a",
    action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ,
    identityActive: true,
    isExplicitParticipant: false,
    policyDecision: COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY,
  });
  assert.equal(denied.decision, COMMUNITY_COMMUNICATION_ACCESS_DECISION.DENY);
  assert.equal(
    denied.reasonCode,
    COMMUNITY_COMMUNICATION_DENY_REASON.RESTRICTED_POLICY_DENIED
  );

  const allowed = evaluateCommunityChannelAccess({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.SUPPORT,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.RESTRICTED,
    participantId: "user-a",
    action: COMMUNITY_COMMUNICATION_ACCESS_ACTION.READ,
    identityActive: true,
    isExplicitParticipant: true,
  });
  assert.equal(
    allowed.decision,
    COMMUNITY_COMMUNICATION_ACCESS_DECISION.ALLOW
  );
});

test("READ_ONLY does not allow send", async () => {
  const app = createApp();
  const created = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.READ_ONLY,
    channelSuffix: "rules",
    name: "Rules",
    actorParticipantId: "mod-a",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: created.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "nope",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_READ_ONLY
  );
});

test("join does not duplicate active participant", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  const first = await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  const second = await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  assert.equal(first.joined, true);
  assert.equal(second.joined, false);
  const actives = second.channel.participants.filter(
    (p) =>
      p.participantId === "user-a" && p.status === PARTICIPANT_STATUS.ACTIVE
  );
  assert.equal(actives.length, 1);
});

test("leave is idempotent", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  const left = await app.communityCommunication.leaveCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  assert.equal(left.left, true);
  const again = await app.communityCommunication.leaveCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  assert.equal(again.left, false);
});

test("suspended participant cannot send", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  await app.communityCommunication.suspendCommunityChannelParticipant({
    conversationId: lobby.conversation.conversationId,
    actorParticipantId: "mod-a",
    participantId: "user-a",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "blocked",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_ACCESS_DENIED
  );
});

test("archived and suspended channel cannot send", async () => {
  const app = createApp();
  const a = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "arch",
    actorParticipantId: "mod-a",
  });
  await app.communityCommunication.archiveCommunityChannel({
    conversationId: a.channel.conversation.conversationId,
    actorParticipantId: "mod-a",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: a.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "x",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_ARCHIVED
  );

  const b = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "susp",
    actorParticipantId: "mod-a",
  });
  await app.communityCommunication.suspendCommunityChannel({
    conversationId: b.channel.conversation.conversationId,
    actorParticipantId: "mod-a",
  });
  assert.equal(
    (
      await app.repositories.channels.findById(
        b.channel.conversation.conversationId
      )
    ).lifecycleStatus,
    COMMUNITY_CHANNEL_LIFECYCLE.SUSPENDED
  );
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: b.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "x",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_CHANNEL_SUSPENDED
  );
});

test("reply from different channel is rejected", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  const other = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "other",
  });
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "root",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: other.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "reply",
        replyToMessageId: sent.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY
  );
});

test("slow mode disabled allows send", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  assert.equal(lobby.slowModeIntervalSeconds, 0);
  const first = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "one",
    createdAt: T0,
  });
  const second = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "two",
    createdAt: T1,
  });
  assert.ok(first.message.messageId);
  assert.ok(second.message.messageId);
});

test("slow mode interval valid and early send rejected", async () => {
  const app = createApp();
  const created = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "slow",
    slowModeIntervalSeconds: 60,
  });
  assert.equal(created.channel.slowModeIntervalSeconds, 60);

  await app.communityCommunication.sendCommunityMessage({
    conversationId: created.channel.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "one",
    createdAt: T0,
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: created.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "too soon",
        createdAt: T1,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_SLOW_MODE_ACTIVE
  );

  const ok = await app.communityCommunication.sendCommunityMessage({
    conversationId: created.channel.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "later",
    createdAt: T2,
  });
  assert.ok(ok.message.messageId);
});

test("moderator bypass slow mode via policy", async () => {
  const app = createApp({
    moderationPolicy: createBypassSlowModeCommunityModerationPolicy(),
  });
  const created = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "slow-bypass",
    slowModeIntervalSeconds: 60,
  });
  await app.communityCommunication.sendCommunityMessage({
    conversationId: created.channel.conversation.conversationId,
    senderParticipantId: "mod-a",
    body: "one",
    createdAt: T0,
  });
  const second = await app.communityCommunication.sendCommunityMessage({
    conversationId: created.channel.conversation.conversationId,
    senderParticipantId: "mod-a",
    body: "bypass",
    createdAt: T1,
  });
  assert.ok(second.message.messageId);

  const decision = evaluateCommunitySlowMode({
    enabled: true,
    intervalSeconds: 60,
    lastSentAt: T0,
    now: T1,
    moderatorBypass: true,
  });
  assert.equal(decision.allowed, true);
});

test("report different tenant/channel rejected", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  const otherTenant =
    await app.communityCommunication.createOrResolveCommunityLobby({
      tenantId: "tenant-2",
    });
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "msg",
  });

  await expectCodeAsync(
    () =>
      app.communityCommunication.reportCommunityMessage({
        conversationId: otherTenant.channel.conversation.conversationId,
        messageId: sent.message.messageId,
        reporterParticipantId: "other-tenant-user",
        reason: "spam",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.REPORT_TARGET_INVALID
  );

  await expectCodeAsync(
    () =>
      app.communityCommunication.reportCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        messageId: sent.message.messageId,
        reporterParticipantId: "user-b",
        reason: "spam",
        tenantId: "tenant-2",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_TENANT_MISMATCH
  );
});

test("unauthorized moderator is rejected", async () => {
  const app = createApp({
    moderationPolicy: createDenyAllCommunityModerationPolicy(),
    accessPolicy: createDefaultCommunityAccessPolicy(),
  });
  const lobby = await resolveLobby(app);
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "msg",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.hideCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        actorParticipantId: "user-b",
        messageId: sent.message.messageId,
        reasonCode: "HIDE",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_COMMUNITY_MODERATOR
  );
});

test("moderation action has reason code", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "bad",
  });
  const hidden = await app.communityCommunication.hideCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    actorParticipantId: "mod-a",
    messageId: sent.message.messageId,
    reasonCode: "OFFTOPIC",
    reason: "OFFTOPIC",
  });
  assert.equal(
    hidden.moderationAction.type,
    MODERATION_ACTION_TYPE.HIDE_MESSAGE
  );
  assert.equal(hidden.moderationAction.reason, "OFFTOPIC");
  assert.ok(hidden.moderationAction.actionId);
});

test("banned participant cannot join again", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.banCommunityParticipant({
    conversationId: lobby.conversation.conversationId,
    actorParticipantId: "mod-a",
    participantId: "banned-a",
    reasonCode: "ABUSE",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.joinCommunityChannel({
        conversationId: lobby.conversation.conversationId,
        participantId: "banned-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_BANNED
  );
});

test("pin different channel rejected", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  const other = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.TOPIC,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.PUBLIC,
    channelSuffix: "pin-other",
  });
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "pin me",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.pinCommunityMessage({
        conversationId: other.channel.conversation.conversationId,
        actorParticipantId: "mod-a",
        messageId: sent.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID
  );
});

test("unauthorized pin rejected", async () => {
  const app = createApp({
    moderationPolicy: createDenyAllCommunityModerationPolicy(),
    accessPolicy: createDefaultCommunityAccessPolicy(),
  });
  const lobby = await resolveLobby(app);
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-a",
    body: "pin me",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.pinCommunityMessage({
        conversationId: lobby.conversation.conversationId,
        actorParticipantId: "user-b",
        messageId: sent.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN
  );
});

test("read cursor is monotonic", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-b",
    body: "hello",
    createdAt: T0,
  });
  await app.communityCommunication.markCommunityChannelRead({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
    lastReadAt: T1,
    lastReadMessageId: sent.message.messageId,
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.markCommunityChannelRead({
        conversationId: lobby.conversation.conversationId,
        participantId: "user-a",
        lastReadAt: T0,
        lastReadMessageId: sent.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION
  );
});

test("summary is deterministic", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  await app.communityCommunication.joinCommunityChannel({
    conversationId: lobby.conversation.conversationId,
    participantId: "user-a",
  });
  const sent = await app.communityCommunication.sendCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    senderParticipantId: "user-b",
    body: "latest",
    createdAt: T0,
  });
  await app.communityCommunication.pinCommunityMessage({
    conversationId: lobby.conversation.conversationId,
    actorParticipantId: "mod-a",
    messageId: sent.message.messageId,
  });
  const s1 = await app.communityCommunication.buildCommunityChannelSummary({
    conversationId: lobby.conversation.conversationId,
    viewerParticipantId: "user-a",
  });
  const s2 = await app.communityCommunication.buildCommunityChannelSummary({
    conversationId: lobby.conversation.conversationId,
    viewerParticipantId: "user-a",
  });
  assert.deepEqual(s1, s2);
  assert.equal(s1.tenantId, "tenant-1");
  assert.equal(s1.channelKind, COMMUNITY_CHANNEL_KIND.LOBBY);
  assert.equal(s1.visibility, COMMUNITY_CHANNEL_VISIBILITY.PUBLIC);
  assert.equal(s1.channelKey, buildCommunityLobbyChannelKey("tenant-1"));
  assert.equal(s1.latestMessageId, sent.message.messageId);
  assert.equal(s1.pinnedMessageIds[0], sent.message.messageId);
  assert.equal(s1.lifecycleStatus, COMMUNITY_CHANNEL_LIFECYCLE.ACTIVE);
  assert.equal(s1.status, CONVERSATION_STATUS.ACTIVE);
  assert.equal(typeof s1.unreadCount, "number");
});

test("ports have no runtime coupling and unimplemented throw typed errors", async () => {
  const channelRepo = createUnimplementedCommunityChannelRepository();
  const messageRepo = createUnimplementedCommunityMessageRepository();
  const membership = createUnimplementedCommunityMembershipReader();
  const access = createUnimplementedCommunityAccessPolicy();
  const moderation = createUnimplementedCommunityModerationPolicy();
  const restriction = createUnimplementedCommunityRestrictionRepository();

  assert.equal(matchesCommunityChannelRepository(channelRepo), true);
  assert.equal(matchesCommunityMessageRepository(messageRepo), true);
  assert.equal(matchesCommunityMembershipReader(membership), true);
  assert.equal(matchesCommunityAccessPolicy(access), true);
  assert.equal(matchesCommunityModerationPolicy(moderation), true);
  assert.equal(matchesCommunityRestrictionRepository(restriction), true);

  await expectCodeAsync(
    () => channelRepo.findById("x"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => membership.getMembership("t", "u"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );

  const memory = createInMemoryCommunityCommunicationRepositories();
  assert.equal(memory.isTestDoubleOnly, true);
  assert.equal(matchesCommunityChannelRepository(memory.channels), true);

  // No SQL / Supabase / UI strings in community module sources
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (entry.name.endsWith(".js")) out.push(full);
    }
    return out;
  };
  const communityFiles = walk(MODULE_ROOT).filter((f) =>
    /community/i.test(path.basename(f))
  );
  for (const file of communityFiles) {
    const text = fs.readFileSync(file, "utf8");
    assert.equal(/from ['"]@supabase/i.test(text), false, file);
    assert.equal(/createClient\s*\(/.test(text), false, file);
    assert.equal(/\bSELECT\b|\bINSERT\b|\bCREATE TABLE\b/i.test(text), false, file);
  }
});

test("JOIN_REQUIRED application path returns typed join-required error", async () => {
  const membershipReader = createMemoryCommunityMembershipReader([]);
  const app = createApp({ membershipReader });
  const created = await app.communityCommunication.createCommunityChannel({
    tenantId: "tenant-1",
    channelKind: COMMUNITY_CHANNEL_KIND.REGION,
    visibility: COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED,
    channelSuffix: "hanoi",
  });
  await expectCodeAsync(
    () =>
      app.communityCommunication.sendCommunityMessage({
        conversationId: created.channel.conversation.conversationId,
        senderParticipantId: "user-a",
        body: "need join",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.COMMUNITY_JOIN_REQUIRED
  );
});

test("conversation type remains COMMUNITY", async () => {
  const app = createApp();
  const lobby = await resolveLobby(app);
  assert.equal(lobby.conversation.type, CONVERSATION_TYPE.COMMUNITY);
  assert.equal(lobby.conversation.tenantId, "tenant-1");
});
