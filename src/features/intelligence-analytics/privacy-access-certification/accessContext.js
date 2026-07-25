/**
 * Trusted analytics privacy access-context contracts (I&A-11).
 * Consumes explicit trusted Platform/Module access context.
 * Does not authenticate, assign roles, or infer permissions from role names.
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
  ANALYTICS_DATA_CLASSIFICATION,
  ANALYTICS_ENTITY_SCOPE_KIND,
} from "./enums.js";
import { validateDataClassification } from "./classification.js";

const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  "token",
  "accessToken",
  "authToken",
  "password",
  "secret",
  "apiKey",
  "credentials",
  "email",
  "phone",
  "fullName",
  "name",
  "ssn",
  "cardNumber",
  "cvv",
  "permissionsObject",
  "rolePermissions",
]);

const POLICY_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * @param {Record<string, unknown>} input
 * @param {string} fieldLabel
 * @returns {import("../contracts/result.js").Result | null}
 */
function rejectForbiddenContextFields(input, fieldLabel) {
  const present = FORBIDDEN_CONTEXT_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(input, key)
  );
  if (present.length === 0) return null;
  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
      `${fieldLabel} must not contain forbidden secret/PII fields: ${present.join(", ")}`,
      fieldLabel,
      { forbiddenFields: Object.freeze([...present]) }
    )
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrivacyPolicyReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
        "PrivacyPolicyReference must be a plain object",
        "policyReference"
      )
    );
  }

  if (!isNonEmptyString(input.policyId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
        "policyId is required",
        "policyReference.policyId"
      )
    );
  }

  if (!isNonEmptyString(input.policyVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_VERSION_INVALID,
        "policyVersion is required",
        "policyReference.policyVersion"
      )
    );
  }

  const version = String(input.policyVersion).trim();
  if (!POLICY_VERSION_PATTERN.test(version)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_POLICY_VERSION_INVALID,
        "policyVersion must be semver MAJOR.MINOR.PATCH",
        "policyReference.policyVersion",
        { reasonCode: "MALFORMED_POLICY_VERSION" }
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const ref = {
    policyId: String(input.policyId).trim(),
    policyVersion: version,
  };

  if (input.policySource !== undefined) {
    if (!isNonEmptyString(input.policySource)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_POLICY_INVALID,
          "policySource must be a non-empty string when provided",
          "policyReference.policySource"
        )
      );
    }
    ref.policySource = String(input.policySource).trim();
  }

  return ok(deepFreeze(ref));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrincipalReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "PrincipalReference must be a plain object",
        "principal"
      )
    );
  }

  const forbidden = rejectForbiddenContextFields(input, "principal");
  if (forbidden) return forbidden;

  if (!isNonEmptyString(input.principalId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "principalId is required (opaque)",
        "principal.principalId"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const principal = {
    principalId: String(input.principalId).trim(),
  };

  if (input.principalKind !== undefined) {
    if (!isNonEmptyString(input.principalKind)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "principalKind must be a non-empty string when provided",
          "principal.principalKind"
        )
      );
    }
    principal.principalKind = String(input.principalKind).trim();
  }

  return ok(deepFreeze(principal));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrivacyTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "PrivacyTenantScope must be a plain object",
        "tenantScope"
      )
    );
  }

  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Explicit tenantId is required (fail closed; no arbitrary default)",
        "tenantScope.tenantId",
        { reasonCode: "MISSING_TENANT" }
      )
    );
  }

  return ok(
    deepFreeze({
      tenantId: String(input.tenantId).trim(),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrivacyEntityScope(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "PrivacyEntityScope must be a plain object",
        "entityScope"
      )
    );
  }

  /** @type {Record<string, string>} */
  const scope = {};
  const kindToField = {
    [ANALYTICS_ENTITY_SCOPE_KIND.COMPETITION]: "competitionId",
    [ANALYTICS_ENTITY_SCOPE_KIND.VENUE]: "venueId",
    [ANALYTICS_ENTITY_SCOPE_KIND.COURT]: "courtId",
    [ANALYTICS_ENTITY_SCOPE_KIND.CLUB]: "clubId",
    [ANALYTICS_ENTITY_SCOPE_KIND.CUSTOMER]: "customerId",
    [ANALYTICS_ENTITY_SCOPE_KIND.PLAYER]: "playerId",
    [ANALYTICS_ENTITY_SCOPE_KIND.TEAM]: "teamId",
    [ANALYTICS_ENTITY_SCOPE_KIND.FINANCE]: "financeScopeId",
    [ANALYTICS_ENTITY_SCOPE_KIND.RANKING_SYSTEM]: "rankingSystemId",
    [ANALYTICS_ENTITY_SCOPE_KIND.RATING_SYSTEM]: "ratingSystemId",
  };

  for (const field of Object.values(kindToField)) {
    if (input[field] !== undefined) {
      if (!isNonEmptyString(input[field])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
            `${field} must be a non-empty string when provided`,
            `entityScope.${field}`
          )
        );
      }
      scope[field] = String(input[field]).trim();
    }
  }

  if (input.parentVenueId !== undefined) {
    if (!isNonEmptyString(input.parentVenueId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "parentVenueId must be a non-empty string when provided",
          "entityScope.parentVenueId"
        )
      );
    }
    scope.parentVenueId = String(input.parentVenueId).trim();
  }

  return ok(deepFreeze(scope));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsMetricAccessGrant(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "MetricAccessGrant must be a plain object",
        "metricGrant"
      )
    );
  }

  if (!isNonEmptyString(input.metricId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "metricId is required",
        "metricGrant.metricId"
      )
    );
  }

  const classificationResult = validateDataClassification(input.classification);
  if (!classificationResult.ok) return classificationResult;

  /** @type {Record<string, unknown>} */
  const grant = {
    metricId: String(input.metricId).trim(),
    classification: classificationResult.value,
  };

  if (input.metricVersion !== undefined) {
    if (!isNonEmptyString(input.metricVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "metricVersion must be a non-empty string when provided",
          "metricGrant.metricVersion"
        )
      );
    }
    grant.metricVersion = String(input.metricVersion).trim();
  }

  if (input.maxClassification !== undefined) {
    const maxResult = validateDataClassification(input.maxClassification);
    if (!maxResult.ok) return maxResult;
    grant.maxClassification = maxResult.value;
  }

  return ok(deepFreeze(grant));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDimensionAccessGrant(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "DimensionAccessGrant must be a plain object",
        "dimensionGrant"
      )
    );
  }

  if (!isNonEmptyString(input.dimensionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "dimensionId is required",
        "dimensionGrant.dimensionId"
      )
    );
  }

  const classificationResult = validateDataClassification(input.classification);
  if (!classificationResult.ok) return classificationResult;

  /** @type {Record<string, unknown>} */
  const grant = {
    dimensionId: String(input.dimensionId).trim(),
    classification: classificationResult.value,
  };

  if (input.dimensionVersion !== undefined) {
    if (!isNonEmptyString(input.dimensionVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "dimensionVersion must be a non-empty string when provided",
          "dimensionGrant.dimensionVersion"
        )
      );
    }
    grant.dimensionVersion = String(input.dimensionVersion).trim();
  }

  return ok(deepFreeze(grant));
}

/**
 * Trusted AnalyticsAccessContext for privacy certification (I&A-11).
 * Distinct from I&A-03 runtime access context — requires trustedSource marker,
 * explicit tenant, and policy version.
 *
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsPrivacyAccessContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "AnalyticsPrivacyAccessContext must be a plain object",
        "accessContext"
      )
    );
  }

  const forbidden = rejectForbiddenContextFields(input, "accessContext");
  if (forbidden) return forbidden;

  if (input.trustedSource !== true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_TRUSTED_SOURCE_REQUIRED,
        "trustedSource marker must be explicitly true (fail closed)",
        "accessContext.trustedSource",
        { reasonCode: "MISSING_TRUSTED_SOURCE" }
      )
    );
  }

  const tenantResult = createAnalyticsPrivacyTenantScope(
    input.tenantScope ?? { tenantId: input.tenantId }
  );
  if (!tenantResult.ok) return tenantResult;

  const policyResult = createAnalyticsPrivacyPolicyReference(
    input.privacyPolicy ?? input.policyReference ?? {}
  );
  if (!policyResult.ok) return policyResult;

  if (!isValidIsoTimestamp(input.issuedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
        "issuedAt must be a valid ISO timestamp",
        "accessContext.issuedAt"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const context = {
    trustedSource: true,
    tenantScope: tenantResult.value,
    privacyPolicy: policyResult.value,
    issuedAt: String(input.issuedAt).trim(),
    isCanonicalAuthorizationState: false,
  };

  if (input.principal !== undefined) {
    const principalResult = createAnalyticsPrincipalReference(input.principal);
    if (!principalResult.ok) return principalResult;
    context.principal = principalResult.value;
  }

  if (input.permittedEntityScopes !== undefined) {
    if (!Array.isArray(input.permittedEntityScopes)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "permittedEntityScopes must be an array",
          "accessContext.permittedEntityScopes"
        )
      );
    }
    /** @type {unknown[]} */
    const scopes = [];
    for (const item of input.permittedEntityScopes) {
      const scopeResult = createAnalyticsPrivacyEntityScope(item);
      if (!scopeResult.ok) return scopeResult;
      scopes.push(scopeResult.value);
    }
    context.permittedEntityScopes = Object.freeze([...scopes]);
  } else {
    context.permittedEntityScopes = Object.freeze([]);
  }

  if (input.metricGrants !== undefined) {
    if (!Array.isArray(input.metricGrants)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "metricGrants must be an array",
          "accessContext.metricGrants"
        )
      );
    }
    /** @type {unknown[]} */
    const grants = [];
    for (const item of input.metricGrants) {
      const grantResult = createAnalyticsMetricAccessGrant(item);
      if (!grantResult.ok) return grantResult;
      grants.push(grantResult.value);
    }
    context.metricGrants = Object.freeze([...grants]);
  } else {
    context.metricGrants = Object.freeze([]);
  }

  if (input.dimensionGrants !== undefined) {
    if (!Array.isArray(input.dimensionGrants)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "dimensionGrants must be an array",
          "accessContext.dimensionGrants"
        )
      );
    }
    /** @type {unknown[]} */
    const grants = [];
    for (const item of input.dimensionGrants) {
      const grantResult = createAnalyticsDimensionAccessGrant(item);
      if (!grantResult.ok) return grantResult;
      grants.push(grantResult.value);
    }
    context.dimensionGrants = Object.freeze([...grants]);
  } else {
    context.dimensionGrants = Object.freeze([]);
  }

  if (input.maxClassification !== undefined) {
    const maxResult = validateDataClassification(input.maxClassification);
    if (!maxResult.ok) return maxResult;
    context.maxClassification = maxResult.value;
  } else {
    context.maxClassification = ANALYTICS_DATA_CLASSIFICATION.INTERNAL;
  }

  if (input.correlationId !== undefined) {
    if (!isNonEmptyString(input.correlationId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_ACCESS_CONTEXT_INVALID,
          "correlationId must be a non-empty string when provided",
          "accessContext.correlationId"
        )
      );
    }
    context.correlationId = String(input.correlationId).trim();
  }

  return ok(deepFreeze(context));
}
