import { syncClubToCloud } from "./cloudSync.js";
import { isClubCloudSyncEnabled } from "./cloudSyncConfig.js";
import { getClubCloudVersion } from "../domain/clubStorage.js";
import { getCurrentUser } from "../auth/authService.js";
import { loadActiveTenantId } from "../data/tenantSession.js";
import { getExplicitTenantIdForClub } from "../features/tenant/guards/tenantGuard.js";
import { isPhase43aSafetyEnabled } from "../features/safety/phase43aFlags.js";

const DEBOUNCE_MS = 1500;
const pendingTimers = new Map();

function canScheduleCloudPush(clubId) {
  if (!isPhase43aSafetyEnabled()) {
    return true;
  }
  const clubTenant = getExplicitTenantIdForClub(clubId);
  const user = getCurrentUser();
  const activeTenant = loadActiveTenantId() || user?.venueId || user?.tenantId || null;
  if (clubTenant && activeTenant && clubTenant !== activeTenant) {
    return false;
  }
  return true;
}

export function scheduleClubCloudPush(clubId) {
  const id = String(clubId || "").trim();
  if (!id || !isClubCloudSyncEnabled() || !canScheduleCloudPush(id)) {
    return;
  }

  const existing = pendingTimers.get(id);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    pendingTimers.delete(id);
    void syncClubToCloud({
      clubId: id,
      expectedVersion: getClubCloudVersion(id),
    }).then((result) => {
      if (!result?.ok && result?.code !== "VERSION_CONFLICT") {
        console.warn("[clubCloudPush]", id, result?.error || result?.code);
      }
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(id, timer);
}

export function flushClubCloudPushForTests() {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}
