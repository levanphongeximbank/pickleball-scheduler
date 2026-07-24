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
  CONVERSATION_ROLE,
  PARTICIPANT_STATUS,
  CLUB_CHANNEL_KIND,
  CLUB_MEMBERSHIP_STATUS,
  CLUB_COMMUNICATION_ACCESS_DECISION,
  CLUB_COMMUNICATION_ACCESS_ACTION,
  CLUB_COMMUNICATION_DENY_REASON,
  createConversationContract,
  buildDefaultClubChannelKey,
  resolveClubChannelIdentity,
  evaluateClubChannelAccess,
  createClubCommunicationApplication,
  createMemoryClubMembershipReader,
  createAllowAllClubCommunicationAccessPolicy,
  createDefaultClubCommunicationAccessPolicy,
  createDenyAllTeamAccessPolicy,
  createAllowAllTeamAccessPolicy,
  createUnimplementedClubChannelRepository,
  createUnimplementedClubMessageRepository,
  createUnimplementedClubMembershipReader,
  createUnimplementedClubCommunicationAccessPolicy,
  createUnimplementedTeamAccessPolicy,
  matchesClubChannelRepository,
  matchesClubMessageRepository,
  matchesClubMembershipReader,
  matchesClubCommunicationAccessPolicy,
  matchesTeamAccessPolicy,
  createInMemoryClubCommunicationRepositories,
} from "../src/features/communication/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = path.resolve(__dirname, "../src/features/communication");
const T0 = "2026-07-24T12:00:00.000Z";
const T1 = "2026-07-24T12:05:00.000Z";

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
    createMemoryClubMembershipReader([
      ["club-1", "member-a", CLUB_MEMBERSHIP_STATUS.ACTIVE],
      ["club-1", "member-b", CLUB_MEMBERSHIP_STATUS.ACTIVE],
      ["club-1", "admin-a", CLUB_MEMBERSHIP_STATUS.ACTIVE],
      ["club-1", "suspended-a", CLUB_MEMBERSHIP_STATUS.SUSPENDED],
      ["club-1", "removed-a", CLUB_MEMBERSHIP_STATUS.REMOVED],
      ["club-2", "other-club-user", CLUB_MEMBERSHIP_STATUS.ACTIVE],
    ]);

  const accessPolicy =
    options.accessPolicy ||
    createAllowAllClubCommunicationAccessPolicy();
  const teamAccessPolicy =
    options.teamAccessPolicy || createAllowAllTeamAccessPolicy();

  return createClubCommunicationApplication({
    useInMemoryRepositories: true,
    membershipReader,
    accessPolicy,
    teamAccessPolicy,
    ...options,
  });
}

async function resolveGeneral(app, clubId = "club-1") {
  const result = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId,
    actorParticipantId: "admin-a",
  });
  const general = result.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL
  );
  assert.ok(general);
  return general;
}

test("COMMS-03 phase metadata and public exports", () => {
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-04");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.name, "community-communication");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasPersistence, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasRealtime, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasUi, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasInMemoryTestDoubles, true);
});

test("CLUB conversation requires clubId", () => {
  expectCode(
    () =>
      createConversationContract({
        conversationId: "c1",
        type: CONVERSATION_TYPE.CLUB,
        createdAt: T0,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
});

test("invalid channel kind is rejected", () => {
  expectCode(
    () =>
      resolveClubChannelIdentity({
        clubId: "club-1",
        channelKind: "LOBBY",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND
  );
});

test("default GENERAL resolve is idempotent", async () => {
  const app = createApp();
  const a = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const b = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const g1 = a.channels.find((c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL);
  const g2 = b.channels.find((c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL);
  assert.equal(g1.conversation.conversationId, g2.conversation.conversationId);
  assert.equal(g1.channelKey, buildDefaultClubChannelKey("club-1", "GENERAL"));
  assert.equal(b.createdCount, 0);
});

test("default ANNOUNCEMENT resolve is idempotent", async () => {
  const app = createApp();
  const a = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const b = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const n1 = a.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );
  const n2 = b.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );
  assert.equal(n1.conversation.conversationId, n2.conversation.conversationId);
  assert.equal(
    n1.channelKey,
    buildDefaultClubChannelKey("club-1", "ANNOUNCEMENT")
  );
});

test("no duplicate default channel for same club/kind", async () => {
  const app = createApp();
  await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.createClubChannel({
        clubId: "club-1",
        channelKind: CLUB_CHANNEL_KIND.GENERAL,
        name: "Another General",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_CLUB_CHANNEL
  );
});

test("channelKey does not depend on channel name", async () => {
  const app = createApp();
  const identityA = resolveClubChannelIdentity({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.GENERAL,
    name: "Phòng chung",
  });
  const identityB = resolveClubChannelIdentity({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.GENERAL,
    name: "General Room",
  });
  assert.equal(identityA.channelKey, identityB.channelKey);

  const created = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const general = created.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL
  );
  await app.clubCommunication.updateClubChannelMetadata({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
    name: "Tên mới hoàn toàn",
  });
  const again = await app.repositories.channels.findById(
    general.conversation.conversationId
  );
  assert.equal(again.channelKey, general.channelKey);
  assert.equal(again.name, "Tên mới hoàn toàn");
});

test("cannot move channel to another club", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await expectCodeAsync(
    () =>
      app.clubCommunication.updateClubChannelMetadata({
        conversationId: general.conversation.conversationId,
        actorParticipantId: "admin-a",
        clubId: "club-2",
        name: "x",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CHANNEL_CLUB_MISMATCH
  );
});

test("non-member is denied GENERAL access/send", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: general.conversation.conversationId,
        senderParticipantId: "stranger",
        body: "hello",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED
  );
});

test("suspended and removed membership cannot send", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: general.conversation.conversationId,
        senderParticipantId: "suspended-a",
        body: "no",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED
  );
  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: general.conversation.conversationId,
        senderParticipantId: "removed-a",
        body: "no",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED
  );
});

test("active member can join/send GENERAL", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  const sent = await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "xin chao CLB",
    createdAt: T0,
  });
  assert.equal(sent.message.body, "xin chao CLB");
  assert.equal(sent.message.conversationId, general.conversation.conversationId);
  assert.equal(sent.channel.conversation.type, CONVERSATION_TYPE.CLUB);
});

test("ANNOUNCEMENT only authorized actor can send", async () => {
  const denyAnnounce = {
    async evaluate(input = {}) {
      if (
        input.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT &&
        input.action === CLUB_COMMUNICATION_ACCESS_ACTION.SEND
      ) {
        if (input.participantId === "admin-a") {
          return {
            decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
            reasonCode: null,
          };
        }
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.DENY,
          reasonCode: CLUB_COMMUNICATION_DENY_REASON.ANNOUNCEMENT_SEND_DENIED,
        };
      }
      return {
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
  const app = createApp({ accessPolicy: denyAnnounce });
  const defaults = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const announcement = defaults.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );

  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: announcement.conversation.conversationId,
        senderParticipantId: "member-a",
        body: "unauthorized announce",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_SEND_POLICY_DENIED
  );

  const ok = await app.clubCommunication.sendClubMessage({
    conversationId: announcement.conversation.conversationId,
    senderParticipantId: "admin-a",
    body: "official announce",
  });
  assert.equal(ok.message.body, "official announce");
});

test("PRIVATE only explicit participant can access/send", async () => {
  const app = createApp();
  const created = await app.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.PRIVATE,
    actorParticipantId: "admin-a",
    name: "Ban dieu hanh nho",
  });
  assert.equal(created.channel.channelKind, CLUB_CHANNEL_KIND.PRIVATE);

  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: created.channel.conversation.conversationId,
        senderParticipantId: "member-a",
        body: "cannot",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_ACCESS_DENIED
  );

  await app.clubCommunication.addClubChannelParticipant({
    conversationId: created.channel.conversation.conversationId,
    actorParticipantId: "admin-a",
    participantId: "member-a",
  });

  const sent = await app.clubCommunication.sendClubMessage({
    conversationId: created.channel.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "private ok",
  });
  assert.equal(sent.message.body, "private ok");
});

test("TEAM and MANAGEMENT call policy ports", async () => {
  let teamCalls = 0;
  let managementCalls = 0;
  const teamPolicy = {
    async canAccessTeamChannel() {
      teamCalls += 1;
      return { allowed: true, reasonCode: null };
    },
  };
  const accessPolicy = {
    async evaluate(input = {}) {
      if (input.channelKind === CLUB_CHANNEL_KIND.MANAGEMENT) {
        managementCalls += 1;
        return {
          decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
          reasonCode: null,
        };
      }
      return {
        decision: CLUB_COMMUNICATION_ACCESS_DECISION.ALLOW,
        reasonCode: null,
      };
    },
  };
  const app = createApp({ teamAccessPolicy: teamPolicy, accessPolicy });

  const team = await app.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.TEAM,
    actorParticipantId: "admin-a",
    name: "Team A",
  });
  await app.clubCommunication.sendClubMessage({
    conversationId: team.channel.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "team hi",
  });
  assert.ok(teamCalls >= 1);

  const mgmt = await app.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.MANAGEMENT,
    actorParticipantId: "admin-a",
    name: "Ban dieu hanh",
  });
  await app.clubCommunication.sendClubMessage({
    conversationId: mgmt.channel.conversation.conversationId,
    senderParticipantId: "admin-a",
    body: "mgmt hi",
  });
  assert.ok(managementCalls >= 1);

  const denyTeamApp = createApp({
    teamAccessPolicy: createDenyAllTeamAccessPolicy(),
  });
  const deniedTeam = await denyTeamApp.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.TEAM,
    actorParticipantId: "admin-a",
  });
  await expectCodeAsync(
    () =>
      denyTeamApp.clubCommunication.sendClubMessage({
        conversationId: deniedTeam.channel.conversation.conversationId,
        senderParticipantId: "member-a",
        body: "no",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_SEND_POLICY_DENIED
  );
});

test("participant from another club is rejected", async () => {
  const app = createApp();
  const privateCh = await app.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.PRIVATE,
    actorParticipantId: "admin-a",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.addClubChannelParticipant({
        conversationId: privateCh.channel.conversation.conversationId,
        actorParticipantId: "admin-a",
        participantId: "other-club-user",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PARTICIPANT_CLUB_MISMATCH
  );
});

test("duplicate participant is prevented", async () => {
  const app = createApp();
  const privateCh = await app.clubCommunication.createClubChannel({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.PRIVATE,
    actorParticipantId: "admin-a",
  });
  await app.clubCommunication.addClubChannelParticipant({
    conversationId: privateCh.channel.conversation.conversationId,
    actorParticipantId: "admin-a",
    participantId: "member-a",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.addClubChannelParticipant({
        conversationId: privateCh.channel.conversation.conversationId,
        actorParticipantId: "admin-a",
        participantId: "member-a",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PARTICIPANT
  );
});

test("membership reconciliation revokes send rights", async () => {
  const membershipReader = createMemoryClubMembershipReader([
    ["club-1", "member-a", CLUB_MEMBERSHIP_STATUS.ACTIVE],
    ["club-1", "admin-a", CLUB_MEMBERSHIP_STATUS.ACTIVE],
  ]);
  const app = createApp({ membershipReader });
  const general = await resolveGeneral(app);
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "before",
  });

  membershipReader.setStatus(
    "club-1",
    "member-a",
    CLUB_MEMBERSHIP_STATUS.SUSPENDED
  );
  const sync = await app.clubCommunication.synchronizeClubMembershipAccess({
    conversationId: general.conversation.conversationId,
    participantId: "member-a",
  });
  assert.equal(sync.changed, true);
  assert.equal(sync.participant.status, PARTICIPANT_STATUS.SUSPENDED);

  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: general.conversation.conversationId,
        senderParticipantId: "member-a",
        body: "after",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED
  );
});

test("archived channel rejects new messages", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await app.clubCommunication.archiveClubChannel({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: general.conversation.conversationId,
        senderParticipantId: "member-a",
        body: "too late",
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_CHANNEL_ARCHIVED
  );
});

test("reply to message in another channel is rejected", async () => {
  const app = createApp();
  const defaults = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const general = defaults.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL
  );
  const announcement = defaults.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );
  const msg = await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "general msg",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.sendClubMessage({
        conversationId: announcement.conversation.conversationId,
        senderParticipantId: "admin-a",
        body: "reply elsewhere",
        replyToMessageId: msg.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.CROSS_CONVERSATION_REPLY
  );
});

test("pin message from another channel is rejected", async () => {
  const app = createApp();
  const defaults = await app.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
  });
  const general = defaults.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.GENERAL
  );
  const announcement = defaults.channels.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );
  const msg = await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "pin me elsewhere",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.pinClubMessage({
        conversationId: announcement.conversation.conversationId,
        actorParticipantId: "admin-a",
        messageId: msg.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PIN_TARGET_INVALID
  );
});

test("unauthorized actor cannot pin", async () => {
  const app = createApp({
    accessPolicy: createDefaultClubCommunicationAccessPolicy(),
  });
  const general = await resolveGeneral(app);
  // Give member OWNER role? Without policy allow and without admin role → deny
  const msg = await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "pin target",
  });
  await expectCodeAsync(
    () =>
      app.clubCommunication.pinClubMessage({
        conversationId: general.conversation.conversationId,
        actorParticipantId: "member-a",
        messageId: msg.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.UNAUTHORIZED_CHANNEL_ADMIN
  );
});

test("duplicate pin is rejected; unpin is idempotent", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  // Make admin-a an OWNER via send + role change
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "admin-a",
    body: "seed",
  });
  await app.clubCommunication.changeClubChannelParticipantRole({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
    participantId: "admin-a",
    role: CONVERSATION_ROLE.OWNER,
  });
  const msg = await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "important",
  });
  const pin = await app.clubCommunication.pinClubMessage({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
    messageId: msg.message.messageId,
    pinnedAt: T1,
  });
  assert.equal(pin.pin.messageId, msg.message.messageId);

  await expectCodeAsync(
    () =>
      app.clubCommunication.pinClubMessage({
        conversationId: general.conversation.conversationId,
        actorParticipantId: "admin-a",
        messageId: msg.message.messageId,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN
  );

  const firstUnpin = await app.clubCommunication.unpinClubMessage({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
    messageId: msg.message.messageId,
  });
  assert.equal(firstUnpin.removed, true);
  const secondUnpin = await app.clubCommunication.unpinClubMessage({
    conversationId: general.conversation.conversationId,
    actorParticipantId: "admin-a",
    messageId: msg.message.messageId,
  });
  assert.equal(secondUnpin.removed, false);
});

test("read cursor is monotonic", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "m1",
    createdAt: T0,
  });
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-b",
    body: "m2",
    createdAt: T1,
  });
  // ensure member-b is participant for read
  const marked = await app.clubCommunication.markClubChannelRead({
    conversationId: general.conversation.conversationId,
    participantId: "member-b",
    lastReadAt: T1,
  });
  assert.equal(marked.readCursor.lastReadAt, T1);
  await expectCodeAsync(
    () =>
      app.clubCommunication.markClubChannelRead({
        conversationId: general.conversation.conversationId,
        participantId: "member-b",
        lastReadAt: T0,
      }),
    COMMUNICATION_FOUNDATION_ERROR_CODE.READ_CURSOR_REGRESSION
  );
});

test("summary projection is deterministic", async () => {
  const app = createApp();
  const general = await resolveGeneral(app);
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-a",
    body: "alpha",
    createdAt: T0,
  });
  await app.clubCommunication.sendClubMessage({
    conversationId: general.conversation.conversationId,
    senderParticipantId: "member-b",
    body: "beta",
    createdAt: T1,
  });
  await app.clubCommunication.markClubChannelRead({
    conversationId: general.conversation.conversationId,
    participantId: "member-a",
    lastReadAt: T0,
  });

  const s1 = await app.clubCommunication.buildClubChannelSummary({
    conversationId: general.conversation.conversationId,
    viewerParticipantId: "member-a",
  });
  const s2 = await app.clubCommunication.buildClubChannelSummary({
    conversationId: general.conversation.conversationId,
    viewerParticipantId: "member-a",
  });
  assert.deepEqual(s1, s2);
  assert.equal(s1.clubId, "club-1");
  assert.equal(s1.channelKind, CLUB_CHANNEL_KIND.GENERAL);
  assert.equal(s1.channelKey, buildDefaultClubChannelKey("club-1", "GENERAL"));
  assert.equal(s1.latestMessageBodyPreview, "beta");
  assert.equal(s1.unreadCount, 1);
  assert.equal(s1.status, CONVERSATION_STATUS.ACTIVE);
});

test("ports have no runtime coupling (unimplemented throws)", async () => {
  const channelRepo = createUnimplementedClubChannelRepository();
  const messageRepo = createUnimplementedClubMessageRepository();
  const membership = createUnimplementedClubMembershipReader();
  const access = createUnimplementedClubCommunicationAccessPolicy();
  const team = createUnimplementedTeamAccessPolicy();

  assert.equal(matchesClubChannelRepository(channelRepo), true);
  assert.equal(matchesClubMessageRepository(messageRepo), true);
  assert.equal(matchesClubMembershipReader(membership), true);
  assert.equal(matchesClubCommunicationAccessPolicy(access), true);
  assert.equal(matchesTeamAccessPolicy(team), true);

  await expectCodeAsync(
    () => channelRepo.findById("x"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => messageRepo.save({}),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => membership.getMembership("c", "u"),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => access.evaluate({}),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
  await expectCodeAsync(
    () => team.canAccessTeamChannel({}),
    COMMUNICATION_FOUNDATION_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED
  );
});

test("typed reason and error codes are stable", () => {
  assert.equal(
    COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CLUB_CHANNEL_KIND,
    "COMMUNICATION_INVALID_CLUB_CHANNEL_KIND"
  );
  assert.equal(
    COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
    "COMMUNICATION_CLUB_MEMBERSHIP_DENIED"
  );
  assert.equal(
    COMMUNICATION_FOUNDATION_ERROR_CODE.DUPLICATE_PIN,
    "COMMUNICATION_DUPLICATE_PIN"
  );
  assert.equal(
    CLUB_COMMUNICATION_DENY_REASON.ANNOUNCEMENT_SEND_DENIED,
    "ANNOUNCEMENT_SEND_DENIED"
  );
  assert.equal(
    CLUB_COMMUNICATION_DENY_REASON.TEAM_POLICY_DENIED,
    "TEAM_POLICY_DENIED"
  );

  const decision = evaluateClubChannelAccess({
    clubId: "club-1",
    channelKind: CLUB_CHANNEL_KIND.GENERAL,
    participantId: "x",
    membershipStatus: CLUB_MEMBERSHIP_STATUS.NOT_MEMBER,
    action: CLUB_COMMUNICATION_ACCESS_ACTION.SEND,
  });
  assert.equal(decision.decision, CLUB_COMMUNICATION_ACCESS_DECISION.DENY);
  assert.equal(decision.reasonCode, CLUB_COMMUNICATION_DENY_REASON.NOT_MEMBER);
});

test("in-memory club repositories are isolated test doubles", () => {
  const a = createInMemoryClubCommunicationRepositories();
  const b = createInMemoryClubCommunicationRepositories();
  assert.equal(a.isTestDoubleOnly, true);
  assert.notEqual(a.channels, b.channels);
});

test("module source has no SQL / Supabase / UI wiring", () => {
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    /** @type {string[]} */
    const files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...walk(full));
      else if (entry.name.endsWith(".js")) files.push(full);
    }
    return files;
  };
  const files = walk(MODULE_ROOT);
  const banned = [
    /from ['"]@supabase\//,
    /createClient\s*\(/,
    /\.from\(['"]club_/,
    /new\s+WebSocket\b/i,
    /useEffect\s*\(/,
    /from ['"]react-router/,
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(
        pattern.test(text),
        false,
        `${path.relative(MODULE_ROOT, file)} matched ${pattern}`
      );
    }
  }
});
