import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  emitDomainNotificationEvent,
  listInbox,
  markNotificationRead,
  countUnreadNotifications,
  enqueueNotificationDelivery,
  listQueuedDeliveryJobs,
  markDeliveryJobResult,
  DELIVERY_CHANNELS,
  DELIVERY_JOB_STATUSES,
  createNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  NOTIFICATION_STORE_MODES,
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_STATUSES,
  NOTIFICATION_CATEGORIES,
  createMemoryRecipientDirectory,
  setRecipientDirectory,
  resetRecipientDirectory,
  createIdentityMembershipDirectory,
  buildNotificationIdempotencyKey,
} from "../src/features/notifications/index.js";
import { clearNotificationInboxStorage } from "../src/features/notifications/storage/notificationInboxStorage.js";
import { clearLocalDeliveryJobsStorage } from "../src/features/notifications/repositories/localNotificationRepository.js";
import { rowToInboxRecord } from "../src/features/notifications/repositories/notificationRowMap.js";

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  clearNotificationInboxStorage();
  clearLocalDeliveryJobsStorage();
  resetRecipientDirectory();
  setNotificationRepository(
    createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY })
  );
});

afterEach(() => {
  resetNotificationRepository();
  clearNotificationInboxStorage();
  clearLocalDeliveryJobsStorage();
  resetRecipientDirectory();
  delete globalThis.localStorage;
});

describe("Notification Phase 1.3 — repository", () => {
  it("create / list / markRead / markAllRead / countUnread", async () => {
    const repo = createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY });
    setNotificationRepository(repo);

    const created = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.BOOKING_CREATED,
      idempotencyKey: "t1:BOOKING_CREATED:b1:v1",
      recipientHints: { userIds: ["u1", "u2"] },
      payload: { customerName: "A", courtName: "Sân 1", startTime: "09:00" },
      repository: repo,
    });
    assert.equal(created.createdCount, 2);

    const listed = await listInbox({ tenantId: "t1", userId: "u1", repository: repo });
    assert.equal(listed.items.length, 1);

    const unread = await countUnreadNotifications({
      tenantId: "t1",
      userId: "u1",
      repository: repo,
    });
    assert.equal(unread.count, 1);

    const marked = await markNotificationRead({
      tenantId: "t1",
      notificationId: listed.items[0].notificationId,
      userId: "u1",
      repository: repo,
    });
    assert.equal(marked.ok, true);
    assert.equal(marked.notification.status, NOTIFICATION_STATUSES.READ);

    const unreadAfter = await countUnreadNotifications({
      tenantId: "t1",
      userId: "u1",
      repository: repo,
    });
    assert.equal(unreadAfter.count, 0);
  });

  it("maps supabase row shape to domain record", () => {
    const mapped = rowToInboxRecord({
      id: "11111111-1111-1111-1111-111111111111",
      event_id: "e1",
      event_type: "MATCH_SCHEDULED",
      category: "COMPETITION",
      priority: "NORMAL",
      tenant_id: "t1",
      venue_id: null,
      club_id: null,
      competition_id: "c1",
      recipient_user_id: "22222222-2222-2222-2222-222222222222",
      actor_user_id: null,
      title: "Lịch trận",
      message: "Đã xếp",
      status: "CREATED",
      read_at: null,
      created_at: "2026-07-18T00:00:00.000Z",
      updated_at: "2026-07-18T00:00:00.000Z",
      idempotency_key: "key",
      source_entity_type: "match",
      source_entity_id: "m1",
      metadata: { domainSource: "test" },
    });
    assert.equal(mapped.notificationId, "11111111-1111-1111-1111-111111111111");
    assert.equal(mapped.eventType, "MATCH_SCHEDULED");
    assert.equal(mapped.category, NOTIFICATION_CATEGORIES.COMPETITION);
    assert.equal(mapped.recipientUserId, "22222222-2222-2222-2222-222222222222");
  });
});

describe("Notification Phase 1.3 — identity directory", () => {
  it("resolves roles from real profile cache (no hard-coded fake runtime users)", async () => {
    const directory = createIdentityMembershipDirectory({
      profiles: [
        {
          id: "owner-1",
          venue_id: "t1",
          role: "COURT_OWNER",
          status: "active",
        },
        {
          id: "player-1",
          venue_id: "t1",
          role: "PLAYER",
          status: "active",
        },
        {
          id: "owner-other",
          venue_id: "t2",
          role: "COURT_OWNER",
          status: "active",
        },
      ],
    });
    setRecipientDirectory(directory);

    const result = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.BOOKING_CREATED,
      idempotencyKey: buildNotificationIdempotencyKey({
        tenantId: "t1",
        eventType: NOTIFICATION_EVENT_TYPES.BOOKING_CREATED,
        entityId: "bk-id",
        version: "v1",
      }),
      recipientHints: { roles: ["COURT_OWNER"] },
      payload: { customerName: "Lan", courtName: "Sân 2", startTime: "10:00" },
      directory,
    });

    assert.equal(result.createdCount, 1);
    assert.equal(result.notifications[0].recipientUserId, "owner-1");
  });

  it("rejects userIds not present in identity cache when cache is populated", async () => {
    const directory = createIdentityMembershipDirectory({
      profiles: [{ id: "known", venue_id: "t1", role: "PLAYER", status: "active" }],
      allowUnverifiedUserIds: false,
    });
    const result = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_CONFIRMED,
      idempotencyKey: "t1:PAYMENT_CONFIRMED:tx:confirmed",
      recipientHints: { userIds: ["known", "unknown"] },
      payload: { amountLabel: "10k" },
      directory,
    });
    assert.equal(result.createdCount, 1);
    assert.ok(result.rejectedRecipientIds.includes("unknown"));
  });
});

describe("Notification Phase 1.3 — queue foundation", () => {
  it("enqueues CREATED → QUEUED without live providers", async () => {
    const repo = createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY });
    setNotificationRepository(repo);

    const result = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.MATCH_SCHEDULED,
      idempotencyKey: "t1:MATCH_SCHEDULED:m9:v1",
      recipientHints: { userIds: ["u1"] },
      payload: { matchId: "m9", scheduledAt: "09:00" },
      repository: repo,
    });

    assert.equal(result.createdCount, 1);
    assert.equal(result.notifications[0].status, NOTIFICATION_STATUSES.QUEUED);

    const queued = await listQueuedDeliveryJobs({ tenantId: "t1", repository: repo });
    assert.equal(queued.items.length, 1);
    assert.equal(queued.items[0].channel, DELIVERY_CHANNELS.IN_APP);
    assert.equal(queued.items[0].status, DELIVERY_JOB_STATUSES.QUEUED);
  });

  it("markDeliveryJobResult can move job to SENT/FAILED without providers", async () => {
    const repo = createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY });
    const emit = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
      idempotencyKey: "t1:PAYMENT_FAILED:tx:failed",
      recipientHints: { userIds: ["u1"] },
      payload: { reason: "timeout" },
      repository: repo,
      skipQueue: true,
    });
    assert.equal(emit.notifications[0].status, NOTIFICATION_STATUSES.CREATED);

    const enq = await enqueueNotificationDelivery({
      notificationId: emit.notifications[0].notificationId,
      tenantId: "t1",
      repository: repo,
    });
    assert.equal(enq.ok, true);

    const marked = await markDeliveryJobResult({
      jobId: enq.job.id,
      status: DELIVERY_JOB_STATUSES.FAILED,
      lastError: "provider not configured",
      repository: repo,
    });
    assert.equal(marked.ok, true);
    assert.equal(marked.job.status, DELIVERY_JOB_STATUSES.FAILED);

    const inbox = await listInbox({ tenantId: "t1", repository: repo });
    assert.equal(inbox.items[0].status, NOTIFICATION_STATUSES.FAILED);
  });

  it("does not expose live providers on public API queue path", async () => {
    const api = await import("../src/features/notifications/index.js");
    assert.equal(api.EmailProvider, undefined);
    assert.equal(api.resolveNotificationProvider, undefined);
    assert.equal(typeof api.enqueueNotificationDelivery, "function");
    assert.equal(typeof api.countUnreadNotifications, "function");
  });
});

describe("Notification Phase 1.3 — memory directory still works for tests", () => {
  it("memory recipient directory remains injectable", async () => {
    setRecipientDirectory(
      createMemoryRecipientDirectory([
        { userId: "a", tenantId: "t1", role: "CASHIER" },
      ])
    );
    const result = await emitDomainNotificationEvent({
      tenantId: "t1",
      eventType: NOTIFICATION_EVENT_TYPES.BOOKING_CANCELLED,
      idempotencyKey: "t1:BOOKING_CANCELLED:x:v1",
      recipientHints: { roles: ["CASHIER"] },
      payload: { courtName: "Sân 1", startTime: "08:00" },
    });
    assert.equal(result.createdCount, 1);
  });
});
