/**
 * Confidence, uncertainty, explanation, evidence, candidate contracts (I&A-12).
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
  INTELLIGENCE_CANDIDATE_STATUS,
  INTELLIGENCE_CONFIDENCE_SCALE,
  INTELLIGENCE_CONFIDENCE_SOURCE,
  isIntelligenceEnumValue,
} from "./enums.js";

const FORBIDDEN_EXPLANATION_KEYS = Object.freeze([
  "systemPrompt",
  "hiddenPrompt",
  "chainOfThought",
  "rawPrompt",
  "email",
  "phone",
  "fullName",
  "ssn",
  "apiKey",
  "token",
  "secret",
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceConfidence(input) {
  if (input === undefined || input === null) {
    return ok(
      deepFreeze({
        source: INTELLIGENCE_CONFIDENCE_SOURCE.UNSPECIFIED,
        scale: INTELLIGENCE_CONFIDENCE_SCALE.UNKNOWN,
        value: undefined,
        isUnknown: true,
        fabricated: false,
      })
    );
  }

  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_INVALID,
        "IntelligenceConfidence must be a plain object",
        "confidence"
      )
    );
  }

  const source = isIntelligenceEnumValue(
    input.source,
    INTELLIGENCE_CONFIDENCE_SOURCE
  )
    ? input.source
    : INTELLIGENCE_CONFIDENCE_SOURCE.UNKNOWN;

  // Never fabricate provider confidence.
  if (
    source === INTELLIGENCE_CONFIDENCE_SOURCE.UNKNOWN ||
    source === INTELLIGENCE_CONFIDENCE_SOURCE.UNSPECIFIED ||
    input.value === undefined ||
    input.value === null
  ) {
    return ok(
      deepFreeze({
        source,
        scale: isIntelligenceEnumValue(input.scale, INTELLIGENCE_CONFIDENCE_SCALE)
          ? input.scale
          : INTELLIGENCE_CONFIDENCE_SCALE.UNKNOWN,
        value: undefined,
        isUnknown: true,
        fabricated: false,
        limitations: Object.freeze(
          Array.isArray(input.limitations) ? [...input.limitations] : []
        ),
        modelId: isNonEmptyString(input.modelId)
          ? String(input.modelId).trim()
          : undefined,
        modelVersion: isNonEmptyString(input.modelVersion)
          ? String(input.modelVersion).trim()
          : undefined,
        generatedAt: isValidIsoTimestamp(input.generatedAt)
          ? String(input.generatedAt).trim()
          : undefined,
        calibrationReference: isNonEmptyString(input.calibrationReference)
          ? String(input.calibrationReference).trim()
          : undefined,
      })
    );
  }

  if (!isFiniteNumber(input.value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_INVALID,
        "confidence.value must be a finite number when provided",
        "confidence.value"
      )
    );
  }

  const scale = isIntelligenceEnumValue(input.scale, INTELLIGENCE_CONFIDENCE_SCALE)
    ? input.scale
    : INTELLIGENCE_CONFIDENCE_SCALE.UNIT_INTERVAL;

  if (
    scale === INTELLIGENCE_CONFIDENCE_SCALE.UNIT_INTERVAL &&
    (input.value < 0 || input.value > 1)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_INVALID,
        "UNIT_INTERVAL confidence must be in [0,1]",
        "confidence.value"
      )
    );
  }

  return ok(
    deepFreeze({
      source,
      scale,
      value: input.value,
      isUnknown: false,
      fabricated: false,
      isProbability:
        scale === INTELLIGENCE_CONFIDENCE_SCALE.UNIT_INTERVAL &&
        input.treatAsProbability === true,
      limitations: Object.freeze(
        Array.isArray(input.limitations) ? [...input.limitations] : []
      ),
      modelId: isNonEmptyString(input.modelId)
        ? String(input.modelId).trim()
        : undefined,
      modelVersion: isNonEmptyString(input.modelVersion)
        ? String(input.modelVersion).trim()
        : undefined,
      generatedAt: isValidIsoTimestamp(input.generatedAt)
        ? String(input.generatedAt).trim()
        : undefined,
      calibrationReference: isNonEmptyString(input.calibrationReference)
        ? String(input.calibrationReference).trim()
        : undefined,
    })
  );
}

/**
 * @param {*} left
 * @param {*} right
 * @returns {import("../contracts/result.js").Result}
 */
export function compareIntelligenceConfidence(left, right) {
  if (!left || !right || left.isUnknown || right.isUnknown) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_SCALE_INCOMPATIBLE,
        "Cannot compare unknown confidence",
        "confidence"
      )
    );
  }
  if (left.scale !== right.scale || left.source !== right.source) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_SCALE_INCOMPATIBLE,
        "Incompatible confidence scales/sources cannot be compared",
        "confidence",
        { leftScale: left.scale, rightScale: right.scale }
      )
    );
  }
  if (left.modelId !== right.modelId || left.modelVersion !== right.modelVersion) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_SCALE_INCOMPATIBLE,
        "Confidence from incompatible models cannot be compared",
        "confidence"
      )
    );
  }
  return ok(
    deepFreeze({
      comparison: left.value === right.value ? 0 : left.value > right.value ? 1 : -1,
      left: left.value,
      right: right.value,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceUncertainty(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CONFIDENCE_INVALID,
        "IntelligenceUncertainty must be a plain object",
        "uncertainty"
      )
    );
  }

  return ok(
    deepFreeze({
      kind: isNonEmptyString(input.kind)
        ? String(input.kind).trim()
        : "UNSPECIFIED",
      notes: Object.freeze(
        Array.isArray(input.notes) ? input.notes.map(String) : []
      ),
      isCalibrated: input.isCalibrated === true,
    })
  );
}

/**
 * @param {unknown} input
 * @param {{ allowedEvidenceRefs?: ReadonlySet<string> }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceEvidenceReference(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID,
        "Evidence reference must be a plain object",
        "evidence"
      )
    );
  }

  for (const key of FORBIDDEN_EXPLANATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID,
          "Evidence must not expose sensitive fields",
          "evidence",
          { field: key }
        )
      );
    }
  }

  if (!isNonEmptyString(input.referenceId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID,
        "evidence.referenceId is required",
        "evidence.referenceId"
      )
    );
  }

  const referenceId = String(input.referenceId).trim();
  if (
    options.allowedEvidenceRefs instanceof Set &&
    !options.allowedEvidenceRefs.has(referenceId)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID,
        "Invented evidence reference rejected",
        "evidence.referenceId",
        { referenceId }
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const evidence = {
    referenceId,
    kind: isNonEmptyString(input.kind)
      ? String(input.kind).trim()
      : "analytical-result",
  };

  if (isNonEmptyString(input.metricId)) {
    evidence.metricId = String(input.metricId).trim();
  }
  if (isNonEmptyString(input.metricVersion)) {
    evidence.metricVersion = String(input.metricVersion).trim();
  }
  if (isPlainObject(input.timeWindow)) {
    evidence.timeWindow = deepFreeze({ ...input.timeWindow });
  }
  if (isNonEmptyString(input.entityReference)) {
    evidence.entityReference = String(input.entityReference).trim();
  }
  if (isNonEmptyString(input.policyReference)) {
    evidence.policyReference = String(input.policyReference).trim();
  }
  if (isNonEmptyString(input.snapshotReference)) {
    evidence.snapshotReference = String(input.snapshotReference).trim();
  }

  // Never embed raw restricted facts.
  if (Object.prototype.hasOwnProperty.call(input, "rawFact")) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVIDENCE_INVALID,
        "Evidence must not include raw restricted facts",
        "evidence.rawFact"
      )
    );
  }

  return ok(deepFreeze(evidence));
}

/**
 * @param {unknown} input
 * @param {{ allowedEvidenceRefs?: ReadonlySet<string> }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceExplanation(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID,
        "IntelligenceExplanation must be a plain object",
        "explanation"
      )
    );
  }

  for (const key of FORBIDDEN_EXPLANATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID,
          `Explanation must not expose ${key}`,
          `explanation.${key}`
        )
      );
    }
  }

  const summary = isNonEmptyString(input.summary)
    ? String(input.summary).trim()
    : "";

  if (
    /system prompt|chain-of-thought|hidden prompt/i.test(summary) ||
    /@|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(summary)
  ) {
    // Soft structural guard — reject obvious PII/prompt leakage patterns in summary.
    if (/system prompt|chain-of-thought|hidden prompt/i.test(summary)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INTELLIGENCE_EXPLANATION_INVALID,
          "Explanation must not expose hidden prompt or chain-of-thought",
          "explanation.summary"
        )
      );
    }
  }

  const evidenceInputs = Array.isArray(input.evidence) ? input.evidence : [];
  /** @type {Array<*>} */
  const evidence = [];
  for (const ev of evidenceInputs) {
    const evResult = createIntelligenceEvidenceReference(ev, options);
    if (!evResult.ok) return evResult;
    evidence.push(evResult.value);
  }

  return ok(
    deepFreeze({
      summary,
      structuredReasons: Object.freeze(
        Array.isArray(input.structuredReasons)
          ? input.structuredReasons.map(String)
          : []
      ),
      evidence: Object.freeze(evidence),
      exposesHiddenPrompt: false,
      exposesChainOfThought: false,
      exposesPii: false,
    })
  );
}

/**
 * @param {unknown} input
 * @param {{ allowedEvidenceRefs?: ReadonlySet<string> }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceCandidateInsight(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CANDIDATE_INVALID,
        "IntelligenceCandidateInsight must be a plain object",
        "candidate"
      )
    );
  }

  if (
    !isIntelligenceEnumValue(input.status, INTELLIGENCE_CANDIDATE_STATUS)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CANDIDATE_INVALID,
        "Unknown candidate status",
        "candidate.status",
        { status: input.status }
      )
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(input, "writeCommand") ||
    Object.prototype.hasOwnProperty.call(input, "command") ||
    Object.prototype.hasOwnProperty.call(input, "toolCall") ||
    Object.prototype.hasOwnProperty.call(input, "sql") ||
    Object.prototype.hasOwnProperty.call(input, "shell") ||
    Object.prototype.hasOwnProperty.call(input, "eval")
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_CANDIDATE_INVALID,
        "Candidate cannot expose write command, tool, SQL, shell, or eval",
        "candidate"
      )
    );
  }

  const confidenceResult = createIntelligenceConfidence(input.confidence);
  if (!confidenceResult.ok) return confidenceResult;

  const uncertaintyResult = createIntelligenceUncertainty(
    input.uncertainty ?? {}
  );
  if (!uncertaintyResult.ok) return uncertaintyResult;

  let explanation = null;
  if (input.explanation !== undefined) {
    const explanationResult = createIntelligenceExplanation(
      input.explanation,
      options
    );
    if (!explanationResult.ok) return explanationResult;
    explanation = explanationResult.value;
  }

  return ok(
    deepFreeze({
      candidateId: isNonEmptyString(input.candidateId)
        ? String(input.candidateId).trim()
        : `candidate-${Date.now()}`,
      status: input.status,
      structuredOutput: isPlainObject(input.structuredOutput)
        ? deepFreeze({ ...input.structuredOutput })
        : deepFreeze({}),
      confidence: confidenceResult.value,
      uncertainty: uncertaintyResult.value,
      explanation,
      isCanonicalDomainState: false,
      isAdvisoryCandidate: true,
      canMutateDomain: false,
      canExecuteTool: false,
      canExecuteSql: false,
      canExecuteShell: false,
      canEval: false,
      humanReviewRequired: input.humanReviewRequired === true,
      safetyDecisions: Object.freeze(
        Array.isArray(input.safetyDecisions) ? [...input.safetyDecisions] : []
      ),
      generatedAt: isValidIsoTimestamp(input.generatedAt)
        ? String(input.generatedAt).trim()
        : undefined,
      requestId: isNonEmptyString(input.requestId)
        ? String(input.requestId).trim()
        : undefined,
      useCaseId: isNonEmptyString(input.useCaseId)
        ? String(input.useCaseId).trim()
        : undefined,
      useCaseVersion: isNonEmptyString(input.useCaseVersion)
        ? String(input.useCaseVersion).trim()
        : undefined,
    })
  );
}
