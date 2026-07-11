import { normalizeQueueEntries, OFFLINE_QUEUE_STATUS } from "./offlineQueueSchema.js";
import { isPhase43aSafetyEnabled } from "../../safety/phase43aFlags.js";

const QUEUE_KEY = "pickleball-offline-queue-v1";

function loadQueueRaw() {
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

function quarantineEntries(predicate, reason) {
  const queue = normalizeQueueEntries(loadQueueRaw());
  let changed = false;

  const next = queue.map((entry) => {
    if (!predicate(entry) || entry.status === OFFLINE_QUEUE_STATUS.QUARANTINED) {
      return entry;
    }
    if (
      entry.status === OFFLINE_QUEUE_STATUS.PENDING ||
      entry.status === OFFLINE_QUEUE_STATUS.FAILED
    ) {
      changed = true;
      return {
        ...entry,
        status: OFFLINE_QUEUE_STATUS.QUARANTINED,
        lastError: reason,
      };
    }
    return entry;
  });

  if (changed) {
    saveQueue(next);
  }

  return { ok: true, changed };
}

/** Phase 43A — quarantine pending queue on logout / user switch. */
export function quarantineOfflineQueueOnLogout() {
  if (!isPhase43aSafetyEnabled()) {
    return { ok: true, skipped: true };
  }
  return quarantineEntries(
    (entry) =>
      entry.status === OFFLINE_QUEUE_STATUS.PENDING ||
      entry.status === OFFLINE_QUEUE_STATUS.FAILED,
    "SESSION_LOGOUT"
  );
}

/** Phase 43A — quarantine entries from other tenants on tenant switch. */
export function quarantineOfflineQueueForTenantSwitch(newTenantId) {
  if (!isPhase43aSafetyEnabled()) {
    return { ok: true, skipped: true };
  }
  const trimmed = String(newTenantId || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Tenant không hợp lệ." };
  }
  return quarantineEntries((entry) => entry.tenantId !== trimmed, "TENANT_SWITCH");
}
