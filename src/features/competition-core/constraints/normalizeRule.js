import { COMPETITION_CONSTRAINT_TYPE, isCompetitionConstraintType } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY, isConstraintSeverity } from "../constants/constraintSeverity.js";
import {
  DEFAULT_RULE_SET_ID,
  DEFAULT_RULE_SET_VERSION,
  DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE,
  LEGACY_CONSTRAINT_TYPE_ALIASES,
} from "./ruleConstants.js";

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 */

/**
 * @typedef {Object} RuleSet
 * @property {string} id
 * @property {string} version
 * @property {ConstraintDefinition[]} constraints
 * @property {Record<string, unknown>} [metadata]
 */

function resolveCanonicalType(rawType) {
  const normalized = String(rawType || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (isCompetitionConstraintType(normalized)) {
    return normalized;
  }
  const alias = LEGACY_CONSTRAINT_TYPE_ALIASES[normalized];
  if (alias && isCompetitionConstraintType(alias)) {
    return alias;
  }
  return null;
}

function resolveSeverity(type, partial) {
  if (partial.severity && isConstraintSeverity(partial.severity)) {
    return partial.severity;
  }
  if (partial.mode === "hard") {
    return CONSTRAINT_SEVERITY.HARD;
  }
  if (partial.mode === "soft") {
    return CONSTRAINT_SEVERITY.SOFT;
  }
  return DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE[type] || CONSTRAINT_SEVERITY.SOFT;
}

function normalizeParams(partial, canonicalType) {
  const params = partial.params && typeof partial.params === "object" ? { ...partial.params } : {};

  const anchor =
    partial.anchorPlayerId ??
    params.anchorPlayerId ??
    partial.playerA ??
    params.playerA ??
    null;
  const targetsRaw =
    partial.targetPlayerIds ??
    params.targetPlayerIds ??
    (partial.playerB || params.playerB ? [partial.playerB ?? params.playerB] : []);

  if (anchor) {
    params.anchorPlayerId = String(anchor);
  }

  if (Array.isArray(targetsRaw) && targetsRaw.length) {
    params.targetPlayerIds = targetsRaw.map((id) => String(id)).filter(Boolean);
  }

  if (canonicalType === COMPETITION_CONSTRAINT_TYPE.GENDER_ELIGIBILITY && !params.eventType) {
    params.eventType = partial.eventType ?? "mixed_double";
  }

  if (canonicalType === COMPETITION_CONSTRAINT_TYPE.SKILL_CAP && params.maxDiff == null) {
    params.maxDiff = partial.maxDiff ?? 0.5;
  }

  if (
    canonicalType === COMPETITION_CONSTRAINT_TYPE.SAME_CLUB_SEPARATION &&
    params.scope == null
  ) {
    params.scope = partial.scope ?? (partial.type === "avoid_same_group" ? "group" : "group");
  }

  return Object.keys(params).length ? params : undefined;
}

/**
 * Normalize raw constraint input to canonical ConstraintDefinition.
 *
 * @param {Partial<ConstraintDefinition> & Record<string, unknown>} [raw]
 * @param {number} [index]
 * @returns {ConstraintDefinition|null}
 */
export function normalizeRuleDefinition(raw, index = 0) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const canonicalType = resolveCanonicalType(raw.type);
  if (!canonicalType) {
    return null;
  }

  const id = String(raw.id || `rule-${index + 1}-${canonicalType}`);

  return {
    id,
    type: canonicalType,
    severity: resolveSeverity(canonicalType, raw),
    enabled: raw.enabled !== false,
    params: normalizeParams(raw, canonicalType),
  };
}

/**
 * @param {Array<Partial<ConstraintDefinition>|null|undefined>} rules
 * @returns {ConstraintDefinition[]}
 */
export function normalizeRuleDefinitions(rules = []) {
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule, index) => normalizeRuleDefinition(rule, index))
    .filter(Boolean);
}

/**
 * @param {Partial<RuleSet>} [partial]
 * @returns {RuleSet}
 */
export function createRuleSet(partial = {}) {
  return {
    id: String(partial.id || DEFAULT_RULE_SET_ID),
    version: String(partial.version || DEFAULT_RULE_SET_VERSION),
    constraints: normalizeRuleDefinitions(partial.constraints || []),
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : {},
  };
}

/**
 * @param {RuleSet|Partial<RuleSet>} ruleSet
 * @returns {RuleSet}
 */
export function normalizeRuleSet(ruleSet) {
  return createRuleSet(ruleSet);
}
