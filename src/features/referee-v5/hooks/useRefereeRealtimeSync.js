import { useCallback, useEffect, useRef, useState } from "react";

import { REALTIME_CONNECTION } from "../constants/realtimeConnectionStates.js";
import { isRefereeV5RealtimeEnabled } from "../flags.js";
import {
  nextConnectionAfterReloadStart,
  nextConnectionAfterReloadSuccess,
  shouldDisableMutations,
} from "../realtime/realtimeSyncLogic.js";
import { subscribeRefereeMatchRealtime } from "../realtime/refereeV5RealtimeChannel.js";
import { buildMatchStateId } from "../persistence/matchStateSerializer.js";

/**
 * Realtime sync for Referee V5 remote mode.
 * Database (via Edge reload) remains source of truth — never applies broadcast payload as state.
 */
export function useRefereeRealtimeSync({
  enabled = false,
  tenantId,
  tournamentId,
  matchId,
  stateVersion = 0,
  isProcessing = false,
  hasConflict = false,
  reloadOfficialState,
}) {
  const [connectionState, setConnectionState] = useState(REALTIME_CONNECTION.CONNECTING);
  const [remoteUpdateNotice, setRemoteUpdateNotice] = useState(false);
  const stateVersionRef = useRef(stateVersion);
  const isProcessingRef = useRef(isProcessing);
  const reloadInFlightRef = useRef(false);
  const noticeTimerRef = useRef(null);

  stateVersionRef.current = stateVersion;
  isProcessingRef.current = isProcessing;

  const matchStateId =
    tenantId && tournamentId && matchId
      ? buildMatchStateId({ tenantId, tournamentId, matchId })
      : null;

  const performReload = useCallback(
    async ({ reason }) => {
      if (!reloadOfficialState || reloadInFlightRef.current) {
        return;
      }
      reloadInFlightRef.current = true;
      setConnectionState((prev) => nextConnectionAfterReloadStart(prev));

      try {
        const result = await reloadOfficialState();
        if (result?.ok) {
          setConnectionState(nextConnectionAfterReloadSuccess());
          if (reason !== "poll_fallback" && reason !== "reconnect") {
            setRemoteUpdateNotice(true);
            if (noticeTimerRef.current) {
              window.clearTimeout(noticeTimerRef.current);
            }
            noticeTimerRef.current = window.setTimeout(() => {
              setRemoteUpdateNotice(false);
              noticeTimerRef.current = null;
            }, 4000);
          }
        } else if (result?.code === "MATCH_STATE_CONFLICT") {
          setConnectionState(REALTIME_CONNECTION.CONFLICT);
        } else {
          setConnectionState(REALTIME_CONNECTION.ERROR);
        }
      } catch {
        setConnectionState(REALTIME_CONNECTION.ERROR);
      } finally {
        reloadInFlightRef.current = false;
      }
    },
    [reloadOfficialState],
  );

  useEffect(() => {
    if (hasConflict) {
      setConnectionState(REALTIME_CONNECTION.CONFLICT);
    }
  }, [hasConflict]);

  useEffect(() => {
    if (!enabled || !isRefereeV5RealtimeEnabled() || !matchStateId || !matchId) {
      setConnectionState(REALTIME_CONNECTION.DISCONNECTED);
      return undefined;
    }

    const unsubscribe = subscribeRefereeMatchRealtime({
      matchStateId,
      matchId,
      currentVersionRef: () => stateVersionRef.current,
      isProcessingRef: () => isProcessingRef.current,
      onConnectionChange: setConnectionState,
      onNotification: () => {},
      onReloadRequired: performReload,
    });

    return () => {
      unsubscribe();
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, [enabled, matchStateId, matchId, performReload]);

  const mutationsBlocked = shouldDisableMutations({
    realtimeConnectionState: connectionState,
    isProcessing,
    loaded: Boolean(matchStateId),
  });

  return {
    connectionState,
    remoteUpdateNotice,
    mutationsBlocked,
    isRealtimeActive: enabled && isRefereeV5RealtimeEnabled(),
  };
}
