/**
 * BM-FINAL-COURT-01 — Court runtime persistence authority certification tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  COURT_RUNTIME_AUTHORITY,
  COURT_RUNTIME_ERROR_CODES,
  __resetCourtRuntimeForTests,
  createCourtRuntime,
  createMemoryCourtRuntimeAdapter,
  createDurableCourtRuntimeAdapter,
  persistCourtSession,
  createCourtRuntimeSession,
  loadActiveCourtSession,
  resolveCourtRuntimeAuthority,
  inspectCourtRuntimeAuthority,
} from "../src/features/court-engine/runtime/index.js";
import { createCourtSession } from "../src/features/court-engine/models/courtSession.js";
import { addToQueue } from "../src/features/court-engine/services/queueService.js";
import { checkInPlayer } from "../src/features/court-engine/services/checkInService.js";
import { createUserRecord } from "../src/models/user.js";
import { ROLES } from "../src/auth/roles.js";

function memoryLocalStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}

test("authority — Production selects durable", () => {
  const resolved = resolveCourtRuntimeAuthority({
    env: { PROD: true, MODE: "production" },
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.DURABLE);
});

test("authority — Staging selects durable", () => {
  const resolved = resolveCourtRuntimeAuthority({
    env: { MODE: "staging", VITE_VERCEL_ENV: "staging" },
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.DURABLE);
});

test("authority — Preview defaults durable", () => {
  const resolved = resolveCourtRuntimeAuthority({
    env: { MODE: "preview", VITE_VERCEL_ENV: "preview" },
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.DURABLE);
});

test("authority — Development local requires explicit selection", () => {
  const defaultDev = resolveCourtRuntimeAuthority({
    env: { MODE: "development", PROD: false },
  });
  assert.equal(defaultDev.authority, COURT_RUNTIME_AUTHORITY.DURABLE);

  const explicit = resolveCourtRuntimeAuthority({
    env: {
      MODE: "development",
      VITE_COURT_RUNTIME_AUTHORITY: "development_local",
    },
  });
  assert.equal(explicit.authority, COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL);
  assert.equal(explicit.explicit, true);
});

test("authority — Offline local requires explicit selection", () => {
  const resolved = resolveCourtRuntimeAuthority({
    authority: COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL,
  });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.OFFLINE_LOCAL);
  assert.equal(resolved.explicit, true);
});

test("authority — Test memory requires explicit injection", () => {
  const created = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  assert.equal(created.ok, true);
  assert.equal(created.authority, COURT_RUNTIME_AUTHORITY.TEST_MEMORY);
});

test("authority — Cloud failure never changes authority", () => {
  const resolved = resolveCourtRuntimeAuthority({
    env: { PROD: true },
    cloudFailure: true,
    rpcNotDeployed: true,
  });
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.DURABLE);
});

test("authority — RPC_NOT_DEPLOYED never activates local fallback", () => {
  const resolved = resolveCourtRuntimeAuthority({
    env: { MODE: "preview" },
    rpcNotDeployed: true,
  });
  assert.equal(resolved.authority, COURT_RUNTIME_AUTHORITY.DURABLE);
});

test("authority — Missing Supabase config in durable mode fails closed on write", async () => {
  const adapter = createDurableCourtRuntimeAdapter({
    getClient: () => null,
  });
  const created = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter,
  });
  assert.equal(created.ok, true);

  const session = createCourtSession({
    clubId: "club-1",
    tenantId: "tenant-1",
    name: "Durable fail-closed",
  });
  const saved = await created.writer.saveSession(
    session,
    { tenantId: "tenant-1", clubId: "club-1" },
    { skipAuthorization: true }
  );
  assert.equal(saved.ok, false);
  assert.equal(
    saved.code,
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE
  );
});

test("writer — exactly one canonical write per saveSession; no localStorage in durable", async () => {
  const ls = memoryLocalStorage();
  global.localStorage = ls;

  const adapter = createDurableCourtRuntimeAdapter({
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: null, error: null }),
                    };
                  },
                };
              },
            };
          },
          upsert() {
            return {
              select() {
                return {
                  maybeSingle: async () => ({
                    data: { version: 1, updated_at: new Date().toISOString() },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      },
    }),
  });

  // Patch hydrate/save to count precisely via writeLog
  const originalSave = adapter.saveRuntime.bind(adapter);
  adapter.saveRuntime = async (...args) => {
    const result = await originalSave(...args);
    return result;
  };

  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter,
  });

  const runtime = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter,
  });
  const session = createCourtSession({
    clubId: "club-d",
    tenantId: "tenant-d",
  });
  runtime.writer.resetWriteCounts();
  const result = await runtime.writer.saveSession(
    session,
    { tenantId: "tenant-d", clubId: "club-d" },
    { skipAuthorization: true }
  );
  assert.equal(result.ok, true);
  assert.equal(runtime.writer.getWriteCount("saveSession"), 1);
  assert.equal(ls.size, 0);
  assert.equal(adapter.usesLocalStorage, false);
  assert.equal(adapter.dualWrite, false);
});

test("writer — durable failure is typed; local success cannot mask it", async () => {
  const ls = memoryLocalStorage();
  global.localStorage = ls;
  const adapter = createDurableCourtRuntimeAdapter({
    getClient: () => ({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({
                        data: null,
                        error: { message: "boom" },
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      },
    }),
  });
  const runtime = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter,
  });
  const session = createCourtSession({ clubId: "c1", tenantId: "t1" });
  const result = await runtime.writer.saveSession(
    session,
    { tenantId: "t1", clubId: "c1" },
    { skipAuthorization: true }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED);
  assert.equal(ls.size, 0);
});

test("scope — tenantId and clubId required; cross-scope denied", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  const runtime = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  const session = createCourtSession({ clubId: "club-1", tenantId: null });

  const missingTenant = runtime.writer.saveSession(
    session,
    { clubId: "club-1", tenantId: "" },
    { skipAuthorization: true }
  );
  assert.equal(missingTenant.ok, false);
  assert.equal(
    missingTenant.code,
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED
  );

  const withTenant = createCourtSession({
    clubId: "club-1",
    tenantId: "tenant-1",
  });
  const mismatch = runtime.writer.saveSession(
    withTenant,
    {
      tenantId: "tenant-1",
      clubId: "club-1",
      expectedTenantId: "other-tenant",
    },
    { skipAuthorization: true }
  );
  assert.equal(mismatch.ok, false);
  assert.equal(
    mismatch.code,
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_MISMATCH
  );
});

test("authorization — unauthorized denied before storage mutation", () => {
  const adapter = createMemoryCourtRuntimeAdapter();
  const runtime = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
    adapter,
  });
  const player = createUserRecord({
    role: ROLES.PLAYER,
    venueId: "venue-a",
    clubId: "club-auth",
  });
  const session = createCourtSession({
    clubId: "club-auth",
    tenantId: "tenant-auth",
  });
  const before = adapter.writeLog.length;
  const result = runtime.writer.saveSession(
    session,
    { tenantId: "tenant-auth", clubId: "club-auth" },
    { user: player, rbacEnabled: true }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_UNAUTHORIZED);
  assert.equal(adapter.writeLog.length, before);
});

test("authorization — authorized command reaches writer exactly once", () => {
  const adapter = createMemoryCourtRuntimeAdapter();
  const runtime = createCourtRuntime({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
    adapter,
  });
  const session = createCourtSession({
    clubId: "club-ok",
    tenantId: "tenant-ok",
  });
  runtime.writer.resetWriteCounts();
  const result = runtime.writer.saveSession(
    session,
    { tenantId: "tenant-ok", clubId: "club-ok" },
    { skipAuthorization: true }
  );
  assert.equal(result.ok, true);
  assert.equal(runtime.writer.getWriteCount("saveSession"), 1);
  assert.equal(adapter.writeLog.filter((w) => w.type === "saveRuntime").length, 1);
});

test("session lifecycle — create/start/end deterministic via memory writer", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  const created = createCourtRuntimeSession("club-life", {
    tenantId: "tenant-life",
    name: "Lifecycle",
    skipAuthorization: true,
  });
  assert.equal(created.ok, true);
  assert.ok(created.session?.id);

  const active = loadActiveCourtSession("club-life", {
    tenantId: "tenant-life",
  });
  assert.equal(active.ok, true);
  assert.equal(active.session.id, created.session.id);
});

test("queue lifecycle — enqueue goes through canonical writer", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  let session = createCourtSession({
    clubId: "club-q",
    tenantId: "tenant-q",
  });
  const checked = checkInPlayer(session, "p1");
  session = checked.session;
  const queued = addToQueue(session, "p1");
  session = queued.session;

  const saved = persistCourtSession("club-q", session, {
    tenantId: "tenant-q",
    skipAuthorization: true,
  });
  assert.equal(saved.ok, true);
  const loaded = loadActiveCourtSession("club-q", { tenantId: "tenant-q" });
  assert.equal(loaded.session.queue.length, 1);
});

test("compatibility — inspect authority available on facade", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.TEST_MEMORY,
  });
  const inspected = inspectCourtRuntimeAuthority();
  assert.equal(inspected.ok, true);
  assert.equal(inspected.authority, COURT_RUNTIME_AUTHORITY.TEST_MEMORY);
});
