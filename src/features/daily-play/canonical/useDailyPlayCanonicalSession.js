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
  const revisionRef = useRef(0);
  const mutatingRef = useRef(false);

  const applySnapshot = useCallback((snapshot) => {
    if (!mountedRef.current || !snapshot?.ok) return;
    const normalized = normalizeDailyPlayServerSnapshot(snapshot);
    if (!normalized.ok) return;
    hasSnapshotRef.current = true;
    revisionRef.current = Number(normalized.revision || 0);
    setState(normalized);
    setError(null);
  }, []);

  const refresh = useCallback(
    async (options = {}) => {
      const background = options.background === true;
      if (!enabled || !tenantId || !clubId || !tournamentId) {
        setState(null);
        hasSnapshotRef.current = false;
        revisionRef.current = 0;
        setLoading(false);
        setRefreshing(false);
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VALIDATION,
          error: "Thiếu phạm vi.",
        };
      }

      // DP-03/DP-05: never flash full-page loading on poll / mutation readback.
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
    revisionRef.current = 0;
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

  const beginMutationGate = useCallback(() => {
    if (mutatingRef.current) {
      return {
        ok: false,
        code: DAILY_PLAY_CODE.VALIDATION,
        error: "Đang xử lý thao tác trước đó.",
      };
    }
    mutatingRef.current = true;
    setMutating(true);
    setError(null);
    return null;
  }, []);

  const endMutationGate = useCallback(() => {
    mutatingRef.current = false;
    if (mountedRef.current) {
      setMutating(false);
    }
  }, []);

  const runMutation = useCallback(
    async (executor) => {
      const gate = beginMutationGate();
      if (gate) return gate;
      try {
        const result = mapConflict(await executor());
        if (!mountedRef.current) return result;

        if (result?.ok) {
          if (result.revision != null) {
            revisionRef.current = Number(result.revision);
          }
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
        endMutationGate();
      }
    },
    [beginMutationGate, endMutationGate, refresh]
  );

  const runBulkPresence = useCallback(
    async (playerIds, mode) => {
      const gate = beginMutationGate();
      if (gate) return gate;

      const ids = [...new Set((playerIds || []).map(String).filter(Boolean))];
      const succeeded = [];
      let expected = Number(revisionRef.current || 0);

      try {
        for (const playerId of ids) {
          const result = mapConflict(
            await (mode === "checkOut"
              ? service.checkOut(
                  { tenantId, clubId, tournamentId },
                  {
                    playerId,
                    expectedVersion: expected,
                    idempotencyKey: `${mode}-${playerId}-${expected}`,
                  }
                )
              : service.checkIn(
                  { tenantId, clubId, tournamentId },
                  {
                    playerId,
                    expectedVersion: expected,
                    idempotencyKey: `${mode}-${playerId}-${expected}`,
                  }
                ))
          );

          if (!result?.ok) {
            await refresh({ background: true });
            const failure = {
              ok: false,
              code: result?.code || DAILY_PLAY_CODE.VALIDATION,
              error:
                result?.error ||
                DAILY_PLAY_MESSAGES[result?.code] ||
                (mode === "checkOut"
                  ? "Không bỏ chọn được toàn bộ VĐV."
                  : "Không chọn được toàn bộ VĐV."),
              partial: true,
              succeeded,
              failedPlayerId: playerId,
            };
            if (mountedRef.current) {
              setError(failure.error);
            }
            return failure;
          }

          expected = Number(result.revision);
          revisionRef.current = expected;
          succeeded.push(playerId);
        }

        const readback = await refresh({ background: true });
        if (!readback?.ok) {
          const failure = {
            ok: false,
            code: DAILY_PLAY_CODE.READBACK_FAILED,
            error: DAILY_PLAY_MESSAGES[DAILY_PLAY_CODE.READBACK_FAILED],
            mutationCommitted: true,
            partial: true,
            succeeded,
            readback,
          };
          if (mountedRef.current) setError(failure.error);
          return failure;
        }

        return {
          ok: true,
          revision: readback.revision,
          dailyPlay: readback.dailyPlay,
          succeeded,
          readback,
        };
      } finally {
        endMutationGate();
      }
    },
    [beginMutationGate, endMutationGate, refresh, service, tenantId, clubId, tournamentId]
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
    revisionRef,
    courts: state?.courts || [],
    courtStates: state?.courtStates || [],
    availableCourts: state?.availableCourts || [],
    hasCourtCapability: Boolean(state?.hasCourtCapability),
    leases: state?.leases || [],
    refresh,
    checkIn: (playerId) =>
      runMutation(() =>
        service.checkIn(scope, {
          playerId,
          expectedVersion: revisionRef.current,
        })
      ),
    checkOut: (playerId) =>
      runMutation(() =>
        service.checkOut(scope, {
          playerId,
          expectedVersion: revisionRef.current,
        })
      ),
    checkInMany: (playerIds) => runBulkPresence(playerIds, "checkIn"),
    checkOutMany: (playerIds) => runBulkPresence(playerIds, "checkOut"),
    createMatches: (matches, options = {}) =>
      runMutation(() =>
        service.createMatches(scope, {
          matches,
          expectedVersion: revisionRef.current,
          eligiblePlayerCount: options.eligiblePlayerCount,
          idempotencyKey: options.idempotencyKey,
        })
      ),
    assignCourt: (matchId, courtId = null) =>
      runMutation(() =>
        service.assignCourt(scope, {
          matchId,
          courtId,
          expectedVersion: revisionRef.current,
        })
      ),
    startMatch: (matchId) =>
      runMutation(() =>
        service.startMatch(scope, {
          matchId,
          expectedVersion: revisionRef.current,
        })
      ),
    submitScore: (matchId, scoreA, scoreB) =>
      runMutation(() =>
        service.submitScore(scope, {
          matchId,
          scoreA,
          scoreB,
          expectedVersion: revisionRef.current,
        })
      ),
    cancelMatch: (matchId) =>
      runMutation(() =>
        service.cancelMatch(scope, {
          matchId,
          expectedVersion: revisionRef.current,
        })
      ),
    changeCourt: (matchId, courtId) =>
      runMutation(() =>
        service.changeCourt(scope, {
          matchId,
          courtId,
          expectedVersion: revisionRef.current,
        })
      ),
  };
}
