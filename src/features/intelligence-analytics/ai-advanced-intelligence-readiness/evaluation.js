/**
 * Evaluation, quality-gate and drift contracts (I&A-12).
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
  INTELLIGENCE_DRIFT_SIGNAL_TYPE,
  INTELLIGENCE_QUALITY_GATE_STATUS,
  INTELLIGENCE_WARNING_CODE,
  isIntelligenceEnumValue,
} from "./enums.js";
import {
  createIntelligenceReproducibilityMetadata,
  createSafeCanonicalFingerprint,
  requireSemver,
} from "./provenance.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceEvaluationScenario(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "EvaluationScenario must be a plain object",
        "scenario"
      )
    );
  }

  if (!isNonEmptyString(input.scenarioId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "scenarioId is required",
        "scenario.scenarioId"
      )
    );
  }

  const versionResult = requireSemver(input.version, "scenario.version");
  if (!versionResult.ok) return versionResult;

  if (!isPlainObject(input.useCaseReference)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "useCaseReference is required",
        "scenario.useCaseReference"
      )
    );
  }

  return ok(
    deepFreeze({
      scenarioId: String(input.scenarioId).trim(),
      version: versionResult.value,
      useCaseReference: deepFreeze({ ...input.useCaseReference }),
      featureSchemaReference: isPlainObject(input.featureSchemaReference)
        ? deepFreeze({ ...input.featureSchemaReference })
        : undefined,
      providerModelReference: isPlainObject(input.providerModelReference)
        ? deepFreeze({ ...input.providerModelReference })
        : undefined,
      inputFixtureReference: isNonEmptyString(input.inputFixtureReference)
        ? String(input.inputFixtureReference).trim()
        : undefined,
      expectedStructuralOutcome: isPlainObject(input.expectedStructuralOutcome)
        ? deepFreeze({ ...input.expectedStructuralOutcome })
        : deepFreeze({}),
      privacyAccessExpectation: isPlainObject(input.privacyAccessExpectation)
        ? deepFreeze({ ...input.privacyAccessExpectation })
        : undefined,
      safetyExpectation: isPlainObject(input.safetyExpectation)
        ? deepFreeze({ ...input.safetyExpectation })
        : undefined,
      abstentionExpectation: isPlainObject(input.abstentionExpectation)
        ? deepFreeze({ ...input.abstentionExpectation })
        : undefined,
      deterministicSeed: isNonEmptyString(input.deterministicSeed)
        ? String(input.deterministicSeed).trim()
        : undefined,
      provenance: isPlainObject(input.provenance)
        ? deepFreeze({ ...input.provenance })
        : deepFreeze({
            source: "ia-12-evaluation-scenario",
            generatedAt: "2026-07-25T00:00:00.000Z",
          }),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceQualityGate(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_QUALITY_GATE_FAILED,
        "QualityGate must be a plain object",
        "qualityGate"
      )
    );
  }

  if (!isNonEmptyString(input.gateId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_QUALITY_GATE_FAILED,
        "gateId is required",
        "qualityGate.gateId"
      )
    );
  }

  if (
    !isIntelligenceEnumValue(input.status, INTELLIGENCE_QUALITY_GATE_STATUS)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_QUALITY_GATE_FAILED,
        "Quality gate status must be explicit PASS/FAIL/WARN",
        "qualityGate.status"
      )
    );
  }

  return ok(
    deepFreeze({
      gateId: String(input.gateId).trim(),
      status: input.status,
      message: isNonEmptyString(input.message)
        ? String(input.message).trim()
        : input.status,
      details: isPlainObject(input.details)
        ? deepFreeze({ ...input.details })
        : undefined,
    })
  );
}

/**
 * Run structural evaluation assertions — deterministic.
 * @param {unknown} scenario
 * @param {unknown} actual
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateIntelligenceScenario(scenario, actual) {
  if (!isPlainObject(scenario) || !isPlainObject(actual)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "Scenario and actual result required",
        "evaluation"
      )
    );
  }

  /** @type {Array<*>} */
  const gates = [];
  /** @type {Array<*>} */
  const failures = [];
  /** @type {Array<*>} */
  const warnings = [];

  const expected = scenario.expectedStructuralOutcome ?? {};

  function addGate(gateId, pass, message, details) {
    const status = pass
      ? INTELLIGENCE_QUALITY_GATE_STATUS.PASS
      : INTELLIGENCE_QUALITY_GATE_STATUS.FAIL;
    const gate = {
      gateId,
      status,
      message,
      details,
    };
    gates.push(gate);
    if (!pass) failures.push(gate);
  }

  if (expected.candidateStatus !== undefined) {
    addGate(
      "candidate-status",
      actual.candidate?.status === expected.candidateStatus,
      "candidate status structural assertion",
      {
        expected: expected.candidateStatus,
        actual: actual.candidate?.status,
      }
    );
  }

  addGate(
    "schema-validity",
    actual.candidate?.isAdvisoryCandidate === true,
    "schema validity / advisory candidate"
  );

  addGate(
    "non-canonical-guarantee",
    actual.candidate?.isCanonicalDomainState === false &&
      actual.nonCanonical === true,
    "non-canonical guarantee"
  );

  addGate(
    "no-sensitive-leakage",
    actual.candidate?.explanation?.exposesPii !== true &&
      actual.candidate?.explanation?.exposesHiddenPrompt !== true,
    "no sensitive leakage"
  );

  if (expected.humanReviewRequired !== undefined) {
    addGate(
      "human-review-correctness",
      Boolean(actual.candidate?.humanReviewRequired) ===
        Boolean(expected.humanReviewRequired),
      "human-review correctness"
    );
  }

  if (expected.abstained === true) {
    addGate(
      "abstention-correctness",
      actual.candidate?.status === "ABSTAINED",
      "abstention correctness"
    );
  }

  if (scenario.privacyAccessExpectation?.mustPass === true) {
    const privacyOk = actual.privacyFailure !== true;
    addGate(
      "privacy-expectation",
      privacyOk,
      "privacy/access expectation"
    );
    if (!privacyOk) {
      failures.push({
        gateId: "privacy-failure-explicit",
        status: INTELLIGENCE_QUALITY_GATE_STATUS.FAIL,
        message: "Evaluation privacy failure explicit",
      });
    }
  }

  if (scenario.safetyExpectation?.mustPass === true) {
    const safetyOk = actual.safetyFailure !== true;
    addGate("safety-expectation", safetyOk, "safety expectation");
    if (!safetyOk) {
      failures.push({
        gateId: "safety-failure-explicit",
        status: INTELLIGENCE_QUALITY_GATE_STATUS.FAIL,
        message: "Evaluation safety failure explicit",
      });
    }
  }

  // Stale warnings (non-fatal).
  if (actual.staleModel === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_MODEL,
      message: "Stale model warning",
    });
  }
  if (actual.stalePrompt === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_PROMPT,
      message: "Stale prompt warning",
    });
  }
  if (actual.stalePolicy === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_POLICY,
      message: "Stale policy warning",
    });
  }

  const reproducibility =
    actual.reproducibility ??
    (isPlainObject(actual.reproducibilityInput)
      ? actual.reproducibilityInput
      : null);

  let reproducibilityMeta = null;
  if (reproducibility) {
    const metaResult = createIntelligenceReproducibilityMetadata(reproducibility);
    if (!metaResult.ok) return metaResult;
    reproducibilityMeta = metaResult.value;
  }

  const result = deepFreeze({
    scenarioId: scenario.scenarioId,
    scenarioVersion: scenario.version,
    status:
      failures.length === 0
        ? INTELLIGENCE_QUALITY_GATE_STATUS.PASS
        : INTELLIGENCE_QUALITY_GATE_STATUS.FAIL,
    gates: Object.freeze(gates.map((g) => deepFreeze(g))),
    failures: Object.freeze(failures.map((g) => deepFreeze(g))),
    warnings: Object.freeze(warnings.map((w) => deepFreeze(w))),
    reproducibility: reproducibilityMeta,
    fingerprint: createSafeCanonicalFingerprint({
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.version,
      candidateStatus: actual.candidate?.status,
      gates: gates.map((g) => ({ gateId: g.gateId, status: g.status })),
    }),
    deterministic: true,
  });

  return ok(result);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceEvaluationReport(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "EvaluationReport must be a plain object",
        "report"
      )
    );
  }

  const results = Array.isArray(input.results) ? input.results : [];
  const passed = results.filter(
    (r) => r.status === INTELLIGENCE_QUALITY_GATE_STATUS.PASS
  ).length;
  const failed = results.filter(
    (r) => r.status === INTELLIGENCE_QUALITY_GATE_STATUS.FAIL
  ).length;

  return ok(
    deepFreeze({
      reportId: isNonEmptyString(input.reportId)
        ? String(input.reportId).trim()
        : "ia-12-eval-report",
      generatedAt: isValidIsoTimestamp(input.generatedAt)
        ? String(input.generatedAt).trim()
        : "2026-07-25T00:00:00.000Z",
      results: Object.freeze([...results]),
      completeness: deepFreeze({
        total: results.length,
        passed,
        failed,
        complete: results.length > 0 && failed === 0,
      }),
      status:
        failed === 0
          ? INTELLIGENCE_QUALITY_GATE_STATUS.PASS
          : INTELLIGENCE_QUALITY_GATE_STATUS.FAIL,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceDriftSignal(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_DRIFT_SIGNAL_INVALID,
        "DriftSignal must be a plain object",
        "driftSignal"
      )
    );
  }

  if (!isIntelligenceEnumValue(input.signalType, INTELLIGENCE_DRIFT_SIGNAL_TYPE)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_DRIFT_SIGNAL_INVALID,
        "Unknown drift signal type",
        "driftSignal.signalType"
      )
    );
  }

  return ok(
    deepFreeze({
      signalId: isNonEmptyString(input.signalId)
        ? String(input.signalId).trim()
        : `drift-${input.signalType}`,
      signalType: input.signalType,
      detectedAt: isValidIsoTimestamp(input.detectedAt)
        ? String(input.detectedAt).trim()
        : "2026-07-25T00:00:00.000Z",
      details: isPlainObject(input.details)
        ? deepFreeze({ ...input.details })
        : deepFreeze({}),
      autoRetrain: false,
      autoSwitchModel: false,
      autoRollbackProduction: false,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceQualitySignal(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_DRIFT_SIGNAL_INVALID,
        "QualitySignal must be a plain object",
        "qualitySignal"
      )
    );
  }

  return ok(
    deepFreeze({
      signalId: isNonEmptyString(input.signalId)
        ? String(input.signalId).trim()
        : "quality-signal",
      kind: isNonEmptyString(input.kind) ? String(input.kind).trim() : "QUALITY",
      status: isIntelligenceEnumValue(
        input.status,
        INTELLIGENCE_QUALITY_GATE_STATUS
      )
        ? input.status
        : INTELLIGENCE_QUALITY_GATE_STATUS.WARN,
      detectedAt: isValidIsoTimestamp(input.detectedAt)
        ? String(input.detectedAt).trim()
        : "2026-07-25T00:00:00.000Z",
      details: isPlainObject(input.details)
        ? deepFreeze({ ...input.details })
        : deepFreeze({}),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceModelHealthSnapshot(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_DRIFT_SIGNAL_INVALID,
        "ModelHealthSnapshot must be a plain object",
        "modelHealth"
      )
    );
  }

  return ok(
    deepFreeze({
      modelId: isNonEmptyString(input.modelId)
        ? String(input.modelId).trim()
        : "unknown",
      modelVersion: isNonEmptyString(input.modelVersion)
        ? String(input.modelVersion).trim()
        : "0.0.0",
      capturedAt: isValidIsoTimestamp(input.capturedAt)
        ? String(input.capturedAt).trim()
        : "2026-07-25T00:00:00.000Z",
      healthy: input.healthy !== false,
      notes: Object.freeze(
        Array.isArray(input.notes) ? input.notes.map(String) : []
      ),
      autoActionsTaken: Object.freeze([]),
    })
  );
}

/**
 * Emit stale warnings as quality gates / warning contracts.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function evaluateStalenessWarnings(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTELLIGENCE_EVALUATION_INVALID,
        "Staleness input must be a plain object",
        "staleness"
      )
    );
  }

  /** @type {Array<*>} */
  const warnings = [];
  if (input.staleModel === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_MODEL,
      message: "Stale model warning produced",
    });
  }
  if (input.stalePrompt === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_PROMPT,
      message: "Stale prompt warning produced",
    });
  }
  if (input.stalePolicy === true) {
    warnings.push({
      code: INTELLIGENCE_WARNING_CODE.STALE_POLICY,
      message: "Stale policy warning produced",
    });
  }

  return ok(deepFreeze({ warnings: Object.freeze(warnings) }));
}
