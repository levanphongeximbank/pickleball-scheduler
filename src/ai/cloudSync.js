import { getActiveClubId } from "../data/club.js";
import { PERMISSIONS } from "../auth/permissions.js";
import { guardClubAction, guardAnyClubAction } from "../auth/guardAction.js";
import { guardSubscriptionForClub } from "../auth/subscriptionGuard.js";
import { getSupabaseAuthClient, hasSupabaseConfig } from "../auth/supabaseClient.js";
import { getCurrentUser } from "../auth/authService.js";
import { loadActiveTenantId } from "../data/tenantSession.js";
import { isPhase43aSafetyEnabled } from "../features/safety/phase43aFlags.js";
import { getClubById } from "../domain/clubService.js";
import { getExplicitTenantIdForClub } from "../features/tenant/guards/tenantGuard.js";
import {
  buildFullClubExport,
  getClubCloudVersion,
  loadClubData,
  saveClubData,
  setClubCloudVersion,
  validateClubPayloadForSync,
} from "../domain/clubStorage.js";
import { isClubDataDirty, markClubDataSynced } from "../domain/clubSyncMetadata.js";
import { loadAIData, saveAIData } from "./storage.js";
import {
  hydrateClubPlayersPickVnRatings,
  pushClubPlayersPickVnRatings,
} from "../features/pick-vn-rating/services/pickVnClubSyncService.js";

/**
 * Abort applying a remote club snapshot when local blob has unsynced writes
 * (e.g. MLP draft just created). Prevents in-flight pull from wiping drafts.
 */
function abortPullIfLocalDirty(clubId, provider) {
  if (!isClubDataDirty(clubId)) {
    return null;
  }
  return {
    ok: false,
    provider,
    clubId,
    error:
      "Abort cloud pull: local club blob có thay đổi chưa đồng bộ (ví dụ draft giải đồng đội).",
    code: "LOCAL_DIRTY_ABORT",
    aborted: true,
  };
}

const CLOUD_DB_KEY = "pickleball-cloud-db-v1";
const SUPABASE_TABLE = "club_ai_data";
const SUPABASE_CLUB_TABLE = "club_data_v3";

const SUPABASE_URL =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL || ""
    : "";

const SUPABASE_KEY =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    : "";

export function getCloudSyncMode() {
  return hasSupabaseConfig() ? "supabase" : "local";
}

export function isCloudSyncConfigured() {
  return hasSupabaseConfig();
}

async function getSupabaseAccessToken() {
  const client = getSupabaseAuthClient();
  if (!client) {
    return SUPABASE_KEY;
  }

  const { data } = await client.auth.getSession();
  return data.session?.access_token || SUPABASE_KEY;
}

async function buildSupabaseHeaders(extra = {}) {
  const token = await getSupabaseAccessToken();
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function buildClubPayload(clubId) {
  return {
    clubId,
    data: loadClubData(clubId),
    aiData: loadAIData(clubId),
    exportedAt: new Date().toISOString(),
  };
}

function dispatchClubVersionConflict(clubId, remoteVersion) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("club-data:version-conflict", {
      detail: { clubId, remoteVersion },
    })
  );
}

export async function readRemoteClubCloudVersion(clubId) {
  const headers = await buildSupabaseHeaders();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_CLUB_TABLE}?select=version&club_id=eq.${encodeURIComponent(clubId)}&limit=1`,
    { method: "GET", headers }
  );

  if (!response.ok) {
    return { ok: false, version: 0 };
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return { ok: true, version: Number(row?.version ?? 0) };
}

function assertCloudPushScope(clubId) {
  if (!isPhase43aSafetyEnabled()) {
    return { ok: true };
  }

  const user = getCurrentUser();
  const clubTenant = getExplicitTenantIdForClub(clubId);
  const activeTenant =
    loadActiveTenantId() || user?.venueId || user?.tenantId || null;

  if (clubTenant && activeTenant && clubTenant !== activeTenant) {
    return {
      ok: false,
      code: "TENANT_FORBIDDEN",
      error: "Từ chối push cloud: CLB thuộc tenant khác.",
      clubId,
    };
  }

  return { ok: true };
}

async function syncToSupabase(clubId, options = {}) {
  const scopeCheck = assertCloudPushScope(clubId);
  if (!scopeCheck.ok) {
    return scopeCheck;
  }

  const club = getClubById(clubId);
  const expectedVersion = Number(options.expectedVersion ?? getClubCloudVersion(clubId) ?? 0);
  const remote = await readRemoteClubCloudVersion(clubId);

  if (remote.ok && remote.version > expectedVersion) {
    dispatchClubVersionConflict(clubId, remote.version);
    return {
      ok: false,
      provider: "supabase",
      clubId,
      code: "VERSION_CONFLICT",
      error: "Dữ liệu CLB đã được cập nhật bởi người khác — tải lại.",
      remoteVersion: remote.version,
    };
  }

  const nextVersion = expectedVersion + 1;
  const payload = {
    club_id: clubId,
    venue_id: club?.venueId || null,
    data: buildClubPayload(clubId),
    synced_at: new Date().toISOString(),
    version: nextVersion,
  };

  const headers = await buildSupabaseHeaders({
    Prefer: "resolution=merge-duplicates,return=representation",
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_CLUB_TABLE}?on_conflict=club_id`,
    {
      method: "POST",
      headers,
      body: JSON.stringify([payload]),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase sync failed: ${response.status} ${details}`);
  }

  setClubCloudVersion(clubId, nextVersion);
  markClubDataSynced(clubId, { push: true });

  let pickVnWarning = null;
  try {
    const pickVnResult = await pushClubPlayersPickVnRatings(clubId);
    if (pickVnResult?.ok === false || (pickVnResult?.pushed ?? 0) < (pickVnResult?.total ?? 0)) {
      pickVnWarning =
        pickVnResult?.error ||
        `Pick_VN: chỉ đồng bộ ${pickVnResult?.pushed ?? 0}/${pickVnResult?.total ?? 0} VĐV.`;
    }
  } catch (error) {
    pickVnWarning = error?.message || "Pick_VN sync thất bại.";
  }

  return {
    ok: true,
    provider: "supabase",
    clubId,
    syncedAt: payload.synced_at,
    version: nextVersion,
    warnings: pickVnWarning ? [pickVnWarning] : [],
  };
}

async function pullFromSupabase(clubId) {
  const headers = await buildSupabaseHeaders();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_CLUB_TABLE}?select=data,synced_at,venue_id,version&club_id=eq.${encodeURIComponent(clubId)}&limit=1`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase pull failed: ${response.status} ${details}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row?.data) {
    return pullLegacyFromSupabase(clubId);
  }

  const expectedVenueId = getExplicitTenantIdForClub(clubId);
  if (
    row.venue_id &&
    expectedVenueId &&
    row.venue_id !== expectedVenueId
  ) {
    return {
      ok: false,
      provider: "supabase",
      clubId,
      error: "Từ chối pull cloud: dữ liệu thuộc tenant khác.",
      code: "TENANT_FORBIDDEN",
    };
  }

  const clubPayload = row.data?.data || row.data;

  if (clubPayload?.data) {
    const dirtyAbort = abortPullIfLocalDirty(clubId, "supabase");
    if (dirtyAbort) {
      return dirtyAbort;
    }
    const validated = validateClubPayloadForSync(clubPayload.data, clubId);
    // Re-check immediately before overwrite (create may mark dirty mid-fetch).
    const dirtyAbortImmediate = abortPullIfLocalDirty(clubId, "supabase");
    if (dirtyAbortImmediate) {
      return dirtyAbortImmediate;
    }
    saveClubData(clubId, validated.data, { source: "cloud" });
  }

  if (clubPayload?.aiData) {
    const dirtyAbortAi = abortPullIfLocalDirty(clubId, "supabase");
    if (dirtyAbortAi) {
      return dirtyAbortAi;
    }
    saveAIData(clubPayload.aiData, clubId);
  }

  if (row.version != null) {
    setClubCloudVersion(clubId, Number(row.version) || 0);
  }
  // Never clear dirty after an aborted overwrite path; only mark synced when applied.
  if (isClubDataDirty(clubId)) {
    return abortPullIfLocalDirty(clubId, "supabase");
  }
  markClubDataSynced(clubId, { pull: true });

  let pickVnWarning = null;
  try {
    const hydrateResult = await hydrateClubPlayersPickVnRatings(clubId);
    if (hydrateResult?.ok === false) {
      pickVnWarning = hydrateResult.error || "Pick_VN hydrate thất bại.";
    }
  } catch (error) {
    pickVnWarning = error?.message || "Pick_VN hydrate thất bại.";
  }

  return {
    ok: true,
    provider: "supabase",
    clubId,
    pulledAt: new Date().toISOString(),
    sourceSyncedAt: row.synced_at || null,
    version: Number(row.version ?? 0),
    warnings: pickVnWarning ? [pickVnWarning] : [],
  };
}

async function pullLegacyFromSupabase(clubId) {
  const headers = await buildSupabaseHeaders();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=data,synced_at&club_id=eq.${encodeURIComponent(clubId)}&limit=1`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase pull failed: ${response.status} ${details}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row?.data) {
    return {
      ok: false,
      provider: "supabase",
      clubId,
      error: "Khong tim thay du lieu cloud cho CLB hien tai.",
    };
  }

  saveAIData(row.data, clubId);

  return {
    ok: true,
    provider: "supabase",
    clubId,
    pulledAt: new Date().toISOString(),
    sourceSyncedAt: row.synced_at || null,
    legacySource: true,
    warnings: [
      "Dữ liệu cloud chỉ có club_ai_data (legacy). Chạy mergeLegacyClubAiToV3 để nâng cấp.",
    ],
  };
}

/**
 * One-time migration: gộp row club_ai_data legacy lên club_data_v3 đầy đủ.
 */
export async function mergeLegacyClubAiToV3(options = {}) {
  const clubId = options.clubId || getActiveClubId();
  const legacyPull = await pullLegacyFromSupabase(clubId);

  if (!legacyPull.ok) {
    return legacyPull;
  }

  const pushResult = await syncClubToCloud({
    clubId,
    permission: options.permission || PERMISSIONS.SYSTEM_SETTING,
    expectedVersion: getClubCloudVersion(clubId),
  });

  if (!pushResult.ok) {
    return pushResult;
  }

  return {
    ok: true,
    clubId,
    migratedFrom: "club_ai_data",
    version: pushResult.version,
    warnings: pushResult.warnings || [],
  };
}

function loadCloudDatabase() {
  try {
    const raw = localStorage.getItem(CLOUD_DB_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCloudDatabase(database) {
  localStorage.setItem(CLOUD_DB_KEY, JSON.stringify(database));
}

export async function syncClubToCloud(options = {}) {
  const clubId = options.clubId || getActiveClubId();
  const check = options.permission
    ? guardClubAction(clubId, options.permission)
    : guardAnyClubAction(clubId, [
        PERMISSIONS.CLUB_UPDATE,
        PERMISSIONS.SYSTEM_SETTING,
      ]);
  if (!check.ok) {
    return check;
  }

  const planCheck = guardSubscriptionForClub(clubId, "cloud_sync");
  if (!planCheck.ok) {
    return planCheck;
  }

  if (hasSupabaseConfig()) {
    return syncToSupabase(clubId, {
      expectedVersion: options.expectedVersion ?? getClubCloudVersion(clubId),
    });
  }

  const db = loadCloudDatabase();

  db[clubId] = {
    ...buildClubPayload(clubId),
    syncedAt: new Date().toISOString(),
  };

  saveCloudDatabase(db);
  markClubDataSynced(clubId, { push: true });

  return {
    ok: true,
    provider: "local",
    clubId,
    syncedAt: db[clubId].syncedAt,
  };
}

export async function pullClubFromCloud(options = {}) {
  const clubId = options.clubId || getActiveClubId();
  const permission = options.permission || PERMISSIONS.SYSTEM_SETTING;
  const check = guardClubAction(clubId, permission);
  if (!check.ok) {
    return check;
  }

  const planCheck = guardSubscriptionForClub(clubId, "cloud_sync");
  if (!planCheck.ok) {
    return planCheck;
  }

  if (hasSupabaseConfig()) {
    return pullFromSupabase(clubId);
  }

  const db = loadCloudDatabase();
  const payload = db[clubId];

  if (!payload?.data) {
    return {
      ok: false,
      provider: "local",
      clubId,
      error: "Khong tim thay du lieu cloud cho CLB hien tai.",
    };
  }

  const dirtyAbort = abortPullIfLocalDirty(clubId, "local");
  if (dirtyAbort) {
    return dirtyAbort;
  }

  const validated = validateClubPayloadForSync(payload.data, clubId);
  // Re-check immediately before overwrite (MLP create may mark dirty mid-pull).
  const dirtyAbortImmediate = abortPullIfLocalDirty(clubId, "local");
  if (dirtyAbortImmediate) {
    return dirtyAbortImmediate;
  }
  saveClubData(clubId, validated.data, { source: "cloud" });
  if (payload.aiData) {
    saveAIData(payload.aiData, clubId);
  }

  return {
    ok: true,
    provider: "local",
    clubId,
    pulledAt: new Date().toISOString(),
    sourceSyncedAt: payload.syncedAt || null,
  };
}

export async function syncAIDataToCloud() {
  return syncClubToCloud();
}

export async function pullAIDataFromCloud() {
  return pullClubFromCloud();
}

export function getLastCloudSync(clubId = getActiveClubId()) {
  const db = loadCloudDatabase();
  return db[clubId]?.syncedAt || null;
}

export function buildClubCloudExport(clubId = getActiveClubId()) {
  return buildFullClubExport(clubId);
}
