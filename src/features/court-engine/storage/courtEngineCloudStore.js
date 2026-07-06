import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import {
  buildCourtEngineActiveKey,
  buildCourtEngineStorageKey,
  loadCourtEngineStore,
  saveActiveSessionId,
  saveCourtEngineStore,
} from "./courtEngineStorage.js";

const STORES_TABLE = "court_engine_stores";
const ACTIVE_TABLE = "court_engine_active_sessions";

export function isCourtEngineCloudEnabled() {
  const mode = String(import.meta.env?.VITE_COURT_ENGINE_STORE || "local").toLowerCase();
  return mode === "supabase" && hasSupabaseConfig();
}

function resolveClient(client) {
  return client || getSupabaseAuthClient();
}

function normalizeTenantId(tenantId) {
  return String(tenantId || "").trim();
}

function normalizeClubId(clubId) {
  return String(clubId || "").trim();
}

export async function pullCourtEngineFromCloud(clubId, tenantId, client = null) {
  if (!isCourtEngineCloudEnabled()) {
    return { ok: false, code: "CLOUD_DISABLED", error: "Court Engine cloud chưa bật." };
  }

  const supabase = resolveClient(client);
  if (!supabase) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  if (!tid || !cid) {
    return { ok: false, code: "BAD_REQUEST", error: "Thiếu tenantId hoặc clubId." };
  }

  const { data: storeRow, error: storeError } = await supabase
    .from(STORES_TABLE)
    .select("payload, version, updated_at")
    .eq("tenant_id", tid)
    .eq("club_id", cid)
    .maybeSingle();

  if (storeError) {
    return { ok: false, code: "PULL_FAILED", error: storeError.message };
  }

  const { data: activeRow, error: activeError } = await supabase
    .from(ACTIVE_TABLE)
    .select("session_id, updated_at")
    .eq("tenant_id", tid)
    .eq("club_id", cid)
    .maybeSingle();

  if (activeError) {
    return { ok: false, code: "PULL_ACTIVE_FAILED", error: activeError.message };
  }

  if (!storeRow?.payload) {
    return { ok: true, found: false, clubId: cid, tenantId: tid };
  }

  const payload = {
    ...storeRow.payload,
    clubId: cid,
    tenantId: tid,
    cloudVersion: storeRow.version ?? 1,
  };

  saveCourtEngineStore(cid, payload, { tenantId: tid });

  if (activeRow?.session_id) {
    saveActiveSessionId(cid, activeRow.session_id, { tenantId: tid });
  }

  return {
    ok: true,
    found: true,
    clubId: cid,
    tenantId: tid,
    version: storeRow.version ?? 1,
    updatedAt: storeRow.updated_at,
    activeSessionId: activeRow?.session_id || null,
  };
}

export async function pushCourtEngineToCloud(clubId, tenantId, options = {}) {
  if (!isCourtEngineCloudEnabled()) {
    return { ok: true, skipped: true };
  }

  const supabase = resolveClient(options.client);
  if (!supabase) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  if (!tid || !cid) {
    return { ok: false, code: "BAD_REQUEST", error: "Thiếu tenantId hoặc clubId." };
  }

  const store = loadCourtEngineStore(cid, { tenantId: tid });
  const expectedVersion = Number(options.expectedVersion ?? store.cloudVersion ?? 0);
  const nextVersion = expectedVersion + 1;
  const user = getCurrentUser();
  const userId = user?.id || null;

  const payload = {
    clubId: cid,
    tenantId: tid,
    sessions: store.sessions || [],
    updatedAt: new Date().toISOString(),
  };

  const { data: existing, error: readError } = await supabase
    .from(STORES_TABLE)
    .select("version")
    .eq("tenant_id", tid)
    .eq("club_id", cid)
    .maybeSingle();

  if (readError) {
    return { ok: false, code: "READ_FAILED", error: readError.message };
  }

  if (existing && Number(existing.version) > expectedVersion) {
    return {
      ok: false,
      code: "VERSION_CONFLICT",
      error: "Dữ liệu đã được cập nhật bởi người khác — tải lại.",
      remoteVersion: existing.version,
    };
  }

  const { data, error } = await supabase
    .from(STORES_TABLE)
    .upsert(
      {
        tenant_id: tid,
        club_id: cid,
        payload,
        version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "tenant_id,club_id" }
    )
    .select("version, updated_at")
    .maybeSingle();

  if (error) {
    return { ok: false, code: "PUSH_FAILED", error: error.message };
  }

  const activeSessionId =
    options.activeSessionId ??
    (typeof localStorage !== "undefined"
      ? localStorage.getItem(buildCourtEngineActiveKey(cid, tid))
      : null);

  if (activeSessionId) {
    const { error: activeErr } = await supabase.from(ACTIVE_TABLE).upsert(
      {
        tenant_id: tid,
        club_id: cid,
        session_id: String(activeSessionId),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,club_id" }
    );
    if (activeErr) {
      return { ok: false, code: "PUSH_ACTIVE_FAILED", error: activeErr.message };
    }
  }

  saveCourtEngineStore(
    cid,
    { ...store, cloudVersion: data?.version ?? nextVersion },
    { tenantId: tid }
  );

  return {
    ok: true,
    version: data?.version ?? nextVersion,
    updatedAt: data?.updated_at,
  };
}

export async function migrateLocalCourtEngineToCloud(clubId, tenantId, client = null) {
  const tid = normalizeTenantId(tenantId);
  const cid = normalizeClubId(clubId);
  const localStore = loadCourtEngineStore(cid, { tenantId: tid });

  if (!localStore.sessions?.length) {
    return { ok: true, skipped: true, reason: "empty_local" };
  }

  const push = await pushCourtEngineToCloud(cid, tid, {
    client,
    expectedVersion: 0,
  });

  if (!push.ok) {
    return push;
  }

  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      `pickleball-court-engine-migrated-v1::${tid}::${cid}`,
      new Date().toISOString()
    );
  }

  return { ok: true, migrated: true, version: push.version };
}

export function isCourtEngineMigrated(clubId, tenantId) {
  if (typeof localStorage === "undefined") {
    return true;
  }
  const key = `pickleball-court-engine-migrated-v1::${tenantId}::${clubId}`;
  return Boolean(localStorage.getItem(key));
}

export { STORES_TABLE, ACTIVE_TABLE };
