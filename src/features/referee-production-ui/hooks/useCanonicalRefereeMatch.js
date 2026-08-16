import { useCallback, useEffect, useRef, useState } from "react";

import { REFEREE_ADAPTER_ERROR_CODE } from "../../competition-engine/integration/referee/constants.js";
import { REFEREE_UI_ERROR_CODE } from "../constants.js";

function nextKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Pending → canonical command (expectedVersion + idempotency) → ACK → fresh view.
 * No optimistic fake success. Duplicate taps blocked while pending.
 */
export function useCanonicalRefereeMatch({
  client,
  matchId,
  tenantId,
  actor,
  competitionId = null,
  competitionMode = null,
}) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [stale, setStale] = useState(false);
  const pendingRef = useRef(false);

  const scope = useCallback(
    (extra = {}) => ({
      matchId,
      tenantId,
      actor,
      competitionId: competitionId || extra.competitionId || view?.competitionId,
      competitionMode: competitionMode || extra.competitionMode || view?.competitionMode,
      expectedVersion: extra.expectedVersion ?? view?.expectedVersion,
      idempotencyKey: extra.idempotencyKey,
      commandId: extra.idempotencyKey,
    }),
    [matchId, tenantId, actor, competitionId, competitionMode, view]
  );

  const reload = useCallback(async () => {
    if (!client || !matchId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.getMatchView({
        matchId,
        tenantId,
        actor,
        competitionId,
        competitionMode,
      });
      setView(result.view);
      setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được trận");
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [client, matchId, tenantId, actor, competitionId, competitionMode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async (action, invoke) => {
      if (!client || pendingRef.current) {
        return {
          ok: false,
          duplicateBlocked: pendingRef.current,
          code: REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED,
        };
      }
      pendingRef.current = true;
      setPendingAction(action);
      setError(null);
      try {
        const result = await invoke(
          scope({ idempotencyKey: nextKey(action) })
        );
        if (result?.stale || result?.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE) {
          setStale(true);
          if (result.view) setView(result.view);
          return result;
        }
        if (result?.view) setView(result.view);
        setStale(false);
        return result;
      } catch (err) {
        if (err?.code === REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED) {
          return { ok: false, duplicateBlocked: true, code: err.code };
        }
        if (err?.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE) {
          setStale(true);
          setError(err.message);
          return { ok: false, stale: true, failClosed: true, error: err.message };
        }
        setError(err instanceof Error ? err.message : "Lệnh trọng tài thất bại");
        throw err;
      } finally {
        pendingRef.current = false;
        setPendingAction(null);
      }
    },
    [client, scope]
  );

  return {
    view,
    loading,
    error,
    pendingAction,
    stale,
    reload,
    startMatch: () => run("start", (cmd) => client.startMatch(cmd)),
    submitPoint: (scoringSide) =>
      run(`point:${scoringSide}`, (cmd) => client.submitPoint({ ...cmd, scoringSide })),
    changeServe: () =>
      run("change-serve", (cmd) => {
        const receiving = view?.receivingSideNow;
        if (!receiving) {
          return Promise.reject(new Error("Không xác định được bên nhận để đổi giao"));
        }
        return client.submitPoint({ ...cmd, scoringSide: receiving });
      }),
    suspendMatch: () => run("suspend", (cmd) => client.suspendMatch(cmd)),
    resumeMatch: () => run("resume", (cmd) => client.resumeMatch(cmd)),
    confirmChangeEnds: () => run("change-ends", (cmd) => client.confirmChangeEnds(cmd)),
    switchPositions: (sideKey) =>
      run(`switch-pos:${sideKey}`, (cmd) => client.switchPositions({ ...cmd, sideKey })),
    configureLineup: (payload) =>
      run("configure-lineup", (cmd) => client.configureLineup({ ...cmd, ...payload })),
    submitResult: (acceptResult = false) =>
      run("submit-result", (cmd) => client.submitResult({ ...cmd, acceptResult })),
    correctResult: () => run("correct", (cmd) => client.correctResult(cmd)),
  };
}
