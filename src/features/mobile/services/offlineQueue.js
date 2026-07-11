import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { canEnqueueOfflineAction } from "./offlineGuardService.js";
import { isPhase43aSafetyEnabled } from "../../safety/phase43aFlags.js";
import {
  OFFLINE_QUEUE_STATUS,
  createScopedQueueEntry,
  entryMatchesSession,
  isFlushableEntry,
  normalizeQueueEntries,
} from "./offlineQueueSchema.js";

const QUEUE_KEY = "pickleball-offline-queue-v1";
const SYNC_LOCK_KEY = "pickleball-offline-sync-lock";
const QUEUE_META_KEY = "pickleball-offline-queue-meta-v1";

export const OFFLINE_ACTION_TYPES = Object.freeze({
  CHECKIN: "checkin",
  MATCH_SCORE: "match_score",
  REFEREE_NOTE: "referee_note",
});

function loadQueueRaw() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadQueue() {
  const raw = loadQueueRaw();
  const normalized = normalizeQueueEntries(raw);
  if (isPhase43aSafetyEnabled()) {
    const serialized = JSON.stringify(normalized);
    const current = localStorage.getItem(QUEUE_KEY);
    if (current !== serialized) {
      saveQueue(normalized);
    }
  }
  return normalized;
}

function saveQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function loadQueueMeta() {
  try {
    const raw = localStorage.getItem(QUEUE_META_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveQueueMeta(meta) {
  localStorage.setItem(QUEUE_META_KEY, JSON.stringify(meta));
}

function getSyncedRequestIds(meta = loadQueueMeta()) {
  const list = meta.syncedRequestIds;
  return Array.isArray(list) ? list : [];
}

function markRequestIdSynced(requestId) {
  if (!requestId) {
    return;
  }
  const meta = loadQueueMeta();
  const syncedRequestIds = getSyncedRequestIds(meta);
  if (!syncedRequestIds.includes(requestId)) {
    syncedRequestIds.push(requestId);
  }
  saveQueueMeta({ ...meta, syncedRequestIds });
}

function getFlushSessionScope() {
  const user = getCurrentUser();
  return {
    userId: user?.id || null,
    tenantId: user?.venueId || user?.tenantId || null,
  };
}

function shouldFlushEntry(entry, scope, syncedRequestIds) {
  if (!isFlushableEntry(entry)) {
    return false;
  }

  if (!isPhase43aSafetyEnabled()) {
    return true;
  }

  if (!entryMatchesSession(entry, scope)) {
    return false;
  }

  if (entry.requestId && syncedRequestIds.includes(entry.requestId)) {
    return false;
  }

  return true;
}

export function getPendingQueueCount() {
  return loadQueue().filter((item) => isFlushableEntry(item)).length;
}

export function listOfflineQueue() {
  return loadQueue();
}

export function enqueueOfflineAction({ type, payload, tenantId, clubId, userId }) {
  const enqueueGuard = canEnqueueOfflineAction(type);
  if (!enqueueGuard.ok) {
    return enqueueGuard;
  }

  const user = getCurrentUser();
  const resolvedUserId = userId || user?.id || null;
  const resolvedTenantId = tenantId || user?.venueId || user?.tenantId || null;

  if (isPhase43aSafetyEnabled()) {
    if (!resolvedUserId || !resolvedTenantId) {
      return {
        ok: false,
        error: "Thiếu user hoặc tenant — không thể xếp hàng offline.",
        code: "SCOPE_REQUIRED",
      };
    }
  }

  const entry = createScopedQueueEntry({
    type,
    payload,
    userId: resolvedUserId,
    tenantId: resolvedTenantId,
    clubId: clubId || user?.clubId || null,
  });

  const queue = loadQueue();
  queue.push(entry);
  saveQueue(queue);
  return { ok: true, entry };
}

async function syncCheckinAction(entry) {
  if (!hasSupabaseConfig()) {
    return { ok: true, provider: "dev" };
  }
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }
  const insertPayload = {
    ...entry.payload,
    ...(entry.requestId ? { request_id: entry.requestId } : {}),
  };
  const { data, error } = await client.from("checkins").insert(insertPayload).select("*").single();
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Xung đột dữ liệu check-in.", code: "CONFLICT", conflict: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

async function syncMatchScoreAction(entry) {
  if (!hasSupabaseConfig()) {
    return { ok: true, provider: "dev" };
  }
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }
  const { error } = await client.rpc("referee_update_match_score", entry.payload);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function syncRefereeNoteAction(entry) {
  await writeAuditLog({
    action: "update",
    resourceType: "referee_note",
    resourceId: entry.payload.matchId || "",
    metadata: entry.payload,
  });
  return { ok: true };
}

async function processEntry(entry) {
  if (entry.type === OFFLINE_ACTION_TYPES.MATCH_SCORE) {
    return {
      ok: false,
      error: "Cập nhật điểm không được phép qua offline queue.",
      code: "BLOCKED_ACTION",
      conflict: true,
    };
  }

  switch (entry.type) {
    case OFFLINE_ACTION_TYPES.CHECKIN:
      return syncCheckinAction(entry);
    case OFFLINE_ACTION_TYPES.MATCH_SCORE:
      return syncMatchScoreAction(entry);
    case OFFLINE_ACTION_TYPES.REFEREE_NOTE:
      return syncRefereeNoteAction(entry);
    default:
      return { ok: false, error: `Loại hành động không hỗ trợ: ${entry.type}` };
  }
}

/** Flush pending offline actions when back online. */
export function getOfflineQueueStatusSummary() {
  const queue = loadQueue();
  const summary = {
    total: queue.length,
    pending: 0,
    synced: 0,
    conflict: 0,
    failed: 0,
    quarantined: 0,
    lastSyncAt: null,
    lastSyncResult: null,
  };

  queue.forEach((item) => {
    if (item.status === OFFLINE_QUEUE_STATUS.SYNCED) {
      summary.synced += 1;
    } else if (item.status === OFFLINE_QUEUE_STATUS.CONFLICT) {
      summary.conflict += 1;
    } else if (item.status === OFFLINE_QUEUE_STATUS.FAILED) {
      summary.failed += 1;
    } else if (item.status === OFFLINE_QUEUE_STATUS.QUARANTINED) {
      summary.quarantined += 1;
    } else {
      summary.pending += 1;
    }
  });

  const meta = loadQueueMeta();
  if (meta.lastSyncAt) {
    summary.lastSyncAt = meta.lastSyncAt;
  }
  if (meta.lastSyncResult) {
    summary.lastSyncResult = meta.lastSyncResult;
  }

  return summary;
}

export async function flushOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "Đang offline.", code: "OFFLINE" };
  }

  const lock = sessionStorage.getItem(SYNC_LOCK_KEY);
  if (lock && Date.now() - Number(lock) < 30000) {
    return { ok: true, skipped: true };
  }
  sessionStorage.setItem(SYNC_LOCK_KEY, String(Date.now()));

  const queue = loadQueue();
  const meta = loadQueueMeta();
  const syncedRequestIds = getSyncedRequestIds(meta);
  const scope = getFlushSessionScope();
  const results = { synced: 0, failed: 0, skipped: 0, conflicts: [] };

  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];

    if (entry.status === OFFLINE_QUEUE_STATUS.SYNCED) {
      continue;
    }

    if (!shouldFlushEntry(entry, scope, syncedRequestIds)) {
      if (
        isPhase43aSafetyEnabled() &&
        entry.requestId &&
        syncedRequestIds.includes(entry.requestId)
      ) {
        entry.status = OFFLINE_QUEUE_STATUS.SYNCED;
        entry.syncedAt = entry.syncedAt || new Date().toISOString();
        queue[i] = entry;
      }
      results.skipped += 1;
      continue;
    }

    entry.attempts += 1;
    const result = await processEntry(entry);

    if (result.ok) {
      entry.status = OFFLINE_QUEUE_STATUS.SYNCED;
      entry.syncedAt = new Date().toISOString();
      if (entry.requestId) {
        markRequestIdSynced(entry.requestId);
      }
      results.synced += 1;
    } else if (result.conflict) {
      entry.status = OFFLINE_QUEUE_STATUS.CONFLICT;
      entry.lastError = result.error;
      results.conflicts.push({ id: entry.id, error: result.error });
      results.failed += 1;
    } else {
      entry.status = entry.attempts >= 3 ? OFFLINE_QUEUE_STATUS.FAILED : OFFLINE_QUEUE_STATUS.PENDING;
      entry.lastError = result.error;
      results.failed += 1;
    }
    queue[i] = entry;
  }

  saveQueue(queue);
  saveQueueMeta({
    ...meta,
    syncedRequestIds: getSyncedRequestIds(),
    lastSyncAt: new Date().toISOString(),
    lastSyncResult: {
      synced: results.synced,
      failed: results.failed,
      skipped: results.skipped,
      conflicts: results.conflicts.length,
    },
  });
  sessionStorage.removeItem(SYNC_LOCK_KEY);
  return { ok: true, ...results };
}

export function clearSyncedQueue() {
  const remaining = loadQueue().filter((item) => item.status !== OFFLINE_QUEUE_STATUS.SYNCED);
  saveQueue(remaining);
  return { ok: true, remaining: remaining.length };
}

export function clearQuarantinedQueue() {
  const remaining = loadQueue().filter((item) => item.status !== OFFLINE_QUEUE_STATUS.QUARANTINED);
  saveQueue(remaining);
  return { ok: true, remaining: remaining.length };
}

export { quarantineOfflineQueueForTenantSwitch, quarantineOfflineQueueOnLogout } from "./offlineQueueQuarantine.js";

/** Test helper — reset queue storage between unit tests. */
export function resetOfflineQueueForTests() {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem(QUEUE_META_KEY);
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(SYNC_LOCK_KEY);
  }
}
