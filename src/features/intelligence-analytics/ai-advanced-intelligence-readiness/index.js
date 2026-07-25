/**
 * I&A-12 — AI and Advanced Intelligence Readiness public barrel.
 */

export {
  INTELLIGENCE_RISK_TIER,
  INTELLIGENCE_USE_CASE_LIFECYCLE,
  INTELLIGENCE_FEATURE_VALUE_TYPE,
  INTELLIGENCE_MISSING_VALUE_POLICY,
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_CONFIDENCE_SOURCE,
  INTELLIGENCE_CONFIDENCE_SCALE,
  INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT,
  INTELLIGENCE_HUMAN_REVIEW_OUTCOME,
  INTELLIGENCE_FALLBACK_POLICY,
  INTELLIGENCE_ABSTENTION_REASON,
  INTELLIGENCE_PROVIDER_LIFECYCLE,
  INTELLIGENCE_MODEL_CAPABILITY,
  INTELLIGENCE_OUTPUT_CLASSIFICATION,
  INTELLIGENCE_QUALITY_GATE_STATUS,
  INTELLIGENCE_DRIFT_SIGNAL_TYPE,
  INTELLIGENCE_PRESENTATION_DATA_STATE,
  INTELLIGENCE_WARNING_CODE,
  AI_ADVANCED_INTELLIGENCE_READINESS_METHOD_VERSION,
  AI_ADVANCED_INTELLIGENCE_READINESS_COMPLETENESS,
  PROHIBITED_INTELLIGENCE_USE_CASE_IDS,
  FORBIDDEN_INTELLIGENCE_FEATURE_KEYS,
  FORBIDDEN_PROVIDER_SECRET_KEYS,
  ADVANCED_INTELLIGENCE_DEFERRED,
  isIntelligenceEnumValue,
} from "./enums.js";

export {
  createIntelligenceProvenance,
  createIntelligenceReproducibilityMetadata,
  createSafeCanonicalFingerprint,
  requireSemver,
} from "./provenance.js";

export { createIntelligenceUseCaseDefinition } from "./useCase.js";

export {
  INTELLIGENCE_USE_CASE_REGISTRATION_STATUS,
  intelligenceUseCaseIdentityKey,
  createIntelligenceUseCaseRegistry,
  createReadOnlyIntelligenceUseCaseRegistry,
} from "./registry.js";

export {
  createIntelligenceFeatureDefinition,
  createIntelligenceFeatureSchema,
  createIntelligenceFeatureVector,
} from "./featureSchema.js";

export {
  createIntelligenceProviderReference,
  createIntelligenceModelReference,
  createIntelligencePromptTemplateReference,
  assertProviderCapabilities,
} from "./providerRefs.js";

export {
  createIntelligenceConfidence,
  compareIntelligenceConfidence,
  createIntelligenceUncertainty,
  createIntelligenceEvidenceReference,
  createIntelligenceExplanation,
  createIntelligenceCandidateInsight,
} from "./candidate.js";

export {
  createIntelligenceSafetyPolicy,
  createIntelligenceHumanReviewRequirement,
  evaluateIntelligenceFallback,
} from "./policies.js";

export {
  guardProhibitedUseCase,
  guardPromptInjectionBoundary,
  guardIntelligenceTenantEntityIsolation,
  guardAccessDecisionForInference,
  guardProviderCapabilityCompatibility,
  guardVersionCompatibility,
  projectIntelligenceOutputPrivacy,
} from "./guards.js";

export {
  createIntelligenceInferenceRequest,
  validateIntelligenceInferenceResponse,
} from "./inference.js";

export { createInMemoryIntelligenceProvider } from "./inMemoryProvider.js";

export {
  createIntelligenceEvaluationScenario,
  createIntelligenceQualityGate,
  evaluateIntelligenceScenario,
  createIntelligenceEvaluationReport,
  createIntelligenceDriftSignal,
  createIntelligenceQualitySignal,
  createIntelligenceModelHealthSnapshot,
  evaluateStalenessWarnings,
} from "./evaluation.js";

export { composeIntelligenceInsightPresentationPayloads } from "./dashboardPayloads.js";

export {
  createIntelligenceReadinessFacade,
  createReadOnlyIntelligenceReadinessFacade,
} from "./facade.js";
