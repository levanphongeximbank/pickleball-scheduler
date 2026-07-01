import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { getCurrentUser } from "../../../auth/authService.js";
import { writeAuditLog } from "../../identity/services/auditService.js";
import { canEnqueueOfflineAction } from "./offlineGuardService.js";

const QUEUE_KEY = "pickleball-offline-queue-v1";
const SYNC_LOCK_KEY = "pickleball-offline-sync-lock";
const QUEUE_META_KEY = "pickleball-offline-queue-meta-v1";

export const OFFLINE_ACTION_TYPES = Object.freeze({
  CHECKIN: "checkin",
  MATCH_SCORE: "match_score",
  REFEREE_NOTE: "referee_note",
});

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

export function getPendingQueueCount() {
  return loadQueue().filter((item) => item.status === "pending" || item.status === "failed").length;
}

export function listOfflineQueue() {
  return loadQueue();
}

export function enqueueOfflineAction({ type, payload, tenantId, clubId }) {
  const enqueueGuard = canEnqueueOfflineAction(type);
  if (!enqueueGuard.ok) {
    return enqueueGuard;
  }

  const user = getCurrentUser();
  const entry = {
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    tenantId: tenantId || user?.venueId || null,
    clubId: clubId || user?.clubId || null,
    status: "pending",
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
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
  const { data, error } = await client.from("checkins").insert(entry.payload).select("*").single();
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
    lastSyncAt: null,
    lastSyncResult: null,
  };

  queue.forEach((item) => {
    if (item.status === "synced") {
      summary.synced += 1;
    } else if (item.status === "conflict") {
      summary.conflict += 1;
    } else if (item.status === "failed") {
      summary.failed += 1;
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
  const results = { synced: 0, failed: 0, conflicts: [] };

  for (let i = 0; i < queue.length; i++) {
    const entry = queue[i];
    if (entry.status === "synced") {
      continue;
    }

    entry.attempts += 1;
    const result = await processEntry(entry);

    if (result.ok) {
      entry.status = "synced";
      entry.syncedAt = new Date().toISOString();
      results.synced += 1;
    } else if (result.conflict) {
      entry.status = "conflict";
      entry.lastError = result.error;
      results.conflicts.push({ id: entry.id, error: result.error });
      results.failed += 1;
    } else {
      entry.status = entry.attempts >= 3 ? "failed" : "pending";
      entry.lastError = result.error;
      results.failed += 1;
    }
    queue[i] = entry;
  }

  saveQueue(queue);
  saveQueueMeta({
    lastSyncAt: new Date().toISOString(),
    lastSyncResult: {
      synced: results.synced,
      failed: results.failed,
      conflicts: results.conflicts.length,
    },
  });
  sessionStorage.removeItem(SYNC_LOCK_KEY);
  return { ok: true, ...results };
}

export function clearSyncedQueue() {
  const remaining = loadQueue().filter((item) => item.status !== "synced");
  saveQueue(remaining);
  return { ok: true, remaining: remaining.length };
}
