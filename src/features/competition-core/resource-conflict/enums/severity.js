/**
 * CORE-14 — severity constants (HARD / SOFT / INFO).
 */

export const SEVERITY = Object.freeze({
  HARD: "HARD",
  SOFT: "SOFT",
  INFO: "INFO",
});

export const SEVERITY_VALUES = Object.freeze([
  SEVERITY.HARD,
  SEVERITY.SOFT,
  SEVERITY.INFO,
]);

const SEVERITY_SET = new Set(SEVERITY_VALUES);

/** Rank for raise-only max: HARD > SOFT > INFO */
export const SEVERITY_RANK = Object.freeze({
  [SEVERITY.INFO]: 0,
  [SEVERITY.SOFT]: 1,
  [SEVERITY.HARD]: 2,
});

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isSeverity(value) {
  return typeof value === "string" && SEVERITY_SET.has(value);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function maxSeverity(a, b) {
  const ra = SEVERITY_RANK[a] ?? -1;
  const rb = SEVERITY_RANK[b] ?? -1;
  return ra >= rb ? a : b;
}
