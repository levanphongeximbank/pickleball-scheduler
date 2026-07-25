/**
 * Provider / model / prompt-template reference contracts (I&A-12).
 * No API keys, tokens, secrets, or private credentials.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  FORBIDDEN_PROVIDER_SECRET_KEYS,
  INTELLIGENCE_MODEL_CAPABILITY,
  INTELLIGENCE_PROVIDER_LIFECYCLE,
  isIntelligenceEnumValue,
} from "./enums.js";
import { requireSemver } from "./provenance.js";

/**
 * @param {Record<string, unknown>} input
 * @param {string} field
 * @returns {import("../contracts/result.js").Result | null}
 */
function rejectSecrets(input, field) {
  const present = FORBIDDEN_PROVIDER_SECRET_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(input, key)
  );
  if (present.length === 0) return null;
  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID,
      `${field} must not contain secrets: ${present.join(", ")}`,
      field,
      { forbiddenFields: Object.freeze([...present]) }
    )
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceProviderReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID,
        "IntelligenceProviderReference must be a plain object",
        "provider"
      )
    );
  }

  const secretReject = rejectSecrets(input, "provider");
  if (secretReject) return secretReject;

  if (!isNonEmptyString(input.providerId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID,
        "providerId is required",
        "provider.providerId"
      )
    );
  }

  const versionResult = requireSemver(
    input.providerVersion ?? input.version ?? "1.0.0",
    "provider.providerVersion"
  );
  if (!versionResult.ok) return versionResult;

  const lifecycleStatus = isIntelligenceEnumValue(
    input.lifecycleStatus,
    INTELLIGENCE_PROVIDER_LIFECYCLE
  )
    ? input.lifecycleStatus
    : INTELLIGENCE_PROVIDER_LIFECYCLE.CERTIFICATION_ONLY;

  return ok(
    deepFreeze({
      providerId: String(input.providerId).trim(),
      providerVersion: versionResult.value,
      lifecycleStatus,
      privacyClassificationSupport: Object.freeze(
        Array.isArray(input.privacyClassificationSupport)
          ? [...input.privacyClassificationSupport]
          : []
      ),
      residencyMetadata: isPlainObject(input.residencyMetadata)
        ? deepFreeze({ ...input.residencyMetadata })
        : undefined,
      evaluationPolicy: isNonEmptyString(input.evaluationPolicy)
        ? String(input.evaluationPolicy).trim()
        : "offline-certification-v1",
      isProductionProvider: false,
      containsSecrets: false,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceModelReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_INVALID,
        "IntelligenceModelReference must be a plain object",
        "model"
      )
    );
  }

  const secretReject = rejectSecrets(input, "model");
  if (secretReject) return secretReject;

  if (!isNonEmptyString(input.modelId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_INVALID,
        "modelId is required",
        "model.modelId"
      )
    );
  }

  if (!isNonEmptyString(input.modelVersion) && !isNonEmptyString(input.version)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_INVALID,
        "modelVersion is required",
        "model.modelVersion"
      )
    );
  }

  const versionResult = requireSemver(
    input.modelVersion ?? input.version,
    "model.modelVersion"
  );
  if (!versionResult.ok) return versionResult;

  const capabilities = Array.isArray(input.capabilities)
    ? input.capabilities
    : [];
  for (const cap of capabilities) {
    if (!isIntelligenceEnumValue(cap, INTELLIGENCE_MODEL_CAPABILITY)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_CAPABILITY_MISMATCH,
          "Unknown model capability",
          "model.capabilities",
          { capability: cap }
        )
      );
    }
  }

  const lifecycleStatus = isIntelligenceEnumValue(
    input.lifecycleStatus,
    INTELLIGENCE_PROVIDER_LIFECYCLE
  )
    ? input.lifecycleStatus
    : INTELLIGENCE_PROVIDER_LIFECYCLE.CERTIFICATION_ONLY;

  /** @type {Record<string, unknown>} */
  const model = {
    modelId: String(input.modelId).trim(),
    modelVersion: versionResult.value,
    capabilities: Object.freeze([...capabilities]),
    lifecycleStatus,
    supportedInputSchemas: Object.freeze(
      Array.isArray(input.supportedInputSchemas)
        ? [...input.supportedInputSchemas]
        : []
    ),
    supportedOutputSchemas: Object.freeze(
      Array.isArray(input.supportedOutputSchemas)
        ? [...input.supportedOutputSchemas]
        : []
    ),
    isProductionModel: false,
    containsSecrets: false,
  };

  if (isPlainObject(input.contextLimit)) {
    model.contextLimit = deepFreeze({ ...input.contextLimit });
  }

  if (isNonEmptyString(input.providerId)) {
    model.providerId = String(input.providerId).trim();
  }

  return ok(deepFreeze(model));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligencePromptTemplateReference(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROMPT_VERSION_MISMATCH,
        "IntelligencePromptTemplateReference must be a plain object",
        "promptTemplate"
      )
    );
  }

  const secretReject = rejectSecrets(input, "promptTemplate");
  if (secretReject) return secretReject;

  if (!isNonEmptyString(input.promptTemplateId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
        "promptTemplateId is required",
        "promptTemplate.promptTemplateId"
      )
    );
  }

  const versionResult = requireSemver(
    input.version ?? input.promptTemplateVersion,
    "promptTemplate.version"
  );
  if (!versionResult.ok) return versionResult;

  /** @type {Record<string, unknown>} */
  const ref = {
    promptTemplateId: String(input.promptTemplateId).trim(),
    version: versionResult.value,
    containsSecrets: false,
    allowsUntrustedOverride: false,
  };

  // Safe static template metadata only — no runtime provider execution.
  if (isNonEmptyString(input.templateText)) {
    const text = String(input.templateText);
    if (
      /api[_-]?key|secret|token|password/i.test(text) ||
      text.includes("sk-")
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID,
          "Prompt template must not contain secrets",
          "promptTemplate.templateText"
        )
      );
    }
    ref.templateText = text;
  }

  if (isPlainObject(input.metadata)) {
    ref.metadata = deepFreeze({ ...input.metadata });
  }

  return ok(deepFreeze(ref));
}

/**
 * @param {ReadonlyArray<string>} required
 * @param {ReadonlyArray<string>} available
 * @returns {import("../contracts/result.js").Result}
 */
export function assertProviderCapabilities(required, available) {
  const availableSet = new Set(available ?? []);
  const missing = (required ?? []).filter((cap) => !availableSet.has(cap));
  if (missing.length > 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_CAPABILITY_MISMATCH,
        "Provider capability mismatch",
        "capabilities",
        { missing: Object.freeze([...missing]) }
      )
    );
  }
  return ok(true);
}
