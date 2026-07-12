import { isRulesV2Enabled } from "../../config/featureFlags.js";
import {
  buildDeduplicationKey,
  buildIdentityFromAiPolicy,
  buildIdentityFromPairingConstraint,
} from "./founderPolicyIdentity.js";
import {
  EVALUATION_OWNER,
  resolveRuleEvaluationOwner,
  shouldSuppressLegacyContribution,
} from "./ruleEvaluationOwnership.js";

/** @typedef {import('./founderPolicyIdentity.js').RuleSourceType} RuleSourceType */

/**
 * @typedef {Object} DeduplicationEntry
 * @property {ReturnType<typeof buildRuleSourceIdentity>} identity
 * @property {import('./ruleEvaluationOwnership.js').EvaluationOwner} evaluationOwner
 * @property {boolean} legacyContributionSuppressed
 * @property {boolean} canonicalContributionApplied
 * @property {string} [fallbackReason]
 * @property {boolean} duplicateDetected
 * @property {number} [legacyScoreContribution]
 * @property {number} [canonicalScoreContribution]
 */

/**
 * @param {Array<Record<string, unknown>>} policies
 * @returns {Array<Record<string, unknown>>}
 */
export function deduplicatePoliciesByIdentity(policies = []) {
  const seen = new Set();
  const result = [];

  policies.forEach((policy) => {
    if (!policy || policy.enabled === false) {
      return;
    }
    const identity = buildIdentityFromAiPolicy(policy);
    const key = buildDeduplicationKey(identity);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(policy);
  });

  return result;
}

/**
 * Build evaluation ownership plan for AI scoring founder / policy rules.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} [input.policies]
 * @param {Array<Record<string, unknown>>} [input.pairingConstraints]
 * @param {Record<string, unknown>|undefined} [input.envSource]
 * @param {string} [input.scope]
 * @param {string} [input.ruleSetId]
 * @param {string} [input.ruleSetVersion]
 */
export function buildFounderPolicyDeduplicationPlan(input = {}) {
  const rulesV2Enabled = isRulesV2Enabled(input.envSource);
  /** @type {Map<string, DeduplicationEntry>} */
  const byKey = new Map();
  /** @type {DeduplicationEntry[]} */
  const duplicates = [];

  const register = (identity, options = {}) => {
    const key = buildDeduplicationKey(identity);
    const existing = byKey.get(key);
    const duplicateOfExisting = Boolean(existing);

    const evaluationOwner = resolveRuleEvaluationOwner({
      rulesV2Enabled,
      identity,
      duplicateOfExisting,
      canonicalMapped: options.canonicalMapped !== false,
      unsupportedHard: options.unsupportedHard === true,
      explicitLegacyFallback: options.explicitLegacyFallback === true,
      consumer: input.consumer || "ai_scoring",
    });

    const entry = {
      identity,
      evaluationOwner,
      legacyContributionSuppressed: shouldSuppressLegacyContribution(evaluationOwner),
      canonicalContributionApplied:
        rulesV2Enabled &&
        evaluationOwner === EVALUATION_OWNER.CANONICAL &&
        !duplicateOfExisting,
      fallbackReason: options.fallbackReason,
      duplicateDetected: duplicateOfExisting,
      legacyScoreContribution: options.legacyScoreContribution,
      canonicalScoreContribution: options.canonicalScoreContribution,
    };

    if (duplicateOfExisting && existing) {
      duplicates.push({
        ...entry,
        evaluationOwner: EVALUATION_OWNER.SKIPPED_DUPLICATE,
        legacyContributionSuppressed: true,
        canonicalContributionApplied: false,
        fallbackReason: "duplicate_source_identity",
      });
      return;
    }

    byKey.set(key, entry);
  };

  (input.policies || []).forEach((policy) => {
    if (!policy || policy.enabled === false) {
      return;
    }
    register(buildIdentityFromAiPolicy(policy, input), {
      canonicalMapped: true,
    });
  });

  (input.pairingConstraints || []).forEach((constraint) => {
    if (!constraint || constraint.enabled === false) {
      return;
    }
    register(buildIdentityFromPairingConstraint(constraint, input), {
      canonicalMapped: true,
    });
  });

  const entries = [...byKey.values()];

  return {
    rulesV2Enabled,
    entries,
    duplicates,
    duplicateDetected: duplicates.length > 0,
    duplicateResolved: duplicates.every((item) => item.evaluationOwner === EVALUATION_OWNER.SKIPPED_DUPLICATE),
    sourceMappings: Object.fromEntries(
      entries.map((entry) => [entry.identity.deduplicationKey, entry.identity])
    ),
    suppressedLegacyKeys: entries
      .filter((entry) => entry.legacyContributionSuppressed)
      .map((entry) => entry.identity.deduplicationKey),
    canonicalKeys: entries
      .filter((entry) => entry.canonicalContributionApplied)
      .map((entry) => entry.identity.deduplicationKey),
  };
}

/**
 * Deduplicate hard violations and soft notes by reasonCode + deduplication key.
 *
 * @param {import('../../types/index.js').ConstraintEvaluationResult} canonical
 * @param {ReturnType<typeof buildFounderPolicyDeduplicationPlan>} [plan]
 */
export function deduplicateCanonicalContributions(canonical = {}, plan) {
  if (!plan?.rulesV2Enabled) {
    return canonical;
  }

  const seenHard = new Set();
  const seenSoft = new Set();
  const seenReason = new Set();

  const hardViolations = (canonical.hardViolations || []).filter((item) => {
    const key = [
      item.details?.deduplicationKey || item.details?.constraintId || item.reasonCode,
      item.reasonCode,
    ].join("::");
    if (seenHard.has(key) || (item.reasonCode && seenReason.has(`hard:${item.reasonCode}:${key}`))) {
      return false;
    }
    seenHard.add(key);
    if (item.reasonCode) {
      seenReason.add(`hard:${item.reasonCode}:${key}`);
    }
    return true;
  });

  const softNotes = (canonical.softNotes || []).filter((item) => {
    const key = [
      item.details?.deduplicationKey || item.details?.constraintId || item.reasonCode,
      item.reasonCode,
    ].join("::");
    if (seenSoft.has(key)) {
      return false;
    }
    seenSoft.add(key);
    return true;
  });

  const explanations = (canonical.explanations || []).filter((item, index, list) => {
    const key = item.details?.deduplicationKey || item.code || item.reasonCode || String(index);
    const firstIndex = list.findIndex(
      (candidate) =>
        (candidate.details?.deduplicationKey || candidate.code || candidate.reasonCode) === key
    );
    return firstIndex === index;
  });

  return {
    ...canonical,
    hardViolations,
    softNotes,
    explanations,
  };
}

/**
 * @param {ReturnType<typeof buildFounderPolicyDeduplicationPlan>} plan
 * @returns {Array<Record<string, unknown>>}
 */
export function buildDeduplicationTraceEntries(plan) {
  if (!plan?.rulesV2Enabled) {
    return [];
  }

  const rows = [...(plan.entries || []), ...(plan.duplicates || [])];

  return rows.map((entry) => ({
    evaluationOwner: entry.evaluationOwner,
    deduplicationKey: entry.identity.deduplicationKey,
    deduplicationStatus:
      entry.evaluationOwner === EVALUATION_OWNER.SKIPPED_DUPLICATE ? "SKIPPED_DUPLICATE" : "ACTIVE",
    legacyContributionSuppressed: entry.legacyContributionSuppressed,
    canonicalContributionApplied: entry.canonicalContributionApplied,
    fallbackReason: entry.fallbackReason,
    sourceType: entry.identity.sourceType,
    sourceId: entry.identity.sourceId,
    canonicalType: entry.identity.canonicalType,
    severity: entry.identity.severity,
    duplicateDetected: entry.duplicateDetected === true,
  }));
}

/**
 * @param {Object} input
 * @param {number} [input.legacyContribution]
 * @param {number} [input.canonicalContribution]
 * @param {boolean} [input.legacyContributionSuppressed]
 * @param {boolean} [input.duplicateDetected]
 * @param {boolean} [input.duplicateResolved]
 * @param {string} [input.evaluationOwner]
 */
export function buildFounderShadowContributionSummary(input = {}) {
  const legacyContribution = Number(input.legacyContribution ?? 0);
  const canonicalContribution = Number(input.canonicalContribution ?? 0);
  const legacyContributionSuppressed = input.legacyContributionSuppressed === true;
  const suppressedLegacyContribution = legacyContributionSuppressed ? legacyContribution : 0;
  const finalBusinessContribution = legacyContributionSuppressed
    ? canonicalContribution
    : legacyContribution + canonicalContribution;

  return {
    legacyContribution,
    canonicalContribution,
    suppressedLegacyContribution,
    legacyContributionSuppressed,
    duplicateDetected: input.duplicateDetected === true,
    duplicateResolved: input.duplicateResolved === true,
    evaluationOwner: input.evaluationOwner || EVALUATION_OWNER.CANONICAL,
    finalBusinessContribution,
  };
}

/**
 * Detect whether legacy and canonical both applied business contribution for same rule.
 *
 * @param {Object} input
 * @param {number} [input.legacySoftScore]
 * @param {number} [input.canonicalSoftScore]
 * @param {boolean} [input.legacySuppressed]
 * @param {boolean} [input.hardRejected]
 */
export function detectFounderDoubleCount(input = {}) {
  if (input.hardRejected) {
    return false;
  }
  if (input.legacySuppressed) {
    return false;
  }
  const legacySoft = Number(input.legacySoftScore ?? 0);
  const canonicalSoft = Number(input.canonicalSoftScore ?? 0);
  if (!Number.isFinite(legacySoft) || !Number.isFinite(canonicalSoft)) {
    return false;
  }
  return legacySoft !== 0 && canonicalSoft !== 0;
}
