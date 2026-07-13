/**
 * TT-6B polling fallback coordinator — one timer per scope key.
 */

export const POLLING_INTERVALS = Object.freeze({
  CRITICAL_MS: 4000,
  TOURNAMENT_MS: 8000,
  HIDDEN_MS: 15000,
});

/**
 * @param {{ intervals?: typeof POLLING_INTERVALS }} [options]
 */
export function createPollingFallbackCoordinator(options = {}) {
  const intervals = options.intervals ?? POLLING_INTERVALS;

  /** @type {Map<string, { timer: ReturnType<typeof setInterval> | null, intervalMs: number, hidden: boolean, onTick: () => void }>} */
  const scopes = new Map();

  function resolveIntervalMs(scopeType, hidden = false) {
    if (hidden) {
      return intervals.HIDDEN_MS;
    }
    if (scopeType === "sub_match" || scopeType === "referee_match") {
      return intervals.CRITICAL_MS;
    }
    return intervals.TOURNAMENT_MS;
  }

  function start(scopeKey, scopeType, onTick) {
    stop(scopeKey);
    const hidden = typeof document !== "undefined" && document.hidden;
    const intervalMs = resolveIntervalMs(scopeType, hidden);
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      onTick();
    }, intervalMs);
    scopes.set(scopeKey, { timer, intervalMs, hidden, onTick });
    return intervalMs;
  }

  function stop(scopeKey) {
    const entry = scopes.get(scopeKey);
    if (entry?.timer) {
      clearInterval(entry.timer);
    }
    scopes.delete(scopeKey);
  }

  function stopAll() {
    for (const key of scopes.keys()) {
      stop(key);
    }
  }

  function isActive(scopeKey) {
    return scopes.has(scopeKey);
  }

  function handleVisibilityChange() {
    const hidden = typeof document !== "undefined" && document.hidden;
    for (const [scopeKey, entry] of scopes.entries()) {
      if (entry.hidden === hidden) {
        continue;
      }
      const scopeType = scopeKey.split(":")[0] || "tournament";
      start(scopeKey, scopeType, entry.onTick);
      if (!hidden) {
        entry.onTick();
      }
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function dispose() {
    stopAll();
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }

  return {
    start,
    stop,
    stopAll,
    isActive,
    dispose,
    activeCount: () => scopes.size,
    resolveIntervalMs,
  };
}
