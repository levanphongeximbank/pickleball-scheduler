/**
 * useDailyPlayCanonicalSession — authoritative readback + mutation orchestration.
 * DP-13: hidden tabs skip routine poll; visibility resume is one silent get_state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { DAILY_PLAY_CODE, DAILY_PLAY_MESSAGES } from "./dailyPlayCodes.js";
import { getDailyPlayCanonicalService } from "./dailyPlayCanonicalService.js";
import { emptyDailyPlayState } from "./dailyPlayCanonicalDomain.js";
import { normalizeDailyPlayServerSnapshot } from "./normalizeDailyPlayServerSnapshot.js";
import {
  createDailyPlayRefreshFence,
  DAILY_PLAY_REFRESH_REASON,
  isDocumentHidden,
  isSilentRefreshReason,
  shouldReplaceCanonicalSnapshot,
  shouldSkipRoutinePoll,
} from "./dailyPlaySessionRefresh.js";

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

function resolveRefreshReason({ background, mutationCommitted, reason } = {}) {
  if (reason) return reason;
  if (mutationCommitted) return DAILY_PLAY_REFRESH_REASON.MUTATION;
  if (background) return DAILY_PLAY_REFRESH_REASON.BACKGROUND;
  return DAILY_PLAY_REFRESH_REASON.INITIAL;
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
  const hasSnapshotRef = useRef(false);
  const revisionRef = useRef(0);
  const mutatingRef = useRef(false);
  const signatureRef = useRef("");
  const fenceRef = useRef(null);
  if (!fenceRef.current) {
    fenceRef.current = createDailyPlayRefreshFence();
  }

  const applySnapshot = useCallback((snapshot) => {
    if (!mountedRef.current || !snapshot?.ok) return false;
    const normalized = normalizeDailyPlayServerSnapshot(snapshot);
    if (!normalized.ok) return false;
    const decision = shouldReplaceCanonicalSnapshot(signatureRef.current, normalized);
    hasSnapshotRef.current = true;
    revisionRef.current = Number(normalized.revision || 0);
    if (!decision.replace) return false;
    signatureRef.current = decision.signature;
    setState(normalized);
    setError(null);
    return true;
  }, []);

  const refresh = useCallback(
    async (options = {}) => {
      const reason = resolveRefreshReason(options);
      const silent = isSilentRefreshReason(reason) || options.background === true;
      if (!enabled || !tenantId || !clubId || !tournamentId) {
        hasSnapshotRef.current = false;
        signatureRef.current = "";
        revisionRef.current = 0;
        setState(null);
        setLoading(false);
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VALIDATION,
          error: "Thiếu phạm vi.",
        };
      }

      if (shouldSkipRoutinePoll(reason, isDocumentHidden())) {
        return { ok: true, skipped: true, reason };
      }

      const fence = fenceRef.current;
      const token = fence.begin(reason);
      if (token.kind === "join") {
        return token.promise;
      }
      if (token.waitFor) {
        await token.waitFor;
      }

      const isInitial = !hasSnapshotRef.current && !silent;
      if (isInitial) setLoading(true);

      try {
        const snapshot = await service.getState({ tenantId, clubId, tournamentId });
        if (!mountedRef.current) {
          fence.finish(token, snapshot);
          return snapshot;
        }
        if (!fence.isCurrent(token.generation)) {
          fence.finish(token, snapshot);
          return snapshot;
        }
        if (snapshot?.ok) {
          applySnapshot(snapshot);
        } else if (!silent && !hasSnapshotRef.current) {
          setError(
            snapshot?.error ||
              DAILY_PLAY_MESSAGES[snapshot?.code] ||
              "Lỗi tải Daily Play."
          );
        }
        fence.finish(token, snapshot);
        return snapshot;
      } catch (caught) {
        const failure = {
          ok: false,
          code: DAILY_PLAY_CODE.CLOUD_UNAVAILABLE,
          error: String(caught?.message || caught),
        };
        if (mountedRef.current && !silent && !hasSnapshotRef.current) {
          setError(failure.error);
        }
        fence.finish(token, failure);
        return failure;
      } finally {
        if (mountedRef.current && isInitial) {
          setLoading(false);
        }
      }
    },
    [applySnapshot, clubId, enabled, service, tenantId, tournamentId]
  );

  useEffect(() => {
    mountedRef.current = true;
    hasSnapshotRef.current = false;
    revisionRef.current = 0;
    signatureRef.current = "";
    fenceRef.current = createDailyPlayRefreshFence();
    void refresh({ background: false, reason: DAILY_PLAY_REFRESH_REASON.INITIAL });
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !tournamentId || !pollMs || pollMs < 3000) return undefined;
    const timer = setInterval(() => {
      if (isDocumentHidden()) return;
      void refresh({
        background: true,
        reason: DAILY_PLAY_REFRESH_REASON.POLL,
      });
    }, pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, refresh, tournamentId]);

  useEffect(() => {
    if (!enabled || !tournamentId) return undefined;
    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      void refresh({
        background: true,
        reason: DAILY_PLAY_REFRESH_REASON.VISIBILITY_RESUME,
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, refresh, tournamentId]);

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
          const readback = await refresh({
            background: true,
            mutationCommitted: true,
            reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
          });
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
          await refresh({
            background: true,
            reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
          });
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
            await refresh({
              background: true,
              reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
            });
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

        const readback = await refresh({
          background: true,
          mutationCommitted: true,
          reason: DAILY_PLAY_REFRESH_REASON.MUTATION,
        });
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
    refreshing: false,
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
    leases: state?.leases || state?.activeLeases || [],
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
    correctScore: (matchId, scoreA, scoreB, note = "") =>
      runMutation(() =>
        service.correctScore(scope, {
          matchId,
          scoreA,
          scoreB,
          note,
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
