/**
 * React hook for coaching UI collections (COACHING-04).
 *
 * Uses createDefaultCoachingRuntime() composition.
 * No silent fallback from durable failure to legacy success.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { COACHING_RUNTIME_MODE } from "./constants.js";
import { COACHING_RUNTIME_ERROR_CODES } from "./errors.js";
import { getDefaultCoachingRuntime } from "./createDefaultCoachingRuntime.js";

/**
 * @typedef {'idle'|'loading'|'ready'|'empty'|'error'|'denied'} CoachingCollectionStatus
 */

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
  const [rows, setRows] = useState(/** @type {object[]} */ ([]));
  const [error, setError] = useState(/** @type {object|null} */ (null));
  const [pending, setPending] = useState(false);
  const requestSeq = useRef(0);

  const applyResult = useCallback((result, seq) => {
    if (seq !== requestSeq.current) return; // stale
    if (!result || result.ok !== true) {
      const code = result?.code;
      if (code === COACHING_RUNTIME_ERROR_CODES.AUTHORIZATION_DENIED) {
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
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const result = await runtime.listCollection(collectionName, clubId);
      applyResult(result, seq);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setStatus("error");
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
          setError(result);
        } else if (result && result.ok === false) {
          setError(result);
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
          setError(result);
        } else if (result && result.ok === false) {
          setError(result);
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
    rows,
    error,
    reload,
    save,
    remove,
    pending,
  };
}
