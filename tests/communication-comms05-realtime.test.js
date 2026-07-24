/**
 * COMMS-05 realtime foundation tests (no remote websocket).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  COMMUNICATION_ACTIVATION_STATUS,
  assertActivationAllowed,
  createCommunicationRealtimeEventEnvelope,
  createConversationRealtimeSubscriptionDescriptor,
  createInMemoryRealtimeDeliveryAdapter,
  createScopedRealtimeDeliveryAdapter,
  createCommunicationPersistenceEventIntent,
  createCommunicationPersistenceEventRepository,
  createFakeSupabaseCommunicationClient,
  matchesRealtimeDeliveryPort,
  getCommunicationActivationSnapshot,
} from "../src/features/communication/index.js";

test("subscription descriptor requires authorization and stays conversation-scoped", () => {
  assert.throws(
    () =>
      createConversationRealtimeSubscriptionDescriptor({
        conversationId: "conv-1",
        actorParticipantId: "user-a",
        authorized: false,
      }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_SUBSCRIPTION_DENIED
  );

  const descriptor = createConversationRealtimeSubscriptionDescriptor({
    conversationId: "conv-1",
    actorParticipantId: "user-a",
    authorized: true,
    tenantId: "tenant-1",
  });
  assert.equal(descriptor.scope, "conversation");
  assert.equal(descriptor.channelName, "comms:conversation:conv-1");
  assert.equal(descriptor.filter, "conversation_id=eq.conv-1");
  assert.equal(descriptor.remotePublicationEnabled, false);
  assert.match(descriptor.table, /^communication_/);
});

test("unauthorized subscribe is rejected; authorized publish delivers envelope", async () => {
  const rt = createInMemoryRealtimeDeliveryAdapter({
    authorizeSubscribe: (conversationId, actor) =>
      conversationId === "conv-1" && actor === "user-a",
    idProvider: { nextId: () => "evt-fixed" },
    clock: { now: () => "2026-07-24T00:00:00.000Z" },
  });
  assert.equal(matchesRealtimeDeliveryPort(rt), true);

  await assert.rejects(
    () => rt.subscribeConversation("conv-1", () => {}, { actorParticipantId: "user-b" }),
    (err) =>
      err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.REALTIME_SUBSCRIPTION_DENIED
  );

  /** @type {object[]} */
  const received = [];
  const sub = await rt.subscribeConversation(
    "conv-1",
    (event) => {
      received.push(event);
    },
    { actorParticipantId: "user-a" }
  );
  assert.equal(sub.descriptor.conversationId, "conv-1");

  await rt.publishConversationEvent("conv-1", {
    eventType: "MESSAGE_CREATED",
    payload: { messageId: "m1" },
  });
  assert.equal(received.length, 1);
  assert.equal(received[0].signalOnly, true);
  assert.equal(received[0].eventType, "MESSAGE_CREATED");
  assert.equal(received[0].conversationId, "conv-1");

  sub.unsubscribe();
  await rt.publishConversationEvent("conv-1", {
    eventType: "READ_STATE_CHANGED",
    payload: {},
  });
  assert.equal(received.length, 1);
});

test("scoped adapter and activation gates remain fail-closed for remote activation", () => {
  const scoped = createScopedRealtimeDeliveryAdapter({
    authorizeSubscribe: async () => true,
  });
  assert.equal(matchesRealtimeDeliveryPort(scoped), true);

  const snap = getCommunicationActivationSnapshot();
  assert.equal(snap.REALTIME_PUBLICATION, "DEFERRED_NOT_ENABLED");
  assert.equal(snap.CLIENT_RLS_POLICY, "DEFERRED_FAIL_CLOSED");
  assert.equal(snap.SQL_APPLY, "DEFERRED_STAGING_FIRST_GATE");
  assert.equal(COMMUNICATION_ACTIVATION_STATUS.STAGING_MIGRATION_READY, false);

  assert.throws(
    () => assertActivationAllowed("REALTIME_PUBLICATION"),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.ACTIVATION_GATE_BLOCKED
  );
});

test("persistence event intent records deferred notification gate without delivering", async () => {
  const intent = createCommunicationPersistenceEventIntent({
    eventId: "pe-1",
    conversationId: "conv-1",
    eventType: "MESSAGE_CREATED",
    occurredAt: "2026-07-24T00:00:00.000Z",
    deliveryIntent: "DEFERRED_NOTIFICATION",
    payload: { messageId: "m1" },
  });
  assert.equal(intent.deliveryIntent, "DEFERRED_NOTIFICATION");

  const client = createFakeSupabaseCommunicationClient();
  const repo = createCommunicationPersistenceEventRepository(client);
  const saved = await repo.append(intent);
  assert.equal(saved.eventId, "pe-1");
  const rows = client.getRows("communication_persistence_events");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].delivery_intent, "DEFERRED_NOTIFICATION");
});

test("envelope rejects unknown event types", () => {
  assert.throws(
    () =>
      createCommunicationRealtimeEventEnvelope({
        eventId: "e1",
        conversationId: "c1",
        eventType: "NOT_A_REAL_EVENT",
        occurredAt: "2026-07-24T00:00:00.000Z",
      }),
    (err) => err.code === COMMUNICATION_FOUNDATION_ERROR_CODE.INVALID_CONTRACT
  );
});
