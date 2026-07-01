import { OFFLINE_ACTION_TYPES } from "./offlineQueue.js";
import {
  getOfflineCapability,
  OFFLINE_CAPABILITY_MODE,
} from "./offlineCapabilityMatrix.js";

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/**
 * Guard offline actions — block risky ops, allow safe reads and pending drafts.
 */
export function guardOfflineAction(actionType, { forceOnline = false } = {}) {
  const capability = getOfflineCapability(actionType);
  const offline = isOffline();

  if (!offline && !forceOnline) {
    return { ok: true, capability, offline: false };
  }

  if (capability.mode === OFFLINE_CAPABILITY_MODE.READ_ONLY) {
    return { ok: true, capability, offline, readOnly: true };
  }

  if (capability.mode === OFFLINE_CAPABILITY_MODE.BLOCK) {
    return {
      ok: false,
      offline,
      capability,
      code: "OFFLINE_BLOCKED",
      error: `${capability.label}: ${capability.description}`,
    };
  }

  if (capability.mode === OFFLINE_CAPABILITY_MODE.PENDING_DRAFT) {
    return {
      ok: true,
      offline,
      capability,
      pendingDraft: true,
      warning: "Thao tác sẽ lưu tạm và validate lại khi có mạng.",
    };
  }

  return { ok: true, capability, offline };
}

export function guardRiskyMutationWhenOffline(actionType) {
  const blockedTypes = new Set([
    OFFLINE_ACTION_TYPES.MATCH_SCORE,
    "booking_create",
    "payment",
    "match_finalize",
    "subscription_update",
  ]);

  if (!isOffline()) {
    return { ok: true };
  }

  if (blockedTypes.has(actionType)) {
    const capability = getOfflineCapability(actionType);
    return {
      ok: false,
      code: "OFFLINE_BLOCKED",
      error: capability.description || "Thao tác này cần kết nối mạng.",
    };
  }

  return guardOfflineAction(actionType);
}

export function canEnqueueOfflineAction(actionType) {
  const guard = guardOfflineAction(actionType);
  if (!guard.ok) {
    return guard;
  }

  const capability = guard.capability;
  if (
    capability.mode === OFFLINE_CAPABILITY_MODE.BLOCK &&
    (isOffline() || actionType === OFFLINE_ACTION_TYPES.MATCH_SCORE)
  ) {
    return {
      ok: false,
      code: "OFFLINE_BLOCKED",
      error: capability.description,
    };
  }

  return { ok: true, pendingDraft: capability.mode === OFFLINE_CAPABILITY_MODE.PENDING_DRAFT };
}
