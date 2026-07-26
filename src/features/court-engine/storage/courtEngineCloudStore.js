/**
 * Court Engine cloud helpers — durable path only (no localStorage dual-write).
 * BM-FINAL-COURT-01: cloud failure must not activate local success.
 */

import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { createDurableCourtRuntimeAdapter } from "../runtime/adapters/createDurableCourtRuntimeAdapter.js";
import {
  getCourtRuntimeWriter,
  isDurableCourtRuntimeAuthority,
} from "../runtime/composition.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../runtime/errors.js";
import { resolveCourtRuntimeAuthority } from "../runtime/resolveCourtRuntimeAuthority.js";

const STORES_TABLE = "court_engine_stores";
const ACTIVE_TABLE = "court_engine_active_sessions";

export function isCourtEngineCloudEnabled() {
  const resolved = resolveCourtRuntimeAuthority();
  if (!resolved.ok) {
    return false;
  }
  return isDurableCourtRuntimeAuthority(resolved.authority) && hasSupabaseConfig();
}

function normalizeTenantId(tenantId) {
  return String(tenantId || "").trim();
}

function normalizeClubId(clubId) {
  return String(clubId || "").trim();
}

function getDurableAdapter(client = null) {
  const runtime = getCourtRuntimeWriter({
    authority: "durable",
    client,
    forceNew: false,
  });
  if (runtime.ok && runtime.writer?.adapter?.mode === "durable") {
    return runtime.writer.adapter;
  }
  return createDurableCourtRuntimeAdapter({ client });
}

export async function pullCourtEngineFromCloud(clubId, tenantId, client = null) {
  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  if (!tid || !cid) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "Thiếu tenantId hoặc clubId."
    );
  }

  if (!isDurableCourtRuntimeAuthority(resolveCourtRuntimeAuthority().authority)) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT,
      "Cloud pull requires durable Court runtime authority."
    );
  }

  const adapter = getDurableAdapter(client);
  const result = await adapter.hydrateRuntime(tid, cid);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    found: result.found === true,
    clubId: cid,
    tenantId: tid,
    version: result.version ?? result.store?.cloudVersion ?? 0,
    updatedAt: result.store?.updatedAt,
    activeSessionId: result.activeSessionId || null,
    store: result.store,
  };
}

export async function pushCourtEngineToCloud(clubId, tenantId, options = {}) {
  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  if (!tid || !cid) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "Thiếu tenantId hoặc clubId."
    );
  }

  if (!isDurableCourtRuntimeAuthority(resolveCourtRuntimeAuthority().authority)) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT,
      "Cloud push requires durable Court runtime authority."
    );
  }

  const adapter = getDurableAdapter(options.client || null);
  const loaded = adapter.loadRuntime(tid, cid);
  if (!loaded.ok) {
    return loaded;
  }

  const saved = await adapter.saveRuntime(tid, cid, loaded.store, {
    expectedVersion: options.expectedVersion ?? loaded.store.cloudVersion ?? 0,
  });
  if (!saved.ok) {
    return saved;
  }

  const activeSessionId =
    options.activeSessionId ?? adapter.loadActiveSessionId(tid, cid);
  if (activeSessionId) {
    const active = await adapter.setActiveSessionId(tid, cid, activeSessionId);
    if (!active.ok) {
      return active;
    }
  }

  return {
    ok: true,
    version: saved.version ?? saved.store?.cloudVersion,
    updatedAt: saved.store?.updatedAt,
  };
}

/**
 * One-way migrate local → durable. Does not keep dual-writing afterwards.
 * Only callable when durable authority is active and an explicit local read is provided.
 */
export async function migrateLocalCourtEngineToCloud(clubId, tenantId, client = null) {
  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  if (!tid || !cid) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "Thiếu tenantId hoặc clubId."
    );
  }

  // Read-only legacy local snapshot (does not authorize local write).
  let localSessions = [];
  if (typeof localStorage !== "undefined") {
    try {
      const key = `pickleball-court-engine-v1::${tid}::${cid}`;
      const legacy = `pickleball-court-engine-v1::${cid}`;
      const raw = localStorage.getItem(key) || localStorage.getItem(legacy);
      if (raw) {
        const parsed = JSON.parse(raw);
        localSessions = parsed?.sessions || [];
      }
    } catch {
      localSessions = [];
    }
  }

  if (!localSessions.length) {
    return { ok: true, skipped: true, reason: "empty_local" };
  }

  const adapter = getDurableAdapter(client);
  const saved = await adapter.saveRuntime(
    tid,
    cid,
    {
      clubId: cid,
      tenantId: tid,
      sessions: localSessions,
      cloudVersion: 0,
    },
    { expectedVersion: 0 }
  );
  if (!saved.ok) {
    return saved;
  }

  // Migration marker is informational only (not runtime authority).
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      `pickleball-court-engine-migrated-v1::${tid}::${cid}`,
      new Date().toISOString()
    );
  }

  return { ok: true, migrated: true, version: saved.version };
}

export function isCourtEngineMigrated(clubId, tenantId) {
  if (typeof localStorage === "undefined") {
    return true;
  }
  const key = `pickleball-court-engine-migrated-v1::${tenantId}::${clubId}`;
  return Boolean(localStorage.getItem(key));
}

export { STORES_TABLE, ACTIVE_TABLE };
