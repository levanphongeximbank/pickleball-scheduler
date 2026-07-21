import { deepFreeze } from "../domain/deepFreeze.js";
import {
  CORE07_INTEGRATION_CONTRACT_VERSION,
  ELIGIBILITY_STATUS,
} from "../domain/constants.js";
import { normalizeSeedingScope, buildSeedingScopeKey } from "../domain/normalizeSeedingScope.js";
import {
  normalizeOpaqueId,
  normalizeExplicitTimestamp,
  throwSeedingError,
  SEEDING_ERROR_CODE,
} from "../domain/normalizeHelpers.js";
import { isFingerprintPort } from "../ports/FingerprintPort.js";
import { isEligibilityDecisionPort } from "../ports/EligibilityDecisionPort.js";
import { isRuleEvaluationPort } from "../ports/RuleEvaluationPort.js";
import {
  isRankingRatingSnapshotProviderPort,
} from "../ports/RankingRatingSnapshotProviderPort.js";
import { isSeedingResultRepositoryPort } from "../ports/SeedingResultRepositoryPort.js";
import { isSeedingLifecycleAuditPort } from "../ports/SeedingLifecycleAuditPort.js";

/**
 * @typedef {Object} SeedingIntegrationPortBundle
 * @property {import('../ports/FingerprintPort.js').FingerprintPort} fingerprintPort
 * @property {import('../ports/EligibilityDecisionPort.js').EligibilityDecisionPort} [eligibilityPort]
 * @property {import('../ports/RuleEvaluationPort.js').RuleEvaluationPort} [ruleEvaluationPort]
 * @property {import('../ports/RankingRatingSnapshotProviderPort.js').RankingRatingSnapshotProviderPort} [snapshotProviderPort]
 * @property {import('../ports/SeedingResultRepositoryPort.js').SeedingResultRepositoryPort} [repositoryPort]
 * @property {import('../ports/SeedingLifecycleAuditPort.js').SeedingLifecycleAuditPort} [auditPort]
 */

/**
 * Normalize an integration request. No wall-clock reads.
 *
 * @param {unknown} raw
 * @returns {Readonly<object>}
 */
export function normalizeSeedingIntegrationRequest(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "SeedingIntegrationRequest must be a non-null object"
    );
  }
  const input = /** @type {Record<string, unknown>} */ (raw);

  const requestId = normalizeOpaqueId(input.requestId);
  const resultId = normalizeOpaqueId(input.resultId);
  if (!requestId || !resultId) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "requestId and resultId are required"
    );
  }
  if (input.resultVersion == null || input.resultVersion === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "resultVersion is required"
    );
  }
  if (input.generatedAt == null || input.generatedAt === "") {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "generatedAt must be supplied explicitly"
    );
  }
  const generatedAt = normalizeExplicitTimestamp(
    input.generatedAt,
    "generatedAt"
  );

  const scope = normalizeSeedingScope(input.seedingScope || input.scope);
  if (!input.policy) {
    throwSeedingError(
      SEEDING_ERROR_CODE.POLICY_REQUIRED,
      "policy is required on integration request"
    );
  }
  if (!Array.isArray(input.candidates)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INVALID_REQUEST,
      "candidates array is required"
    );
  }

  const deterministicContext = input.deterministicContext;
  if (
    !deterministicContext ||
    typeof deterministicContext !== "object" ||
    /** @type {Record<string, unknown>} */ (deterministicContext).effectiveAt ==
      null
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "deterministicContext.effectiveAt is required"
    );
  }

  const ports = /** @type {Record<string, unknown>} */ (input.ports || {});
  if (!isFingerprintPort(ports.fingerprintPort)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "fingerprintPort is required"
    );
  }

  const requireEligibility = input.requireEligibility !== false;
  if (requireEligibility && !isEligibilityDecisionPort(ports.eligibilityPort)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "eligibilityPort is required when requireEligibility is true"
    );
  }

  const requireRules = input.requireRuleEvaluation === true;
  if (requireRules && !isRuleEvaluationPort(ports.ruleEvaluationPort)) {
    throwSeedingError(
      SEEDING_ERROR_CODE.RULE_EVALUATION_REQUIRED,
      "ruleEvaluationPort is required when requireRuleEvaluation is true"
    );
  }

  const requireSnapshot = input.requireSnapshot !== false;
  if (
    requireSnapshot &&
    !isRankingRatingSnapshotProviderPort(ports.snapshotProviderPort) &&
    input.rankingRatingSnapshot == null
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.SNAPSHOT_REQUIRED,
      "snapshotProviderPort or rankingRatingSnapshot is required"
    );
  }

  if (
    ports.repositoryPort != null &&
    !isSeedingResultRepositoryPort(ports.repositoryPort)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "repositoryPort contract is invalid"
    );
  }
  if (
    ports.auditPort != null &&
    !isSeedingLifecycleAuditPort(ports.auditPort)
  ) {
    throwSeedingError(
      SEEDING_ERROR_CODE.INTERNAL_PORT_FAILURE,
      "auditPort contract is invalid"
    );
  }

  return deepFreeze({
    contractVersion: CORE07_INTEGRATION_CONTRACT_VERSION,
    requestId,
    resultId,
    resultVersion: input.resultVersion,
    seedingScope: scope,
    scopeKey: buildSeedingScopeKey(scope),
    candidates: input.candidates,
    policy: input.policy,
    manualOverrides: Array.isArray(input.manualOverrides)
      ? input.manualOverrides
      : [],
    deterministicContext: deepFreeze({
      .../** @type {object} */ (deterministicContext),
    }),
    generatedAt,
    rankingRatingSnapshot: input.rankingRatingSnapshot ?? null,
    requireEligibility,
    requireRuleEvaluation: requireRules,
    requireSnapshot,
    allowPartialSnapshot: input.allowPartialSnapshot === true,
    correlationId: normalizeOpaqueId(input.correlationId),
    idempotencyKey:
      normalizeOpaqueId(input.idempotencyKey) || requestId,
    authorizationDecision: input.authorizationDecision ?? null,
    actor: input.actor ?? null,
    ports: deepFreeze({
      fingerprintPort: ports.fingerprintPort,
      eligibilityPort: ports.eligibilityPort ?? null,
      ruleEvaluationPort: ports.ruleEvaluationPort ?? null,
      snapshotProviderPort: ports.snapshotProviderPort ?? null,
      repositoryPort: ports.repositoryPort ?? null,
      auditPort: ports.auditPort ?? null,
    }),
  });
}

export { ELIGIBILITY_STATUS };
