/**
 * Intelligence use-case definition contracts (I&A-12).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_DATA_CLASSIFICATION,
  ANALYTICS_ENTITY_SCOPE_KIND,
} from "../privacy-access-certification/enums.js";
import {
  INTELLIGENCE_FALLBACK_POLICY,
  INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT,
  INTELLIGENCE_OUTPUT_CLASSIFICATION,
  INTELLIGENCE_RISK_TIER,
  INTELLIGENCE_USE_CASE_LIFECYCLE,
  PROHIBITED_INTELLIGENCE_USE_CASE_IDS,
  isIntelligenceEnumValue,
} from "./enums.js";
import { createIntelligenceProvenance, requireSemver } from "./provenance.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceUseCaseDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "IntelligenceUseCaseDefinition must be a plain object",
        "useCase"
      )
    );
  }

  if (!isNonEmptyString(input.useCaseId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_ID_REQUIRED,
        "useCaseId is required",
        "useCase.useCaseId"
      )
    );
  }

  const versionResult = requireSemver(input.version, "useCase.version");
  if (!versionResult.ok) {
    if (!isNonEmptyString(input.version)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_VERSION_REQUIRED,
          "version is required",
          "useCase.version"
        )
      );
    }
    return versionResult;
  }

  if (!isIntelligenceEnumValue(input.riskTier, INTELLIGENCE_RISK_TIER)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RISK_TIER_UNKNOWN,
        "Unknown risk tier — fail closed",
        "useCase.riskTier",
        { riskTier: input.riskTier }
      )
    );
  }

  const useCaseId = String(input.useCaseId).trim();
  const riskTier = /** @type {string} */ (input.riskTier);

  if (
    riskTier === INTELLIGENCE_RISK_TIER.PROHIBITED ||
    PROHIBITED_INTELLIGENCE_USE_CASE_IDS.includes(useCaseId)
  ) {
    // Prohibited definitions may be registered for governance discovery,
    // but runtime invocation is rejected by prohibited-use-case guard.
    if (
      input.lifecycleStatus !== INTELLIGENCE_USE_CASE_LIFECYCLE.PROHIBITED &&
      input.allowProhibitedRegistration !== true
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED,
          "PROHIBITED use case rejected",
          "useCase.riskTier",
          { useCaseId, riskTier }
        )
      );
    }
  }

  if (!isNonEmptyString(input.title)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "title is required",
        "useCase.title"
      )
    );
  }

  if (!isNonEmptyString(input.description)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "description is required",
        "useCase.description"
      )
    );
  }

  if (!isNonEmptyString(input.owner)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "owner is required",
        "useCase.owner"
      )
    );
  }

  const lifecycleStatus = isIntelligenceEnumValue(
    input.lifecycleStatus,
    INTELLIGENCE_USE_CASE_LIFECYCLE
  )
    ? input.lifecycleStatus
    : INTELLIGENCE_USE_CASE_LIFECYCLE.ACTIVE;

  let humanReviewRequirement = input.humanReviewRequirement;
  if (riskTier === INTELLIGENCE_RISK_TIER.HIGH) {
    humanReviewRequirement = INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.REQUIRED;
  } else if (
    !isIntelligenceEnumValue(
      humanReviewRequirement,
      INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT
    )
  ) {
    humanReviewRequirement =
      riskTier === INTELLIGENCE_RISK_TIER.MODERATE
        ? INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.OPTIONAL
        : INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.OPTIONAL;
  }

  if (riskTier === INTELLIGENCE_RISK_TIER.PROHIBITED) {
    humanReviewRequirement = INTELLIGENCE_HUMAN_REVIEW_REQUIREMENT.NOT_ALLOWED;
  }

  const allowedInputClassifications = Array.isArray(
    input.allowedInputClassifications
  )
    ? input.allowedInputClassifications
    : [ANALYTICS_DATA_CLASSIFICATION.INTERNAL];

  for (const c of allowedInputClassifications) {
    if (!isIntelligenceEnumValue(c, ANALYTICS_DATA_CLASSIFICATION)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
          "Unknown allowed input classification",
          "useCase.allowedInputClassifications",
          { classification: c }
        )
      );
    }
  }

  const allowedOutputClassifications = Array.isArray(
    input.allowedOutputClassifications
  )
    ? input.allowedOutputClassifications
    : [INTELLIGENCE_OUTPUT_CLASSIFICATION.ADVISORY_INSIGHT];

  for (const c of allowedOutputClassifications) {
    if (!isIntelligenceEnumValue(c, INTELLIGENCE_OUTPUT_CLASSIFICATION)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
          "Unknown allowed output classification",
          "useCase.allowedOutputClassifications",
          { classification: c }
        )
      );
    }
    if (c === INTELLIGENCE_OUTPUT_CLASSIFICATION.PROHIBITED_DECISION) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_OUTPUT_SCHEMA_PROHIBITED,
          "Prohibited output classification rejected",
          "useCase.allowedOutputClassifications"
        )
      );
    }
  }

  const permittedEntityScopes = Array.isArray(input.permittedEntityScopes)
    ? input.permittedEntityScopes
    : Object.values(ANALYTICS_ENTITY_SCOPE_KIND);

  for (const scope of permittedEntityScopes) {
    if (!isIntelligenceEnumValue(scope, ANALYTICS_ENTITY_SCOPE_KIND)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
          "Unknown permitted entity scope",
          "useCase.permittedEntityScopes",
          { scope }
        )
      );
    }
  }

  const fallbackPolicy = isIntelligenceEnumValue(
    input.fallbackPolicy,
    INTELLIGENCE_FALLBACK_POLICY
  )
    ? input.fallbackPolicy
    : INTELLIGENCE_FALLBACK_POLICY.FAIL_CLOSED;

  const abstentionPolicy = isIntelligenceEnumValue(
    input.abstentionPolicy,
    INTELLIGENCE_FALLBACK_POLICY
  )
    ? input.abstentionPolicy
    : INTELLIGENCE_FALLBACK_POLICY.ABSTAIN;

  if (!isNonEmptyString(input.featureSchemaId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "featureSchemaId is required",
        "useCase.featureSchemaId"
      )
    );
  }

  const featureSchemaVersion = requireSemver(
    input.featureSchemaVersion ?? "1.0.0",
    "useCase.featureSchemaVersion"
  );
  if (!featureSchemaVersion.ok) return featureSchemaVersion;

  if (!isNonEmptyString(input.outputSchemaId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
        "outputSchemaId is required",
        "useCase.outputSchemaId"
      )
    );
  }

  const outputSchemaVersion = requireSemver(
    input.outputSchemaVersion ?? "1.0.0",
    "useCase.outputSchemaVersion"
  );
  if (!outputSchemaVersion.ok) return outputSchemaVersion;

  const provenanceResult = createIntelligenceProvenance(
    input.provenance ?? {
      source: "ia-12-use-case-definition",
      generatedAt: input.registeredAt ?? "2026-07-25T00:00:00.000Z",
    }
  );
  if (!provenanceResult.ok) return provenanceResult;

  /** @type {Record<string, unknown>} */
  const definition = {
    useCaseId,
    version: versionResult.value,
    title: String(input.title).trim(),
    description: String(input.description).trim(),
    owner: String(input.owner).trim(),
    allowedInputClassifications: Object.freeze([
      ...allowedInputClassifications,
    ]),
    allowedOutputClassifications: Object.freeze([
      ...allowedOutputClassifications,
    ]),
    permittedEntityScopes: Object.freeze([...permittedEntityScopes]),
    requiredAccessPolicy: isNonEmptyString(input.requiredAccessPolicy)
      ? String(input.requiredAccessPolicy).trim()
      : "ia-11-trusted-access",
    riskTier,
    humanReviewRequirement,
    providerCapabilityRequirements: Object.freeze(
      Array.isArray(input.providerCapabilityRequirements)
        ? [...input.providerCapabilityRequirements]
        : []
    ),
    featureSchemaReference: deepFreeze({
      featureSchemaId: String(input.featureSchemaId).trim(),
      version: featureSchemaVersion.value,
    }),
    outputSchemaReference: deepFreeze({
      outputSchemaId: String(input.outputSchemaId).trim(),
      version: outputSchemaVersion.value,
    }),
    fallbackPolicy,
    abstentionPolicy,
    evaluationPolicy: isNonEmptyString(input.evaluationPolicy)
      ? String(input.evaluationPolicy).trim()
      : "structural-assertions-v1",
    lifecycleStatus,
    provenance: provenanceResult.value,
    isCanonicalDomainState: false,
    allowsAutoActionableResult: false,
  };

  if (isNonEmptyString(input.promptTemplateId)) {
    const promptVersion = requireSemver(
      input.promptTemplateVersion ?? "1.0.0",
      "useCase.promptTemplateVersion"
    );
    if (!promptVersion.ok) return promptVersion;
    definition.promptTemplateReference = deepFreeze({
      promptTemplateId: String(input.promptTemplateId).trim(),
      version: promptVersion.value,
    });
  }

  if (isPlainObject(input.replacementReference)) {
    if (
      !isNonEmptyString(input.replacementReference.useCaseId) ||
      !isNonEmptyString(input.replacementReference.version)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_INVALID,
          "replacementReference requires useCaseId and version",
          "useCase.replacementReference"
        )
      );
    }
    definition.replacementReference = deepFreeze({
      useCaseId: String(input.replacementReference.useCaseId).trim(),
      version: String(input.replacementReference.version).trim(),
    });
  }

  return ok(deepFreeze(definition));
}
