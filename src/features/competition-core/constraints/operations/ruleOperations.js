/**
 * Canonical Competition Rule operations — CORE-01.
 *
 * Names below are frozen. Do not rename to PAIRING / MATCH_GENERATE / TEAM_ROSTER / DIVISION.
 * Legacy aliases (if any) are explicit mappings with unit-test coverage.
 */

export const RULE_OPERATION = Object.freeze({
  TEAM_FORMATION: "TEAM_FORMATION",
  PARTNER_PAIRING: "PARTNER_PAIRING",
  GROUP_DRAW: "GROUP_DRAW",
  SEEDING: "SEEDING",
  LINEUP: "LINEUP",
  MATCHUP: "MATCHUP",
  SCHEDULE: "SCHEDULE",
  COURT_ASSIGNMENT: "COURT_ASSIGNMENT",
  REFEREE_ASSIGNMENT: "REFEREE_ASSIGNMENT",
  SCORING: "SCORING",
  STANDINGS: "STANDINGS",
  TIE_BREAK: "TIE_BREAK",
  ELIGIBILITY: "ELIGIBILITY",
  REGISTRATION: "REGISTRATION",
  ALL: "ALL",
});

/** @type {ReadonlySet<string>} */
export const RULE_OPERATION_VALUES = new Set(Object.values(RULE_OPERATION));

/**
 * Explicit legacy / informal alias → canonical operation.
 * Only listed aliases are accepted; unknown strings are unsupported.
 */
export const RULE_OPERATION_ALIASES = Object.freeze({
  PAIRING: RULE_OPERATION.PARTNER_PAIRING,
  MATCH_GENERATE: RULE_OPERATION.MATCHUP,
  TEAM_ROSTER: RULE_OPERATION.TEAM_FORMATION,
  DIVISION: RULE_OPERATION.GROUP_DRAW,
});

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRuleOperation(value) {
  return typeof value === "string" && RULE_OPERATION_VALUES.has(value);
}

/**
 * Resolve a raw operation string to a canonical RULE_OPERATION value.
 *
 * @param {unknown} value
 * @returns {string|null} canonical operation or null if unsupported
 */
export function resolveCanonicalOperation(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const raw = value.trim();
  if (isRuleOperation(raw)) {
    return raw;
  }
  const upper = raw.toUpperCase();
  if (isRuleOperation(upper)) {
    return upper;
  }
  if (Object.prototype.hasOwnProperty.call(RULE_OPERATION_ALIASES, upper)) {
    return RULE_OPERATION_ALIASES[upper];
  }
  if (Object.prototype.hasOwnProperty.call(RULE_OPERATION_ALIASES, raw)) {
    return RULE_OPERATION_ALIASES[raw];
  }
  return null;
}

/**
 * Whether a rule participates in the requested operation.
 * Rules with empty/missing operations match ALL (backward compatible).
 *
 * @param {{ operations?: string[] }|null|undefined} rule
 * @param {string} operation
 * @returns {boolean}
 */
export function matchRuleOperation(rule, operation) {
  const requested = resolveCanonicalOperation(operation);
  if (!requested) {
    return false;
  }
  if (requested === RULE_OPERATION.ALL) {
    return true;
  }

  const rawOps = Array.isArray(rule?.operations) ? rule.operations : null;
  if (!rawOps || rawOps.length === 0) {
    // Backward compatible: unspecified operations apply to every operation.
    return true;
  }

  const canonicalOps = [];
  for (let i = 0; i < rawOps.length; i += 1) {
    const resolved = resolveCanonicalOperation(rawOps[i]);
    if (resolved) {
      canonicalOps.push(resolved);
    }
  }

  if (canonicalOps.includes(RULE_OPERATION.ALL)) {
    return true;
  }
  return canonicalOps.includes(requested);
}
