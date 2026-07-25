/**
 * Inference request / response contracts and validators (I&A-12).
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
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT,
  INTELLIGENCE_OUTPUT_CLASSIFICATION,
  INTELLIGENCE_RISK_TIER,
  isIntelligenceEnumValue,
} from "./enums.js";
import {
  createIntelligenceCandidateInsight,
  createIntelligenceConfidence,
} from "./candidate.js";
import {
  createIntelligenceModelReference,
  createIntelligencePromptTemplateReference,
  createIntelligenceProviderReference,
} from "./providerRefs.js";
import { createIntelligenceSafetyPolicy } from "./policies.js";
import {
  createIntelligenceProvenance,
  createSafeCanonicalFingerprint,
  requireSemver,
} from "./provenance.js";
import {
  guardAccessDecisionForInference,
  guardProhibitedUseCase,
  guardPromptInjectionBoundary,
  guardProviderCapabilityCompatibility,
  guardVersionCompatibility,
} from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceInferenceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "IntelligenceInferenceRequest must be a plain object",
        "request"
      )
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "apiKey") ||
    Object.prototype.hasOwnProperty.call(input, "token") ||
    Object.prototype.hasOwnProperty.call(input, "credentials")
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "Inference request must not contain credentials",
        "request"
      )
    );
  }

  if (!isNonEmptyString(input.requestId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "requestId is required",
        "request.requestId"
      )
    );
  }

  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "tenantId is required",
        "request.tenantId"
      )
    );
  }

  if (!isNonEmptyString(input.useCaseId) || !isNonEmptyString(input.useCaseVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "useCaseId and useCaseVersion are required",
        "request.useCase"
      )
    );
  }

  if (input.noWrite !== true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_NO_WRITE_MARKER_REQUIRED,
        "noWrite marker is required",
        "request.noWrite"
      )
    );
  }

  if (!isPlainObject(input.accessDecisionReference) && input.trustedAccessCertified !== true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TRUSTED_ACCESS_REQUIRED,
        "Missing trusted access reference",
        "request.accessDecisionReference"
      )
    );
  }

  if (isPlainObject(input.accessDecisionReference)) {
    const accessGuard = guardAccessDecisionForInference(
      input.accessDecisionReference
    );
    if (!accessGuard.ok) return accessGuard;
  }

  if (!isPlainObject(input.featureVector)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
        "structured feature vector is required",
        "request.featureVector"
      )
    );
  }

  if (input.featureVector.tenantId !== String(input.tenantId).trim()) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TENANT_MISMATCH,
        "Request tenant must match feature vector tenant",
        "request.tenantId"
      )
    );
  }

  const providerResult = createIntelligenceProviderReference(
    input.providerReference ?? { providerId: "in-memory-certification" }
  );
  if (!providerResult.ok) return providerResult;

  const modelResult = createIntelligenceModelReference(
    input.modelReference ?? {
      modelId: "certification-model",
      modelVersion: "1.0.0",
      capabilities: ["STRUCTURED_OUTPUT"],
    }
  );
  if (!modelResult.ok) return modelResult;

  let promptTemplateReference;
  if (input.promptTemplateReference) {
    const promptResult = createIntelligencePromptTemplateReference(
      input.promptTemplateReference
    );
    if (!promptResult.ok) return promptResult;
    promptTemplateReference = promptResult.value;
  }

  if (!isPlainObject(input.featureSchemaReference)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "featureSchemaReference is required",
        "request.featureSchemaReference"
      )
    );
  }

  const featureSchemaVersion = requireSemver(
    input.featureSchemaReference.version,
    "request.featureSchemaReference.version"
  );
  if (!featureSchemaVersion.ok) return featureSchemaVersion;

  if (!isPlainObject(input.outputSchemaReference)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "outputSchemaReference is required",
        "request.outputSchemaReference"
      )
    );
  }

  if (
    input.outputSchemaReference.classification ===
      INTELLIGENCE_OUTPUT_CLASSIFICATION.PROHIBITED_DECISION ||
    input.outputSchemaReference.prohibited === true
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_OUTPUT_SCHEMA_PROHIBITED,
        "Prohibited output schema rejected",
        "request.outputSchemaReference"
      )
    );
  }

  const outputSchemaVersion = requireSemver(
    input.outputSchemaReference.version ?? "1.0.0",
    "request.outputSchemaReference.version"
  );
  if (!outputSchemaVersion.ok) return outputSchemaVersion;

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "request.generatedAt"
      )
    );
  }

  const safetyResult = createIntelligenceSafetyPolicy(
    input.safetyPolicy ?? {}
  );
  if (!safetyResult.ok) return safetyResult;

  const provenanceResult = createIntelligenceProvenance(
    input.provenance ?? {
      source: "ia-12-inference-request",
      generatedAt: input.generatedAt,
      correlationId: input.correlationId,
    }
  );
  if (!provenanceResult.ok) return provenanceResult;

  const injectionGuard = guardPromptInjectionBoundary(input, {
    tenantId: String(input.tenantId).trim(),
    useCaseId: String(input.useCaseId).trim(),
    useCaseVersion: String(input.useCaseVersion).trim(),
    policyVersion: safetyResult.value.policyVersion,
    modelId: modelResult.value.modelId,
    modelVersion: modelResult.value.modelVersion,
    outputSchemaId: String(input.outputSchemaReference.outputSchemaId).trim(),
    toolPermissions: [],
  });
  if (!injectionGuard.ok) return injectionGuard;

  if (isPlainObject(input.useCase)) {
    const prohibited = guardProhibitedUseCase(input.useCase);
    if (!prohibited.ok) return prohibited;
    const capability = guardProviderCapabilityCompatibility(
      input.useCase,
      modelResult.value
    );
    if (!capability.ok) return capability;
  }

  const request = deepFreeze({
    requestId: String(input.requestId).trim(),
    tenantId: String(input.tenantId).trim(),
    entityScope: isPlainObject(input.entityScope)
      ? deepFreeze({ ...input.entityScope })
      : undefined,
    useCaseId: String(input.useCaseId).trim(),
    useCaseVersion: String(input.useCaseVersion).trim(),
    providerReference: providerResult.value,
    modelReference: modelResult.value,
    promptTemplateReference,
    featureSchemaReference: deepFreeze({
      featureSchemaId: String(
        input.featureSchemaReference.featureSchemaId
      ).trim(),
      version: featureSchemaVersion.value,
    }),
    featureVector: deepFreeze({ ...input.featureVector }),
    outputSchemaReference: deepFreeze({
      outputSchemaId: String(input.outputSchemaReference.outputSchemaId).trim(),
      version: outputSchemaVersion.value,
      classification:
        input.outputSchemaReference.classification ??
        INTELLIGENCE_OUTPUT_CLASSIFICATION.ADVISORY_INSIGHT,
    }),
    accessDecisionReference: isPlainObject(input.accessDecisionReference)
      ? deepFreeze({ ...input.accessDecisionReference })
      : deepFreeze({
          referenceId: "trusted-access",
          decision: "ALLOW",
        }),
    privacyPolicyReference: isPlainObject(input.privacyPolicyReference)
      ? deepFreeze({ ...input.privacyPolicyReference })
      : deepFreeze({ policyId: "ia-11", policyVersion: "1.0.0" }),
    generatedAt: String(input.generatedAt).trim(),
    correlationId: isNonEmptyString(input.correlationId)
      ? String(input.correlationId).trim()
      : undefined,
    provenance: provenanceResult.value,
    noWrite: true,
    humanReviewPolicy: isIntelligenceEnumValue(
      input.humanReviewPolicy,
      INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT
    )
      ? input.humanReviewPolicy
      : input.useCase?.riskTier === INTELLIGENCE_RISK_TIER.HIGH
        ? INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED
        : INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.OPTIONAL,
    safetyPolicy: safetyResult.value,
    riskTier: isIntelligenceEnumValue(input.riskTier, INTELLIGENCE_RISK_TIER)
      ? input.riskTier
      : input.useCase?.riskTier,
    inputFingerprint: createSafeCanonicalFingerprint({
      requestId: input.requestId,
      tenantId: input.tenantId,
      useCaseId: input.useCaseId,
      useCaseVersion: input.useCaseVersion,
      featureVector: input.featureVector,
    }),
    injectionBoundary: injectionGuard.value,
  });

  return ok(request);
}

/**
 * Validate untrusted provider response against request.
 * @param {unknown} responseInput
 * @param {unknown} request
 * @param {{ allowedEvidenceRefs?: ReadonlySet<string> }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function validateIntelligenceInferenceResponse(
  responseInput,
  request,
  options = {}
) {
  if (!isPlainObject(responseInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_INVALID,
        "Malformed provider response rejected",
        "response"
      )
    );
  }

  if (!isPlainObject(request)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "Request required to validate response",
        "request"
      )
    );
  }

  // Treat provider response as untrusted — reject executable payloads.
  if (
    Object.prototype.hasOwnProperty.call(responseInput, "sql") ||
    Object.prototype.hasOwnProperty.call(responseInput, "shell") ||
    Object.prototype.hasOwnProperty.call(responseInput, "eval") ||
    Object.prototype.hasOwnProperty.call(responseInput, "toolCall") ||
    Object.prototype.hasOwnProperty.call(responseInput, "dynamicImport") ||
    typeof responseInput.execute === "function"
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_INVALID,
        "Provider response must not include executable content",
        "response"
      )
    );
  }

  const versionGuard = guardVersionCompatibility(request, responseInput);
  if (!versionGuard.ok) return versionGuard;

  if (
    responseInput.requestId &&
    responseInput.requestId !== request.requestId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_INVALID,
        "Response request reference mismatch",
        "response.requestId"
      )
    );
  }

  let confidence;
  if (
    Object.prototype.hasOwnProperty.call(responseInput, "confidence") &&
    responseInput.confidence !== undefined
  ) {
    const confidenceResult = createIntelligenceConfidence(
      responseInput.confidence
    );
    if (!confidenceResult.ok) return confidenceResult;
    confidence = confidenceResult.value;
  } else {
    const confidenceResult = createIntelligenceConfidence({
      source: "UNSPECIFIED",
    });
    if (!confidenceResult.ok) return confidenceResult;
    confidence = confidenceResult.value;
  }

  let status = responseInput.candidateStatus ?? responseInput.status;
  if (!isIntelligenceEnumValue(status, INTELLIGENCE_CANDIDATE_STATUS)) {
    status = INTELLIGENCE_CANDIDATE_STATUS.GENERATED;
  }

  const humanReviewRequired =
    request.humanReviewPolicy ===
      INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED ||
    request.riskTier === INTELLIGENCE_RISK_TIER.HIGH ||
    status === INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW;

  if (humanReviewRequired && status === INTELLIGENCE_CANDIDATE_STATUS.GENERATED) {
    status = INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW;
  }

  // Low-confidence policy.
  if (
    confidence &&
    !confidence.isUnknown &&
    isFiniteNumberSafe(confidence.value) &&
    confidence.value < (request.safetyPolicy?.lowConfidenceThreshold ?? 0.4)
  ) {
    const action = request.safetyPolicy?.lowConfidenceAction;
    if (action === "ABSTAIN") {
      status = INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED;
    } else if (action === "REQUIRE_HUMAN_REVIEW") {
      status = INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW;
    } else if (action === "FAIL_CLOSED") {
      status = INTELLIGENCE_CANDIDATE_STATUS.REJECTED;
    }
  }

  const candidateResult = createIntelligenceCandidateInsight(
    {
      candidateId: responseInput.candidateId ?? `cand-${request.requestId}`,
      status,
      structuredOutput: responseInput.structuredOutput ?? {},
      confidence,
      uncertainty: responseInput.uncertainty,
      explanation: responseInput.explanation,
      humanReviewRequired:
        humanReviewRequired ||
        status === INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW,
      requestId: request.requestId,
      useCaseId: request.useCaseId,
      useCaseVersion: request.useCaseVersion,
      generatedAt:
        responseInput.generatedAt ?? request.generatedAt,
      safetyDecisions: [
        "PROVIDER_RESPONSE_UNTRUSTED",
        "SCHEMA_VALIDATED",
        "NON_CANONICAL",
        ...(Array.isArray(responseInput.safetyDecisions)
          ? responseInput.safetyDecisions
          : []),
      ],
    },
    options
  );
  if (!candidateResult.ok) return candidateResult;

  return ok(
    deepFreeze({
      requestId: request.requestId,
      useCaseId: request.useCaseId,
      useCaseVersion: request.useCaseVersion,
      providerId: request.providerReference.providerId,
      providerVersion: request.providerReference.providerVersion,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      outputSchemaVersion: request.outputSchemaReference.version,
      promptTemplateVersion: request.promptTemplateReference?.version,
      candidate: candidateResult.value,
      latencyMs: Number.isFinite(responseInput.latencyMs)
        ? responseInput.latencyMs
        : undefined,
      generatedAt: candidateResult.value.generatedAt,
      provenance: deepFreeze({
        source: "ia-12-inference-response",
        generatedAt: candidateResult.value.generatedAt,
        isCanonicalDomainState: false,
        isProductionInference: false,
      }),
      nonCanonical: true,
    })
  );
}

/**
 * @param {unknown} value
 * @returns {value is number}
 */
function isFiniteNumberSafe(value) {
  return typeof value === "number" && Number.isFinite(value);
}
