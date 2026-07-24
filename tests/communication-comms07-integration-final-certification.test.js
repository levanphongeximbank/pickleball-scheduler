/**
 * COMMS-07 Integration Hardening & Final Certification — runtime / gateway smoke.
 * Node built-in test runner (no new packages).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COMMUNICATION_FOUNDATION_PHASE,
  COMMUNICATION_RUNTIME_MODE,
  COMMUNICATION_RUNTIME_PHASE,
  COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE,
  COMMUNICATION_EXPERIENCE_ERROR_CODE,
  PRODUCTION_GATEWAY_MARKER,
  UNAVAILABLE_GATEWAY_MARKER,
  MESSAGING_ROUTE_PATH,
  MESSAGING_MENU_KEY,
  matchesCommunicationExperienceGateway,
  resolveCommunicationRuntimeMode,
  createUnavailableMessagingExperienceGateway,
  createProductionMessagingExperienceGateway,
  createDemoMessagingExperienceGateway,
  bootstrapCommunicationRuntime,
  getCommunicationRuntimeStatus,
  resetCommunicationRuntime,
  createRuntimeNotActivatedError,
  mapToCommunicationExperienceError,
  createSafeCommunicationDiagnosticEvent,
  assertNotRawPersistenceRow,
  sanitizeMessageBodyForDisplay,
  createDirectMessagingApplication,
  createClubCommunicationApplication,
  createCommunityCommunicationApplication,
  createMemoryClubMembershipReader,
  createMemoryCommunityMembershipReader,
  createMemoryIdentityActorPort,
  createFixedClock,
  createSequentialIdProvider,
  createInMemoryRealtimeDeliveryAdapter,
  CLUB_MEMBERSHIP_STATUS,
  COMMUNITY_MEMBERSHIP_STATUS,
  CLUB_CHANNEL_KIND,
  getCommunicationActivationSnapshot,
} from "../src/features/communication/index.js";
import { MESSAGING_MENU_LEAF } from "../src/config/v5Menu/messagingMenu.js";
import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../src/features/communication/errors/errorCodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function createCertifiedComposition(actorId = "actor-1") {
  const clock = createFixedClock("2026-07-24T12:00:00.000Z");
  const idProvider = createSequentialIdProvider("comms07-test");
  const identity = createMemoryIdentityActorPort([actorId, "peer-a", "mod-1"]);
  const clubMembershipReader = createMemoryClubMembershipReader([
    ["club-1", actorId, CLUB_MEMBERSHIP_STATUS.ACTIVE],
  ]);
  const communityMembershipReader = createMemoryCommunityMembershipReader([
    ["tenant-1", actorId, COMMUNITY_MEMBERSHIP_STATUS.ACTIVE],
  ]);
  const playerDisplayPort = {
    async getDisplaySnapshot(id) {
      return { displayName: `User ${id}`, avatarUrl: null };
    },
  };
  const directApp = createDirectMessagingApplication({
    clock,
    idProvider,
    identityActorPort: identity,
  });
  const clubApp = createClubCommunicationApplication({
    clock,
    idProvider,
    membershipReader: clubMembershipReader,
  });
  const communityApp = createCommunityCommunicationApplication({
    clock,
    idProvider,
    identityActorPort: identity,
    membershipReader: communityMembershipReader,
  });
  const realtime = createInMemoryRealtimeDeliveryAdapter({
    authorizeSubscribe: (conversationId, actor) =>
      Boolean(conversationId) && String(actor) === actorId,
    idProvider,
    clock,
  });
  return {
    actorId,
    clock,
    idProvider,
    identity,
    clubMembershipReader,
    communityMembershipReader,
    playerDisplayPort,
    directApp,
    clubApp,
    communityApp,
    realtime,
  };
}

test("COMMS-07 phase + runtime metadata", () => {
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.id, "COMMS-07");
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.structureComplete, true);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.persistenceApplied, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.realtimePublicationEnabled, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.productionBlocked, true);
  assert.equal(COMMUNICATION_RUNTIME_PHASE.id, "COMMS-07");
  assert.equal(MESSAGING_ROUTE_PATH, "/messages");
  assert.equal(MESSAGING_MENU_KEY, "communication-messaging");
  assert.equal(MESSAGING_MENU_LEAF.path, "/messages");
});

test("runtime mode: development explicit/default demo", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { MODE: "development", DEV: true, NODE_ENV: "development" },
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.DEMO);
  assert.equal(r.demoAllowed, true);

  const explicit = resolveCommunicationRuntimeMode({
    env: {
      MODE: "development",
      DEV: true,
      VITE_COMMUNICATION_RUNTIME_MODE: "demo",
    },
  });
  assert.equal(explicit.mode, COMMUNICATION_RUNTIME_MODE.DEMO);
});

test("runtime mode: production with certified deps + activation → PRODUCTION", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { MODE: "production", PROD: true, NODE_ENV: "production" },
    productionDependenciesCertified: true,
    activationSnapshot: {
      ...getCommunicationActivationSnapshot(),
      STAGING_MIGRATION_READY: true,
    },
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.PRODUCTION);
  assert.equal(r.demoAllowed, false);
});

test("runtime mode: production missing deps → UNAVAILABLE (no demo fallback)", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { MODE: "production", PROD: true, NODE_ENV: "production" },
    productionDependenciesCertified: false,
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(r.demoAllowed, false);

  const demoEnvRejected = resolveCommunicationRuntimeMode({
    env: {
      MODE: "production",
      PROD: true,
      NODE_ENV: "production",
      VITE_COMMUNICATION_RUNTIME_MODE: "demo",
    },
  });
  assert.equal(demoEnvRejected.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
});

test("runtime mode: query parameter cannot enable demo", () => {
  const r = resolveCommunicationRuntimeMode({
    env: { MODE: "production", PROD: true, NODE_ENV: "production" },
    searchParams: "?commsDemo=1&runtime=demo&demo=true",
  });
  assert.equal(r.mode, COMMUNICATION_RUNTIME_MODE.UNAVAILABLE);
  assert.equal(r.queryParamIgnored, true);
  assert.equal(r.demoAllowed, false);
});

test("bootstrap: provider does not create duplicate gateway for same mode key", async () => {
  resetCommunicationRuntime();
  const first = await bootstrapCommunicationRuntime({
    allowForceMode: true,
    forceMode: COMMUNICATION_RUNTIME_MODE.DEMO,
    env: { NODE_ENV: "test", VITEST: "true" },
    authenticated: true,
    actorParticipantId: "viewer-demo",
  });
  assert.equal(first.ok, true);
  assert.equal(first.reused, false);
  const second = await bootstrapCommunicationRuntime({
    allowForceMode: true,
    forceMode: COMMUNICATION_RUNTIME_MODE.DEMO,
    env: { NODE_ENV: "test", VITEST: "true" },
    authenticated: true,
    actorParticipantId: "viewer-demo",
  });
  assert.equal(second.reused, true);
  assert.equal(second.gateway, first.gateway);
  resetCommunicationRuntime();
  assert.equal(getCommunicationRuntimeStatus().initialized, false);
});

test("unavailable gateway: fail-closed, no demo rows, user-safe message", async () => {
  const gateway = createUnavailableMessagingExperienceGateway({
    reason: "TEST",
  });
  assert.equal(matchesCommunicationExperienceGateway(gateway), true);
  const info = gateway.getAdapterInfo();
  assert.equal(info.adapterKind, UNAVAILABLE_GATEWAY_MARKER.adapterKind);
  assert.equal(info.productionReady, false);
  await assert.rejects(
    () => gateway.listDirectConversations(),
    (err) => {
      assert.equal(
        err.code,
        COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED
      );
      assert.equal(err.message, COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE);
      return true;
    }
  );
  const badge = await gateway.getUnreadBadge();
  assert.equal(badge.unavailable, true);
  assert.equal(badge.direct, 0);
});

test("production gateway rejects missing actor and unactivated composition without allow flag", () => {
  assert.throws(() => createProductionMessagingExperienceGateway({}), (err) => {
    assert.equal(
      err.code,
      COMMUNICATION_FOUNDATION_ERROR_CODE.RUNTIME_NOT_ACTIVATED
    );
    return true;
  });
  assert.throws(
    () =>
      createProductionMessagingExperienceGateway({
        allowUnactivatedComposition: true,
      }),
    (err) => {
      assert.equal(
        err.code,
        COMMUNICATION_FOUNDATION_ERROR_CODE.IDENTITY_INACTIVE
      );
      return true;
    }
  );
});

test("identity: unauthenticated / inactive actor rejected; UI actorId cannot override", async () => {
  const c = createCertifiedComposition("actor-1");
  c.identity.seed("actor-1", false);
  const gateway = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: c.communityMembershipReader,
    playerDisplayPort: c.playerDisplayPort,
    realtimeAdapter: c.realtime,
  });
  await assert.rejects(() => gateway.listDirectConversations());

  c.identity.seed("actor-1", true);
  const gateway2 = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: c.communityMembershipReader,
    playerDisplayPort: c.playerDisplayPort,
    realtimeAdapter: c.realtime,
  });
  const opened = await gateway2.openOrResolveDirectConversation({
    counterpartParticipantId: "peer-a",
    actorParticipantId: "attacker-ui", // must be ignored
  });
  assert.ok(opened.conversationId);
  const msgs = await gateway2.loadMessages({
    conversationId: opened.conversationId,
    scope: "DIRECT",
  });
  assert.equal(Array.isArray(msgs), true);
});

test("authorization: club/community membership unavailable → fail-closed", async () => {
  const c = createCertifiedComposition("actor-1");
  const emptyClub = createMemoryClubMembershipReader([]);
  const gateway = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: emptyClub,
    communityMembershipReader: c.communityMembershipReader,
    realtimeAdapter: c.realtime,
  });
  await assert.rejects(() => gateway.listClubChannels(), (err) => {
    assert.match(String(err.code), /CLUB_MEMBERSHIP|FORBIDDEN|EXPERIENCE/);
    return true;
  });

  const emptyCommunity = createMemoryCommunityMembershipReader([]);
  const gateway2 = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: emptyCommunity,
    realtimeAdapter: c.realtime,
  });
  await assert.rejects(() => gateway2.listCommunityChannels());
});

test("authorization: tenant mismatch on realtime subscribe rejected", async () => {
  const c = createCertifiedComposition("actor-1");
  const gateway = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: c.communityMembershipReader,
    realtimeAdapter: c.realtime,
  });
  const opened = await gateway.openOrResolveDirectConversation({
    counterpartParticipantId: "peer-a",
  });
  await assert.rejects(() =>
    gateway.subscribe({
      conversationId: opened.conversationId,
      tenantId: "other-tenant",
      onSignal: () => {},
    })
  );
});

test("gateway Direct/Club/Community flows + no raw row leakage", async () => {
  const c = createCertifiedComposition("actor-1");
  const gateway = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: c.communityMembershipReader,
    playerDisplayPort: c.playerDisplayPort,
    realtimeAdapter: c.realtime,
  });
  assert.equal(matchesCommunicationExperienceGateway(gateway), true);
  assert.equal(gateway.getAdapterInfo().adapterKind, PRODUCTION_GATEWAY_MARKER.adapterKind);

  const direct = await gateway.openOrResolveDirectConversation({
    counterpartParticipantId: "peer-a",
  });
  assert.equal(assertNotRawPersistenceRow(direct), true);
  assert.ok(!("email" in direct));
  assert.ok(!("rawRow" in direct));

  const sent = await gateway.sendMessage({
    conversationId: direct.conversationId,
    scope: "DIRECT",
    body: "Hello production composition",
  });
  assert.ok(sent.messageId);
  await gateway.markRead({
    conversationId: direct.conversationId,
    scope: "DIRECT",
    lastReadMessageId: sent.messageId,
  });

  const requests = await gateway.listDirectRequests();
  assert.equal(Array.isArray(requests), true);

  const defaults = await c.clubApp.clubCommunication.createOrResolveDefaultClubChannels({
    clubId: "club-1",
    actorParticipantId: "actor-1",
  });
  const general =
    defaults.channels.find((ch) => ch.channelKind === CLUB_CHANNEL_KIND.GENERAL) ||
    defaults.channels[0];
  const clubChannels = await gateway.listClubChannels();
  assert.ok(clubChannels.length >= 1);
  assert.equal(assertNotRawPersistenceRow(clubChannels[0]), true);
  await gateway.sendMessage({
    conversationId: general.conversation.conversationId,
    scope: "CLUB",
    body: "Club ping",
  });

  const lobby = await c.communityApp.communityCommunication.createOrResolveCommunityLobby({
    tenantId: "tenant-1",
    actorParticipantId: "actor-1",
  });
  await gateway.joinCommunityChannel({
    conversationId: lobby.channel.conversation.conversationId,
  });
  await gateway.sendMessage({
    conversationId: lobby.channel.conversation.conversationId,
    scope: "COMMUNITY",
    body: "Community hello",
  });
  const communities = await gateway.listCommunityChannels();
  assert.ok(communities.length >= 1);
});

test("realtime signal → reload contract; out-of-scope/duplicate suppressed; unsubscribe", async () => {
  const c = createCertifiedComposition("actor-1");
  const gateway = createProductionMessagingExperienceGateway({
    allowUnactivatedComposition: true,
    actorParticipantId: "actor-1",
    tenantId: "tenant-1",
    clubId: "club-1",
    directApp: c.directApp,
    clubApp: c.clubApp,
    communityApp: c.communityApp,
    identityActorPort: c.identity,
    clubMembershipReader: c.clubMembershipReader,
    communityMembershipReader: c.communityMembershipReader,
    realtimeAdapter: c.realtime,
  });
  const opened = await gateway.openOrResolveDirectConversation({
    counterpartParticipantId: "peer-a",
  });
  let signals = 0;
  const sub = await gateway.subscribe({
    conversationId: opened.conversationId,
    onSignal: (evt) => {
      assert.equal(evt.signalOnly, true);
      signals += 1;
    },
  });
  await c.realtime.publishConversationEvent(opened.conversationId, {
    eventId: "evt-1",
    eventType: "MESSAGE_CREATED",
    signalOnly: true,
    schemaVersion: 1,
    conversationId: opened.conversationId,
    occurredAt: c.clock.now(),
    payload: {},
  });
  await c.realtime.publishConversationEvent(opened.conversationId, {
    eventId: "evt-1",
    eventType: "MESSAGE_CREATED",
    signalOnly: true,
    schemaVersion: 1,
    conversationId: opened.conversationId,
    occurredAt: c.clock.now(),
    payload: {},
  });
  await c.realtime.publishConversationEvent("other-conv", {
    eventId: "evt-x",
    eventType: "MESSAGE_CREATED",
    signalOnly: true,
    schemaVersion: 1,
    conversationId: "other-conv",
    occurredAt: c.clock.now(),
    payload: {},
  });
  assert.equal(signals, 1);
  await gateway.unsubscribe({ conversationId: opened.conversationId });
  assert.equal(gateway.__production.activeSubscriptionCount(), 0);
  assert.equal(typeof sub.unsubscribe, "function");
});

test("experience error mapping distinctions + safe diagnostic", () => {
  const mapped = mapToCommunicationExperienceError(
    createRuntimeNotActivatedError("corr-1"),
    { operation: "list", correlationId: "corr-1" }
  );
  assert.equal(
    mapped.code,
    COMMUNICATION_EXPERIENCE_ERROR_CODE.NOT_ACTIVATED
  );
  assert.equal(mapped.message, COMMUNICATION_RUNTIME_UNAVAILABLE_USER_MESSAGE);

  const forbidden = mapToCommunicationExperienceError(
    {
      name: "CommunicationFoundationError",
      code: COMMUNICATION_FOUNDATION_ERROR_CODE.CLUB_MEMBERSHIP_DENIED,
      message: "denied",
    },
    { operation: "club" }
  );
  assert.equal(forbidden.code, COMMUNICATION_EXPERIENCE_ERROR_CODE.FORBIDDEN);

  const diag = createSafeCommunicationDiagnosticEvent({
    code: "X",
    operation: "send",
    conversationId: "c1",
  });
  assert.ok(!("body" in diag));
  assert.ok(!("token" in diag));
  assert.ok(!("email" in diag));
});

test("text-only rendering + demo isolation markers", () => {
  assert.equal(
    sanitizeMessageBodyForDisplay("<b>Hi</b> & text"),
    "Hi & text"
  );
  const demo = createDemoMessagingExperienceGateway();
  assert.equal(demo.getAdapterInfo().productionReady, false);
  const unavailable = createUnavailableMessagingExperienceGateway();
  assert.notEqual(
    unavailable.getAdapterInfo().adapterKind,
    demo.getAdapterInfo().adapterKind
  );
});

test("route/menu registration + MainLayout runtime provider wiring", () => {
  const routerSrc = fs.readFileSync(path.join(ROOT, "src/router.jsx"), "utf8");
  assert.match(routerSrc, /path="\/messages"/);
  assert.match(routerSrc, /MessagingExperiencePage/);
  assert.match(routerSrc, /path="\/crm\/messages"/);
  const layout = fs.readFileSync(
    path.join(ROOT, "src/layouts/MainLayout.jsx"),
    "utf8"
  );
  assert.match(layout, /CommunicationRuntimeProvider/);
  const menu = fs.readFileSync(
    path.join(ROOT, "src/config/v5Menu/messagingMenu.js"),
    "utf8"
  );
  assert.match(menu, /communication-messaging/);
  assert.match(menu, /\/messages/);
});

test("activation snapshot remains blocked for remote gates", () => {
  const snap = getCommunicationActivationSnapshot();
  assert.equal(snap.STAGING_MIGRATION_READY, false);
  assert.equal(snap.PRODUCTION_READY, false);
  assert.equal(snap.REALTIME_ACTIVATION_READY, false);
  assert.equal(COMMUNICATION_FOUNDATION_PHASE.clientRlsPolicy, "FAIL_CLOSED");
});

test("docs and SQL package present; no remote apply scripts added", () => {
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs/communication-foundation/comms-07/07_INTEGRATION_FINAL_CERTIFICATION.md"
      )
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        ROOT,
        "docs/communication-foundation/comms-07/07_STAGING_ACTIVATION_RUNBOOK.md"
      )
    )
  );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  );
  assert.ok(!JSON.stringify(pkg.scripts || {}).includes("supabase db push"));
});
