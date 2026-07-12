import { COMPETITION_CONSTRAINT_TYPE } from "../../constants/constraintType.js";
import { CONSTRAINT_SEVERITY } from "../../constants/constraintSeverity.js";

/** @typedef {'founder_policy'|'club_rule'|'ai_policy'|'pairing_constraint'} RuleSourceType */

export const RULE_SOURCE_TYPE = Object.freeze({
  FOUNDER_POLICY: "founder_policy",
  CLUB_RULE: "club_rule",
  AI_POLICY: "ai_policy",
  PAIRING_CONSTRAINT: "pairing_constraint",
});

/**
 * @param {unknown[]} playerIds
 * @returns {string}
 */
export function sortedPlayerPairKey(playerIds = []) {
  return [...playerIds].map(String).filter(Boolean).sort().join("|");
}

/**
 * @param {Record<string, unknown>} policy
 * @returns {string}
 */
export function buildFounderPolicySourceId(policy = {}) {
  if (policy.sourceId) {
    return String(policy.sourceId);
  }
  if (policy.id) {
    return String(policy.id);
  }
  const pairKey = sortedPlayerPairKey([policy.playerA, policy.playerB]);
  const policyType = String(policy.type || "policy");
  const source = String(policy.source || "founder");
  return `${source}-${policyType}-${pairKey}`;
}

/**
 * Stable founder policy source id shared by courtPolicyAdapter and canonical mappers.
 *
 * @param {Record<string, unknown>} constraint
 * @param {string|number} targetId
 * @param {string} policyType
 */
export function buildFounderCourtPolicySourceId(constraint = {}, targetId, policyType) {
  const constraintId = constraint.id || `${constraint.type}-${constraint.anchorPlayerId}`;
  return `founder-${constraintId}-${policyType}-${constraint.anchorPlayerId}-${targetId}`;
}

/**
 * @param {Record<string, unknown>} constraint
 * @returns {string}
 */
export function buildFounderConstraintSourceId(constraint = {}) {
  if (constraint.sourceId) {
    return String(constraint.sourceId);
  }
  if (constraint.id && constraint.targetPlayerIds?.length === 1) {
    const policyType =
      constraint.type === "avoid_partner"
        ? "avoid_teammate"
        : constraint.type === "prefer_partner"
          ? "prefer_teammate"
          : String(constraint.type);
    return buildFounderCourtPolicySourceId(constraint, constraint.targetPlayerIds[0], policyType);
  }
  if (constraint.id) {
    return String(constraint.id);
  }
  const anchor = String(constraint.anchorPlayerId || "");
  const targets = (constraint.targetPlayerIds || []).map(String);
  return `founder-${String(constraint.type || "constraint")}-${anchor}-${targets.sort().join("|")}`;
}

/**
 * Map AI policy type to canonical constraint type.
 *
 * @param {Record<string, unknown>} policy
 * @returns {string}
 */
export function mapPolicyToCanonicalType(policy = {}) {
  if (policy.type === "avoid_teammate") {
    return COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER;
  }
  if (policy.type === "prefer_teammate") {
    return COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER;
  }
  return String(policy.type || "unknown");
}

/**
 * @param {Record<string, unknown>} policy
 * @returns {string}
 */
export function mapPolicyToSeverity(policy = {}) {
  if (policy.type === "avoid_teammate" && policy.priority === "HIGH") {
    return CONSTRAINT_SEVERITY.HARD;
  }
  return CONSTRAINT_SEVERITY.SOFT;
}

/**
 * Build stable canonical identity for a mapped founder / AI policy rule.
 *
 * @param {Object} input
 * @param {RuleSourceType} [input.sourceType]
 * @param {string} [input.sourceId]
 * @param {string} [input.constraintId]
 * @param {string} [input.canonicalType]
 * @param {string} [input.severity]
 * @param {string} [input.scope]
 * @param {string[]} [input.playerIds]
 * @param {string} [input.ruleSetId]
 * @param {string} [input.ruleSetVersion]
 * @returns {{
 *   sourceType: RuleSourceType,
 *   sourceId: string,
 *   constraintId: string,
 *   canonicalType: string,
 *   severity: string,
 *   scope: string,
 *   playerIds: string[],
 *   ruleSetId: string,
 *   ruleSetVersion: string,
 *   deduplicationKey: string,
 * }}
 */
export function buildRuleSourceIdentity(input = {}) {
  const sourceType = /** @type {RuleSourceType} */ (input.sourceType || RULE_SOURCE_TYPE.AI_POLICY);
  const sourceId = String(input.sourceId || input.constraintId || "unknown");
  const constraintId = String(input.constraintId || sourceId);
  const canonicalType = String(input.canonicalType || "unknown");
  const severity = String(input.severity || CONSTRAINT_SEVERITY.SOFT);
  const scope = String(input.scope || "match");
  const playerIds = sortedPlayerPairKey(input.playerIds || []).split("|").filter(Boolean);
  const ruleSetId = String(input.ruleSetId || "legacy-ai-scoring");
  const ruleSetVersion = String(input.ruleSetVersion || "1");
  const affectedPlayers = sortedPlayerPairKey(playerIds);

  const deduplicationKey = [
    sourceType,
    sourceId,
    canonicalType,
    scope,
    affectedPlayers,
  ].join("::");

  return {
    sourceType,
    sourceId,
    constraintId,
    canonicalType,
    severity,
    scope,
    playerIds,
    ruleSetId,
    ruleSetVersion,
    deduplicationKey,
  };
}

/**
 * @param {Record<string, unknown>} policy
 * @param {Partial<{ scope: string, ruleSetId: string, ruleSetVersion: string }>} [meta]
 */
export function buildIdentityFromAiPolicy(policy = {}, meta = {}) {
  const sourceType =
    policy.source === "founder" ? RULE_SOURCE_TYPE.FOUNDER_POLICY : RULE_SOURCE_TYPE.AI_POLICY;

  return buildRuleSourceIdentity({
    sourceType,
    sourceId: buildFounderPolicySourceId(policy),
    constraintId: policy.id ? String(policy.id) : buildFounderPolicySourceId(policy),
    canonicalType: mapPolicyToCanonicalType(policy),
    severity: mapPolicyToSeverity(policy),
    scope: meta.scope || "match",
    playerIds: [policy.playerA, policy.playerB].filter(Boolean).map(String),
    ruleSetId: meta.ruleSetId,
    ruleSetVersion: meta.ruleSetVersion,
  });
}

/**
 * @param {Record<string, unknown>} constraint
 * @param {Partial<{ scope: string, ruleSetId: string, ruleSetVersion: string }>} [meta]
 */
export function buildIdentityFromPairingConstraint(constraint = {}, meta = {}) {
  const canonicalType =
    constraint.type === "avoid_partner" || constraint.type === "prefer_partner"
      ? constraint.type === "avoid_partner"
        ? COMPETITION_CONSTRAINT_TYPE.AVOID_PARTNER
        : COMPETITION_CONSTRAINT_TYPE.PREFER_PARTNER
      : String(constraint.type || "unknown");

  const severity =
    constraint.mode === "hard" || constraint.severity === "hard"
      ? CONSTRAINT_SEVERITY.HARD
      : CONSTRAINT_SEVERITY.SOFT;

  const playerIds = [
    constraint.anchorPlayerId,
    ...((constraint.targetPlayerIds || []).map(String)),
  ].filter(Boolean);

  const isFounderPartnerRule =
    constraint.source === "founder" ||
    constraint.sourceType === RULE_SOURCE_TYPE.FOUNDER_POLICY ||
    constraint.type === "avoid_partner" ||
    constraint.type === "prefer_partner";

  const sourceType = isFounderPartnerRule
    ? RULE_SOURCE_TYPE.FOUNDER_POLICY
    : RULE_SOURCE_TYPE.PAIRING_CONSTRAINT;

  return buildRuleSourceIdentity({
    sourceType,
    sourceId: buildFounderConstraintSourceId(constraint),
    constraintId: String(constraint.id || buildFounderConstraintSourceId(constraint)),
    canonicalType,
    severity,
    scope: meta.scope || "match",
    playerIds,
    ruleSetId: meta.ruleSetId,
    ruleSetVersion: meta.ruleSetVersion,
  });
}

/**
 * @param {{ deduplicationKey?: string } & Record<string, unknown>} identity
 * @returns {string}
 */
export function buildDeduplicationKey(identity = {}) {
  if (identity.deduplicationKey) {
    return String(identity.deduplicationKey);
  }
  return buildRuleSourceIdentity(identity).deduplicationKey;
}
