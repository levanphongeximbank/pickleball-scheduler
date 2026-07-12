import { isRulesV2Enabled } from "../../config/featureFlags.js";
import { CONSTRAINT_SEVERITY } from "../../constants/constraintSeverity.js";
import { RULE_SOURCE_TYPE } from "./founderPolicyIdentity.js";

/** @typedef {'CANONICAL'|'LEGACY_FALLBACK'|'NON_RULE_SCORING'|'UNSUPPORTED_HARD'|'SKIPPED_DUPLICATE'} EvaluationOwner */

export const EVALUATION_OWNER = Object.freeze({
  CANONICAL: "CANONICAL",
  LEGACY_FALLBACK: "LEGACY_FALLBACK",
  NON_RULE_SCORING: "NON_RULE_SCORING",
  UNSUPPORTED_HARD: "UNSUPPORTED_HARD",
  SKIPPED_DUPLICATE: "SKIPPED_DUPLICATE",
});

/**
 * Resolve a single evaluation owner for a logical rule when Rules V2 is active.
 *
 * @param {Object} input
 * @param {boolean} [input.rulesV2Enabled]
 * @param {Record<string, unknown>} [input.identity]
 * @param {boolean} [input.canonicalMapped]
 * @param {boolean} [input.duplicateOfExisting]
 * @param {boolean} [input.unsupportedHard]
 * @param {boolean} [input.explicitLegacyFallback]
 * @param {string} [input.consumer]
 * @returns {EvaluationOwner}
 */
export function resolveRuleEvaluationOwner(input = {}) {
  const rulesV2Enabled = input.rulesV2Enabled === true;

  if (!rulesV2Enabled) {
    if (input.consumer === "ai_scoring" && input.identity?.sourceType) {
      return EVALUATION_OWNER.LEGACY_FALLBACK;
    }
    return EVALUATION_OWNER.NON_RULE_SCORING;
  }

  if (input.duplicateOfExisting) {
    return EVALUATION_OWNER.SKIPPED_DUPLICATE;
  }

  if (input.unsupportedHard) {
    return EVALUATION_OWNER.UNSUPPORTED_HARD;
  }

  if (input.explicitLegacyFallback) {
    return EVALUATION_OWNER.LEGACY_FALLBACK;
  }

  if (input.canonicalMapped !== false) {
    return EVALUATION_OWNER.CANONICAL;
  }

  if (input.identity?.severity === CONSTRAINT_SEVERITY.HARD) {
    return EVALUATION_OWNER.UNSUPPORTED_HARD;
  }

  return EVALUATION_OWNER.LEGACY_FALLBACK;
}

/**
 * @param {Record<string, unknown>} policy
 * @param {Record<string, unknown>|undefined} envSource
 * @returns {boolean}
 */
export function isCanonicalManagedFounderPolicy(policy = {}, envSource) {
  if (!isRulesV2Enabled(envSource)) {
    return false;
  }
  if (policy.source !== "founder" && policy.sourceType !== RULE_SOURCE_TYPE.FOUNDER_POLICY) {
    return policy.source === undefined || policy.canonicalManaged === true;
  }
  return true;
}

/**
 * @param {EvaluationOwner} owner
 * @returns {boolean}
 */
export function shouldSuppressLegacyContribution(owner) {
  return (
    owner === EVALUATION_OWNER.CANONICAL ||
    owner === EVALUATION_OWNER.SKIPPED_DUPLICATE ||
    owner === EVALUATION_OWNER.UNSUPPORTED_HARD
  );
}
