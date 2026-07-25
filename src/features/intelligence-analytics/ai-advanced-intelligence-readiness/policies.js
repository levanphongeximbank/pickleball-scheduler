/**
 * Safety, human-review, abstention and fallback policies (I&A-12).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  INTELLIGENCE_ABSTENTION_REASON,
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_FALLBACK_POLICY,
  INTELLIGENCE_HUMAN_REVIEW_OUTCOME,
  INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT,
  INTELLIGENCE_RISK_TIER,
  isIntelligenceEnumValue,
} from "./enums.js";
import { createIntelligenceCandidateInsight } from "./candidate.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceSafetyPolicy(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_SAFETY_POLICY_INVALID,
        "IntelligenceSafetyPolicy must be a plain object",
        "safetyPolicy"
      )
    );
  }

  const versionResult = isNonEmptyString(input.policyVersion)
    ? String(input.policyVersion).trim()
    : "1.0.0";

  return ok(
    deepFreeze({
      policyId: isNonEmptyString(input.policyId)
        ? String(input.policyId).trim()
        : "ia-12-safety-default",
      policyVersion: versionResult,
      rejectProhibitedUseCases: input.rejectProhibitedUseCases !== false,
      treatProviderResponseAsUntrusted:
        input.treatProviderResponseAsUntrusted !== false,
      allowToolExecution: false,
      allowSqlExecution: false,
      allowShellExecution: false,
      allowDynamicEval: false,
      allowUnsafeHtml: false,
      allowAutomaticUrlFetch: false,
      allowAutomaticFileAccess: false,
      allowProviderDirectedTools: false,
      lowConfidenceAction: isIntelligenceEnumValue(
        input.lowConfidenceAction,
        INTELLIGENCE_FALLBACK_POLICY
      )
        ? input.lowConfidenceAction
        : INTELLIGENCE_FALLBACK_POLICY.REQUIRE_HUMAN_REVIEW,
      lowConfidenceThreshold: Number.isFinite(input.lowConfidenceThreshold)
        ? input.lowConfidenceThreshold
        : 0.4,
      highRiskRequiresReview: input.highRiskRequiresReview !== false,
      prohibitedCannotBypassViaReview:
        input.prohibitedCannotBypassViaReview !== false,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceHumanReviewRequirement(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_HUMAN_REVIEW_INVALID,
        "HumanReviewRequirement must be a plain object",
        "humanReview"
      )
    );
  }

  if (
    !isIntelligenceEnumValue(
      input.requirement,
      INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_HUMAN_REVIEW_INVALID,
        "Unknown human-review requirement",
        "humanReview.requirement"
      )
    );
  }

  if (
    input.riskTier === INTELLIGENCE_RISK_TIER.PROHIBITED &&
    input.requirement !== INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.NOT_ALLOWED
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED,
        "PROHIBITED use case cannot bypass via review",
        "humanReview"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const review = {
    requirement: input.requirement,
    reviewReason: isNonEmptyString(input.reviewReason)
      ? String(input.reviewReason).trim()
      : "policy",
    riskTier: isIntelligenceEnumValue(input.riskTier, INTELLIGENCE_RISK_TIER)
      ? input.riskTier
      : undefined,
    candidateReference: isNonEmptyString(input.candidateReference)
      ? String(input.candidateReference).trim()
      : undefined,
    reviewerCapabilityReference: isNonEmptyString(
      input.reviewerCapabilityReference
    )
      ? String(input.reviewerCapabilityReference).trim()
      : undefined,
    outcome: isIntelligenceEnumValue(
      input.outcome,
      INTELLIGENCE_HUMAN_REVIEW_OUTCOME
    )
      ? input.outcome
      : INTELLIGENCE_HUMAN_REVIEW_OUTCOME.PENDING,
    isAssigned: false,
    notificationSent: false,
  };

  if (isValidIsoTimestamp(input.reviewDeadline)) {
    review.reviewDeadline = String(input.reviewDeadline).trim();
  }

  if (isPlainObject(input.provenance)) {
    review.provenance = deepFreeze({ ...input.provenance });
  }

  return ok(deepFreeze(review));
}

/**
 * Evaluate abstention / fallback without fabricating insights.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateIntelligenceFallback(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FALLBACK_INVALID,
        "Fallback evaluation input must be a plain object",
        "fallback"
      )
    );
  }

  const policy = isIntelligenceEnumValue(
    input.policy,
    INTELLIGENCE_FALLBACK_POLICY
  )
    ? input.policy
    : INTELLIGENCE_FALLBACK_POLICY.FAIL_CLOSED;

  const reason = isIntelligenceEnumValue(
    input.reason,
    INTELLIGENCE_ABSTENTION_REASON
  )
    ? input.reason
    : INTELLIGENCE_ABSTENTION_REASON.POLICY;

  if (policy === INTELLIGENCE_FALLBACK_POLICY.FAIL_CLOSED) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FALLBACK_INVALID,
        "Fallback FAIL_CLOSED",
        "fallback",
        { reason }
      )
    );
  }

  if (policy === INTELLIGENCE_FALLBACK_POLICY.ABSTAIN) {
    return createIntelligenceCandidateInsight({
      candidateId: input.candidateId ?? "abstain-fallback",
      status: INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED,
      structuredOutput: { abstentionReason: reason },
      confidence: { source: "UNSPECIFIED" },
      requestId: input.requestId,
      useCaseId: input.useCaseId,
      useCaseVersion: input.useCaseVersion,
      generatedAt: input.generatedAt ?? "2026-07-25T00:00:00.000Z",
      safetyDecisions: ["FALLBACK_ABSTAIN"],
    });
  }

  if (policy === INTELLIGENCE_FALLBACK_POLICY.RETURN_NO_INSIGHT) {
    return createIntelligenceCandidateInsight({
      candidateId: input.candidateId ?? "no-insight-fallback",
      status: INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED,
      structuredOutput: { noInsight: true, reason },
      confidence: { source: "UNSPECIFIED" },
      requestId: input.requestId,
      useCaseId: input.useCaseId,
      useCaseVersion: input.useCaseVersion,
      generatedAt: input.generatedAt ?? "2026-07-25T00:00:00.000Z",
      safetyDecisions: ["FALLBACK_RETURN_NO_INSIGHT"],
    });
  }

  if (policy === INTELLIGENCE_FALLBACK_POLICY.REQUIRE_HUMAN_REVIEW) {
    return createIntelligenceCandidateInsight({
      candidateId: input.candidateId ?? "review-fallback",
      status: INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW,
      structuredOutput: { reason },
      confidence: input.confidence ?? { source: "UNSPECIFIED" },
      humanReviewRequired: true,
      requestId: input.requestId,
      useCaseId: input.useCaseId,
      useCaseVersion: input.useCaseVersion,
      generatedAt: input.generatedAt ?? "2026-07-25T00:00:00.000Z",
      safetyDecisions: ["FALLBACK_REQUIRE_HUMAN_REVIEW"],
    });
  }

  if (policy === INTELLIGENCE_FALLBACK_POLICY.RETURN_DETERMINISTIC_ANALYTICS) {
    const refs = Array.isArray(input.analyticsResultReferences)
      ? input.analyticsResultReferences
      : [];
    if (refs.length === 0) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FALLBACK_INVALID,
          "Deterministic analytics fallback requires I&A result references",
          "fallback.analyticsResultReferences"
        )
      );
    }
    // Only reference certified I&A results — never fabricate insights.
    return createIntelligenceCandidateInsight({
      candidateId: input.candidateId ?? "analytics-fallback",
      status: INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
      structuredOutput: {
        kind: "deterministic-analytics-reference",
        analyticsResultReferences: Object.freeze([...refs]),
      },
      confidence: { source: "UNSPECIFIED" },
      explanation: {
        summary: "Returned deterministic analytics references only",
        evidence: refs.map((r) =>
          typeof r === "string"
            ? { referenceId: r, kind: "analytical-result" }
            : r
        ),
      },
      requestId: input.requestId,
      useCaseId: input.useCaseId,
      useCaseVersion: input.useCaseVersion,
      generatedAt: input.generatedAt ?? "2026-07-25T00:00:00.000Z",
      safetyDecisions: ["FALLBACK_RETURN_DETERMINISTIC_ANALYTICS"],
    });
  }

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.INTELLIGENCE_FALLBACK_INVALID,
      "Unknown fallback policy",
      "fallback.policy"
    )
  );
}
