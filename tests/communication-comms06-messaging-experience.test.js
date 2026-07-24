/**
 * COMMS-06 Messaging Experience — gateway / view-model / navigation registry tests.
 * Node built-in test runner (no new packages). React DOM covered separately via vitest when available.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_FOUNDATION_PHASE,
  MESSAGING_EXPERIENCE_PHASE,
  MESSAGING_ROUTE_PATH,
  MESSAGING_MENU_KEY,
  MESSAGING_TAB,
  MESSAGE_BODY_MAX_LENGTH,
  DEMO_GATEWAY_MARKER,
  matchesCommunicationExperienceGateway,
  createDemoMessagingExperienceGateway,
  sanitizeMessageBodyForDisplay,
  validateComposerBody,
  assertNotRawPersistenceRow,
  createMessageItemVm,
  CLUB_CHANNEL_KIND,
  COMMUNITY_CHANNEL_KIND,
  COMMUNITY_CHANNEL_VISIBILITY,
  DIRECT_MESSAGING_ACCESS_DECISION,
} from "../src/features/communication/index.js";
import { MESSAGING_MENU_LEAF } from "../src/config/v5Menu/messagingMenu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

test("COMMS-06 phase + experience metadata", () => {
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-06");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.hasUi, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.persistenceApplied, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.realtimePublicationEnabled, false);
  assert.equal(MESSAGING_EXPERIENCE_PHASE.id, "COMMS-06");
  assert.equal(MESSAGING_EXPERIENCE_PHASE.productionAdapterWired, false);
  assert.equal(MESSAGING_ROUTE_PATH, "/messages");
  assert.equal(MESSAGING_MENU_KEY, "communication-messaging");
  assert.ok(Object.values(MESSAGING_TAB).includes("DIRECT"));
  assert.ok(MESSAGE_BODY_MAX_LENGTH > 0);
});

test("route /messages is registered and distinct from CRM /crm/messages", () => {
  const routerSrc = fs.readFileSync(path.join(ROOT, "src/router.jsx"), "utf8");
  assert.match(routerSrc, /path="\/messages"/);
  assert.match(routerSrc, /MessagingExperiencePage/);
  assert.match(routerSrc, /path="\/crm\/messages"/);
  const navSrc = fs.readFileSync(
    path.join(ROOT, "src/config/navigationConfig.js"),
    "utf8"
  );
  assert.match(navSrc, /"\/messages":\s*\[\]/);
});

test("menu entry Tin nhắn under messaging group (not CRM leaf)", () => {
  assert.equal(MESSAGING_MENU_LEAF.text, "Tin nhắn");
  assert.equal(MESSAGING_MENU_LEAF.path, "/messages");
  assert.equal(MESSAGING_MENU_LEAF.key, MESSAGING_MENU_KEY);
  const menuIndex = fs.readFileSync(
    path.join(ROOT, "src/config/v5Menu/index.js"),
    "utf8"
  );
  assert.match(menuIndex, /id:\s*"messaging"/);
  assert.match(menuIndex, /MESSAGING_MENU_LEAF/);
  const crmMenu = fs.readFileSync(
    path.join(ROOT, "src/config/v5Menu/crmMenu.js"),
    "utf8"
  );
  assert.match(crmMenu, /path:\s*"\/crm\/messages"/);
  assert.doesNotMatch(crmMenu, /communication-messaging/);
});

test("demo gateway matches port and is marked non-production", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  assert.equal(matchesCommunicationExperienceGateway(gateway), true);
  const info = gateway.getAdapterInfo();
  assert.equal(info.adapterKind, DEMO_GATEWAY_MARKER.adapterKind);
  assert.equal(info.productionReady, false);
});

test("Direct conversation list + access decisions + requests accept/decline/cancel", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const directs = await gateway.listDirectConversations();
  assert.ok(directs.length >= 1);
  assert.equal(assertNotRawPersistenceRow(directs[0]), true);
  assert.ok(!("email" in directs[0]));
  assert.ok(!("phone" in directs[0]));
  assert.ok(directs[0].counterpart.displayName);

  const allow = await gateway.evaluateDirectAccess({
    counterpartParticipantId: "peer-allow",
  });
  assert.equal(allow.decision, DIRECT_MESSAGING_ACCESS_DECISION.ALLOW);

  const req = await gateway.evaluateDirectAccess({
    counterpartParticipantId: "peer-request",
  });
  assert.equal(req.decision, DIRECT_MESSAGING_ACCESS_DECISION.REQUEST_REQUIRED);

  const denied = await gateway.evaluateDirectAccess({
    counterpartParticipantId: "peer-denied",
  });
  assert.equal(denied.decision, DIRECT_MESSAGING_ACCESS_DECISION.DENY);

  const requests = await gateway.listDirectRequests();
  assert.ok(requests.length >= 2);
  const incoming = requests.find((r) => r.direction === "INCOMING");
  const outgoing = requests.find((r) => r.direction === "OUTGOING");
  assert.ok(incoming);
  assert.ok(outgoing);

  await gateway.declineDirectRequest({ requestId: incoming.requestId });
  await gateway.cancelDirectRequest({ requestId: outgoing.requestId });
  const after = await gateway.listDirectRequests();
  assert.equal(
    after.find((r) => r.requestId === incoming.requestId),
    undefined
  );
});

test("send, reply, mark read, block, report", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const handles = await gateway.__demo.ensureSeeded();
  const conversationId = handles.allowConvId;

  const sent = await gateway.sendMessage({
    conversationId,
    scope: "DIRECT",
    body: "Tin nhắn mới từ test",
  });
  assert.equal(sent.body, "Tin nhắn mới từ test");
  assert.equal(sent.mine, true);

  const replied = await gateway.replyMessage({
    conversationId,
    scope: "DIRECT",
    body: "Trả lời test",
    replyToMessageId: sent.messageId,
  });
  assert.equal(replied.replyToMessageId, sent.messageId);

  await gateway.markRead({
    conversationId,
    scope: "DIRECT",
    lastReadMessageId: replied.messageId,
  });

  const block = await gateway.blockUser({
    counterpartParticipantId: "peer-allow",
    reason: "test-block",
  });
  assert.ok(block.blockId);
  assert.ok(!("email" in block));

  const report = await gateway.reportMessage({
    conversationId,
    messageId: sent.messageId,
    reason: "spam",
    scope: "DIRECT",
  });
  assert.ok(report.reportId);
});

test("Club channel taxonomy + announcement composer authorization flags", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const clubs = await gateway.listClubChannels();
  const kinds = new Set(clubs.map((c) => c.channelKind));
  for (const kind of Object.values(CLUB_CHANNEL_KIND)) {
    assert.ok(kinds.has(kind), `missing club kind ${kind}`);
  }
  const announcement = clubs.find(
    (c) => c.channelKind === CLUB_CHANNEL_KIND.ANNOUNCEMENT
  );
  assert.ok(announcement);
  assert.equal(typeof announcement.canComposeAnnouncement, "boolean");
  const privateCh = clubs.find((c) => c.channelKind === CLUB_CHANNEL_KIND.PRIVATE);
  const team = clubs.find((c) => c.channelKind === CLUB_CHANNEL_KIND.TEAM);
  const mgmt = clubs.find((c) => c.channelKind === CLUB_CHANNEL_KIND.MANAGEMENT);
  assert.ok(privateCh);
  assert.ok(team);
  assert.ok(mgmt);
  assert.ok(privateCh.participantAccessState);
});

test("Community lobby, join-required, read-only, slow-mode", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const channels = await gateway.listCommunityChannels();
  const lobby = channels.find((c) => c.channelKind === COMMUNITY_CHANNEL_KIND.LOBBY);
  assert.ok(lobby);

  const joinRequired = channels.find(
    (c) => c.visibility === COMMUNITY_CHANNEL_VISIBILITY.JOIN_REQUIRED
  );
  assert.ok(joinRequired);
  assert.equal(joinRequired.canJoin, true);

  const readOnly = channels.find(
    (c) => c.visibility === COMMUNITY_CHANNEL_VISIBILITY.READ_ONLY
  );
  assert.ok(readOnly);
  assert.equal(readOnly.readOnly, true);

  const handles = await gateway.__demo.ensureSeeded();
  const slow = await gateway.getSlowModeState({
    conversationId: handles.slowModeId,
  });
  assert.equal(slow.enabled, true);
  assert.ok(slow.intervalSeconds > 0);

  await gateway.sendMessage({
    conversationId: handles.slowModeId,
    scope: "COMMUNITY",
    body: "Slow mode first send",
  });
  const after = await gateway.getSlowModeState({
    conversationId: handles.slowModeId,
  });
  assert.equal(after.canSend, false);
  assert.ok(after.remainingSeconds > 0);
});

test("pinned message + moderation/report controls + text-only rendering", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const handles = await gateway.__demo.ensureSeeded();
  const msgs = await gateway.loadMessages({
    conversationId: handles.lobbyId,
    scope: "COMMUNITY",
  });
  assert.ok(msgs.length >= 1);
  const target = msgs[0];
  await gateway.pinMessage({
    conversationId: handles.lobbyId,
    messageId: target.messageId,
    scope: "COMMUNITY",
  });
  const pinned = await gateway.loadMessages({
    conversationId: handles.lobbyId,
    scope: "COMMUNITY",
  });
  assert.ok(pinned.some((m) => m.messageId === target.messageId && m.pinned));

  await gateway.reportMessage({
    conversationId: handles.lobbyId,
    messageId: target.messageId,
    reason: "spam",
    scope: "COMMUNITY",
  });

  const unsafe = createMessageItemVm({
    messageId: "m-html",
    conversationId: "c1",
    senderParticipantId: "u1",
    body: '<script>alert("x")</script>Hello',
    status: "VISIBLE",
    createdAt: "2026-07-24T12:00:00.000Z",
  });
  assert.equal(unsafe.body.includes("<script>"), false);
  assert.match(unsafe.body, /Hello/);
  assert.equal(sanitizeMessageBodyForDisplay("<b>hi</b>"), "hi");
});

test("composer validation + gateway VMs reject raw row shapes", () => {
  assert.equal(validateComposerBody("").ok, false);
  assert.equal(validateComposerBody("ok").ok, true);
  assert.equal(
    validateComposerBody("x".repeat(MESSAGE_BODY_MAX_LENGTH + 1)).ok,
    false
  );
  assert.equal(assertNotRawPersistenceRow({ conversationId: "c1" }), true);
  assert.equal(assertNotRawPersistenceRow({ email: "a@b.c" }), false);
  assert.equal(assertNotRawPersistenceRow({ rawRow: {} }), false);
});

test("subscribe unsubscribe cleanup", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const handles = await gateway.__demo.ensureSeeded();
  let signals = 0;
  const sub = await gateway.subscribe({
    conversationId: handles.allowConvId,
    onSignal: () => {
      signals += 1;
    },
  });
  assert.equal(gateway.__demo.activeSubscriptionCount(), 1);
  await gateway.sendMessage({
    conversationId: handles.allowConvId,
    scope: "DIRECT",
    body: "signal me",
  });
  assert.ok(signals >= 1);
  await gateway.unsubscribe({ conversationId: handles.allowConvId });
  assert.equal(gateway.__demo.activeSubscriptionCount(), 0);
  sub.unsubscribe();
  assert.equal(gateway.__demo.activeSubscriptionCount(), 0);
});

test("unread badge uses Communication projection not Notification inbox", async () => {
  const gateway = createDemoMessagingExperienceGateway();
  const badge = await gateway.getUnreadBadge();
  assert.equal(typeof badge.total, "number");
  assert.ok("direct" in badge && "club" in badge && "community" in badge);
  assert.ok(!("notificationInbox" in badge));
});

test("experience docs and module files exist", () => {
  const doc = path.join(
    ROOT,
    "docs/communication-foundation/comms-06/06_MESSAGING_EXPERIENCE.md"
  );
  assert.equal(fs.existsSync(doc), true);
  assert.equal(
    fs.existsSync(
      path.join(
        ROOT,
        "src/features/communication/experience/MessagingExperiencePage.jsx"
      )
    ),
    true
  );
});
