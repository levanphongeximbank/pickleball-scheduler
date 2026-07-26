/**
 * BM-FINAL-COURT-01 — court-cluster claim authority fail-closed tests.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetCourtRuntimeForTests,
  COURT_RUNTIME_AUTHORITY,
  COURT_RUNTIME_ERROR_CODES,
} from "../src/features/court-engine/runtime/index.js";
import {
  canUseLocalCourtClaimStorage,
  denyLocalCourtClaimWrite,
  saveCourtClaimRequests,
} from "../src/features/court-cluster/storage/courtClaimRequestStorage.js";

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

test("claim — durable mode denies local claim writes", () => {
  global.localStorage = memoryLocalStorage();
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter: {
      authority: COURT_RUNTIME_AUTHORITY.DURABLE,
      mode: "durable",
      dualWrite: false,
      usesLocalStorage: false,
      writeLog: [],
      loadRuntime: () => ({ ok: true, store: { sessions: [] } }),
      saveRuntime: async () => ({ ok: true }),
      loadActiveSessionId: () => null,
      setActiveSessionId: async () => ({ ok: true }),
    },
  });

  assert.equal(canUseLocalCourtClaimStorage(), false);
  const denied = denyLocalCourtClaimWrite("RPC_NOT_DEPLOYED");
  assert.equal(denied.ok, false);
  assert.equal(
    denied.code,
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT
  );

  const saved = saveCourtClaimRequests([]);
  assert.equal(saved.ok, false);
  assert.equal(global.localStorage.size, 0);
});

test("claim — NO_SUPABASE fail-closed helper under durable", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter: {
      authority: COURT_RUNTIME_AUTHORITY.DURABLE,
      mode: "durable",
      dualWrite: false,
      usesLocalStorage: false,
      writeLog: [],
      loadRuntime: () => ({ ok: true, store: { sessions: [] } }),
      saveRuntime: async () => ({ ok: true }),
      loadActiveSessionId: () => null,
      setActiveSessionId: async () => ({ ok: true }),
    },
  });
  const denied = denyLocalCourtClaimWrite("NO_SUPABASE");
  assert.equal(denied.ok, false);
  assert.match(denied.error, /NO_SUPABASE/);
});

test("claim — RPC_FAILED semantics stay fail-closed (no local activation)", () => {
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DURABLE,
    adapter: {
      authority: COURT_RUNTIME_AUTHORITY.DURABLE,
      mode: "durable",
      dualWrite: false,
      usesLocalStorage: false,
      writeLog: [],
      loadRuntime: () => ({ ok: true, store: { sessions: [] } }),
      saveRuntime: async () => ({ ok: true }),
      loadActiveSessionId: () => null,
      setActiveSessionId: async () => ({ ok: true }),
    },
  });
  const denied = denyLocalCourtClaimWrite("RPC_FAILED");
  assert.equal(denied.ok, false);
  assert.equal(
    denied.code,
    COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT
  );
});

test("claim — explicit development_local allows local claim storage", () => {
  global.localStorage = memoryLocalStorage();
  __resetCourtRuntimeForTests({
    authority: COURT_RUNTIME_AUTHORITY.DEVELOPMENT_LOCAL,
  });
  assert.equal(canUseLocalCourtClaimStorage(), true);
  const saved = saveCourtClaimRequests([]);
  assert.equal(saved.ok, true);
  assert.ok(global.localStorage.size >= 1);
});
