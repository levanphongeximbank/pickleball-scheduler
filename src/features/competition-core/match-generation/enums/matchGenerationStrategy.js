/**
 * CORE-09 — format-neutral MatchGenerationStrategy identifiers.
 */

export const MATCH_GENERATION_STRATEGY = Object.freeze({
  ROUND_ROBIN: "ROUND_ROBIN",
  GROUP_ROUND_ROBIN: "GROUP_ROUND_ROBIN",
  SINGLE_ELIMINATION: "SINGLE_ELIMINATION",
  TEAM_FIXTURE: "TEAM_FIXTURE",
});

/** Anticipated but not yet supported — fail closed if requested. */
export const DEFERRED_MATCH_GENERATION_STRATEGY = Object.freeze({
  SWISS: "SWISS",
  DOUBLE_ELIMINATION: "DOUBLE_ELIMINATION",
});

/** @type {ReadonlySet<string>} */
export const MATCH_GENERATION_STRATEGY_VALUES = new Set(
  Object.values(MATCH_GENERATION_STRATEGY)
);

/** @type {ReadonlySet<string>} */
export const DEFERRED_MATCH_GENERATION_STRATEGY_VALUES = new Set(
  Object.values(DEFERRED_MATCH_GENERATION_STRATEGY)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMatchGenerationStrategy(value) {
  return (
    typeof value === "string" && MATCH_GENERATION_STRATEGY_VALUES.has(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDeferredMatchGenerationStrategy(value) {
  return (
    typeof value === "string" &&
    DEFERRED_MATCH_GENERATION_STRATEGY_VALUES.has(value)
  );
}

/**
 * Supported for Phase 1B contract binding (executors arrive in later phases).
 * Deferred / unknown → fail closed.
 *
 * @param {unknown} value
 * @returns {{ ok: true, strategy: string }|{ ok: false, reason: string }}
 */
export function resolveSupportedStrategy(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, reason: "STRATEGY_REQUIRED" };
  }
  const raw = value.trim().toUpperCase();
  if (MATCH_GENERATION_STRATEGY_VALUES.has(raw)) {
    return { ok: true, strategy: raw };
  }
  if (DEFERRED_MATCH_GENERATION_STRATEGY_VALUES.has(raw)) {
    return { ok: false, reason: "STRATEGY_DEFERRED" };
  }
  return { ok: false, reason: "STRATEGY_UNSUPPORTED" };
}
