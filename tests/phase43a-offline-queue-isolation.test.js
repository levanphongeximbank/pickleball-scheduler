import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { signInAs, enableRbac } from "../src/auth/authService.js";
import { clearAuthSession } from "../src/auth/authStorage.js";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  listOfflineQueue,
  quarantineOfflineQueueForTenantSwitch,
  quarantineOfflineQueueOnLogout,
  resetOfflineQueueForTests,
  OFFLINE_ACTION_TYPES,
} from "../src/features/mobile/services/offlineQueue.js";
import { OFFLINE_QUEUE_STATUS } from "../src/features/mobile/services/offlineQueueSchema.js";

const USER_A = "user-43a-a";
const USER_B = "user-43a-b";
const TENANT_A = "tenant-43a-a";
const TENANT_B = "tenant-43a-b";

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

function signInUser(id, tenantId) {
  signInAs({
    id,
    role: ROLES.PLAYER,
    venueId: tenantId,
    tenantId,
    status: "active",
  });
}

beforeEach(() => {
  process.env.VITE_PHASE43A_SAFETY = "true";
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "test" },
    configurable: true,
    writable: true,
  });
  resetOfflineQueueForTests();
  clearAuthSession();
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete process.env.VITE_PHASE43A_SAFETY;
  resetOfflineQueueForTests();
});

describe("Phase 43A — offline queue isolation", () => {
  it("T1: User A queue is not flushed as User B", async () => {
    signInUser(USER_A, TENANT_A);
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "m-a" },
      tenantId: TENANT_A,
    });

    signInUser(USER_B, TENANT_A);
    const flush = await flushOfflineQueue();
    assert.equal(flush.ok, true);
    assert.equal(flush.synced, 0);
    assert.equal(flush.skipped >= 1, true);

    const queue = listOfflineQueue();
    const userAEntry = queue.find((entry) => entry.userId === USER_A);
    assert.ok(userAEntry);
    assert.notEqual(userAEntry.status, OFFLINE_QUEUE_STATUS.SYNCED);
  });

  it("T2: Tenant A queue is not flushed under Tenant B session", async () => {
    signInUser(USER_A, TENANT_A);
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "m-tenant-a" },
      tenantId: TENANT_A,
    });

    signInUser(USER_A, TENANT_B);
    const flush = await flushOfflineQueue();
    assert.equal(flush.ok, true);
    assert.equal(flush.synced, 0);

    const entry = listOfflineQueue().find((item) => item.tenantId === TENANT_A);
    assert.ok(entry);
    assert.notEqual(entry.status, OFFLINE_QUEUE_STATUS.SYNCED);
  });

  it("T3: legacy unscoped queue entries are quarantined", async () => {
    globalThis.localStorage.setItem(
      "pickleball-offline-queue-v1",
      JSON.stringify([
        {
          id: "legacy-1",
          type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
          payload: { matchId: "legacy" },
          status: "pending",
          createdAt: new Date().toISOString(),
          attempts: 0,
        },
      ])
    );

    signInUser(USER_A, TENANT_A);
    const queue = listOfflineQueue();
    assert.equal(queue.length, 1);
    assert.equal(queue[0].status, OFFLINE_QUEUE_STATUS.QUARANTINED);

    const flush = await flushOfflineQueue();
    assert.equal(flush.synced, 0);
  });

  it("T4: same request_id is not processed twice", async () => {
    signInUser(USER_A, TENANT_A);
    const enqueued = enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "dedup" },
      tenantId: TENANT_A,
    });
    assert.equal(enqueued.ok, true);

    const first = await flushOfflineQueue();
    assert.equal(first.synced, 1);

    const queue = listOfflineQueue();
    const entry = queue.find((item) => item.requestId === enqueued.entry.requestId);
    assert.equal(entry.status, OFFLINE_QUEUE_STATUS.SYNCED);

    entry.status = OFFLINE_QUEUE_STATUS.PENDING;
    globalThis.localStorage.setItem("pickleball-offline-queue-v1", JSON.stringify(queue));

    const second = await flushOfflineQueue();
    assert.equal(second.synced, 0);
    assert.equal(second.skipped >= 1, true);
  });

  it("T5: logout quarantines pending session entries", () => {
    signInUser(USER_A, TENANT_A);
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "logout" },
      tenantId: TENANT_A,
    });

    quarantineOfflineQueueOnLogout();
    clearAuthSession();

    const pending = listOfflineQueue().filter(
      (entry) => entry.userId === USER_A && entry.status === OFFLINE_QUEUE_STATUS.QUARANTINED
    );
    assert.equal(pending.length, 1);
  });

  it("tenant switch quarantines other-tenant pending entries", () => {
    signInUser(USER_A, TENANT_A);
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "switch" },
      tenantId: TENANT_A,
    });

    quarantineOfflineQueueForTenantSwitch(TENANT_B);

    const entry = listOfflineQueue()[0];
    assert.equal(entry.status, OFFLINE_QUEUE_STATUS.QUARANTINED);
    assert.equal(entry.lastError, "TENANT_SWITCH");
  });

  it("rejects enqueue without user/tenant scope when 43A safety is on", () => {
    clearAuthSession();
    const result = enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "no-scope" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "SCOPE_REQUIRED");
  });
});
