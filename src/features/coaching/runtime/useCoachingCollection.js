/**
 * React hook for coaching UI collections (COACHING-04).
 *
 * Uses createDefaultCoachingRuntime() composition.
 * No silent fallback from durable failure to legacy success.
 * Surfaces explicit provenance: LIVE / EMPTY / UNMAPPED / FORBIDDEN / ERROR.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { COACHING_RUNTIME_MODE } from "./constants.js";
import { COACHING_RUNTIME_ERROR_CODES } from "./errors.js";
import { COACHING_PLAYER_SCOPE_STATE } from "./playerSelfScope.js";
import { getDefaultCoachingRuntime } from "./createDefaultCoachingRuntime.js";

/**
 * @typedef {'idle'|'loading'|'ready'|'empty'|'error'|'denied'|'unmapped'|'forbidden'} CoachingCollectionStatus
 * @typedef {'LOADING'|'LIVE'|'EMPTY'|'UNMAPPED'|'FORBIDDEN'|'ERROR'|null} CoachingProvenanceState
 */

/**
 * @param {object|null|undefined} result
 * @returns {CoachingProvenanceState}
 */
function deriveProvenance(result) {
  if (!result) return COACHING_PLAYER_SCOPE_STATE.ERROR;
  if (result.state && typeof result.state === "string") {
    return /** @type {CoachingProvenanceState} */ (result.state);
  }
  if (result.ok === true) {
    const data = Array.isArray(result.data) ? result.data : [];
    return data.length === 0
      ? COACHING_PLAYER_SCOPE_STATE.EMPTY
      : COACHING_PLAYER_SCOPE_STATE.LIVE;
  }
  const code = result.code;
  const playerState = result.details?.playerScopeState;
  if (playerState && typeof playerState === "string") {
    return /** @type {CoachingProvenanceState} */ (playerState);
  }
  if (code === COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED) {
    return COACHING_PLAYER_SCOPE_STATE.UNMAPPED;
  }
  if (code === COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED) {
    return COACHING_PLAYER_SCOPE_STATE.FORBIDDEN;
  }
  return COACHING_PLAYER_SCOPE_STATE.ERROR;
}

/**
 * @param {string} collectionName
 * @param {{ clubId?: string|null }} [options]
 */
export function useCoachingCollection(collectionName, options = {}) {
  const clubId = options.clubId != null ? String(options.clubId).trim() : "";
  const runtime = getDefaultCoachingRuntime();
  const mode = runtime.mode;

  const [status, setStatus] = useState(
    /** @type {CoachingCollectionStatus} */ ("idle")
  );
  const [provenance, setProvenance] = useState(
    /** @type {CoachingProvenanceState} */ (null)
  );
  const [rows, setRows] = useState(/** @type {object[]} */ ([]));
  const [error, setError] = useState(/** @type {object|null} */ (null));
  const [pending, setPending] = useState(false);
  const requestSeq = useRef(0);

  const applyResult = useCallback((result, seq) => {
    if (seq !== requestSeq.current) return; // stale
    const nextProvenance = deriveProvenance(result);
    setProvenance(nextProvenance);

    if (!result || result.ok !== true) {
      const code = result?.code;
      if (nextProvenance === COACHING_PLAYER_SCOPE_STATE.UNMAPPED) {
        setStatus("unmapped");
      } else if (
        code === COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED ||
        nextProvenance === COACHING_PLAYER_SCOPE_STATE.FORBIDDEN
      ) {
        setStatus("denied");
      } else {
        setStatus("error");
      }
      setError(result || { ok: false, error: "Unknown coaching runtime error." });
      setRows([]);
      return;
    }
    const data = Array.isArray(result.data) ? result.data : [];
    setRows(data);
    setError(null);
    setStatus(data.length === 0 ? "empty" : "ready");
  }, []);

  const reload = useCallback(async () => {
    const seq = ++requestSeq.current;
    if (!clubId) {
      setRows([]);
      setError(null);
      setStatus("idle");
      setProvenance(null);
      return;
    }

    setStatus("loading");
    setProvenance(COACHING_PLAYER_SCOPE_STATE.LOADING);
    setError(null);

    try {
      const result = await runtime.listCollection(collectionName, clubId);
      applyResult(result, seq);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setStatus("error");
      setProvenance(COACHING_PLAYER_SCOPE_STATE.ERROR);
      setError({
        ok: false,
        code: COACHING_RUNTIME_ERROR_CODES.DURABLE_UNAVAILABLE,
        error: err?.message || "Failed to load coaching collection.",
      });
      setRows([]);
    }
  }, [applyResult, clubId, collectionName, runtime]);

  useEffect(() => {
    void reload();
    return () => {
      // Invalidate in-flight responses when club/collection changes or unmounts.
      requestSeq.current += 1;
    };
  }, [reload]);

  const save = useCallback(
    async (row) => {
      if (!clubId) {
        return {
          ok: false,
          code: COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
          error: "clubId is required.",
        };
      }
      setPending(true);
      try {
        const result = await runtime.saveCollection(collectionName, clubId, row);
        if (result?.ok) {
          await reload();
        } else if (
          result?.code === COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED
        ) {
          setStatus("denied");
          setProvenance(COACHING_PLAYER_SCOPE_STATE.FORBIDDEN);
          setError(result);
        } else if (result && result.ok === false) {
          setError(result);
          setProvenance(deriveProvenance(result));
        }
        return result;
      } finally {
        setPending(false);
      }
    },
    [clubId, collectionName, reload, runtime]
  );

  const remove = useCallback(
    async (id) => {
      if (!clubId) {
        return {
          ok: false,
          code: COACHING_RUNTIME_ERROR_CODES.MISSING_SCOPE,
          error: "clubId is required.",
        };
      }
      setPending(true);
      try {
        const result = await runtime.deleteCollection(
          collectionName,
          clubId,
          id
        );
        if (result?.ok) {
          await reload();
        } else if (
          result?.code === COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED
        ) {
          setStatus("denied");
          setProvenance(COACHING_PLAYER_SCOPE_STATE.FORBIDDEN);
          setError(result);
        } else if (result && result.ok === false) {
          setError(result);
          setProvenance(deriveProvenance(result));
        }
        return result;
      } finally {
        setPending(false);
      }
    },
    [clubId, collectionName, reload, runtime]
  );

  return {
    mode: mode || COACHING_RUNTIME_MODE.LEGACY,
    status,
    provenance,
    rows,
    error,
    reload,
    save,
    remove,
    pending,
  };
}
