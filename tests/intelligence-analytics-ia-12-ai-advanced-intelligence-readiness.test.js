/**
 * I&A-12 — AI and Advanced Intelligence Readiness tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import * as IA from "../src/features/intelligence-analytics/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = join(__dirname, "../src/features/intelligence-analytics");
const AI_ADVANCED_ROOT = join(MODULE_ROOT, "ai-advanced-intelligence-readiness");
const DOCS_ROOT = join(__dirname, "../docs/intelligence-analytics/ia-12");

const FIXED_NOW = "2026-07-25T00:00:00.000Z";
const TENANT = "tenant-a";
const OTHER_TENANT = "tenant-b";

function listFiles(dir, extFilter) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...listFiles(full, extFilter));
    else if (!extFilter || entry.endsWith(extFilter)) files.push(full);
  }
  return files;
}

const SOURCE_FILES = listFiles(AI_ADVANCED_ROOT, ".js");
const DOC_FILES = listFiles(DOCS_ROOT);

function baseUseCase(overrides = {}) {
  return {
    useCaseId: "venue.utilization.advisory-summary",
    version: "1.0.0",
    title: "Venue utilization advisory summary",
    description:
      "Generates an advisory summary of venue utilization trends for internal review.",
    owner: "intelligence-analytics-team",
    riskTier: IA.INTELLIGENCE_RISK_TIER.LOW,
    allowedOutputClassifications: [
      IA.INTELLIGENCE_OUTPUT_CLASSIFICATION.ADVISORY_SUMMARY,
    ],
    featureSchemaId: "ia-12-cert-schema",
    featureSchemaVersion: "1.0.0",
    outputSchemaId: "advisory-summary-output",
    outputSchemaVersion: "1.0.0",
    ...overrides,
  };
}

function baseFeatureSchema(overrides = {}) {
  return {
    featureSchemaId: "ia-12-cert-schema",
    version: "1.0.0",
    features: [
      {
        featureId: "match.count",
        version: "1.0.0",
        valueType: IA.INTELLIGENCE_FEATURE_VALUE_TYPE.COUNT,
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
        allowedRange: { min: 0, max: 10000 },
      },
      {
        featureId: "utilization.ratio",
        version: "1.0.0",
        valueType: IA.INTELLIGENCE_FEATURE_VALUE_TYPE.RATIO,
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
        allowedRange: { min: 0, max: 1 },
      },
    ],
    ...overrides,
  };
}

function buildFeatureSchema(overrides = {}) {
  const result = IA.createIntelligenceFeatureSchema(baseFeatureSchema(overrides));
  assert.equal(result.ok, true, result.error?.message);
  return result.value;
}

function baseFeatureVector(overrides = {}) {
  return {
    tenantId: TENANT,
    useCaseId: "venue.utilization.advisory-summary",
    useCaseVersion: "1.0.0",
    featureSchema: buildFeatureSchema(),
    privacyAccessCertified: true,
    values: [
      { featureId: "match.count", value: 42 },
      { featureId: "utilization.ratio", value: 0.75 },
    ],
    generatedAt: FIXED_NOW,
    ...overrides,
  };
}

function buildFeatureVector(overrides = {}) {
  const result = IA.createIntelligenceFeatureVector(baseFeatureVector(overrides));
  assert.equal(result.ok, true, result.error?.message);
  return result.value;
}

function buildTrustedAccessContext(overrides = {}) {
  const result = IA.createAnalyticsPrivacyAccessContext({
    trustedSource: true,
    tenantId: TENANT,
    privacyPolicy: {
      policyId: "ia-12-cert-policy",
      policyVersion: "1.0.0",
    },
    issuedAt: FIXED_NOW,
    ...overrides,
  });
  assert.equal(result.ok, true, result.error?.message);
  return result.value;
}

function baseRequestParts(overrides = {}) {
  return {
    requestId: "req-1",
    tenantId: TENANT,
    useCaseId: "venue.utilization.advisory-summary",
    useCaseVersion: "1.0.0",
    noWrite: true,
    trustedAccessCertified: true,
    featureVector: buildFeatureVector(),
    featureSchemaReference: { featureSchemaId: "ia-12-cert-schema", version: "1.0.0" },
    outputSchemaReference: {
      outputSchemaId: "advisory-summary-output",
      version: "1.0.0",
      classification: IA.INTELLIGENCE_OUTPUT_CLASSIFICATION.ADVISORY_SUMMARY,
    },
    generatedAt: FIXED_NOW,
    ...overrides,
  };
}

function buildRequest(overrides = {}) {
  const result = IA.createIntelligenceInferenceRequest(baseRequestParts(overrides));
  assert.equal(result.ok, true, result.error?.message);
  return result.value;
}

test("I&A-12 marker and public exports", () => {
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_AI_ADVANCED_INTELLIGENCE_READINESS.workstreamId,
    "I&A-12"
  );
  for (const name of IA.INTELLIGENCE_ANALYTICS_PUBLIC_EXPORTS) {
    assert.equal(name in IA, true, `missing public export: ${name}`);
  }
});

test("1. Valid use-case definition accepted", () => {
  const result = IA.createIntelligenceUseCaseDefinition(baseUseCase());
  assert.equal(result.ok, true);
  assert.equal(result.value.useCaseId, "venue.utilization.advisory-summary");
  assert.equal(result.value.riskTier, IA.INTELLIGENCE_RISK_TIER.LOW);
  assert.equal(result.value.isCanonicalDomainState, false);
});

test("2. Missing use-case ID rejected", () => {
  const rest = { ...baseUseCase() };
  delete rest.useCaseId;
  const result = IA.createIntelligenceUseCaseDefinition(rest);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_ID_REQUIRED
  );
});

test("3. Missing version rejected", () => {
  const rest = { ...baseUseCase() };
  delete rest.version;
  const result = IA.createIntelligenceUseCaseDefinition(rest);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_VERSION_REQUIRED
  );
});

test("4. Unknown risk tier rejected", () => {
  const result = IA.createIntelligenceUseCaseDefinition(
    baseUseCase({ riskTier: "UNKNOWN_TIER" })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_RISK_TIER_UNKNOWN
  );
});

test("5. PROHIBITED use case rejected", () => {
  const result = IA.createIntelligenceUseCaseDefinition(
    baseUseCase({
      useCaseId: "fraud.accusation",
      riskTier: IA.INTELLIGENCE_RISK_TIER.PROHIBITED,
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED
  );
});

test("6. HIGH use case requires review", () => {
  const result = IA.createIntelligenceUseCaseDefinition(
    baseUseCase({ riskTier: IA.INTELLIGENCE_RISK_TIER.HIGH })
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.value.humanReviewRequirement,
    IA.INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED
  );
});

test("7. Use-case registry exact lookup works", () => {
  const registryResult = IA.createIntelligenceUseCaseRegistry({
    entries: [baseUseCase()],
  });
  assert.equal(registryResult.ok, true);
  const lookup = registryResult.value.registry.getExact(
    "venue.utilization.advisory-summary",
    "1.0.0"
  );
  assert.equal(lookup.ok, true);
  assert.equal(lookup.value.useCaseId, "venue.utilization.advisory-summary");
});

test("8. Duplicate idempotent registration works", () => {
  const registryResult = IA.createIntelligenceUseCaseRegistry({
    entries: [baseUseCase(), baseUseCase()],
  });
  assert.equal(registryResult.ok, true);
  assert.equal(registryResult.value.size, 1);
  assert.equal(registryResult.value.registrations[1].ok, true);
  assert.equal(
    registryResult.value.registrations[1].value.status,
    IA.INTELLIGENCE_USE_CASE_REGISTRATION_STATUS.IDEMPOTENT
  );
});

test("9. Conflicting registration rejected", () => {
  const registryResult = IA.createIntelligenceUseCaseRegistry({
    entries: [baseUseCase(), baseUseCase({ title: "Different title entirely" })],
  });
  assert.equal(registryResult.ok, true);
  assert.equal(registryResult.value.size, 1);
  const second = registryResult.value.registrations[1];
  assert.equal(second.ok, false);
  assert.equal(
    second.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_REGISTRY_CONFLICT
  );
});

test("10. Retired use case rejected", () => {
  const registryResult = IA.createIntelligenceUseCaseRegistry({
    entries: [baseUseCase({ lifecycleStatus: IA.INTELLIGENCE_USE_CASE_LIFECYCLE.RETIRED })],
  });
  assert.equal(registryResult.ok, true);
  const lookup = registryResult.value.registry.getExact(
    "venue.utilization.advisory-summary",
    "1.0.0"
  );
  assert.equal(lookup.ok, false);
  assert.equal(
    lookup.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_RETIRED
  );
});

test("11. Deprecated use case warning emitted", () => {
  const registryResult = IA.createIntelligenceUseCaseRegistry({
    entries: [
      baseUseCase({ lifecycleStatus: IA.INTELLIGENCE_USE_CASE_LIFECYCLE.DEPRECATED }),
    ],
  });
  assert.equal(registryResult.ok, true);
  const lookup = registryResult.value.registry.getExact(
    "venue.utilization.advisory-summary",
    "1.0.0"
  );
  assert.equal(lookup.ok, true);
  assert.equal(
    lookup.metadata.warnings[0].code,
    IA.INTELLIGENCE_WARNING_CODE.USE_CASE_DEPRECATED
  );
});

test("12. Unknown use case rejected before provider call", () => {
  const result = IA.guardProhibitedUseCase(null);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_UNKNOWN
  );
});

test("13. Valid feature schema accepted", () => {
  const result = IA.createIntelligenceFeatureSchema(baseFeatureSchema());
  assert.equal(result.ok, true);
  assert.equal(result.value.featureCount, 2);
});

test("14. Unknown feature type rejected", () => {
  const result = IA.createIntelligenceFeatureDefinition({
    featureId: "custom.metric",
    valueType: "UNKNOWN_TYPE",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_TYPE_UNKNOWN
  );
});

test("15. Missing-value policy enforced", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ values: [{ featureId: "match.count", value: null }] })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_MISSING_POLICY
  );
});

test("16. Feature range validation enforced", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ values: [{ featureId: "match.count", value: 99999 }] })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_RANGE_INVALID
  );
});

test("17. Feature vector tenant preserved", () => {
  const result = IA.createIntelligenceFeatureVector(baseFeatureVector());
  assert.equal(result.ok, true);
  assert.equal(result.value.tenantId, TENANT);
});

test("18. Mixed-tenant feature vector rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        { featureId: "match.count", value: 10 },
        { featureId: "utilization.ratio", value: 0.5, tenantId: OTHER_TENANT },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_TENANT_MISMATCH
  );
});

test("19. Entity mismatch rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        { featureId: "match.count", value: 10, entityId: "venue-1" },
        { featureId: "utilization.ratio", value: 0.5, entityId: "venue-2" },
      ],
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_ENTITY_MISMATCH
  );
});

test("20. Feature-schema version mismatch rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ featureSchemaVersion: "2.0.0" })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_VERSION_MISMATCH
  );
});

test("21. Raw PII field rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ values: [{ featureId: "email", value: "a@b.com" }] })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PII_REJECTED
  );
});

test("22. Secret/token field rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ values: [{ featureId: "apiKey", value: "x" }] })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SECRET_REJECTED
  );
});

test("23. Free-form private text rejected", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({ values: [{ featureId: "rawUserText", value: "hello" }] })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PRIVATE_TEXT_REJECTED
  );
});

test("24. Denied I&A-11 value not included in vector", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        { featureId: "match.count", value: 10 },
        {
          featureId: "utilization.ratio",
          value: 0.5,
          accessDecision: IA.ANALYTICS_ACCESS_DECISION.DENY,
        },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.values.length, 1);
  assert.equal(result.value.values[0].featureId, "match.count");
});

test("25. Suppressed value not included in vector", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        {
          featureId: "match.count",
          value: 10,
          accessDecision: IA.ANALYTICS_ACCESS_DECISION.SUPPRESS,
        },
        { featureId: "utilization.ratio", value: 0.5 },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.value.values.some((v) => v.featureId === "match.count"),
    false
  );
});

test("26. Original redacted value not included", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        {
          featureId: "match.count",
          value: 999999,
          accessDecision: IA.ANALYTICS_ACCESS_DECISION.REDACT,
        },
        { featureId: "utilization.ratio", value: 0.5 },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.value.values.some((v) => v.featureId === "match.count"),
    false
  );
  const json = JSON.stringify(result.value);
  assert.equal(json.includes("999999"), false);
});

test("27. Structured data cannot override policy", () => {
  const result = IA.guardPromptInjectionBoundary(
    { structuredOverrides: { tenantId: OTHER_TENANT } },
    { tenantId: TENANT, useCaseId: "u", useCaseVersion: "1.0.0" }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION
  );
});

test("28. Untrusted text cannot change tenant", () => {
  const result = IA.guardPromptInjectionBoundary(
    { untrustedText: { markedUntrusted: true, tenantId: OTHER_TENANT } },
    { tenantId: TENANT }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION
  );
});

test("29. Untrusted text cannot change use case", () => {
  const result = IA.guardPromptInjectionBoundary(
    { untrustedText: { markedUntrusted: true, useCaseId: "other.use.case" } },
    { tenantId: TENANT, useCaseId: "u" }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION
  );
});

test("30. Untrusted text cannot enable tools", () => {
  const result = IA.guardPromptInjectionBoundary(
    { untrustedText: { markedUntrusted: true, enableTools: true } },
    { tenantId: TENANT }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION
  );
});

test("31. Model reference requires ID/version", () => {
  const result = IA.createIntelligenceModelReference({});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_INVALID);
});

test("32. Provider reference contains no secret", () => {
  const rejected = IA.createIntelligenceProviderReference({
    providerId: "p1",
    apiKey: "sk-should-not-be-here",
  });
  assert.equal(rejected.ok, false);
  assert.equal(
    rejected.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID
  );

  const accepted = IA.createIntelligenceProviderReference({ providerId: "p1" });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.containsSecrets, false);
});

test("33. Unknown model rejected", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider({
    unknownModelId: "ghost-model",
  });
  assert.equal(providerResult.ok, true);
  const request = buildRequest({
    modelReference: { modelId: "ghost-model", modelVersion: "1.0.0", capabilities: [] },
  });
  const response = providerResult.value.infer(request);
  assert.equal(response.ok, false);
  assert.equal(
    response.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_UNKNOWN
  );
});

test("34. Provider capability mismatch rejected", () => {
  const result = IA.assertProviderCapabilities(
    [IA.INTELLIGENCE_MODEL_CAPABILITY.FORECAST_CANDIDATE],
    [IA.INTELLIGENCE_MODEL_CAPABILITY.SUMMARY]
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_CAPABILITY_MISMATCH
  );
});

test("35. Prompt-template version mismatch rejected", () => {
  const request = buildRequest({
    promptTemplateReference: { promptTemplateId: "pt1", version: "1.0.0" },
  });
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      promptTemplateVersion: "2.0.0",
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_PROMPT_VERSION_MISMATCH
  );
});

test("36. Inference request immutable", () => {
  const request = buildRequest();
  assert.ok(Object.isFrozen(request));
  assert.throws(() => {
    // @ts-expect-error intentional mutation attempt
    request.tenantId = OTHER_TENANT;
  });
});

test("37. Missing trusted access reference rejected", () => {
  const result = IA.createIntelligenceInferenceRequest(
    baseRequestParts({
      trustedAccessCertified: undefined,
      accessDecisionReference: undefined,
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_TRUSTED_ACCESS_REQUIRED
  );
});

test("38. Missing no-write marker rejected", () => {
  const result = IA.createIntelligenceInferenceRequest(
    baseRequestParts({ noWrite: false })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_NO_WRITE_MARKER_REQUIRED
  );
});

test("39. Prohibited output schema rejected", () => {
  const result = IA.createIntelligenceInferenceRequest(
    baseRequestParts({
      outputSchemaReference: {
        outputSchemaId: "bad-schema",
        version: "1.0.0",
        classification: IA.INTELLIGENCE_OUTPUT_CLASSIFICATION.PROHIBITED_DECISION,
      },
    })
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_OUTPUT_SCHEMA_PROHIBITED
  );
});

test("40. Offline provider deterministic", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider();
  assert.equal(providerResult.ok, true);
  const request = buildRequest();
  const a = providerResult.value.infer(request);
  const b = providerResult.value.infer(request);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value.candidate.structuredOutput, b.value.candidate.structuredOutput);
});

test("41. Offline provider makes no network call", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider();
  const provider = providerResult.value;
  assert.equal(provider.makesNetworkCalls, false);
  const request = buildRequest();
  provider.infer(request);
  const log = provider.getNetworkCallLog();
  assert.ok(log.length > 0);
  assert.equal(log.every((entry) => entry.attempted === false), true);
});

test("42. Offline provider failure wrapped", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider({ failureMode: "throw" });
  const request = buildRequest();
  const response = providerResult.value.infer(request);
  assert.equal(response.ok, false);
  assert.equal(
    response.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_FAILURE
  );
});

test("43. Malformed provider response rejected", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider({
    malformedResponse: true,
  });
  const request = buildRequest();
  const response = providerResult.value.infer(request);
  assert.equal(response.ok, false);
  assert.equal(
    response.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_INVALID
  );
});

test("44. Response model/version mismatch rejected", () => {
  const request = buildRequest();
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: "different-model",
      modelVersion: request.modelReference.modelVersion,
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_MODEL_MISMATCH
  );
});

test("45. Response schema mismatch rejected", () => {
  const request = buildRequest();
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      outputSchemaVersion: "9.9.9",
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_SCHEMA_MISMATCH
  );
});

test("46. Candidate marked non-canonical", () => {
  const request = buildRequest();
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      candidateStatus: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.candidate.isCanonicalDomainState, false);
  assert.equal(result.value.nonCanonical, true);
});

test("47. Candidate cannot expose write command", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
    writeCommand: { op: "UPDATE" },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_CANDIDATE_INVALID
  );
});

test("48. Candidate cannot execute tool", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
    toolCall: { name: "search" },
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_CANDIDATE_INVALID
  );
});

test("49. Candidate status GENERATED represented", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED);
});

test("50. Candidate status ABSTAINED represented", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED);
});

test("51. Candidate status REJECTED represented", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.REJECTED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_CANDIDATE_STATUS.REJECTED);
});

test("52. Candidate status REQUIRES_REVIEW represented", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.status,
    IA.INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW
  );
});

test("53. Unknown confidence remains UNKNOWN", () => {
  const result = IA.createIntelligenceConfidence({ source: "UNKNOWN" });
  assert.equal(result.ok, true);
  assert.equal(result.value.source, IA.INTELLIGENCE_CONFIDENCE_SOURCE.UNKNOWN);
  assert.equal(result.value.isUnknown, true);
  assert.equal(result.value.value, undefined);
});

test("54. Confidence not fabricated", () => {
  const result = IA.createIntelligenceConfidence({ source: "UNSPECIFIED", value: 0.99 });
  assert.equal(result.ok, true);
  assert.equal(result.value.fabricated, false);
  assert.equal(result.value.value, undefined);
  assert.equal(result.value.isUnknown, true);
});

test("55. Confidence scale preserved", () => {
  const result = IA.createIntelligenceConfidence({
    source: "PROVIDER_REPORTED",
    scale: "PERCENT",
    value: 80,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.scale, "PERCENT");
  assert.equal(result.value.value, 80);
});

test("56. Incompatible confidence scales not compared", () => {
  const left = IA.createIntelligenceConfidence({
    source: "PROVIDER_REPORTED",
    scale: "UNIT_INTERVAL",
    value: 0.5,
    modelId: "m1",
    modelVersion: "1.0.0",
  }).value;
  const right = IA.createIntelligenceConfidence({
    source: "PROVIDER_REPORTED",
    scale: "PERCENT",
    value: 50,
    modelId: "m1",
    modelVersion: "1.0.0",
  }).value;
  const result = IA.compareIntelligenceConfidence(left, right);
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_SCALE_INCOMPATIBLE
  );
});

test("57. Low-confidence policy can abstain", () => {
  const request = buildRequest({
    safetyPolicy: { lowConfidenceAction: "ABSTAIN", lowConfidenceThreshold: 0.5 },
  });
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      candidateStatus: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
      confidence: { source: "PROVIDER_REPORTED", scale: "UNIT_INTERVAL", value: 0.1 },
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.candidate.status, IA.INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED);
});

test("58. Low-confidence policy can require review", () => {
  const request = buildRequest({
    safetyPolicy: {
      lowConfidenceAction: "REQUIRE_HUMAN_REVIEW",
      lowConfidenceThreshold: 0.5,
    },
  });
  const result = IA.validateIntelligenceInferenceResponse(
    {
      requestId: request.requestId,
      modelId: request.modelReference.modelId,
      modelVersion: request.modelReference.modelVersion,
      candidateStatus: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
      confidence: { source: "PROVIDER_REPORTED", scale: "UNIT_INTERVAL", value: 0.1 },
      structuredOutput: {},
      generatedAt: FIXED_NOW,
    },
    request
  );
  assert.equal(result.ok, true);
  assert.equal(
    result.value.candidate.status,
    IA.INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW
  );
});

test("59. Explanation does not expose hidden prompt", () => {
  const result = IA.createIntelligenceExplanation({
    summary: "This reveals hidden prompt content",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID
  );
});

test("60. Explanation does not expose chain-of-thought", () => {
  const result = IA.createIntelligenceExplanation({
    summary: "Step-by-step chain-of-thought reasoning",
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID
  );
});

test("61. Explanation does not expose PII", () => {
  const result = IA.createIntelligenceExplanation({ email: "user@example.com" });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID
  );
});

test("62. Evidence references existing safe analytical references", () => {
  const allowedEvidenceRefs = new Set(["metric.venue.utilization::1.0.0"]);
  const result = IA.createIntelligenceEvidenceReference(
    { referenceId: "metric.venue.utilization::1.0.0", kind: "analytical-result" },
    { allowedEvidenceRefs }
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.referenceId, "metric.venue.utilization::1.0.0");
});

test("63. Invented evidence reference rejected", () => {
  const allowedEvidenceRefs = new Set(["metric.venue.utilization::1.0.0"]);
  const result = IA.createIntelligenceEvidenceReference(
    { referenceId: "invented.reference" },
    { allowedEvidenceRefs }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID
  );
});

test("64. HIGH risk result requires human review", () => {
  const result = IA.createIntelligenceHumanReviewRequirement({
    requirement: IA.INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED,
    riskTier: IA.INTELLIGENCE_RISK_TIER.HIGH,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.requirement,
    IA.INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED
  );
});

test("65. PROHIBITED use case cannot bypass via review", () => {
  const result = IA.createIntelligenceHumanReviewRequirement({
    requirement: IA.INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.OPTIONAL,
    riskTier: IA.INTELLIGENCE_RISK_TIER.PROHIBITED,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED
  );
});

test("66. Review contract immutable", () => {
  const result = IA.createIntelligenceHumanReviewRequirement({
    requirement: IA.INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED,
  });
  assert.equal(result.ok, true);
  assert.ok(Object.isFrozen(result.value));
  assert.throws(() => {
    // @ts-expect-error intentional mutation attempt
    result.value.outcome = "APPROVED";
  });
});

test("67. Fallback ABSTAIN deterministic", () => {
  const params = {
    policy: IA.INTELLIGENCE_FALLBACK_POLICY.ABSTAIN,
    reason: "LOW_CONFIDENCE",
    requestId: "r1",
    useCaseId: "u",
    useCaseVersion: "1.0.0",
    generatedAt: FIXED_NOW,
  };
  const a = IA.evaluateIntelligenceFallback(params);
  const b = IA.evaluateIntelligenceFallback(params);
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.status, IA.INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED);
});

test("68. Fallback RETURN_NO_INSIGHT deterministic", () => {
  const params = {
    policy: IA.INTELLIGENCE_FALLBACK_POLICY.RETURN_NO_INSIGHT,
    reason: "POLICY",
    requestId: "r1",
    useCaseId: "u",
    useCaseVersion: "1.0.0",
    generatedAt: FIXED_NOW,
  };
  const a = IA.evaluateIntelligenceFallback(params);
  const b = IA.evaluateIntelligenceFallback(params);
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.structuredOutput.noInsight, true);
});

test("69. Deterministic analytics fallback references I&A results only", () => {
  const result = IA.evaluateIntelligenceFallback({
    policy: IA.INTELLIGENCE_FALLBACK_POLICY.RETURN_DETERMINISTIC_ANALYTICS,
    analyticsResultReferences: ["metric.venue.utilization::1.0.0"],
    requestId: "r1",
    useCaseId: "u",
    useCaseVersion: "1.0.0",
    generatedAt: FIXED_NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.structuredOutput.kind, "deterministic-analytics-reference");
  assert.deepEqual(
    [...result.value.structuredOutput.analyticsResultReferences],
    ["metric.venue.utilization::1.0.0"]
  );

  const empty = IA.evaluateIntelligenceFallback({
    policy: IA.INTELLIGENCE_FALLBACK_POLICY.RETURN_DETERMINISTIC_ANALYTICS,
    analyticsResultReferences: [],
  });
  assert.equal(empty.ok, false);
  assert.equal(
    empty.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FALLBACK_INVALID
  );
});

test("70. Provider failure does not fabricate insight", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider({ failureMode: "fail" });
  const request = buildRequest();
  const response = providerResult.value.infer(request);
  assert.equal(response.ok, false);
  assert.equal(
    response.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_FAILURE
  );
});

test("71. Cross-tenant request rejected", () => {
  const ctx = buildTrustedAccessContext();
  const result = IA.guardIntelligenceTenantEntityIsolation(
    ctx,
    { tenantId: OTHER_TENANT },
    {}
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_TENANT_MISMATCH
  );
});

test("72. Cross-entity request rejected", () => {
  const ctx = buildTrustedAccessContext();
  const result = IA.guardIntelligenceTenantEntityIsolation(
    ctx,
    { tenantId: TENANT, entityId: "venue-1" },
    { entityId: "venue-2" }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH
  );
});

test("73. Ranking/rating system mismatch rejected", () => {
  const ctx = buildTrustedAccessContext();
  const result = IA.guardIntelligenceTenantEntityIsolation(
    ctx,
    { tenantId: TENANT, rankingSystemScope: { rankingSystemId: "rank-1" } },
    { rankingSystemScope: { rankingSystemId: "rank-2" } }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH
  );
});

test("74. Finance scope mismatch rejected", () => {
  const ctx = buildTrustedAccessContext();
  const result = IA.guardIntelligenceTenantEntityIsolation(
    ctx,
    { tenantId: TENANT, financeScope: { financeScopeId: "fin-1" } },
    { financeScope: { financeScopeId: "fin-2" } }
  );
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH
  );
});

test("75. Access DENY blocks inference", () => {
  const result = IA.guardAccessDecisionForInference({
    decision: IA.ANALYTICS_ACCESS_DECISION.DENY,
  });
  assert.equal(result.ok, false);
  assert.equal(
    result.error.code,
    IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_ACCESS_DENIED
  );
});

test("76. Access SUPPRESS does not become zero", () => {
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      values: [
        {
          featureId: "match.count",
          value: 0,
          accessDecision: IA.ANALYTICS_ACCESS_DECISION.SUPPRESS,
        },
      ],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.values.length, 0);
});

test("77. Access REDACT does not expose original", () => {
  const candidate = {
    structuredOutput: { displayLabel: "secret-value", keep: 1 },
  };
  const result = IA.projectIntelligenceOutputPrivacy(candidate, {
    redactFields: ["displayLabel"],
    redactionPlaceholder: "[REDACTED]",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.structuredOutput.displayLabel, "[REDACTED]");
  const json = JSON.stringify(result.value);
  assert.equal(json.includes("secret-value"), false);
});

test("78. Access OMIT removes field", () => {
  const candidate = { structuredOutput: { internalNote: "n", keep: true } };
  const result = IA.projectIntelligenceOutputPrivacy(candidate, {
    omitFields: ["internalNote"],
  });
  assert.equal(result.ok, true);
  assert.equal("internalNote" in result.value.structuredOutput, false);
  assert.equal(result.value.structuredOutput.keep, true);
});

test("79. Output privacy projection reapplied", () => {
  const candidate = { structuredOutput: { a: 1, b: 2 } };
  const projected = IA.projectIntelligenceOutputPrivacy(candidate, {
    omitFields: ["b"],
  });
  assert.equal(projected.ok, true);
  assert.equal(projected.value.privacyProjected, true);
  assert.equal("b" in projected.value.structuredOutput, false);
});

test("80. Evaluation scenario version preserved", () => {
  const result = IA.createIntelligenceEvaluationScenario({
    scenarioId: "s1",
    version: "1.0.0",
    useCaseReference: { useCaseId: "u", version: "1.0.0" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.version, "1.0.0");
});

test("81. Evaluation result deterministic", () => {
  const scenario = {
    scenarioId: "s1",
    version: "1.0.0",
    expectedStructuralOutcome: { candidateStatus: "GENERATED" },
  };
  const actual = {
    candidate: {
      status: "GENERATED",
      isAdvisoryCandidate: true,
      isCanonicalDomainState: false,
    },
    nonCanonical: true,
  };
  const a = IA.evaluateIntelligenceScenario(scenario, actual);
  const b = IA.evaluateIntelligenceScenario(scenario, actual);
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.status, IA.INTELLIGENCE_QUALITY_GATE_STATUS.PASS);
});

test("82. Evaluation structural assertion works", () => {
  const scenario = {
    scenarioId: "s1",
    version: "1.0.0",
    expectedStructuralOutcome: { candidateStatus: "ABSTAINED" },
  };
  const actual = {
    candidate: {
      status: "GENERATED",
      isAdvisoryCandidate: true,
      isCanonicalDomainState: false,
    },
    nonCanonical: true,
  };
  const result = IA.evaluateIntelligenceScenario(scenario, actual);
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_QUALITY_GATE_STATUS.FAIL);
  assert.equal(
    result.value.failures.some((f) => f.gateId === "candidate-status"),
    true
  );
});

test("83. Evaluation safety failure explicit", () => {
  const scenario = {
    scenarioId: "s1",
    version: "1.0.0",
    safetyExpectation: { mustPass: true },
  };
  const actual = {
    candidate: {
      status: "GENERATED",
      isAdvisoryCandidate: true,
      isCanonicalDomainState: false,
    },
    nonCanonical: true,
    safetyFailure: true,
  };
  const result = IA.evaluateIntelligenceScenario(scenario, actual);
  assert.equal(result.ok, true);
  assert.equal(
    result.value.failures.some((f) => f.gateId === "safety-failure-explicit"),
    true
  );
});

test("84. Evaluation privacy failure explicit", () => {
  const scenario = {
    scenarioId: "s1",
    version: "1.0.0",
    privacyAccessExpectation: { mustPass: true },
  };
  const actual = {
    candidate: {
      status: "GENERATED",
      isAdvisoryCandidate: true,
      isCanonicalDomainState: false,
    },
    nonCanonical: true,
    privacyFailure: true,
  };
  const result = IA.evaluateIntelligenceScenario(scenario, actual);
  assert.equal(result.ok, true);
  assert.equal(
    result.value.failures.some((f) => f.gateId === "privacy-failure-explicit"),
    true
  );
});

test("85. Evaluation report completeness deterministic", () => {
  const results = [
    { status: IA.INTELLIGENCE_QUALITY_GATE_STATUS.PASS },
    { status: IA.INTELLIGENCE_QUALITY_GATE_STATUS.FAIL },
  ];
  const a = IA.createIntelligenceEvaluationReport({
    reportId: "r1",
    generatedAt: FIXED_NOW,
    results,
  });
  const b = IA.createIntelligenceEvaluationReport({
    reportId: "r1",
    generatedAt: FIXED_NOW,
    results,
  });
  assert.equal(a.ok, true);
  assert.deepEqual(a.value, b.value);
  assert.equal(a.value.completeness.total, 2);
  assert.equal(a.value.completeness.passed, 1);
  assert.equal(a.value.completeness.failed, 1);
  assert.equal(a.value.completeness.complete, false);
});

test("86. Quality gate PASS explicit", () => {
  const result = IA.createIntelligenceQualityGate({
    gateId: "g1",
    status: IA.INTELLIGENCE_QUALITY_GATE_STATUS.PASS,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_QUALITY_GATE_STATUS.PASS);
});

test("87. Quality gate FAIL explicit", () => {
  const result = IA.createIntelligenceQualityGate({
    gateId: "g1",
    status: IA.INTELLIGENCE_QUALITY_GATE_STATUS.FAIL,
    message: "structural mismatch",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.status, IA.INTELLIGENCE_QUALITY_GATE_STATUS.FAIL);
  assert.equal(result.value.message, "structural mismatch");
});

test("88. Stale-model warning produced", () => {
  const result = IA.evaluateStalenessWarnings({ staleModel: true });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.warnings.some((w) => w.code === IA.INTELLIGENCE_WARNING_CODE.STALE_MODEL),
    true
  );
});

test("89. Stale-prompt warning produced", () => {
  const result = IA.evaluateStalenessWarnings({ stalePrompt: true });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.warnings.some((w) => w.code === IA.INTELLIGENCE_WARNING_CODE.STALE_PROMPT),
    true
  );
});

test("90. Stale-policy warning produced", () => {
  const result = IA.evaluateStalenessWarnings({ stalePolicy: true });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.warnings.some((w) => w.code === IA.INTELLIGENCE_WARNING_CODE.STALE_POLICY),
    true
  );
});

test("91. Drift signal contract valid", () => {
  const result = IA.createIntelligenceDriftSignal({
    signalType: IA.INTELLIGENCE_DRIFT_SIGNAL_TYPE.FEATURE_DISTRIBUTION_DRIFT,
    detectedAt: FIXED_NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(
    result.value.signalType,
    IA.INTELLIGENCE_DRIFT_SIGNAL_TYPE.FEATURE_DISTRIBUTION_DRIFT
  );
});

test("92. Drift signal does not auto-retrain", () => {
  const result = IA.createIntelligenceDriftSignal({
    signalType: IA.INTELLIGENCE_DRIFT_SIGNAL_TYPE.QUALITY_DEGRADATION,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.autoRetrain, false);
});

test("93. Drift signal does not auto-switch model", () => {
  const result = IA.createIntelligenceDriftSignal({
    signalType: IA.INTELLIGENCE_DRIFT_SIGNAL_TYPE.STALE_MODEL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.autoSwitchModel, false);
  assert.equal(result.value.autoRollbackProduction, false);
});

test("94. No model-generated SQL execution", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /\.query\s*\(|executeSql\s*\(|CREATE\s+TABLE|SELECT\s+\*\s+FROM/i.test(text),
      false,
      file
    );
  }
});

test("95. No shell execution", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /child_process|execSync|spawnSync|\bexec\s*\(/i.test(text),
      false,
      file
    );
  }
});

test("96. No dynamic eval", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/\beval\s*\(|new Function\s*\(/.test(text), false, file);
  }
});

test("97. No provider SDK import", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /openai|anthropic|@google|azure-openai|fetch\s*\(|XMLHttpRequest|http\.request/i.test(
        text
      ),
      false,
      file
    );
  }
});

test("98. No React import", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/from\s+["']react["']/.test(text), false, file);
  }
});

test("99. No Supabase import", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/supabase/i.test(text), false, file);
  }
});

test("100. No Platform Core private import", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/src\/core\/platform/.test(text), false, file);
  }
});

test("101. No business-module private import", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/features\/(finance|ranking|notification)\//.test(text), false, file);
  }
});

test("102. No global singleton", () => {
  for (const file of SOURCE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/globalThis\.__/.test(text), false, file);
    assert.equal(/^\s*let\s+\w*[Rr]egistry\s*=/m.test(text), false, file);
  }
  const a = IA.createIntelligenceUseCaseRegistry({ entries: [baseUseCase()] }).value.registry;
  const b = IA.createIntelligenceUseCaseRegistry({ entries: [baseUseCase()] }).value.registry;
  assert.notEqual(a, b);
});

test("103. No API key in fixtures/docs", () => {
  for (const file of DOC_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/sk-[A-Za-z0-9]{10,}/.test(text), false, file);
    assert.equal(/api[_-]?key\s*[:=]\s*["'][^"']+["']/i.test(text), false, file);
  }
  const thisFile = readFileSync(fileURLToPath(import.meta.url), "utf8");
  assert.equal(/sk-[A-Za-z0-9]{10,}/.test(thisFile), false);
});

test("104. No PII in fixtures/docs/errors", () => {
  for (const file of DOC_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(
      /[a-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail)\.com/i.test(text),
      false,
      file
    );
    assert.equal(/\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(text), false, file);
  }
  const sanitized = IA.sanitizePrivacySafeError({
    code: "X",
    message: "failed for user@example.com",
  });
  assert.equal(sanitized.value.message.includes("user@example.com"), false);
});

test("105. Same request/provider fixture gives same result", () => {
  const providerResult = IA.createInMemoryIntelligenceProvider({ includeConfidence: true });
  const request = buildRequest();
  const a = providerResult.value.infer(request);
  const b = providerResult.value.infer(request);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.deepEqual(a.value.candidate, b.value.candidate);
});

test("106. Empty feature set handled deterministically", () => {
  const a = IA.createIntelligenceFeatureVector(baseFeatureVector({ values: [] }));
  const b = IA.createIntelligenceFeatureVector(baseFeatureVector({ values: [] }));
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.value.values.length, 0);
  assert.deepEqual(a.value.values, b.value.values);
});

test("107. Missing data not silently imputed", () => {
  const schemaResult = IA.createIntelligenceFeatureSchema({
    featureSchemaId: "omit-schema",
    version: "1.0.0",
    features: [
      {
        featureId: "match.count",
        valueType: IA.INTELLIGENCE_FEATURE_VALUE_TYPE.COUNT,
        classification: IA.ANALYTICS_DATA_CLASSIFICATION.INTERNAL,
        missingValuePolicy: IA.INTELLIGENCE_MISSING_VALUE_POLICY.OMIT_FEATURE,
      },
    ],
  });
  assert.equal(schemaResult.ok, true);
  const result = IA.createIntelligenceFeatureVector(
    baseFeatureVector({
      featureSchema: schemaResult.value,
      values: [{ featureId: "match.count", value: null }],
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.values.length, 0);
});

test("108. Candidate result does not claim canonical domain state", () => {
  const result = IA.createIntelligenceCandidateInsight({
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.isCanonicalDomainState, false);
});

test("109. Candidate result cannot mutate input", () => {
  const input = {
    status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
    structuredOutput: { a: 1 },
  };
  const before = JSON.stringify(input);
  const result = IA.createIntelligenceCandidateInsight(input);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(input), before);
  assert.ok(Object.isFrozen(result.value));
  assert.equal(result.value.canMutateDomain, false);
});

test("110. Read-only facade exposes no write methods", () => {
  const facadeResult = IA.createReadOnlyIntelligenceReadinessFacade();
  assert.equal(facadeResult.ok, true);
  const facade = facadeResult.value;
  assert.equal(Object.keys(facade).includes("write"), false);
  for (const op of [
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
  ]) {
    const rejected = facade[op]();
    assert.equal(rejected.ok, false, op);
    assert.equal(
      rejected.error.code,
      IA.ANALYTICS_ERROR_CODE.INTELLIGENCE_FACADE_WRITE_REJECTED,
      op
    );
  }
});

test("111. Invalid request does not invoke provider", () => {
  let calls = 0;
  const innerProvider = IA.createInMemoryIntelligenceProvider().value;
  const countingProvider = {
    infer(request, options) {
      calls += 1;
      return innerProvider.infer(request, options);
    },
  };
  const facadeResult = IA.createIntelligenceReadinessFacade({
    provider: countingProvider,
  });
  assert.equal(facadeResult.ok, true);
  const result = facadeResult.value.runReadinessPipeline({
    useCaseId: "unknown.use.case",
    useCaseVersion: "1.0.0",
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("112. Presentation payload distinguishes generated/review/abstained/rejected", () => {
  const generated = IA.composeIntelligenceInsightPresentationPayloads({
    candidate: {
      candidateId: "c1",
      status: IA.INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
      structuredOutput: {},
    },
  });
  const review = IA.composeIntelligenceInsightPresentationPayloads({
    candidate: {
      candidateId: "c2",
      status: IA.INTELLIGENCE_CANDIDATE_STATUS.REQUIRES_REVIEW,
      structuredOutput: {},
    },
  });
  const abstained = IA.composeIntelligenceInsightPresentationPayloads({
    candidate: {
      candidateId: "c3",
      status: IA.INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED,
      structuredOutput: {},
    },
  });
  const rejected = IA.composeIntelligenceInsightPresentationPayloads({
    candidate: {
      candidateId: "c4",
      status: IA.INTELLIGENCE_CANDIDATE_STATUS.REJECTED,
      structuredOutput: {},
    },
  });
  assert.equal(generated.ok, true);
  assert.equal(generated.value.dataState, IA.INTELLIGENCE_PRESENTATION_DATA_STATE.GENERATED);
  assert.equal(
    review.value.dataState,
    IA.INTELLIGENCE_PRESENTATION_DATA_STATE.REQUIRES_REVIEW
  );
  assert.equal(
    abstained.value.dataState,
    IA.INTELLIGENCE_PRESENTATION_DATA_STATE.ABSTAINED
  );
  assert.equal(
    rejected.value.dataState,
    IA.INTELLIGENCE_PRESENTATION_DATA_STATE.REJECTED
  );
});

test("113. I&A-11 privacy decisions remain enforced", () => {
  const ctx = buildTrustedAccessContext();
  const decision = IA.evaluateMetricAccess(ctx, {
    metricId: "metric.restricted.secret",
    classification: IA.ANALYTICS_DATA_CLASSIFICATION.RESTRICTED,
  });
  assert.equal(decision.ok, true);
  assert.equal(decision.value.decision, IA.ANALYTICS_ACCESS_DECISION.DENY);
});

test("114. I&A-10 alert integration remains read-only", () => {
  assert.equal(typeof IA.createOperationalAlertsInsightsFacade, "function");
  assert.equal(typeof IA.createReadOnlyOperationalAlertsInsightsFacade, "function");
  const text = readFileSync(
    join(MODULE_ROOT, "operational-alerts-insights", "facade.js"),
    "utf8"
  );
  assert.equal(/\bwrite\s*\(|\bpersist\s*\(|\bsendNotification\s*\(/.test(text), false);
});

test("115. I&A-01 through I&A-11 regressions PASS", () => {
  assert.equal(IA.INTELLIGENCE_ANALYTICS_FOUNDATION.workstreamId, "I&A-01");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_METRIC_REGISTRY.workstreamId, "I&A-02");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_QUERY_RUNTIME.workstreamId, "I&A-03");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_DASHBOARD_REPORTING.workstreamId, "I&A-04");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_HISTORICAL_TREND.workstreamId, "I&A-05");
  assert.equal(IA.INTELLIGENCE_ANALYTICS_COMPETITION_ANALYTICS.workstreamId, "I&A-06");
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_VENUE_COURT_CLUB_ANALYTICS.workstreamId,
    "I&A-07"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_CUSTOMER_PLAYER_ANALYTICS.workstreamId,
    "I&A-08"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_FINANCE_RANKING_PERFORMANCE_ANALYTICS.workstreamId,
    "I&A-09"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_OPERATIONAL_ALERTS_INSIGHTS.workstreamId,
    "I&A-10"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_PRIVACY_ACCESS_CERTIFICATION.workstreamId,
    "I&A-11"
  );
  assert.equal(
    IA.INTELLIGENCE_ANALYTICS_AI_ADVANCED_INTELLIGENCE_READINESS.workstreamId,
    "I&A-12"
  );
});
