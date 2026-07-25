/**
 * Feature schema and feature vector contracts (I&A-12).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import {
  ANALYTICS_ACCESS_DECISION,
  ANALYTICS_DATA_CLASSIFICATION,
  ANALYTICS_ENTITY_SCOPE_KIND,
} from "../privacy-access-certification/enums.js";
import {
  FORBIDDEN_INTELLIGENCE_FEATURE_KEYS,
  INTELLIGENCE_FEATURE_VALUE_TYPE,
  INTELLIGENCE_MISSING_VALUE_POLICY,
  isIntelligenceEnumValue,
} from "./enums.js";
import { createIntelligenceProvenance, requireSemver } from "./provenance.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceFeatureDefinition(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "IntelligenceFeatureDefinition must be a plain object",
        "feature"
      )
    );
  }

  if (!isNonEmptyString(input.featureId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "featureId is required",
        "feature.featureId"
      )
    );
  }

  const featureId = String(input.featureId).trim();
  if (FORBIDDEN_INTELLIGENCE_FEATURE_KEYS.includes(featureId)) {
    if (
      featureId === "email" ||
      featureId === "phone" ||
      featureId === "fullName" ||
      featureId === "name" ||
      featureId === "ssn" ||
      featureId === "dateOfBirth" ||
      featureId === "address" ||
      featureId === "nationalId" ||
      featureId === "passport"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PII_REJECTED,
          "Raw PII feature rejected",
          "feature.featureId",
          { featureId }
        )
      );
    }
    if (
      featureId === "token" ||
      featureId === "accessToken" ||
      featureId === "authToken" ||
      featureId === "password" ||
      featureId === "secret" ||
      featureId === "apiKey" ||
      featureId === "credentials" ||
      featureId === "cardNumber" ||
      featureId === "cvv" ||
      featureId === "paymentCredential"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SECRET_REJECTED,
          "Secret/token feature rejected",
          "feature.featureId",
          { featureId }
        )
      );
    }
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PRIVATE_TEXT_REJECTED,
        "Free-form private text feature rejected",
        "feature.featureId",
        { featureId }
      )
    );
  }

  const versionResult = requireSemver(input.version ?? "1.0.0", "feature.version");
  if (!versionResult.ok) return versionResult;

  if (
    !isIntelligenceEnumValue(input.valueType, INTELLIGENCE_FEATURE_VALUE_TYPE)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_TYPE_UNKNOWN,
        "Unknown feature value type",
        "feature.valueType",
        { valueType: input.valueType }
      )
    );
  }

  if (
    !isIntelligenceEnumValue(input.classification, ANALYTICS_DATA_CLASSIFICATION)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "Unknown feature classification",
        "feature.classification",
        { classification: input.classification }
      )
    );
  }

  const missingValuePolicy = isIntelligenceEnumValue(
    input.missingValuePolicy,
    INTELLIGENCE_MISSING_VALUE_POLICY
  )
    ? input.missingValuePolicy
    : INTELLIGENCE_MISSING_VALUE_POLICY.REJECT;

  /** @type {Record<string, unknown>} */
  const definition = {
    featureId,
    version: versionResult.value,
    valueType: input.valueType,
    unit: isNonEmptyString(input.unit) ? String(input.unit).trim() : "unitless",
    classification: input.classification,
    missingValuePolicy,
    normalizationPolicy: isNonEmptyString(input.normalizationPolicy)
      ? String(input.normalizationPolicy).trim()
      : "none",
    provenanceRequired: input.provenanceRequired !== false,
  };

  if (isPlainObject(input.sourceMetricReference)) {
    if (
      !isNonEmptyString(input.sourceMetricReference.metricId) ||
      !isNonEmptyString(input.sourceMetricReference.metricVersion)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
          "sourceMetricReference requires metricId and metricVersion",
          "feature.sourceMetricReference"
        )
      );
    }
    definition.sourceMetricReference = deepFreeze({
      metricId: String(input.sourceMetricReference.metricId).trim(),
      metricVersion: String(input.sourceMetricReference.metricVersion).trim(),
    });
  }

  if (isPlainObject(input.allowedRange)) {
    const { min, max } = input.allowedRange;
    if (
      (min !== undefined && !isFiniteNumber(min)) ||
      (max !== undefined && !isFiniteNumber(max))
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_RANGE_INVALID,
          "allowedRange min/max must be finite numbers",
          "feature.allowedRange"
        )
      );
    }
    if (
      isFiniteNumber(min) &&
      isFiniteNumber(max) &&
      /** @type {number} */ (min) > /** @type {number} */ (max)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_RANGE_INVALID,
          "allowedRange min must be <= max",
          "feature.allowedRange"
        )
      );
    }
    definition.allowedRange = deepFreeze({
      ...(isFiniteNumber(min) ? { min } : {}),
      ...(isFiniteNumber(max) ? { max } : {}),
    });
  }

  if (isNonEmptyString(input.entityScopeKind)) {
    if (!isIntelligenceEnumValue(input.entityScopeKind, ANALYTICS_ENTITY_SCOPE_KIND)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
          "Unknown entityScopeKind",
          "feature.entityScopeKind"
        )
      );
    }
    definition.entityScopeKind = input.entityScopeKind;
  }

  return ok(deepFreeze(definition));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceFeatureSchema(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "IntelligenceFeatureSchema must be a plain object",
        "featureSchema"
      )
    );
  }

  if (!isNonEmptyString(input.featureSchemaId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "featureSchemaId is required",
        "featureSchema.featureSchemaId"
      )
    );
  }

  const versionResult = requireSemver(input.version, "featureSchema.version");
  if (!versionResult.ok) return versionResult;

  const featureInputs = Array.isArray(input.features) ? input.features : [];
  /** @type {Array<*>} */
  const features = [];
  for (const featureInput of featureInputs) {
    const featureResult = createIntelligenceFeatureDefinition(featureInput);
    if (!featureResult.ok) return featureResult;
    features.push(featureResult.value);
  }

  features.sort((a, b) => a.featureId.localeCompare(b.featureId));

  return ok(
    deepFreeze({
      featureSchemaId: String(input.featureSchemaId).trim(),
      version: versionResult.value,
      features: Object.freeze([...features]),
      featureCount: features.length,
    })
  );
}

/**
 * @param {unknown} value
 * @param {*} featureDef
 * @returns {import("../contracts/result.js").Result}
 */
function validateFeatureValue(value, featureDef) {
  if (value === null || value === undefined) {
    if (
      featureDef.missingValuePolicy === INTELLIGENCE_MISSING_VALUE_POLICY.ALLOW_NULL
    ) {
      return ok(null);
    }
    if (
      featureDef.missingValuePolicy === INTELLIGENCE_MISSING_VALUE_POLICY.OMIT_FEATURE
    ) {
      return ok({ omit: true });
    }
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_MISSING_POLICY,
        "Missing feature value rejected by schema policy",
        "feature.value",
        { featureId: featureDef.featureId }
      )
    );
  }

  const type = featureDef.valueType;
  if (
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.NUMBER ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.RATIO ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.DURATION_MS
  ) {
    if (!isFiniteNumber(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature value must be a finite number",
          "feature.value",
          { featureId: featureDef.featureId }
        )
      );
    }
  } else if (
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.INTEGER ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.COUNT ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.MONEY_MINOR
  ) {
    if (!Number.isInteger(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature value must be an integer",
          "feature.value",
          { featureId: featureDef.featureId }
        )
      );
    }
  } else if (type === INTELLIGENCE_FEATURE_VALUE_TYPE.BOOLEAN) {
    if (typeof value !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature value must be boolean",
          "feature.value",
          { featureId: featureDef.featureId }
        )
      );
    }
  } else if (
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.STRING_ENUM ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.CATEGORY ||
    type === INTELLIGENCE_FEATURE_VALUE_TYPE.REFERENCE_ID
  ) {
    if (!isNonEmptyString(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature value must be a non-empty string",
          "feature.value",
          { featureId: featureDef.featureId }
        )
      );
    }
  }

  if (featureDef.allowedRange && isFiniteNumber(value)) {
    const { min, max } = featureDef.allowedRange;
    if (isFiniteNumber(min) && value < min) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_RANGE_INVALID,
          "Feature value below allowed range",
          "feature.value",
          { featureId: featureDef.featureId, min, value }
        )
      );
    }
    if (isFiniteNumber(max) && value > max) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_RANGE_INVALID,
          "Feature value above allowed range",
          "feature.value",
          { featureId: featureDef.featureId, max, value }
        )
      );
    }
  }

  return ok(value);
}

/**
 * Build a privacy-safe immutable feature vector.
 * Denied / suppressed / redacted / omitted access decisions exclude values.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceFeatureVector(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
        "IntelligenceFeatureVector must be a plain object",
        "featureVector"
      )
    );
  }

  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Feature vector requires explicit tenantId",
        "featureVector.tenantId"
      )
    );
  }

  if (!isPlainObject(input.featureSchema)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_INVALID,
        "featureSchema is required",
        "featureVector.featureSchema"
      )
    );
  }

  const schemaResult =
    input.featureSchema.features && input.featureSchema.featureSchemaId
      ? ok(input.featureSchema)
      : createIntelligenceFeatureSchema(input.featureSchema);
  if (!schemaResult.ok) return schemaResult;
  const schema = schemaResult.value;

  if (
    isNonEmptyString(input.featureSchemaVersion) &&
    input.featureSchemaVersion !== schema.version
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SCHEMA_VERSION_MISMATCH,
        "Feature-schema version mismatch",
        "featureVector.featureSchemaVersion",
        {
          expected: schema.version,
          received: input.featureSchemaVersion,
        }
      )
    );
  }

  if (!isNonEmptyString(input.useCaseId) || !isNonEmptyString(input.useCaseVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
        "Feature vector requires explicit useCaseId and useCaseVersion",
        "featureVector.useCase"
      )
    );
  }

  if (input.privacyAccessCertified !== true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_TRUSTED_ACCESS_REQUIRED,
        "Feature vector must be privacy/access certified",
        "featureVector.privacyAccessCertified"
      )
    );
  }

  const tenantId = String(input.tenantId).trim();
  const featureInputs = Array.isArray(input.values) ? input.values : [];
  const schemaById = new Map(schema.features.map((f) => [f.featureId, f]));

  /** @type {Array<*>} */
  const values = [];
  /** @type {string | null} */
  let entityScopeKind = isNonEmptyString(input.entityScopeKind)
    ? String(input.entityScopeKind).trim()
    : null;
  /** @type {string | null} */
  let entityId = isNonEmptyString(input.entityId)
    ? String(input.entityId).trim()
    : null;

  for (const raw of featureInputs) {
    if (!isPlainObject(raw)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature value entry must be a plain object",
          "featureVector.values"
        )
      );
    }

    if (FORBIDDEN_INTELLIGENCE_FEATURE_KEYS.includes(String(raw.featureId ?? ""))) {
      const fid = String(raw.featureId);
      if (
        ["email", "phone", "fullName", "name", "ssn", "dateOfBirth", "address"].includes(
          fid
        )
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PII_REJECTED,
            "Raw PII field rejected",
            "featureVector.values",
            { featureId: fid }
          )
        );
      }
      if (
        ["token", "accessToken", "apiKey", "secret", "password", "credentials"].includes(
          fid
        )
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_SECRET_REJECTED,
            "Secret/token field rejected",
            "featureVector.values",
            { featureId: fid }
          )
        );
      }
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_PRIVATE_TEXT_REJECTED,
          "Free-form private text rejected",
          "featureVector.values",
          { featureId: fid }
        )
      );
    }

    if (isNonEmptyString(raw.tenantId) && String(raw.tenantId).trim() !== tenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_TENANT_MISMATCH,
          "Mixed-tenant feature vector rejected",
          "featureVector.values.tenantId",
          { expected: tenantId, received: raw.tenantId }
        )
      );
    }

    if (isNonEmptyString(raw.entityId)) {
      if (entityId && String(raw.entityId).trim() !== entityId) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_ENTITY_MISMATCH,
            "Entity mismatch in feature vector",
            "featureVector.values.entityId",
            { expected: entityId, received: raw.entityId }
          )
        );
      }
      entityId = String(raw.entityId).trim();
    }

    if (isNonEmptyString(raw.entityScopeKind)) {
      if (
        entityScopeKind &&
        String(raw.entityScopeKind).trim() !== entityScopeKind
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_ENTITY_MISMATCH,
            "Entity scope kind mismatch in feature vector",
            "featureVector.values.entityScopeKind"
          )
        );
      }
      entityScopeKind = String(raw.entityScopeKind).trim();
    }

    const accessDecision = raw.accessDecision;
    if (
      accessDecision === ANALYTICS_ACCESS_DECISION.DENY ||
      accessDecision === ANALYTICS_ACCESS_DECISION.SUPPRESS ||
      accessDecision === ANALYTICS_ACCESS_DECISION.OMIT
    ) {
      // Exclude from vector — never coerce SUPPRESS to zero.
      continue;
    }
    if (accessDecision === ANALYTICS_ACCESS_DECISION.REDACT) {
      // Original redacted value must not be included.
      continue;
    }

    const featureDef = schemaById.get(String(raw.featureId ?? "").trim());
    if (!featureDef) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "Feature not declared in schema — no heuristic features",
          "featureVector.values.featureId",
          { featureId: raw.featureId }
        )
      );
    }

    const validated = validateFeatureValue(raw.value, featureDef);
    if (!validated.ok) return validated;
    if (
      validated.value &&
      typeof validated.value === "object" &&
      validated.value.omit === true
    ) {
      continue;
    }

    values.push(
      deepFreeze({
        featureId: featureDef.featureId,
        featureVersion: featureDef.version,
        value: validated.value,
        valueType: featureDef.valueType,
        unit: featureDef.unit,
        classification: featureDef.classification,
        accessDecision: accessDecision ?? ANALYTICS_ACCESS_DECISION.ALLOW,
        provenance: isPlainObject(raw.provenance)
          ? deepFreeze({ ...raw.provenance })
          : undefined,
      })
    );
  }

  values.sort((a, b) => a.featureId.localeCompare(b.featureId));

  const provenanceResult = createIntelligenceProvenance(
    input.provenance ?? {
      source: "ia-12-feature-vector",
      generatedAt: input.generatedAt ?? "2026-07-25T00:00:00.000Z",
    }
  );
  if (!provenanceResult.ok) return provenanceResult;

  /** @type {Record<string, unknown>} */
  const vector = {
    tenantId,
    useCaseId: String(input.useCaseId).trim(),
    useCaseVersion: String(input.useCaseVersion).trim(),
    featureSchemaId: schema.featureSchemaId,
    featureSchemaVersion: schema.version,
    values: Object.freeze([...values]),
    privacyAccessCertified: true,
    provenance: provenanceResult.value,
    isImmutable: true,
  };

  if (entityScopeKind) vector.entityScopeKind = entityScopeKind;
  if (entityId) vector.entityId = entityId;

  if (isPlainObject(input.timeWindow)) {
    if (
      !isValidIsoTimestamp(input.timeWindow.start) ||
      !isValidIsoTimestamp(input.timeWindow.end)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_FEATURE_VECTOR_INVALID,
          "timeWindow start/end must be valid ISO timestamps",
          "featureVector.timeWindow"
        )
      );
    }
    vector.timeWindow = deepFreeze({
      start: String(input.timeWindow.start).trim(),
      end: String(input.timeWindow.end).trim(),
    });
  }

  if (
    isPlainObject(input.rankingSystemScope) &&
    isNonEmptyString(input.rankingSystemScope.rankingSystemId)
  ) {
    vector.rankingSystemScope = deepFreeze({
      rankingSystemId: String(input.rankingSystemScope.rankingSystemId).trim(),
      rankingSystemVersion: isNonEmptyString(
        input.rankingSystemScope.rankingSystemVersion
      )
        ? String(input.rankingSystemScope.rankingSystemVersion).trim()
        : undefined,
    });
  }

  if (
    isPlainObject(input.financeScope) &&
    isNonEmptyString(input.financeScope.financeScopeId)
  ) {
    vector.financeScope = deepFreeze({
      financeScopeId: String(input.financeScope.financeScopeId).trim(),
      currencyCode: isNonEmptyString(input.financeScope.currencyCode)
        ? String(input.financeScope.currencyCode).trim()
        : undefined,
    });
  }

  return ok(deepFreeze(vector));
}
