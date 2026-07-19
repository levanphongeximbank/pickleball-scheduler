import { COMPETITION_CONSTRAINT_TYPE, isCompetitionConstraintType } from "../constants/constraintType.js";
import { CONSTRAINT_SEVERITY, isConstraintSeverity } from "../constants/constraintSeverity.js";
import { isConstraintScope } from "../constants/constraintScope.js";
import { RULE_SET_STATUS, isRuleSetStatus } from "../constants/ruleSetStatus.js";
import {
  DEFAULT_RULE_SET_ID,
  DEFAULT_RULE_SET_VERSION,
  DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE,
  LEGACY_CONSTRAINT_TYPE_ALIASES,
} from "./ruleConstants.js";
import { deriveRuleSource, isRuleSource, resolveRuleSourcePriority } from "./authority/ruleSource.js";
import { isRulePriority } from "./authority/rulePriority.js";
import { resolveCanonicalOperation } from "./operations/ruleOperations.js";

/**
 * @typedef {import('../types/index.js').ConstraintDefinition} ConstraintDefinition
 * @typedef {import('../types/index.js').RuleSet} RuleSet
 * @typedef {import('../types/index.js').ConstraintApplicability} ConstraintApplicability
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

function normalizeApplicability(raw) {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  /** @type {ConstraintApplicability} */
  const applicability = {};
  const fields = [
    "tenantId",
    "clubId",
    "tournamentId",
    "competitionId",
    "eventId",
    "sessionId",
    "venueId",
    "competitionType",
    "gender",
    "ageGroup",
    "effectiveFrom",
    "effectiveTo",
  ];
  fields.forEach((field) => {
    if (raw[field] != null) {
      applicability[field] = String(raw[field]);
    }
  });
  if (raw.skillMin != null) {
    applicability.skillMin = Number(raw.skillMin);
  }
  if (raw.skillMax != null) {
    applicability.skillMax = Number(raw.skillMax);
  }
  return Object.keys(applicability).length ? applicability : undefined;
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

  /** @type {import('../types/index.js').ConstraintDefinition} */
  const normalized = {
    id,
    type: canonicalType,
    severity: resolveSeverity(canonicalType, raw),
    enabled: raw.enabled !== false,
    scope: isConstraintScope(raw.scope) ? raw.scope : undefined,
    applicability: normalizeApplicability(raw.applicability),
    params: normalizeParams(raw, canonicalType),
  };

  // CORE-01 optional authority / operation fields — only when provided (backward compatible).
  if (raw.source != null || raw.sourcePriority != null) {
    const source = isRuleSource(raw.source) ? raw.source : deriveRuleSource(raw);
    normalized.source = source;
    const explicitPriority = Number(raw.sourcePriority);
    normalized.sourcePriority = Number.isFinite(explicitPriority)
      ? explicitPriority
      : resolveRuleSourcePriority({ ...raw, source });
  }

  if (isRulePriority(raw.priority) || (typeof raw.priority === "number" && Number.isFinite(raw.priority))) {
    normalized.priority = raw.priority;
  }

  if (Array.isArray(raw.operations)) {
    const ops = [];
    for (let i = 0; i < raw.operations.length; i += 1) {
      const resolved = resolveCanonicalOperation(raw.operations[i]);
      if (resolved && !ops.includes(resolved)) {
        ops.push(resolved);
      }
    }
    if (ops.length) {
      normalized.operations = ops;
    }
  }

  if (raw.ruleSetId != null) {
    normalized.ruleSetId = String(raw.ruleSetId);
  }
  if (raw.ruleSetVersion != null) {
    normalized.ruleSetVersion = String(raw.ruleSetVersion);
  }
  if (raw.updatedAt != null) {
    normalized.updatedAt = String(raw.updatedAt);
  }
  if (raw.metadata && typeof raw.metadata === "object") {
    normalized.metadata = { ...raw.metadata };
  }

  return normalized;
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
  const status = isRuleSetStatus(partial.status) ? partial.status : RULE_SET_STATUS.ACTIVE;
  /** @type {import('../types/index.js').RuleSet} */
  const ruleSet = {
    id: String(partial.id || DEFAULT_RULE_SET_ID),
    version: String(partial.version || DEFAULT_RULE_SET_VERSION),
    status,
    effectiveFrom: partial.effectiveFrom ? String(partial.effectiveFrom) : undefined,
    lockedAt: partial.lockedAt ? String(partial.lockedAt) : undefined,
    constraints: normalizeRuleDefinitions(partial.constraints || []),
    metadata: partial.metadata && typeof partial.metadata === "object" ? { ...partial.metadata } : {},
  };

  // Optional set-level authority metadata — does not change lifecycle semantics.
  if (isRuleSource(partial.source)) {
    ruleSet.source = partial.source;
  }
  const setPriority = Number(partial.sourcePriority);
  if (Number.isFinite(setPriority)) {
    ruleSet.sourcePriority = setPriority;
  }

  return ruleSet;
}

/**
 * @param {RuleSet|Partial<RuleSet>} ruleSet
 * @returns {RuleSet}
 */
export function normalizeRuleSet(ruleSet) {
  return createRuleSet(ruleSet);
}
