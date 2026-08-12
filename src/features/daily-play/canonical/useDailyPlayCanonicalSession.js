/**
 * useDailyPlayCanonicalSession — authoritative readback + mutation orchestration.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { DAILY_PLAY_CODE, DAILY_PLAY_MESSAGES } from "./dailyPlayCodes.js";
import { getDailyPlayCanonicalService } from "./dailyPlayCanonicalService.js";
import { emptyDailyPlayState } from "./dailyPlayCanonicalDomain.js";

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
  const [error, setError] = useState(null);
  const [mutating, setMutating] = useState(false);
  const mountedRef = useRef(true);

  const applySnapshot = useCallback((snapshot) => {
    if (!mountedRef.current || !snapshot?.ok) return;
    setState(snapshot);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !tenantId || !clubId || !tournamentId) {
      setState(null);
      setLoading(false);
      return { ok: false, code: DAILY_PLAY_CODE.VALIDATION, error: "Thiếu phạm vi." };
    }
    setLoading(true);
    const result = await service.getState({ tenantId, clubId, tournamentId });
    if (!mountedRef.current) return result;
    setLoading(false);
    if (!result.ok) {
      setError(result.error || DAILY_PLAY_MESSAGES[result.code] || "Lỗi tải Daily Play.");
      return result;
    }
    applySnapshot(result);
    return result;
  }, [enabled, tenantId, clubId, tournamentId, service, applySnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !pollMs || pollMs < 3000) return undefined;
    const timer = setInterval(() => {
      void refresh();
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
          applySnapshot(result);
        } else if (result?.code === DAILY_PLAY_CODE.VERSION_CONFLICT) {
          if (result.state?.ok) {
            applySnapshot(result.state);
          } else {
            await refresh();
          }
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
    [mutating, applySnapshot, refresh]
  );

  const revision = state?.revision ?? state?.dailyPlay?.revision ?? 0;
  const dailyPlay = state?.dailyPlay || emptyDailyPlayState();
  const scope = { tenantId, clubId, tournamentId };

  return {
    loading,
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
