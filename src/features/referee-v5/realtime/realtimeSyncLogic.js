import { REALTIME_CONNECTION } from "../constants/realtimeConnectionStates.js";

export const DEFAULT_POLL_INTERVAL_MS = 8000;
export const DEFAULT_RECONNECT_BASE_MS = 1000;
export const DEFAULT_RECONNECT_MAX_MS = 30000;

/**
 * Decide whether a postgres_changes notification should trigger official state reload.
 * Database version always wins; never apply broadcast payload as domain state.
 */
export function shouldReloadFromNotification({
  notificationVersion,
  currentVersion,
  isProcessing = false,
}) {
  const remoteVersion = Number(notificationVersion ?? 0);
  const localVersion = Number(currentVersion ?? 0);

  if (!Number.isFinite(remoteVersion) || remoteVersion <= 0) {
    return { reload: false, reason: "invalid_version" };
  }
  if (remoteVersion <= localVersion) {
    return { reload: false, reason: "stale_or_duplicate" };
  }
  if (isProcessing) {
    return { reload: false, reason: "local_mutation_in_progress" };
  }
  return { reload: true, reason: remoteVersion === localVersion + 1 ? "next_version" : "version_gap" };
}

export function computeReconnectDelayMs(attempt, baseMs = DEFAULT_RECONNECT_BASE_MS, maxMs = DEFAULT_RECONNECT_MAX_MS) {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.min(maxMs, exp);
}

export function mapSubscriptionStatusToConnection(subscriptionStatus) {
  switch (subscriptionStatus) {
    case "SUBSCRIBED":
      return REALTIME_CONNECTION.CONNECTED;
    case "CHANNEL_ERROR":
    case "TIMED_OUT":
      return REALTIME_CONNECTION.ERROR;
    case "CLOSED":
      return REALTIME_CONNECTION.DISCONNECTED;
    default:
      return REALTIME_CONNECTION.CONNECTING;
  }
}

export function shouldEnablePolling(realtimeConnectionState) {
  return (
    realtimeConnectionState === REALTIME_CONNECTION.DISCONNECTED ||
    realtimeConnectionState === REALTIME_CONNECTION.ERROR ||
    realtimeConnectionState === REALTIME_CONNECTION.RECONNECTING
  );
}

export function shouldDisableMutations({
  realtimeConnectionState,
  remoteError = false,
  loaded = true,
  isProcessing = false,
}) {
  if (remoteError) {
    return true;
  }
  if (!loaded || isProcessing) {
    return true;
  }
  return (
    realtimeConnectionState === REALTIME_CONNECTION.DISCONNECTED ||
    realtimeConnectionState === REALTIME_CONNECTION.ERROR ||
    realtimeConnectionState === REALTIME_CONNECTION.CONNECTING ||
    realtimeConnectionState === REALTIME_CONNECTION.RECONNECTING
  );
}

export function nextConnectionAfterReloadStart(current) {
  if (current === REALTIME_CONNECTION.CONFLICT) {
    return REALTIME_CONNECTION.CONFLICT;
  }
  return REALTIME_CONNECTION.SYNCING;
}

export function nextConnectionAfterReloadSuccess() {
  return REALTIME_CONNECTION.SYNCED;
}
