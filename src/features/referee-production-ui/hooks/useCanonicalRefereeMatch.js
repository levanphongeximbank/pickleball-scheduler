import { useCallback, useEffect, useRef, useState } from "react";

import { REFEREE_ADAPTER_ERROR_CODE } from "../../competition-engine/integration/referee/constants.js";
import { REFEREE_UI_ERROR_CODE } from "../constants.js";
import { deriveOptimisticSubmitPointView } from "../projection/deriveOptimisticSubmitPointView.js";

function nextKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPointAction(action) {
  return String(action || "").startsWith("point:") || action === "change-serve";
}

function isUndoAction(action) {
  return action === "undo" || action === "UNDO_LAST_SCORING_ACTION";
}

function classifyCommandError(err, { action } = {}) {
  const code = err?.code || "";
  const message = err instanceof Error ? err.message : String(err || "");
  const forUndo = isUndoAction(action);
  if (
    code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE ||
    /stale|expectedVersion|CAS|version/i.test(message)
  ) {
    return {
      stale: true,
      message: forUndo
        ? "Chưa hoàn tác được. Trạng thái trận đã thay đổi, vui lòng thử lại."
        : "Chưa ghi được điểm. Trạng thái trận đã thay đổi, vui lòng thử lại.",
    };
  }
  if (/network|fetch|Failed to fetch|timeout|ECONN|offline/i.test(message)) {
    return {
      stale: false,
      message: forUndo
        ? "Không thể hoàn tác. Vui lòng thử lại."
        : "Không thể xác nhận điểm. Vui lòng thử lại.",
    };
  }
  if (
    code === "FAIL_CLOSED_UNSUPPORTED_FOR_QUICK_UNDO" ||
    /confirmChangeEnds|CHANGE_END_ACKED|quick undo/i.test(message)
  ) {
    return {
      stale: false,
      message:
        "Không thể hoàn tác nhanh sau khi đã xác nhận đổi sân.",
    };
  }
  if (code === "UNDO_NOT_ELIGIBLE" || /No eligible scoring action/i.test(message)) {
    return {
      stale: false,
      message: "Không có lần ghi điểm nào để hoàn tác.",
    };
  }
  return {
    stale: false,
    message:
      message ||
      (forUndo
        ? "Không thể hoàn tác. Vui lòng thử lại."
        : "Không thể xác nhận điểm. Vui lòng thử lại."),
  };
}

/**
 * Authoritative view stays server-ACK only.
 * Optimistic view is memory-only presentation until ACK or rollback.
 * expectedVersion always comes from authoritativeView.
 */
export function useCanonicalRefereeMatch({
  client,
  matchId,
  tenantId,
  actor,
  competitionId = null,
  competitionMode = null,
}) {
  const [authoritativeView, setAuthoritativeView] = useState(null);
  const [optimisticView, setOptimisticView] = useState(null);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const pendingRef = useRef(false);
  const commandEpochRef = useRef(0);
  const authoritativeRef = useRef(null);
  const perfRef = useRef({ tapAt: 0, optimisticAt: 0 });

  authoritativeRef.current = authoritativeView;

  const clearOptimistic = useCallback(() => {
    commandEpochRef.current += 1;
    pendingRef.current = false;
    setOptimisticView(null);
    setPendingCommand(null);
  }, []);

  const scope = useCallback(
    (extra = {}) => {
      const auth = authoritativeRef.current;
      return {
        matchId,
        tenantId,
        actor,
        competitionId: competitionId || extra.competitionId || auth?.competitionId,
        competitionMode: competitionMode || extra.competitionMode || auth?.competitionMode,
        // CAS: always authoritative version — never optimistic.
        expectedVersion: extra.expectedVersion ?? auth?.expectedVersion,
        idempotencyKey: extra.idempotencyKey,
        commandId: extra.idempotencyKey,
      };
    },
    [matchId, tenantId, actor, competitionId, competitionMode]
  );

  const reload = useCallback(async () => {
    if (!client || !matchId) return;
    setLoading(true);
    setError(null);
    clearOptimistic();
    try {
      const result = await client.getMatchView({
        matchId,
        tenantId,
        actor,
        competitionId,
        competitionMode,
      });
      setAuthoritativeView(result.view);
      setStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được trận");
      setAuthoritativeView(null);
    } finally {
      setLoading(false);
    }
  }, [client, matchId, tenantId, actor, competitionId, competitionMode, clearOptimistic]);

  // Route / match change and logout (actor cleared) drop memory-only optimistic state.
  useEffect(() => {
    clearOptimistic();
  }, [matchId, actor?.actorId, actor?.authUid, clearOptimistic]);

  useEffect(() => {
    if (!actor) {
      clearOptimistic();
      setAuthoritativeView(null);
    }
  }, [actor, clearOptimistic]);

  useEffect(() => {
    reload();
  }, [reload]);

  const run = useCallback(
    async (action, invoke, { optimistic = null } = {}) => {
      if (!client || pendingRef.current) {
        return {
          ok: false,
          duplicateBlocked: pendingRef.current,
          code: REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED,
        };
      }
      const epoch = commandEpochRef.current;
      pendingRef.current = true;
      setPendingCommand(action);
      setError(null);

      const tapAt =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      perfRef.current.tapAt = tapAt;

      if (optimistic) {
        setOptimisticView(optimistic);
        const optimisticAt =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        perfRef.current.optimisticAt = optimisticAt;
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[referee-optimistic]", {
            OPTIMISTIC_RENDER_MS: Math.round(optimisticAt - tapAt),
            action,
          });
        }
      }

      const stillCurrent = () => epoch === commandEpochRef.current;

      try {
        const result = await invoke(
          scope({ idempotencyKey: nextKey(action) })
        );
        if (!stillCurrent()) {
          return { ok: false, cancelled: true };
        }
        const ackAt =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
        if (typeof console !== "undefined" && console.debug) {
          console.debug("[referee-optimistic]", {
            ACK_TOTAL_MS: Math.round(ackAt - tapAt),
            action,
            ok: result?.ok !== false,
          });
        }

        if (result?.stale || result?.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE) {
          clearOptimistic();
          setStale(true);
          if (result.view) setAuthoritativeView(result.view);
          if (isPointAction(action) || isUndoAction(action)) {
            setError(
              isUndoAction(action)
                ? "Chưa hoàn tác được. Trạng thái trận đã thay đổi, vui lòng thử lại."
                : "Chưa ghi được điểm. Trạng thái trận đã thay đổi, vui lòng thử lại."
            );
          }
          return result;
        }
        if (result?.view) setAuthoritativeView(result.view);
        clearOptimistic();
        setStale(false);
        return result;
      } catch (err) {
        if (!stillCurrent()) {
          return { ok: false, cancelled: true };
        }
        clearOptimistic();
        if (err?.code === REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED) {
          return { ok: false, duplicateBlocked: true, code: err.code };
        }
        const classified = classifyCommandError(err, { action });
        if (classified.stale || err?.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE) {
          setStale(true);
          setError(classified.message);
          return { ok: false, stale: true, failClosed: true, error: classified.message };
        }
        setError(
          isPointAction(action) || isUndoAction(action)
            ? classified.message
            : err instanceof Error
              ? err.message
              : "Lệnh trọng tài thất bại"
        );
        if (isPointAction(action) || isUndoAction(action)) {
          return { ok: false, error: classified.message, networkFailure: true };
        }
        throw err;
      } finally {
        if (stillCurrent()) {
          pendingRef.current = false;
          setPendingCommand(null);
        }
      }
    },
    [client, scope, clearOptimistic]
  );

  const submitPoint = useCallback(
    (scoringSide) => {
      const auth = authoritativeRef.current;
      const optimistic = deriveOptimisticSubmitPointView(auth, scoringSide);
      return run(
        `point:${scoringSide}`,
        (cmd) => client.submitPoint({ ...cmd, scoringSide }),
        { optimistic }
      );
    },
    [client, run]
  );

  const changeServe = useCallback(() => {
    const auth = authoritativeRef.current;
    const receiving = auth?.receivingSideNow;
    if (!receiving) {
      return Promise.reject(new Error("Không xác định được bên nhận để đổi giao"));
    }
    const optimistic = deriveOptimisticSubmitPointView(auth, receiving);
    return run(
      "change-serve",
      (cmd) => client.submitPoint({ ...cmd, scoringSide: receiving }),
      { optimistic }
    );
  }, [client, run]);

  // No optimistic restore — pending until server ACK replaces authoritative view.
  const undoLastScoringAction = useCallback(() => {
    return run("undo", (cmd) => client.undoLastScoringAction(cmd));
  }, [client, run]);

  const displayView = optimisticView ?? authoritativeView;

  return {
    view: displayView,
    authoritativeView,
    optimisticView,
    pendingCommand,
    displayView,
    loading,
    error,
    pendingAction: pendingCommand,
    stale,
    reload,
    clearOptimistic,
    startMatch: () => run("start", (cmd) => client.startMatch(cmd)),
    submitPoint,
    changeServe,
    undoLastScoringAction,
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
