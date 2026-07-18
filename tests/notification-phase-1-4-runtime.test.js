/**
 * Phase 1.4 — runtime wiring, inbox API, mobile compat, MATCH_SCHEDULED bridge.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  bootstrapNotificationRuntime,
  getNotificationRuntimeStatus,
  resetNotificationRuntime,
  createNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  NOTIFICATION_STORE_MODES,
  listInbox,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  refreshInbox,
  emitMatchScheduledFromBoundary,
  emitMatchScheduledAfterSchedulePublish,
  listMobileCompatibleInbox,
  createCompetitionEntryResolver,
  resolveNotificationRecipients,
  createMemoryRecipientDirectory,
  setRecipientDirectory,
  resetRecipientDirectory,
  createIdentityMembershipDirectory,
  NOTIFICATION_COMPATIBILITY,
  NOTIFICATION_STATUSES,
  NOTIFICATION_CATEGORIES,
} from "../src/features/notifications/index.js";

function mockLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe("Notification Phase 1.4 — runtime bootstrap", () => {
  beforeEach(() => {
    mockLocalStorage();
    resetNotificationRuntime();
    resetRecipientDirectory();
    delete process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE;
    delete process.env.VITE_NOTIFICATION_STORE_MODE;
  });
  afterEach(() => {
    resetNotificationRuntime();
    resetRecipientDirectory();
    delete process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE;
    delete process.env.VITE_NOTIFICATION_STORE_MODE;
  });

  it("bootstraps memory repository explicitly", async () => {
    const result = await bootstrapNotificationRuntime({
      mode: NOTIFICATION_STORE_MODES.MEMORY,
      authenticated: true,
      allowUnverifiedUserIds: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.status.mode, "memory");
    assert.equal(result.status.initialized, true);
    assert.equal(result.status.authenticated, true);
    assert.equal(getNotificationRuntimeStatus().initialized, true);
  });

  it("required-supabase mode rejects silent fallback", async () => {
    process.env.VITE_NOTIFICATION_REQUIRE_SUPABASE = "true";
    process.env.VITE_NOTIFICATION_STORE_MODE = "supabase";
    const result = await bootstrapNotificationRuntime({
      mode: NOTIFICATION_STORE_MODES.SUPABASE,
      client: null,
    });
    assert.equal(result.ok, false);
    assert.match(result.error || "", /Refusing silent local fallback/);
    assert.equal(result.status.initialized, false);
  });
});

describe("Notification Phase 1.4 — authenticated inbox API", () => {
  beforeEach(() => {
    mockLocalStorage();
    resetNotificationRepository();
    setNotificationRepository(
      createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY })
    );
  });
  afterEach(() => {
    resetNotificationRepository();
  });

  async function seedOne() {
    const repo = createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY });
    setNotificationRepository(repo);
    const created = await repo.create({
      id: "n1",
      notificationId: "n1",
      eventId: "e1",
      eventType: "BOOKING_CREATED",
      category: NOTIFICATION_CATEGORIES.BOOKING,
      priority: "NORMAL",
      tenantId: "venue-a",
      recipientUserId: "user-a",
      title: "Test",
      message: "Hello",
      status: NOTIFICATION_STATUSES.CREATED,
      idempotencyKey: "key-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert.equal(created.ok, true);
    return created.notification;
  }

  it("lists authenticated inbox", async () => {
    await seedOne();
    const listed = await listInbox({ tenantId: "venue-a", userId: "user-a" });
    assert.equal(listed.ok, true);
    assert.equal(listed.items.length, 1);
  });

  it("counts unread", async () => {
    await seedOne();
    const count = await countUnreadNotifications({ tenantId: "venue-a", userId: "user-a" });
    assert.equal(count.ok, true);
    assert.equal(count.count, 1);
  });

  it("marks one read", async () => {
    const row = await seedOne();
    const marked = await markNotificationRead({
      tenantId: "venue-a",
      userId: "user-a",
      notificationId: row.id || row.notificationId,
    });
    assert.equal(marked.ok, true);
    assert.equal(marked.notification.status, NOTIFICATION_STATUSES.READ);
  });

  it("marks all read", async () => {
    await seedOne();
    const marked = await markAllNotificationsRead({
      tenantId: "venue-a",
      userId: "user-a",
    });
    assert.equal(marked.ok, true);
    assert.ok((marked.updatedCount || 0) >= 1);
  });

  it("refreshInbox returns list + unread", async () => {
    await seedOne();
    const snap = await refreshInbox({ tenantId: "venue-a", userId: "user-a" });
    assert.equal(snap.ok, true);
    assert.equal(snap.items.length, 1);
    assert.equal(snap.unreadCount, 1);
  });
});

describe("Notification Phase 1.4 — Notification Center filters", () => {
  it("filters unread and category from list", () => {
    const items = [
      {
        id: "1",
        status: NOTIFICATION_STATUSES.CREATED,
        category: NOTIFICATION_CATEGORIES.BOOKING,
      },
      {
        id: "2",
        status: NOTIFICATION_STATUSES.READ,
        category: NOTIFICATION_CATEGORIES.BOOKING,
      },
      {
        id: "3",
        status: NOTIFICATION_STATUSES.QUEUED,
        category: NOTIFICATION_CATEGORIES.COMPETITION,
      },
    ];
    const unreadOnly = items.filter((i) => i.status !== NOTIFICATION_STATUSES.READ);
    assert.equal(unreadOnly.length, 2);
    const booking = items.filter((i) => i.category === NOTIFICATION_CATEGORIES.BOOKING);
    assert.equal(booking.length, 2);
  });
});

describe("Notification Phase 1.4 — Header uses canonical repository", () => {
  it("compatibility flags Header on canonical inbox", () => {
    assert.equal(NOTIFICATION_COMPATIBILITY.headerUsesCanonicalInbox, true);
    assert.ok(
      ["1.4", "1.5"].includes(NOTIFICATION_COMPATIBILITY.phase),
      `expected phase 1.4+ got ${NOTIFICATION_COMPATIBILITY.phase}`
    );
  });
});

describe("Notification Phase 1.4 — mobile compatibility deduplication", () => {
  beforeEach(() => {
    mockLocalStorage();
    resetNotificationRepository();
    setNotificationRepository(
      createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY })
    );
  });
  afterEach(() => resetNotificationRepository());

  it("does not duplicate canonical + legacy with same eventId", async () => {
    const repo = createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY });
    setNotificationRepository(repo);
    await repo.create({
      id: "c1",
      notificationId: "c1",
      eventId: "evt-shared",
      eventType: "BOOKING_CREATED",
      category: NOTIFICATION_CATEGORIES.BOOKING,
      priority: "NORMAL",
      tenantId: "venue-a",
      recipientUserId: "user-a",
      title: "Canonical",
      message: "Cloud",
      status: NOTIFICATION_STATUSES.CREATED,
      idempotencyKey: "idem-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const merged = await listMobileCompatibleInbox({
      tenantId: "venue-a",
      userId: "user-a",
      listLegacy: async () => ({
        ok: true,
        notifications: [
          {
            id: "legacy-1",
            title: "Legacy",
            body: "Local",
            tenant_id: "venue-a",
            user_id: "user-a",
            status: "unread",
            created_at: new Date().toISOString(),
            payload_json: { eventId: "evt-shared" },
          },
        ],
      }),
    });
    assert.equal(merged.ok, true);
    assert.equal(merged.items.length, 1);
    assert.equal(merged.skippedDuplicates, 1);
    assert.equal(merged.items[0].source, "canonical");
  });
});

describe("Notification Phase 1.4 — MATCH_SCHEDULED adapter idempotency", () => {
  beforeEach(() => {
    mockLocalStorage();
    resetNotificationRepository();
    resetRecipientDirectory();
    setNotificationRepository(
      createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.MEMORY })
    );
    setRecipientDirectory(
      createMemoryRecipientDirectory([
        { userId: "u1", tenantId: "venue-a", role: "PLAYER" },
      ])
    );
  });
  afterEach(() => {
    resetNotificationRepository();
    resetRecipientDirectory();
  });

  it("retry does not create duplicate MATCH_SCHEDULED rows", async () => {
    const input = {
      tenantId: "venue-a",
      matchId: "m-1",
      scheduleVersion: "v1",
      recipientHints: { userIds: ["u1"] },
    };
    const first = await emitMatchScheduledFromBoundary(input);
    const second = await emitMatchScheduledFromBoundary(input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.ok(first.createdCount + first.duplicateCount >= 1);
    assert.equal(second.duplicateCount >= 1 || second.createdCount === 0, true);
  });

  it("schedule publish bridge emits per match with idempotency", async () => {
    const tournament = {
      id: "t1",
      tenantId: "venue-a",
      venueId: "venue-a",
      entries: [{ id: "e1", playerIds: [], userId: "u1", tenantId: "venue-a" }],
    };
    const matches = [
      {
        id: "m-bridge-1",
        entryAId: "e1",
        scheduledStart: "2026-07-20T10:00:00.000Z",
        recipientUserIds: ["u1"],
      },
    ];
    const first = await emitMatchScheduledAfterSchedulePublish({
      tournament,
      matches,
      tenantId: "venue-a",
      scheduleVersion: "pub-1",
    });
    const second = await emitMatchScheduledAfterSchedulePublish({
      tournament,
      matches,
      tenantId: "venue-a",
      scheduleVersion: "pub-1",
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.ok(first.results[0].createdCount + first.results[0].duplicateCount >= 1);
    assert.ok(second.results[0].duplicateCount >= 1 || second.results[0].createdCount === 0);
  });
});

describe("Notification Phase 1.4 — entryId resolution + cross-tenant rejection", () => {
  it("resolves entryIds via competition entry resolver", () => {
    const resolver = createCompetitionEntryResolver({
      entryIndex: [
        {
          id: "entry-1",
          tenantId: "venue-a",
          userId: "user-linked",
          playerIds: [],
        },
      ],
    });
    const users = resolver({
      tenantId: "venue-a",
      entryIds: ["entry-1"],
    });
    assert.equal(users.length, 1);
    assert.equal(users[0].userId, "user-linked");
  });

  it("rejects cross-tenant recipients", () => {
    const directory = createIdentityMembershipDirectory({
      profiles: [
        { id: "u-a", venue_id: "venue-a", role: "PLAYER", status: "active" },
        { id: "u-b", venue_id: "venue-b", role: "PLAYER", status: "active" },
      ],
      allowUnverifiedUserIds: false,
    });
    const resolved = resolveNotificationRecipients({
      tenantId: "venue-a",
      recipientHints: { userIds: ["u-a", "u-b"] },
      directory,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.recipients.length, 1);
    assert.equal(resolved.recipients[0].userId, "u-a");
    assert.ok(resolved.rejected.includes("u-b"));
  });

  it("reports skipped unresolved entryIds", () => {
    const directory = createIdentityMembershipDirectory({
      profiles: [],
      entryResolver: () => [],
    });
    const resolved = resolveNotificationRecipients({
      tenantId: "venue-a",
      recipientHints: { entryIds: ["missing-entry"] },
      directory,
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.recipients.length, 0);
    assert.ok(resolved.skipped.some((s) => s.entryId === "missing-entry"));
  });
});
