import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  buildRefereeMatchChannelName,
  extractRealtimeNotification,
} from "../constants/realtimeConnectionStates.js";
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_RECONNECT_BASE_MS,
  DEFAULT_RECONNECT_MAX_MS,
  computeReconnectDelayMs,
  mapSubscriptionStatusToConnection,
  shouldEnablePolling,
  shouldReloadFromNotification,
} from "./realtimeSyncLogic.js";
import { REALTIME_CONNECTION } from "../constants/realtimeConnectionStates.js";

/**
 * Subscribe to match-scoped postgres_changes on match_live_states.
 * RLS filters rows by assignment — Realtime uses authenticated JWT.
 * Notification payload is NOT applied as state; only version metadata triggers reload.
 */
export function subscribeRefereeMatchRealtime({
  matchStateId,
  matchId,
  currentVersionRef,
  isProcessingRef,
  onConnectionChange,
  onNotification,
  onReloadRequired,
}) {
  const supabase = getSupabaseAuthClient();
  if (!supabase || !matchStateId || !matchId) {
    onConnectionChange?.(REALTIME_CONNECTION.DISCONNECTED);
    return () => {};
  }

  const channelName = buildRefereeMatchChannelName(matchId);
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let pollTimer = null;
  let disposed = false;
  let channel = null;
  let lastReloadVersion = 0;

  const clearPoll = () => {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const schedulePoll = () => {
    if (pollTimer || disposed) {
      return;
    }
    pollTimer = window.setInterval(() => {
      const currentVersion = currentVersionRef?.() ?? 0;
      onReloadRequired?.({ reason: "poll_fallback", currentVersion, notificationVersion: currentVersion + 1 });
    }, DEFAULT_POLL_INTERVAL_MS);
  };

  const handleRowChange = (payload) => {
    const row = payload?.new ?? payload?.old;
    const note = extractRealtimeNotification(row);
    if (!note || note.matchId !== matchId) {
      return;
    }

    onNotification?.(note);

    const currentVersion = currentVersionRef?.() ?? 0;
    const decision = shouldReloadFromNotification({
      notificationVersion: note.stateVersion,
      currentVersion,
      isProcessing: isProcessingRef?.() ?? false,
    });

    if (!decision.reload) {
      return;
    }
    if (note.stateVersion <= lastReloadVersion) {
      return;
    }
    lastReloadVersion = note.stateVersion;
    onReloadRequired?.({
      reason: decision.reason,
      notificationVersion: note.stateVersion,
      currentVersion,
    });
  };

  const attachChannel = () => {
    if (disposed) {
      return;
    }
    clearReconnect();
    onConnectionChange?.(reconnectAttempt > 0 ? REALTIME_CONNECTION.RECONNECTING : REALTIME_CONNECTION.CONNECTING);

    channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "match_live_states",
          filter: `id=eq.${matchStateId}`,
        },
        handleRowChange,
      )
      .subscribe((status) => {
        if (disposed) {
          return;
        }
        const mapped = mapSubscriptionStatusToConnection(status);
        onConnectionChange?.(mapped);

        if (status === "SUBSCRIBED") {
          reconnectAttempt = 0;
          clearPoll();
          onConnectionChange?.(REALTIME_CONNECTION.SYNCED);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          schedulePoll();
          scheduleReconnect();
        }
      });
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) {
      return;
    }
    reconnectAttempt += 1;
    const delay = computeReconnectDelayMs(reconnectAttempt, DEFAULT_RECONNECT_BASE_MS, DEFAULT_RECONNECT_MAX_MS);
    onConnectionChange?.(REALTIME_CONNECTION.RECONNECTING);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      attachChannel();
    }, delay);
  };

  attachChannel();

  return () => {
    disposed = true;
    clearPoll();
    clearReconnect();
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

export function isPollingActiveForState(connectionState) {
  return shouldEnablePolling(connectionState);
}
