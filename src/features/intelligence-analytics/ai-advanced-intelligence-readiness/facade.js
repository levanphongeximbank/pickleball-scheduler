/**
 * Read-only AI / Advanced Intelligence Readiness facade (I&A-12).
 * No write methods. No global singleton. No Production provider.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createIntelligenceUseCaseDefinition } from "./useCase.js";
import {
  createIntelligenceUseCaseRegistry,
  createReadOnlyIntelligenceUseCaseRegistry,
} from "./registry.js";
import {
  createIntelligenceFeatureDefinition,
  createIntelligenceFeatureSchema,
  createIntelligenceFeatureVector,
} from "./featureSchema.js";
import {
  createIntelligenceModelReference,
  createIntelligencePromptTemplateReference,
  createIntelligenceProviderReference,
} from "./providerRefs.js";
import {
  createIntelligenceInferenceRequest,
  validateIntelligenceInferenceResponse,
} from "./inference.js";
import {
  compareIntelligenceConfidence,
  createIntelligenceCandidateInsight,
  createIntelligenceConfidence,
  createIntelligenceEvidenceReference,
  createIntelligenceExplanation,
  createIntelligenceUncertainty,
} from "./candidate.js";
import {
  createIntelligenceHumanReviewRequirement,
  createIntelligenceSafetyPolicy,
  evaluateIntelligenceFallback,
} from "./policies.js";
import {
  guardAccessDecisionForInference,
  guardIntelligenceTenantEntityIsolation,
  guardProhibitedUseCase,
  guardPromptInjectionBoundary,
  guardProviderCapabilityCompatibility,
  projectIntelligenceOutputPrivacy,
} from "./guards.js";
import { createInMemoryIntelligenceProvider } from "./inMemoryProvider.js";
import {
  createIntelligenceDriftSignal,
  createIntelligenceEvaluationReport,
  createIntelligenceEvaluationScenario,
  createIntelligenceModelHealthSnapshot,
  createIntelligenceQualityGate,
  createIntelligenceQualitySignal,
  evaluateIntelligenceScenario,
  evaluateStalenessWarnings,
} from "./evaluation.js";
import { composeIntelligenceInsightPresentationPayloads } from "./dashboardPayloads.js";
import {
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_FALLBACK_POLICY,
  INTELLIGENCE_RISK_TIER,
} from "./enums.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyIntelligenceReadinessFacade does not expose write/command operations";

/**
 * @param {unknown} [deps]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceReadinessFacade(deps = {}) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "createIntelligenceReadinessFacade requires a dependencies object",
        "deps"
      )
    );
  }

  const provider =
    isPlainObject(deps.provider) && typeof deps.provider.infer === "function"
      ? deps.provider
      : null;

  const useCaseRegistry =
    isPlainObject(deps.useCaseRegistry) &&
    typeof deps.useCaseRegistry.getExact === "function"
      ? deps.useCaseRegistry
      : null;

  /**
   * Full readiness pipeline — invalid requests never invoke provider.
   * @param {unknown} pipelineInput
   */
  function runReadinessPipeline(pipelineInput) {
    if (!isPlainObject(pipelineInput)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
          "Pipeline input must be a plain object",
          "pipeline"
        )
      );
    }

    // Resolve use case before provider.
    let useCase = pipelineInput.useCase;
    if (!useCase && useCaseRegistry && pipelineInput.useCaseId) {
      const lookedUp = useCaseRegistry.getExact(
        pipelineInput.useCaseId,
        pipelineInput.useCaseVersion
      );
      if (!lookedUp.ok) return lookedUp;
      useCase = lookedUp.value;
    }

    if (!useCase) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_UNKNOWN,
          "Unknown use case rejected before provider call",
          "useCase"
        )
      );
    }

    const prohibited = guardProhibitedUseCase(useCase);
    if (!prohibited.ok) return prohibited;

    if (pipelineInput.accessContext || pipelineInput.featureVector) {
      const isolation = guardIntelligenceTenantEntityIsolation(
        pipelineInput.accessContext,
        pipelineInput.featureVector,
        pipelineInput.requestScope ?? {
          tenantId: pipelineInput.tenantId,
          entityId: pipelineInput.entityId,
          rankingSystemScope: pipelineInput.rankingSystemScope,
          financeScope: pipelineInput.financeScope,
        }
      );
      if (!isolation.ok) return isolation;
    }

    if (pipelineInput.accessDecisionReference) {
      const access = guardAccessDecisionForInference(
        pipelineInput.accessDecisionReference
      );
      if (!access.ok) return access;
    }

    const requestResult = createIntelligenceInferenceRequest({
      ...pipelineInput.request,
      useCase,
      useCaseId: useCase.useCaseId,
      useCaseVersion: useCase.version,
      riskTier: useCase.riskTier,
      humanReviewPolicy: useCase.humanReviewRequirement,
      featureVector: pipelineInput.featureVector,
      tenantId: pipelineInput.tenantId ?? pipelineInput.featureVector?.tenantId,
      noWrite: true,
      trustedAccessCertified: true,
      accessDecisionReference:
        pipelineInput.accessDecisionReference ??
        pipelineInput.request?.accessDecisionReference,
    });
    if (!requestResult.ok) return requestResult;

    if (!provider) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_FAILURE,
          "No certification provider configured",
          "provider"
        )
      );
    }

    const response = provider.infer(requestResult.value, {
      allowedEvidenceRefs: pipelineInput.allowedEvidenceRefs,
    });
    if (!response.ok) {
      // Provider failure must not fabricate insight.
      if (pipelineInput.fallbackOnProviderFailure === true) {
        return evaluateIntelligenceFallback({
          policy:
            useCase.fallbackPolicy ?? INTELLIGENCE_FALLBACK_POLICY.ABSTAIN,
          reason: "PROVIDER_FAILURE",
          requestId: requestResult.value.requestId,
          useCaseId: useCase.useCaseId,
          useCaseVersion: useCase.version,
          generatedAt: requestResult.value.generatedAt,
          analyticsResultReferences:
            pipelineInput.analyticsResultReferences,
        });
      }
      return response;
    }

    let candidate = response.value.candidate;
    if (useCase.riskTier === INTELLIGENCE_RISK_TIER.HIGH) {
      candidate = deepFreeze({
        ...candidate,
        humanReviewRequired: true,
        status:
          candidate.status === INTELLIGENCE_CANDIDATE_STATUS.GENERATED
            ? INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW
            : candidate.status,
      });
    }

    if (pipelineInput.privacyProjection) {
      const projected = projectIntelligenceOutputPrivacy(
        candidate,
        pipelineInput.privacyProjection
      );
      if (!projected.ok) return projected;
      candidate = projected.value;
    }

    return ok(
      deepFreeze({
        request: requestResult.value,
        response: deepFreeze({ ...response.value, candidate }),
        candidate,
      })
    );
  }

  const facade = {
    createIntelligenceUseCaseDefinition,
    createIntelligenceUseCaseRegistry,
    createReadOnlyIntelligenceUseCaseRegistry,
    createIntelligenceFeatureDefinition,
    createIntelligenceFeatureSchema,
    createIntelligenceFeatureVector,
    createIntelligenceProviderReference,
    createIntelligenceModelReference,
    createIntelligencePromptTemplateReference,
    createIntelligenceInferenceRequest,
    validateIntelligenceInferenceResponse,
    createIntelligenceCandidateInsight,
    createIntelligenceConfidence,
    compareIntelligenceConfidence,
    createIntelligenceUncertainty,
    createIntelligenceExplanation,
    createIntelligenceEvidenceReference,
    createIntelligenceHumanReviewRequirement,
    createIntelligenceSafetyPolicy,
    evaluateIntelligenceFallback,
    guardProhibitedUseCase,
    guardPromptInjectionBoundary,
    guardIntelligenceTenantEntityIsolation,
    guardAccessDecisionForInference,
    guardProviderCapabilityCompatibility,
    projectIntelligenceOutputPrivacy,
    createInMemoryIntelligenceProvider,
    createIntelligenceEvaluationScenario,
    evaluateIntelligenceScenario,
    createIntelligenceEvaluationReport,
    createIntelligenceQualityGate,
    createIntelligenceDriftSignal,
    createIntelligenceQualitySignal,
    createIntelligenceModelHealthSnapshot,
    evaluateStalenessWarnings,
    composeIntelligenceInsightPresentationPayloads,
    runReadinessPipeline,
  };

  const writeNames = [
    "write",
    "save",
    "update",
    "delete",
    "mutate",
    "persist",
    "trainModel",
    "deployModel",
    "executeCommand",
    "callProductionProvider",
  ];

  for (const name of writeNames) {
    Object.defineProperty(facade, name, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.INTELLIGENCE_FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              name
            )
          );
      },
    });
  }

  return ok(deepFreeze(facade));
}

/**
 * Alias — facade is always read-only.
 * @param {unknown} [deps]
 * @returns {import("../contracts/result.js").Result}
 */
export function createReadOnlyIntelligenceReadinessFacade(deps) {
  return createIntelligenceReadinessFacade(deps);
}
