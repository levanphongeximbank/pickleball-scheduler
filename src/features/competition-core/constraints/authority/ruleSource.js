/**
 * Canonical Competition Rule authority ladder — CORE-01.
 *
 * SUPER_ADMIN > TOURNAMENT > CLUB > SESSION > DEFAULT
 * Numeric priorities are frozen and must stay aligned with Private Pairing parity.
 *
 * CONSTRAINT_SCOPE is NOT an authority source — do not use it here.
 */

export const RULE_SOURCE = Object.freeze({
  SUPER_ADMIN: "SUPER_ADMIN",
  TOURNAMENT: "TOURNAMENT",
  CLUB: "CLUB",
  SESSION: "SESSION",
  DEFAULT: "DEFAULT",
});

/** @type {ReadonlySet<string>} */
export const RULE_SOURCE_VALUES = new Set(Object.values(RULE_SOURCE));

/** Numeric authority — higher wins. */
export const RULE_SOURCE_PRIORITY = Object.freeze({
  [RULE_SOURCE.SUPER_ADMIN]: 1000,
  [RULE_SOURCE.TOURNAMENT]: 800,
  [RULE_SOURCE.CLUB]: 600,
  [RULE_SOURCE.SESSION]: 400,
  [RULE_SOURCE.DEFAULT]: 0,
});

/** Canonical descending authority order (audit / diagnostics). */
export const RULE_SOURCE_ORDER = Object.freeze([
  RULE_SOURCE.SUPER_ADMIN,
  RULE_SOURCE.TOURNAMENT,
  RULE_SOURCE.CLUB,
  RULE_SOURCE.SESSION,
  RULE_SOURCE.DEFAULT,
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRuleSource(value) {
  return typeof value === "string" && RULE_SOURCE_VALUES.has(value);
}

/**
 * Derive authority source from an explicit `source` field.
 * Unknown / missing → DEFAULT (never invent from CONSTRAINT_SCOPE).
 *
 * @param {string|{ source?: string }|null|undefined} ruleOrSource
 * @returns {string}
 */
export function deriveRuleSource(ruleOrSource) {
  if (ruleOrSource && typeof ruleOrSource === "object") {
    if (isRuleSource(ruleOrSource.source)) {
      return ruleOrSource.source;
    }
    return RULE_SOURCE.DEFAULT;
  }
  if (isRuleSource(ruleOrSource)) {
    return ruleOrSource;
  }
  return RULE_SOURCE.DEFAULT;
}

/**
 * Numeric source priority. Explicit numeric `sourcePriority` wins if finite.
 *
 * @param {{ source?: string, sourcePriority?: number }|null|undefined} rule
 * @returns {number}
 */
export function resolveRuleSourcePriority(rule) {
  const explicit = Number(rule?.sourcePriority);
  if (Number.isFinite(explicit)) {
    return explicit;
  }
  const source = deriveRuleSource(rule || {});
  return RULE_SOURCE_PRIORITY[source] ?? 0;
}
