/**
 * useDailyPlayCanonicalSession — authoritative readback + mutation orchestration.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { DAILY_PLAY_CODE, DAILY_PLAY_MESSAGES } from "./dailyPlayCodes.js";
import { getDailyPlayCanonicalService } from "./dailyPlayCanonicalService.js";
import { emptyDailyPlayState } from "./dailyPlayCanonicalDomain.js";
import { normalizeDailyPlayServerSnapshot } from "./normalizeDailyPlayServerSnapshot.js";

function mapConflict(result) {
  if (result?.code === DAILY_PLAY_CODE.VERSION_CONFLICT) {
    return {
      ...result,
      error:
        result.error || DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.VERSION_CONFLICT],
    };
  }
  return result;
}

export function useDailyPlayCanonicalSession({
  tenantId,
  clubId,
  tournamentId,
  pollMs = 15000,
  enabled = true,
} = {}) {
  const service = getDailyPlayCanonicalService();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled && tournamentId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [mutating, setMutating] = useState(false);
  const mountedRef = useRef(true);
  const hasSnapshotRef = useRef(false);

  const applySnapshot = useCallback((snapshot) => {
    if (!mountedRef.current || !snapshot?.ok) return;
    const normalized = normalizeDailyPlayServerSnapshot(snapshot);
    if (!normalized.ok) return;
    hasSnapshotRef.current = true;
    setState(normalized);
    setError(null);
  }, []);

  const refresh = useCallback(
    async (options = {}) => {
      const background = options.background === true;
      if (!enabled || !tenantId || !clubId || !tournamentId) {
        setState(null);
        hasSnapshotRef.current = false;
        setLoading(false);
        setRefreshing(false);
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VALIDATION,
          error: "Thiếu phạm vi.",
        };
      }

      // DP-03: never flash full-page loading on poll / mutation readback.
      if (background && hasSnapshotRef.current) {
        setRefreshing(true);
      } else if (!background) {
        setLoading(true);
      }

      const result = await service.getState({ tenantId, clubId, tournamentId });
      if (!mountedRef.current) return result;

      if (background && hasSnapshotRef.current) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }

      if (!result.ok) {
        // Keep existing tables visible during background failure.
        if (!background || !hasSnapshotRef.current) {
          setError(
            result.error ||
              DAILY_PLAY_MESSAGES[result.code] ||
              "Lỗi tải Daily Play."
          );
        }
        return result;
      }

      applySnapshot(result);
      return result;
    },
    [enabled, tenantId, clubId, tournamentId, service, applySnapshot]
  );

  useEffect(() => {
    mountedRef.current = true;
    hasSnapshotRef.current = false;
    void refresh({ background: false });
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !pollMs || pollMs < 3000) return undefined;
    const timer = setInterval(() => {
      void refresh({ background: true });
    }, pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, refresh]);

  const runMutation = useCallback(
    async (executor) => {
      if (mutating) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VALIDATION,
          error: "Đang xử lý thao tác trước đó.",
        };
      }
      setMutating(true);
      setError(null);
      try {
        const result = mapConflict(await executor());
        if (!mountedRef.current) return result;

        if (result?.ok) {
          // DP-04: never treat compact mutation payloads as session snapshots.
          const readback = await refresh({ background: true });
          if (!mountedRef.current) return result;
          if (!readback?.ok) {
            const failure = {
              ok: false,
              code: DAILY_PLAY_CODE.READBACK_FAILED,
              error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.READBACK_FAILED],
              mutationCommitted: true,
              mutation: result,
              readback,
            };
            setError(failure.error);
            return failure;
          }
          return {
            ...result,
            revision: readback.revision,
            dailyPlay: readback.dailyPlay,
            readback,
          };
        }

        if (result?.code === DAILY_PLAY_CODE.VERSION_CONFLICT) {
          await refresh({ background: true });
          setError(
            result.error || DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.VERSION_CONFLICT]
          );
        } else {
          setError(
            result?.error ||
              DAILY_PLAY_MESSAGES[result?.code] ||
              "Thao tác Daily Play thất bại."
          );
        }
        return result;
      } finally {
        if (mountedRef.current) {
          setMutating(false);
        }
      }
    },
    [mutating, refresh]
  );

  const revision = state?.revision ?? state?.dailyPlay?.revision ?? 0;
  const dailyPlay = state?.dailyPlay || emptyDailyPlayState();
  const scope = { tenantId, clubId, tournamentId };

  return {
    loading,
    refreshing,
    mutating,
    error,
    setError,
    state,
    dailyPlay,
    revision,
    courts: state?.courts || [],
    courtStates: state?.courtStates || [],
    availableCourts: state?.availableCourts || [],
    hasCourtCapability: Boolean(state?.hasCourtCapability),
    leases: state?.leases || [],
    refresh,
    checkIn: (playerId) =>
      runMutation(() =>
        service.checkIn(scope, { playerId, expectedVersion: revision })
      ),
    checkOut: (playerId) =>
      runMutation(() =>
        service.checkOut(scope, { playerId, expectedVersion: revision })
      ),
    createMatches: (matches, options = {}) =>
      runMutation(() =>
        service.createMatches(scope, {
          matches,
          expectedVersion: revision,
          eligiblePlayerCount: options.eligiblePlayerCount,
          idempotencyKey: options.idempotencyKey,
        })
      ),
    assignCourt: (matchId, courtId = null) =>
      runMutation(() =>
        service.assignCourt(scope, {
          matchId,
          courtId,
          expectedVersion: revision,
        })
      ),
    startMatch: (matchId) =>
      runMutation(() =>
        service.startMatch(scope, { matchId, expectedVersion: revision })
      ),
    submitScore: (matchId, scoreA, scoreB) =>
      runMutation(() =>
        service.submitScore(scope, {
          matchId,
          scoreA,
          scoreB,
          expectedVersion: revision,
        })
      ),
    cancelMatch: (matchId) =>
      runMutation(() =>
        service.cancelMatch(scope, { matchId, expectedVersion: revision })
      ),
    changeCourt: (matchId, courtId) =>
      runMutation(() =>
        service.changeCourt(scope, {
          matchId,
          courtId,
          expectedVersion: revision,
        })
      ),
  };
}
