import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  buildQrPayload,
  parseQrPayload,
  createQrToken,
  validateQrToken,
} from "../src/features/mobile/services/qrTokenService.js";
import {
  processQrCheckin,
  getCheckinDashboard,
  buildCheckinSummaryForPlayers,
} from "../src/features/mobile/services/checkInService.js";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  getPendingQueueCount,
  getOfflineQueueStatusSummary,
  OFFLINE_ACTION_TYPES,
} from "../src/features/mobile/services/offlineQueue.js";
import {
  getNotificationPreferences,
  setNotificationPreference,
  createLocalNotification,
  filterNotificationsByRole,
} from "../src/features/mobile/services/notificationService.js";
import {
  snapshotClubDataForOffline,
  loadClubOfflineSnapshot,
  getOfflineSnapshotSummary,
  resetOfflineDbForTests,
} from "../src/features/mobile/services/offlineCache.js";
import { buildPwaInstallBannerModel } from "../src/features/mobile/utils/pwaInstallState.js";
import { buildOfflineQueueBannerModel } from "../src/features/mobile/utils/offlineQueueStatus.js";
import { CHECKIN_STATUS } from "../src/features/mobile/constants/checkInStatus.js";
import { NOTIFICATION_TYPES } from "../src/features/mobile/constants/notificationTypes.js";
import { QR_ENTITY_TYPES } from "../src/features/mobile/constants/qrEntityTypes.js";
import { signInAs } from "../src/auth/authService.js";
import { ROLES } from "../src/auth/roles.js";
import { resetOfflineQueueForTests } from "../src/features/mobile/services/offlineQueue.js";

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

function createIndexedDbMock() {
  const stores = new Map();

  function createStore(name) {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
    return stores.get(name);
  }

  function createDb() {
    return {
      objectStoreNames: {
        contains(name) {
          return stores.has(name);
        },
      },
      createObjectStore(name) {
        return createStore(name);
      },
      transaction(name) {
        const store = createStore(name);
        const tx = {
          objectStore() {
            return {
              put(value, key) {
                store.set(key, value);
              },
              get(key) {
                return store.get(key);
              },
              delete(key) {
                store.delete(key);
              },
            };
          },
          oncomplete: null,
          onerror: null,
        };
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
        return tx;
      },
    };
  }

  return {
    open() {
      const request = {
        result: createDb(),
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.({ target: request });
        request.onsuccess?.();
      });
      return request;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "test" },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete globalThis.indexedDB;
  resetOfflineDbForTests();
});

describe("mobile sprint 9 — QR tokens", () => {
  it("builds and parses opaque QR payload", () => {
    const payload = buildQrPayload("abc123def456789012345678");
    const parsed = parseQrPayload(payload);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.token, "abc123def456789012345678");
  });

  it("rejects non-system QR payload", () => {
    const parsed = parseQrPayload("https://example.com/foo");
    assert.equal(parsed.ok, false);
  });

  it("creates and validates QR token", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-1",
      tenantId: "tenant-a",
    });
    assert.equal(created.ok, true);
    assert.ok(created.payload.startsWith("pbs://checkin/"));

    const valid = await validateQrToken(created.rawToken, { expectedTenantId: "tenant-a" });
    assert.equal(valid.ok, true);
    assert.equal(valid.record.entity_id, "player-1");
  });

  it("rejects QR from wrong tenant", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-2",
      tenantId: "tenant-a",
    });
    const valid = await validateQrToken(created.rawToken, { expectedTenantId: "tenant-b" });
    assert.equal(valid.ok, false);
    assert.equal(valid.code, "WRONG_TENANT");
  });

  it("rejects expired QR token", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.MATCH,
      entityId: "match-1",
      tenantId: "tenant-a",
      ttlHours: -1,
    });
    const valid = await validateQrToken(created.rawToken);
    assert.equal(valid.ok, false);
    assert.equal(valid.code, "EXPIRED");
  });
});

describe("mobile sprint 9 — check-in", () => {
  it("processes valid QR check-in", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-checkin-1",
      tenantId: "tenant-a",
    });

    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      clubId: "club-1",
      registeredPlayerIds: ["player-checkin-1"],
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, CHECKIN_STATUS.CHECKED_IN);
  });

  it("detects duplicate check-in", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-dup",
      tenantId: "tenant-a",
    });

    const first = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
    });
    assert.equal(first.ok, true);

    const second = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "DUPLICATE");
  });

  it("rejects unregistered player", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-x",
      tenantId: "tenant-a",
    });

    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      registeredPlayerIds: ["player-y"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_REGISTERED");
  });

  it("builds check-in dashboard summary", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "p1",
      tenantId: "tenant-a",
    });
    await processQrCheckin({ rawToken: created.rawToken, tenantId: "tenant-a" });

    const dashboard = await getCheckinDashboard({ tenantId: "tenant-a" });
    assert.equal(dashboard.ok, true);
    assert.ok(dashboard.checkins.length >= 1);

    const summary = buildCheckinSummaryForPlayers({
      players: [{ id: "p1", name: "Test" }, { id: "p2", name: "Other" }],
      checkins: dashboard.checkins,
      registeredIds: ["p1", "p2"],
    });
    assert.equal(summary.totalRegistered, 2);
    assert.equal(summary.checkedIn, 1);
    assert.equal(summary.notCheckedIn, 1);
  });
});

describe("mobile sprint 9 — offline queue", () => {
  beforeEach(() => {
    resetOfflineQueueForTests();
    signInAs({
      id: "mobile-s9-offline-user",
      role: ROLES.PLAYER,
      venueId: "tenant-a",
      tenantId: "tenant-a",
      status: "active",
    });
  });

  it("enqueues and flushes offline actions", async () => {
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "m1", note: "test" },
      tenantId: "tenant-a",
    });
    assert.equal(getPendingQueueCount(), 1);

    const result = await flushOfflineQueue();
    assert.equal(result.ok, true);
    assert.equal(result.synced, 1);
  });

  it("does not flush when offline", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false, userAgent: "test" },
      configurable: true,
      writable: true,
    });
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "m2" },
      tenantId: "tenant-a",
    });
    const result = await flushOfflineQueue();
    assert.equal(result.ok, false);
    assert.equal(result.code, "OFFLINE");
  });

  it("exposes the latest sync result in the queue summary", () => {
    globalThis.localStorage.setItem(
      "pickleball-offline-queue-meta-v1",
      JSON.stringify({
        lastSyncAt: "2026-07-01T10:00:00.000Z",
        lastSyncResult: { synced: 2, failed: 1, conflicts: 1 },
      })
    );

    const summary = getOfflineQueueStatusSummary();
    assert.equal(summary.lastSyncAt, "2026-07-01T10:00:00.000Z");
    assert.deepEqual(summary.lastSyncResult, { synced: 2, failed: 1, conflicts: 1 });
  });
});

describe("mobile sprint 9 — offline cache", () => {
  it("snapshots and summarizes club data for offline use", async () => {
    globalThis.indexedDB = createIndexedDbMock();

    const result = await snapshotClubDataForOffline({
      clubId: "club-1",
      courts: [{ id: "c1", name: "Sân 1" }],
      players: [{ id: "p1", name: "Test Player" }],
      tournaments: [{ id: "t1", name: "Demo" }],
      matches: [{ id: "m1" }],
      checkins: [{ id: "ci1", entity_id: "p1" }],
    });

    assert.equal(result.ok, true);

    const snapshot = await loadClubOfflineSnapshot("club-1");
    assert.equal(snapshot.courts.length, 1);
    assert.equal(snapshot.players.length, 1);
    assert.equal(snapshot.tournaments.length, 1);
    assert.equal(snapshot.matches.length, 1);
    assert.equal(snapshot.checkins.length, 1);

    const summary = await getOfflineSnapshotSummary("club-1");
    assert.equal(summary.ok, true);
    assert.equal(summary.hasSnapshot, true);
    assert.equal(summary.itemCount, 5);
  });
});

describe("mobile sprint 9 — PWA install", () => {
  it("builds the right copy for installable and already installed states", () => {
    const installable = buildPwaInstallBannerModel({ canInstall: true, isInstalled: false, isStandalone: false });
    const installed = buildPwaInstallBannerModel({ canInstall: false, isInstalled: true, isStandalone: true });

    assert.equal(installable.showAction, true);
    assert.equal(installable.actionLabel, "Cài đặt ứng dụng");
    assert.equal(installed.showAction, false);
    assert.equal(installed.title, "Ứng dụng đã sẵn sàng");
  });
});

describe("mobile sprint 9 — offline queue status", () => {
  it("builds the right banner for pending offline actions", () => {
    const queued = buildOfflineQueueBannerModel({ pendingCount: 2, isOffline: true, isSyncing: false });
    const ready = buildOfflineQueueBannerModel({ pendingCount: 2, isOffline: false, isSyncing: false });
    const syncing = buildOfflineQueueBannerModel({ pendingCount: 2, isOffline: false, isSyncing: true });

    assert.equal(queued.showBanner, true);
    assert.equal(queued.showAction, false);
    assert.equal(queued.message, "Bạn có 2 thao tác chưa được gửi. Hệ thống sẽ tự đồng bộ khi mạng trở lại.");
    assert.equal(ready.showAction, true);
    assert.equal(ready.actionLabel, "Đồng bộ ngay");
    assert.equal(syncing.actionLabel, "Đang đồng bộ...");
  });
});

describe("mobile sprint 9 — notifications", () => {
  it("stores notification preferences per type", () => {
    const prefs = getNotificationPreferences();
    assert.equal(prefs[NOTIFICATION_TYPES.MATCH_UPCOMING], true);

    setNotificationPreference(NOTIFICATION_TYPES.BOOKING_NEW, false);
    const updated = getNotificationPreferences();
    assert.equal(updated[NOTIFICATION_TYPES.BOOKING_NEW], false);
  });

  it("creates local notification when enabled", async () => {
    const result = await createLocalNotification({
      type: NOTIFICATION_TYPES.CLUB_ANNOUNCEMENT,
      title: "Test",
      body: "Hello",
      tenantId: "tenant-a",
      userId: "user-1",
    });
    assert.equal(result.ok, true);
  });

  it("filters notifications by referee role", () => {
    const notifications = [
      {
        id: "1",
        type: NOTIFICATION_TYPES.REFEREE_ASSIGNED,
        payload_json: { matchId: "m1" },
      },
      {
        id: "2",
        type: NOTIFICATION_TYPES.REFEREE_ASSIGNED,
        payload_json: { matchId: "m2" },
      },
    ];
    const filtered = filterNotificationsByRole(notifications, {
      user: { role: "REFEREE", id: "r1" },
      matchIds: ["m1"],
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "1");
  });

  it("filters notifications for player role", () => {
    const notifications = [
      { id: "1", user_id: "u1", payload_json: {} },
      { id: "2", user_id: "u2", payload_json: { playerId: "p1" } },
    ];
    const filtered = filterNotificationsByRole(notifications, {
      user: { role: "PLAYER", id: "u2", playerId: "p1" },
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "2");
  });
});
