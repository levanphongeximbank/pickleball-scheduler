import { useCallback, useEffect, useRef, useState } from "react";

import { getTeamTournamentRepository } from "../repositories/teamTournamentRepositoryFactory.js";
import { getTeamTournamentRealtimeService } from "../realtime/TeamTournamentRealtimeService.js";
import { isTeamTournamentRealtimeEnabled } from "../realtime/realtimeFlags.js";
import {
  TT_REALTIME_CONNECTION,
  isPollingEligibleState,
} from "../realtime/realtimeConnectionState.js";

const SNAPSHOT_COALESCE_MS = 400;

/**
 * TT-6C — shared realtime controller for team tournament pages.
 * Subscribes via repository boundary only (no direct Supabase channels in pages).
 *
 * @param {{
 *   clubId?: string,
 *   tournamentId?: string,
 *   onReload?: (options?: { silent?: boolean, reason?: string }) => Promise<unknown>,
 *   enabled?: boolean,
 * }} params
 */
export function useTeamTournamentRealtime({
  clubId,
  tournamentId,
  onReload,
  enabled = true,
} = {}) {
  const flagEnabled = isTeamTournamentRealtimeEnabled();
  const [connectionState, setConnectionState] = useState(TT_REALTIME_CONNECTION.IDLE);
  const [subscriptionMode, setSubscriptionMode] = useState(null);
  const [lastEventAt, setLastEventAt] = useState(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState(null);

  const unsubscribeRef = useRef(null);
  const subscriptionIdRef = useRef(null);
  const coalesceTimerRef = useRef(null);
  const reloadRef = useRef(onReload);
  reloadRef.current = onReload;

  const isRealtime =
    flagEnabled && (subscriptionMode === "realtime" || subscriptionMode === "referee_v5_adapter");
  const isDegraded = isPollingEligibleState(connectionState);
  const pollingFallbackActive =
    !flagEnabled || subscriptionMode === "polling_only" || isDegraded || !isRealtime;

  const scheduleSnapshotReload = useCallback((reason) => {
    if (coalesceTimerRef.current) {
      clearTimeout(coalesceTimerRef.current);
    }
    coalesceTimerRef.current = setTimeout(async () => {
      coalesceTimerRef.current = null;
      if (!reloadRef.current) {
        return;
      }
      try {
        await reloadRef.current({ silent: true, reason });
        setLastSnapshotAt(Date.now());
        setSubscriptionError(null);
      } catch {
        setSubscriptionError({
          code: "snapshot_reload_failed",
          error: "Không tải được dữ liệu mới.",
        });
      }
    }, SNAPSHOT_COALESCE_MS);
  }, []);

  const handleRealtimeHint = useCallback(() => {
    setLastEventAt(Date.now());
    scheduleSnapshotReload("realtime_hint");
  }, [scheduleSnapshotReload]);

  const reconnect = useCallback(() => {
    const subscriptionId = subscriptionIdRef.current;
    if (subscriptionId && flagEnabled) {
      getTeamTournamentRealtimeService().reconnect(subscriptionId);
      return;
    }
    scheduleSnapshotReload("manual_reconnect");
  }, [flagEnabled, scheduleSnapshotReload]);

  const refresh = useCallback(async () => {
    if (!reloadRef.current) {
      return { ok: false };
    }
    const result = await reloadRef.current({ silent: true, reason: "manual_refresh" });
    setLastSnapshotAt(Date.now());
    return result;
  }, []);

  useEffect(() => {
    if (!enabled || !clubId || !tournamentId) {
      return undefined;
    }

    let cancelled = false;
    const repo = getTeamTournamentRepository();

    async function startSubscription() {
      setConnectionState(TT_REALTIME_CONNECTION.CONNECTING);
      setSubscriptionError(null);

      const handlers = {
        onTournamentChange: () => {
          if (!cancelled) {
            handleRealtimeHint();
          }
        },
        onMatchupChange: () => {
          if (!cancelled) {
            handleRealtimeHint();
          }
        },
        onLineupChange: () => {
          if (!cancelled) {
            handleRealtimeHint();
          }
        },
        onStandingsChange: () => {
          if (!cancelled) {
            handleRealtimeHint();
          }
        },
        onConnectionStateChange: (state) => {
          if (!cancelled) {
            setConnectionState(state);
          }
        },
        onError: (error) => {
          if (!cancelled && error?.code !== "realtime_connection") {
            setSubscriptionError(error);
          }
        },
      };

      const result = await repo.subscribeTournament(clubId, tournamentId, handlers);
      if (cancelled) {
        result?.data?.unsubscribe?.();
        return;
      }

      if (!result?.ok) {
        setConnectionState(TT_REALTIME_CONNECTION.ERROR);
        setSubscriptionError({
          code: result.code || "subscribe_failed",
          error: result.error || "Không thể đồng bộ realtime.",
        });
        setSubscriptionMode("polling_only");
        return;
      }

      const sub = result.data;
      unsubscribeRef.current = sub.unsubscribe;
      subscriptionIdRef.current = sub.subscriptionId ?? null;
      setSubscriptionMode(sub.mode || sub.fallbackMode || "polling");
      setConnectionState(
        sub.mode === "realtime" || sub.mode === "referee_v5_adapter"
          ? TT_REALTIME_CONNECTION.CONNECTED
          : TT_REALTIME_CONNECTION.DEGRADED
      );
    }

    startSubscription();

    return () => {
      cancelled = true;
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current);
        coalesceTimerRef.current = null;
      }
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      subscriptionIdRef.current = null;
      setConnectionState(TT_REALTIME_CONNECTION.CLOSED);
    };
  }, [clubId, tournamentId, enabled, handleRealtimeHint]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    function onVisibilityChange() {
      if (typeof document !== "undefined" && !document.hidden) {
        refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, refresh]);

  return {
    connectionState,
    isRealtime,
    isDegraded,
    lastEventAt,
    lastSnapshotAt,
    reconnect,
    refresh,
    subscriptionError,
    pollingFallbackActive,
    subscriptionMode,
    flagEnabled,
  };
}

export function __resetTeamTournamentRealtimeHookForTests() {
  // per-mount cleanup in tests via unmount
}
