/**
 * Provenance / reproducibility helpers for I&A-12.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {import("../contracts/result.js").Result}
 */
export function requireSemver(value, field) {
  if (!isNonEmptyString(value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_USE_CASE_VERSION_REQUIRED,
        `${field} is required`,
        field
      )
    );
  }
  const version = String(value).trim();
  if (!VERSION_PATTERN.test(version)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_VERSION_INCOMPATIBLE,
        `${field} must be semver MAJOR.MINOR.PATCH`,
        field,
        { value: version }
      )
    );
  }
  return ok(version);
}

/**
 * Stable non-cryptographic fingerprint of JSON-safe structured input.
 * Does not hash secrets or PII (caller must sanitize first).
 * @param {unknown} value
 * @returns {string}
 */
export function createSafeCanonicalFingerprint(value) {
  const canonical = JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = v[k];
          return acc;
        }, /** @type {Record<string, unknown>} */ ({}));
    }
    return v;
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceProvenance(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "IntelligenceProvenance must be a plain object",
        "provenance"
      )
    );
  }

  if (!isNonEmptyString(input.source)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "provenance.source is required",
        "provenance.source"
      )
    );
  }

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "provenance.generatedAt must be a valid ISO timestamp",
        "provenance.generatedAt"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const provenance = {
    source: String(input.source).trim(),
    generatedAt: String(input.generatedAt).trim(),
    isCanonicalDomainState: false,
    isProductionInference: false,
  };

  if (isNonEmptyString(input.correlationId)) {
    provenance.correlationId = String(input.correlationId).trim();
  }
  if (isNonEmptyString(input.snapshotTimestamp)) {
    if (!isValidIsoTimestamp(input.snapshotTimestamp)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
          "provenance.snapshotTimestamp must be a valid ISO timestamp",
          "provenance.snapshotTimestamp"
        )
      );
    }
    provenance.snapshotTimestamp = String(input.snapshotTimestamp).trim();
  }
  if (isNonEmptyString(input.inputFingerprint)) {
    provenance.inputFingerprint = String(input.inputFingerprint).trim();
  }
  if (isNonEmptyString(input.methodVersion)) {
    provenance.methodVersion = String(input.methodVersion).trim();
  }

  return ok(deepFreeze(provenance));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceReproducibilityMetadata(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "ReproducibilityMetadata must be a plain object",
        "reproducibility"
      )
    );
  }

  const required = [
    "useCaseVersion",
    "featureSchemaVersion",
    "modelVersion",
    "providerVersion",
    "promptTemplateVersion",
    "outputSchemaVersion",
    "policyVersion",
  ];

  /** @type {Record<string, string>} */
  const meta = {};
  for (const key of required) {
    const versionResult = requireSemver(input[key], `reproducibility.${key}`);
    if (!versionResult.ok) return versionResult;
    meta[key] = versionResult.value;
  }

  if (isNonEmptyString(input.evaluationScenarioVersion)) {
    const scenarioVersion = requireSemver(
      input.evaluationScenarioVersion,
      "reproducibility.evaluationScenarioVersion"
    );
    if (!scenarioVersion.ok) return scenarioVersion;
    meta.evaluationScenarioVersion = scenarioVersion.value;
  }

  if (isNonEmptyString(input.deterministicSeed)) {
    meta.deterministicSeed = String(input.deterministicSeed).trim();
  }
  if (isValidIsoTimestamp(input.sourceSnapshotTimestamp)) {
    meta.sourceSnapshotTimestamp = String(input.sourceSnapshotTimestamp).trim();
  }
  if (isValidIsoTimestamp(input.generatedAt)) {
    meta.generatedAt = String(input.generatedAt).trim();
  }
  if (isNonEmptyString(input.inputFingerprint)) {
    meta.inputFingerprint = String(input.inputFingerprint).trim();
  }

  return ok(deepFreeze(meta));
}
