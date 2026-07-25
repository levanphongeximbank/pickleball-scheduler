/**
 * Offline in-memory certification provider (I&A-12).
 * No network. Deterministic. Certification / tests only.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_MODEL_CAPABILITY,
  INTELLIGENCE_PROVIDER_LIFECYCLE,
} from "./enums.js";
import {
  createIntelligenceModelReference,
  createIntelligenceProviderReference,
} from "./providerRefs.js";
import { validateIntelligenceInferenceResponse } from "./inference.js";

/**
 * @param {unknown} [config]
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryIntelligenceProvider(config = {}) {
  if (!isPlainObject(config)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_INVALID,
        "createInMemoryIntelligenceProvider config must be a plain object",
        "config"
      )
    );
  }

  const providerResult = createIntelligenceProviderReference(
    config.providerReference ?? {
      providerId: config.providerId ?? "in-memory-certification",
      providerVersion: config.providerVersion ?? "1.0.0",
      lifecycleStatus: INTELLIGENCE_PROVIDER_LIFECYCLE.CERTIFICATION_ONLY,
    }
  );
  if (!providerResult.ok) return providerResult;

  const modelResult = createIntelligenceModelReference(
    config.modelReference ?? {
      modelId: config.modelId ?? "certification-model",
      modelVersion: config.modelVersion ?? "1.0.0",
      capabilities: config.capabilities ?? [
        INTELLIGENCE_MODEL_CAPABILITY.STRUCTURED_OUTPUT,
        INTELLIGENCE_MODEL_CAPABILITY.SUMMARY,
        INTELLIGENCE_MODEL_CAPABILITY.EXPLANATION,
      ],
      providerId: providerResult.value.providerId,
      lifecycleStatus: INTELLIGENCE_PROVIDER_LIFECYCLE.CERTIFICATION_ONLY,
    }
  );
  if (!modelResult.ok) return modelResult;

  const fixtures = isPlainObject(config.fixtures)
    ? deepFreeze({ ...config.fixtures })
    : deepFreeze({});

  const failureMode = isNonEmptyString(config.failureMode)
    ? String(config.failureMode).trim()
    : null;

  const malformed = config.malformedResponse === true;
  const forceAbstain = config.forceAbstain === true;
  const networkCalls = [];

  const provider = deepFreeze({
    kind: "in-memory-certification",
    isProductionProvider: false,
    makesNetworkCalls: false,
    providerReference: providerResult.value,
    modelReference: modelResult.value,
    fixtures,
    /**
     * Deterministic offline inference — never touches network.
     * @param {unknown} request
     * @param {{ allowedEvidenceRefs?: ReadonlySet<string> }} [options]
     */
    infer(request, options = {}) {
      // Explicitly do not perform any network I/O.
      networkCalls.push({ attempted: false, at: request?.generatedAt });

      if (!isPlainObject(request)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_INFERENCE_REQUEST_INVALID,
            "Invalid inference request — provider not invoked meaningfully",
            "request"
          )
        );
      }

      if (failureMode === "throw") {
        try {
          throw new Error("simulated provider failure");
        } catch {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_FAILURE,
              "Offline provider failure wrapped",
              "provider",
              { failureMode }
            )
          );
        }
      }

      if (failureMode === "fail") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_PROVIDER_FAILURE,
            "Offline provider failure wrapped",
            "provider",
            { failureMode }
          )
        );
      }

      if (malformed) {
        return validateIntelligenceInferenceResponse(
          "not-an-object",
          request,
          options
        );
      }

      if (
        isNonEmptyString(config.unknownModelId) &&
        request.modelReference?.modelId === config.unknownModelId
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.INTELLIGENCE_MODEL_UNKNOWN,
            "Unknown model rejected",
            "model"
          )
        );
      }

      const fixtureKey = request.requestId;
      const canned = fixtures[fixtureKey];

      /** @type {Record<string, unknown>} */
      let responseBody;
      if (isPlainObject(canned)) {
        responseBody = {
          requestId: request.requestId,
          modelId: request.modelReference.modelId,
          modelVersion: request.modelReference.modelVersion,
          outputSchemaVersion: request.outputSchemaReference.version,
          promptTemplateVersion: request.promptTemplateReference?.version,
          ...canned,
        };
      } else if (forceAbstain) {
        responseBody = {
          requestId: request.requestId,
          modelId: request.modelReference.modelId,
          modelVersion: request.modelReference.modelVersion,
          outputSchemaVersion: request.outputSchemaReference.version,
          candidateStatus: INTELLIGENCE_CANDIDATE_STATUS.ABSTAINED,
          structuredOutput: { abstained: true },
          generatedAt: request.generatedAt,
        };
      } else {
        responseBody = {
          requestId: request.requestId,
          modelId: request.modelReference.modelId,
          modelVersion: request.modelReference.modelVersion,
          outputSchemaVersion: request.outputSchemaReference.version,
          promptTemplateVersion: request.promptTemplateReference?.version,
          candidateStatus: INTELLIGENCE_CANDIDATE_STATUS.GENERATED,
          structuredOutput: deepFreeze({
            kind: "advisory-summary-candidate",
            text: "Deterministic certification insight",
            featureCount: Array.isArray(request.featureVector?.values)
              ? request.featureVector.values.length
              : 0,
          }),
          confidence:
            config.includeConfidence === true
              ? {
                  source: "PROVIDER_REPORTED",
                  scale: "UNIT_INTERVAL",
                  value: config.confidenceValue ?? 0.82,
                  modelId: request.modelReference.modelId,
                  modelVersion: request.modelReference.modelVersion,
                  generatedAt: request.generatedAt,
                }
              : { source: "UNSPECIFIED" },
          explanation: {
            summary: "Deterministic offline certification explanation",
            structuredReasons: ["fixture-or-default"],
            evidence: Array.isArray(config.defaultEvidence)
              ? config.defaultEvidence
              : [],
          },
          generatedAt: request.generatedAt,
          latencyMs: 0,
        };
      }

      return validateIntelligenceInferenceResponse(
        responseBody,
        request,
        options
      );
    },

    /** @returns {ReadonlyArray<*>} */
    getNetworkCallLog() {
      return Object.freeze([...networkCalls]);
    },
  });

  return ok(provider);
}
