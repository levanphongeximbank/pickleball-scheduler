/**
 * Privacy, tenant/entity, injection, prohibited and version guards (I&A-12).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
} from "../privacy-access-certification/enums.js";
import { requireTrustedAccessContext } from "../privacy-access-certification/guards.js";
import {
  INTELLIGENCE_RISK_TIER,
  PROHIBITED_INTELLIGENCE_USE_CASE_IDS,
} from "./enums.js";
import { assertProviderCapabilities } from "./providerRefs.js";

/**
 * @param {unknown} useCase
 * @returns {import("../contracts/result.js").Result}
 */
export function guardProhibitedUseCase(useCase) {
  if (!isPlainObject(useCase)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_UNKNOWN,
        "Unknown use case rejected before provider call",
        "useCase"
      )
    );
  }

  const useCaseId = String(useCase.useCaseId ?? "");
  if (
    useCase.riskTier === INTELLIGENCE_RISK_TIER.PROHIBITED ||
    PROHIBITED_INTELLIGENCE_USE_CASE_IDS.includes(useCaseId) ||
    useCase.lifecycleStatus === "PROHIBITED"
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_PROHIBITED,
        "PROHIBITED use case rejected before provider invocation",
        "useCase",
        { useCaseId }
      )
    );
  }

  return ok(useCase);
}

/**
 * Structured / untrusted input cannot override policy, tenant, use-case, tools.
 * @param {unknown} requestLike
 * @param {unknown} trustedBaseline
 * @returns {import("../contracts/result.js").Result}
 */
export function guardPromptInjectionBoundary(requestLike, trustedBaseline) {
  if (!isPlainObject(requestLike) || !isPlainObject(trustedBaseline)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION,
        "Injection boundary requires plain request and trusted baseline",
        "injection"
      )
    );
  }

  const untrusted = requestLike.untrustedText;
  if (untrusted !== undefined && untrusted !== null) {
    if (!isPlainObject(untrusted) || untrusted.markedUntrusted !== true) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION,
          "Untrusted text must be explicitly marked",
          "untrustedText"
        )
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(untrusted, "tenantId") ||
      Object.prototype.hasOwnProperty.call(untrusted, "useCaseId") ||
      Object.prototype.hasOwnProperty.call(untrusted, "useCaseVersion") ||
      Object.prototype.hasOwnProperty.call(untrusted, "enableTools") ||
      Object.prototype.hasOwnProperty.call(untrusted, "toolPermissions") ||
      Object.prototype.hasOwnProperty.call(untrusted, "policy") ||
      Object.prototype.hasOwnProperty.call(untrusted, "modelReference") ||
      Object.prototype.hasOwnProperty.call(untrusted, "outputSchema")
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION,
          "Untrusted text cannot change tenant, use case, policy, model, schema, or tools",
          "untrustedText"
        )
      );
    }
  }

  // Structured data fields must not override trusted baseline policy fields.
  const protectedFields = [
    "tenantId",
    "useCaseId",
    "useCaseVersion",
    "policyVersion",
    "modelId",
    "modelVersion",
    "outputSchemaId",
    "toolPermissions",
  ];

  if (isPlainObject(requestLike.structuredOverrides)) {
    for (const field of protectedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          requestLike.structuredOverrides,
          field
        ) &&
        requestLike.structuredOverrides[field] !== trustedBaseline[field]
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_INJECTION_BOUNDARY_VIOLATION,
            "Structured data cannot override policy/tenant/use-case fields",
            `structuredOverrides.${field}`
          )
        );
      }
    }
  }

  return ok(
    deepFreeze({
      injectionBoundaryEnforced: true,
      untrustedMarked: Boolean(untrusted?.markedUntrusted),
      toolsEnabled: false,
    })
  );
}

/**
 * @param {unknown} accessContext
 * @param {unknown} featureVector
 * @param {unknown} [requestScope]
 * @returns {import("../contracts/result.js").Result}
 */
export function guardIntelligenceTenantEntityIsolation(
  accessContext,
  featureVector,
  requestScope = {}
) {
  const trusted = requireTrustedAccessContext(accessContext);
  if (!trusted.ok) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TRUSTED_ACCESS_REQUIRED,
        "Trusted access context required",
        "accessContext",
        trusted.error?.details
      )
    );
  }

  if (!isPlainObject(featureVector)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
        "Feature vector required for isolation guard",
        "featureVector"
      )
    );
  }

  // I&A-11 requireTrustedAccessContext returns the certified tenantId string.
  const tenantId = trusted.value;
  if (!isNonEmptyString(tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Missing tenant — fail closed",
        "tenantId"
      )
    );
  }

  if (featureVector.tenantId !== tenantId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TENANT_MISMATCH,
        "Cross-tenant request rejected",
        "featureVector.tenantId",
        { expected: tenantId, received: featureVector.tenantId }
      )
    );
  }

  if (
    isPlainObject(requestScope) &&
    isNonEmptyString(requestScope.tenantId) &&
    requestScope.tenantId !== tenantId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TENANT_MISMATCH,
        "Cross-tenant request rejected",
        "request.tenantId"
      )
    );
  }

  if (
    isNonEmptyString(requestScope.entityId) &&
    isNonEmptyString(featureVector.entityId) &&
    requestScope.entityId !== featureVector.entityId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH,
        "Cross-entity request rejected",
        "request.entityId"
      )
    );
  }

  if (
    isPlainObject(requestScope.rankingSystemScope) &&
    isPlainObject(featureVector.rankingSystemScope) &&
    requestScope.rankingSystemScope.rankingSystemId !==
      featureVector.rankingSystemScope.rankingSystemId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH,
        "Ranking/rating system mismatch rejected",
        "rankingSystemScope"
      )
    );
  }

  if (
    isPlainObject(requestScope.financeScope) &&
    isPlainObject(featureVector.financeScope) &&
    requestScope.financeScope.financeScopeId !==
      featureVector.financeScope.financeScopeId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_ENTITY_MISMATCH,
        "Finance scope mismatch rejected",
        "financeScope"
      )
    );
  }

  return ok(
    deepFreeze({
      tenantId,
      entityId: featureVector.entityId,
      entityScopeKind: featureVector.entityScopeKind,
      isolationCertified: true,
    })
  );
}

/**
 * @param {unknown} accessDecision
 * @returns {import("../contracts/result.js").Result}
 */
export function guardAccessDecisionForInference(accessDecision) {
  if (!isPlainObject(accessDecision)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TRUSTED_ACCESS_REQUIRED,
        "Access decision reference required",
        "accessDecision"
      )
    );
  }

  const decision = accessDecision.decision ?? accessDecision.accessDecision;
  if (decision === ANALYTICS_ACCESS_DECISION.DENY) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_ACCESS_DENIED,
        "Access DENY blocks inference",
        "accessDecision"
      )
    );
  }

  return ok(
    deepFreeze({
      decision: decision ?? ANALYTICS_ACCESS_DECISION.ALLOW,
      accessDecisionReference: isNonEmptyString(accessDecision.referenceId)
        ? String(accessDecision.referenceId).trim()
        : "access-decision",
    })
  );
}

/**
 * @param {*} useCase
 * @param {*} model
 * @returns {import("../contracts/result.js").Result}
 */
export function guardProviderCapabilityCompatibility(useCase, model) {
  return assertProviderCapabilities(
    useCase?.providerCapabilityRequirements ?? [],
    model?.capabilities ?? []
  );
}

/**
 * @param {*} request
 * @param {*} response
 * @returns {import("../contracts/result.js").Result}
 */
export function guardVersionCompatibility(request, response) {
  if (!isPlainObject(request) || !isPlainObject(response)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_VERSION_INCOMPATIBLE,
        "Version compatibility requires request and response",
        "compatibility"
      )
    );
  }

  if (
    response.modelId &&
    request.modelReference?.modelId &&
    response.modelId !== request.modelReference.modelId
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_MODEL_MISMATCH,
        "Response model mismatch",
        "response.modelId"
      )
    );
  }

  if (
    response.modelVersion &&
    request.modelReference?.modelVersion &&
    response.modelVersion !== request.modelReference.modelVersion
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_MODEL_MISMATCH,
        "Response model version mismatch",
        "response.modelVersion"
      )
    );
  }

  if (
    response.outputSchemaVersion &&
    request.outputSchemaReference?.version &&
    response.outputSchemaVersion !== request.outputSchemaReference.version
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_RESPONSE_SCHEMA_MISMATCH,
        "Response schema version mismatch",
        "response.outputSchemaVersion"
      )
    );
  }

  if (
    request.promptTemplateReference &&
    response.promptTemplateVersion &&
    response.promptTemplateVersion !== request.promptTemplateReference.version
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROMPT_VERSION_MISMATCH,
        "Prompt-template version mismatch",
        "response.promptTemplateVersion"
      )
    );
  }

  return ok(true);
}

/**
 * Project candidate output through privacy decisions before presentation.
 * @param {unknown} candidate
 * @param {unknown} privacyProjection
 * @returns {import("../contracts/result.js").Result}
 */
export function projectIntelligenceOutputPrivacy(candidate, privacyProjection) {
  if (!isPlainObject(candidate)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PRIVACY_VIOLATION,
        "Candidate required for privacy projection",
        "candidate"
      )
    );
  }

  const projection = isPlainObject(privacyProjection) ? privacyProjection : {};
  const structured = isPlainObject(candidate.structuredOutput)
    ? { ...candidate.structuredOutput }
    : {};

  for (const field of projection.omitFields ?? []) {
    delete structured[field];
  }
  for (const field of projection.redactFields ?? []) {
    if (Object.prototype.hasOwnProperty.call(structured, field)) {
      structured[field] = projection.redactionPlaceholder ?? "[REDACTED]";
    }
  }
  for (const field of projection.suppressFields ?? []) {
    // Suppress removes value — never coerce to zero.
    delete structured[field];
  }

  if (projection.denied === true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_ACCESS_DENIED,
        "Output privacy projection denied",
        "privacyProjection"
      )
    );
  }

  return ok(
    deepFreeze({
      ...candidate,
      structuredOutput: deepFreeze(structured),
      privacyProjected: true,
    })
  );
}
