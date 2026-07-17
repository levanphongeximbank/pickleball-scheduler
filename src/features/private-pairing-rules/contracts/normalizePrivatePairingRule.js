import { CONSTRAINT_SEVERITY } from "../../competition-core/constants/constraintSeverity.js";
import { DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE } from "../../competition-core/constraints/ruleConstants.js";
import { isPrivatePairingConstraintType } from "../constants/constraintTypes.js";
import {
  RELATION_MODE,
  RULE_PRIORITY,
  RULE_VISIBILITY,
  REASON_CATEGORY,
  isRelationMode,
  isRulePriority,
  isRuleVisibility,
  isReasonCategory,
} from "../constants/enums.js";
import { PRIVATE_PAIRING_SCOPE, isPrivatePairingScope } from "../constants/scopes.js";
import {
  derivePrivatePairingSource,
  derivePrivatePairingOperations,
  isPrivatePairingSource,
  PRIVATE_PAIRING_SOURCE_PRIORITY,
} from "../runtime/privatePairingSource.js";

/**
 * @typedef {Object} PrivatePairingRule
 * @property {string} id
 * @property {string} ruleSetId
 * @property {string} ruleSetVersion
 * @property {string} constraintType
 * @property {'hard'|'soft'} severity
 * @property {number|null} weight
 * @property {string} priority
 * @property {string} source
 * @property {number} sourcePriority
 * @property {string[]} operations
 * @property {string} primaryPlayerId
 * @property {string[]} targetPlayerIds
 * @property {'ANY_OF'|'ALL_OF'} relationMode
 * @property {string} scopeType
 * @property {string|null} scopeId
 * @property {string|null} startAt
 * @property {string|null} endAt
 * @property {string} visibility
 * @property {string} reasonCategory
 * @property {string} reasonText
 * @property {string|null} updatedAt
 * @property {boolean} active
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {Partial<PrivatePairingRule> & Record<string, unknown>} input
 * @param {number} [index]
 * @returns {PrivatePairingRule|null}
 */
export function normalizePrivatePairingRule(input, index = 0) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const constraintType = String(input.constraintType || input.type || "").trim();
  if (!isPrivatePairingConstraintType(constraintType)) {
    return null;
  }

  const defaultSeverity =
    DEFAULT_SEVERITY_BY_CONSTRAINT_TYPE[constraintType] || CONSTRAINT_SEVERITY.SOFT;
  const rawSeverity = String(input.severity || input.mode || defaultSeverity).toLowerCase();
  const severity =
    rawSeverity === CONSTRAINT_SEVERITY.HARD ? CONSTRAINT_SEVERITY.HARD : CONSTRAINT_SEVERITY.SOFT;

  const primaryPlayerId = String(
    input.primaryPlayerId || input.anchorPlayerId || ""
  ).trim();

  const targetRaw = Array.isArray(input.targetPlayerIds) ? input.targetPlayerIds : [];
  const targetPlayerIds = [...new Set(targetRaw.map((id) => String(id).trim()).filter(Boolean))];

  const relationMode = isRelationMode(input.relationMode)
    ? input.relationMode
    : RELATION_MODE.ANY_OF;

  const scopeType = isPrivatePairingScope(input.scopeType)
    ? input.scopeType
    : PRIVATE_PAIRING_SCOPE.CLUB;

  const priority = isRulePriority(input.priority) ? input.priority : RULE_PRIORITY.MEDIUM;
  const visibility = isRuleVisibility(input.visibility)
    ? input.visibility
    : RULE_VISIBILITY.PRIVATE;
  const reasonCategory = isReasonCategory(input.reasonCategory)
    ? input.reasonCategory
    : REASON_CATEGORY.OTHER;

  let weight = null;
  if (severity === CONSTRAINT_SEVERITY.SOFT) {
    const parsed = Number(input.weight);
    weight = Number.isFinite(parsed) ? parsed : 50;
  } else if (input.weight != null && input.weight !== "") {
    // Persist but validation will reject simulation misuse; normalize keeps numeric for audit.
    const parsed = Number(input.weight);
    weight = Number.isFinite(parsed) ? parsed : null;
  }

  const source = isPrivatePairingSource(input.source)
    ? input.source
    : derivePrivatePairingSource(scopeType);
  const explicitSourcePriority = Number(input.sourcePriority);
  const sourcePriority = Number.isFinite(explicitSourcePriority)
    ? explicitSourcePriority
    : PRIVATE_PAIRING_SOURCE_PRIORITY[source] ?? 0;
  const operations = derivePrivatePairingOperations(constraintType);

  return {
    id: String(input.id || `private-rule-${index + 1}`),
    ruleSetId: String(input.ruleSetId || "private-pairing-default"),
    ruleSetVersion: String(input.ruleSetVersion || "1"),
    constraintType,
    severity,
    weight,
    priority,
    source,
    sourcePriority,
    operations,
    primaryPlayerId,
    targetPlayerIds,
    relationMode,
    scopeType,
    scopeId: input.scopeId == null || input.scopeId === "" ? null : String(input.scopeId),
    startAt: input.startAt ? String(input.startAt) : null,
    endAt: input.endAt ? String(input.endAt) : null,
    visibility,
    reasonCategory,
    reasonText: String(input.reasonText || input.note || "").trim(),
    updatedAt: input.updatedAt ? String(input.updatedAt) : null,
    active: input.active !== false && input.enabled !== false,
    metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {},
  };
}

/**
 * @param {Array<Partial<PrivatePairingRule>>} rules
 * @returns {PrivatePairingRule[]}
 */
export function normalizePrivatePairingRules(rules = []) {
  if (!Array.isArray(rules)) {
    return [];
  }
  return rules.map((item, index) => normalizePrivatePairingRule(item, index)).filter(Boolean);
}

/**
 * @param {Partial<PrivatePairingRule>} options
 * @returns {PrivatePairingRule|null}
 */
export function createPrivatePairingRule(options = {}) {
  return normalizePrivatePairingRule(options);
}
