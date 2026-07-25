/**
 * Certification scenarios, evidence, and reports (I&A-11).
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
  ANALYTICS_PRIVACY_REASON_CODE,
  PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS,
  PRIVACY_ACCESS_CERTIFICATION_METHOD_VERSION,
} from "./enums.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPrivacyCertificationScenario(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "CertificationScenario must be a plain object",
        "scenario"
      )
    );
  }

  if (!isNonEmptyString(input.scenarioId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "scenarioId is required",
        "scenario.scenarioId"
      )
    );
  }

  if (!isNonEmptyString(input.title)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "title is required",
        "scenario.title"
      )
    );
  }

  if (!isNonEmptyString(input.surface)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "surface is required",
        "scenario.surface"
      )
    );
  }

  return ok(
    deepFreeze({
      scenarioId: String(input.scenarioId).trim(),
      title: String(input.title).trim(),
      surface: String(input.surface).trim(),
      expectedOutcome: isNonEmptyString(input.expectedOutcome)
        ? String(input.expectedOutcome).trim()
        : "PASS",
      tags: Object.freeze(
        Array.isArray(input.tags)
          ? input.tags.filter(isNonEmptyString).map((t) => String(t).trim())
          : []
      ),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPrivacyCertificationEvidence(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "CertificationEvidence must be a plain object",
        "evidence"
      )
    );
  }

  if (!isNonEmptyString(input.scenarioId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "scenarioId is required",
        "evidence.scenarioId"
      )
    );
  }

  if (typeof input.passed !== "boolean") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "passed must be a boolean",
        "evidence.passed"
      )
    );
  }

  if (!isValidIsoTimestamp(input.evaluatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "evaluatedAt must be a valid ISO timestamp",
        "evidence.evaluatedAt"
      )
    );
  }

  return ok(
    deepFreeze({
      scenarioId: String(input.scenarioId).trim(),
      passed: input.passed,
      evaluatedAt: String(input.evaluatedAt).trim(),
      reasonCode: isNonEmptyString(input.reasonCode)
        ? String(input.reasonCode).trim()
        : input.passed
          ? ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_PASSED
          : ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED,
      safeDetails: Object.freeze(
        isPlainObject(input.safeDetails)
          ? Object.fromEntries(
              Object.entries(input.safeDetails).filter(
                ([key, value]) =>
                  ![
                    "rawValue",
                    "email",
                    "phone",
                    "cardNumber",
                    "fact",
                    "cohortCount",
                  ].includes(key) &&
                  (typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean" ||
                    value === null)
              )
            )
          : {}
      ),
      decision: isNonEmptyString(input.decision)
        ? String(input.decision).trim()
        : null,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createPrivacyCertificationReport(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "CertificationReport must be a plain object",
        "report"
      )
    );
  }

  if (!isNonEmptyString(input.reportId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "reportId is required",
        "report.reportId"
      )
    );
  }

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "report.generatedAt"
      )
    );
  }

  const evidenceItems = Array.isArray(input.evidence) ? input.evidence : [];
  /** @type {unknown[]} */
  const normalizedEvidence = [];

  for (const item of evidenceItems) {
    const evidenceResult = createPrivacyCertificationEvidence(item);
    if (!evidenceResult.ok) return evidenceResult;
    normalizedEvidence.push(evidenceResult.value);
  }

  // Deterministic ordering by scenarioId.
  normalizedEvidence.sort((a, b) => {
    const left = /** @type {{ scenarioId: string }} */ (a).scenarioId;
    const right = /** @type {{ scenarioId: string }} */ (b).scenarioId;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const passedCount = normalizedEvidence.filter(
    (e) => /** @type {{ passed: boolean }} */ (e).passed
  ).length;
  const failedCount = normalizedEvidence.length - passedCount;

  const completeness =
    failedCount === 0 && normalizedEvidence.length > 0
      ? PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS.COMPLETE
      : failedCount > 0 && passedCount > 0
        ? PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS.PARTIAL
        : PRIVACY_ACCESS_CERTIFICATION_COMPLETENESS.FAILED;

  return ok(
    deepFreeze({
      reportId: String(input.reportId).trim(),
      generatedAt: String(input.generatedAt).trim(),
      methodVersion: PRIVACY_ACCESS_CERTIFICATION_METHOD_VERSION,
      completeness,
      passedCount,
      failedCount,
      totalCount: normalizedEvidence.length,
      evidence: Object.freeze(normalizedEvidence),
      failedScenarioIds: Object.freeze(
        normalizedEvidence
          .filter((e) => !/** @type {{ passed: boolean }} */ (e).passed)
          .map((e) => /** @type {{ scenarioId: string }} */ (e).scenarioId)
      ),
      isCanonicalAuthorizationState: false,
    })
  );
}

/**
 * Run a deterministic certification suite from scenario handlers.
 * @param {unknown} suiteInput
 * @returns {import("../contracts/result.js").Result}
 */
export function runPrivacyCertificationSuite(suiteInput) {
  if (!isPlainObject(suiteInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "suiteInput must be a plain object",
        "suiteInput"
      )
    );
  }

  if (!isNonEmptyString(suiteInput.reportId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "reportId is required",
        "suiteInput.reportId"
      )
    );
  }

  if (!isValidIsoTimestamp(suiteInput.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "suiteInput.generatedAt"
      )
    );
  }

  if (!Array.isArray(suiteInput.scenarios)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "scenarios must be an array",
        "suiteInput.scenarios"
      )
    );
  }

  /** @type {unknown[]} */
  const evidence = [];

  for (const scenario of suiteInput.scenarios) {
    const scenarioResult = createPrivacyCertificationScenario(scenario);
    if (!scenarioResult.ok) return scenarioResult;

    let passed = false;
    let reasonCode = ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED;
    /** @type {Record<string, unknown>} */
    let safeDetails = {};

    if (typeof scenario.run === "function") {
      try {
        const outcome = scenario.run();
        if (isPlainObject(outcome)) {
          passed = outcome.passed === true;
          reasonCode = isNonEmptyString(outcome.reasonCode)
            ? String(outcome.reasonCode).trim()
            : passed
              ? ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_PASSED
              : ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED;
          if (isPlainObject(outcome.safeDetails)) {
            safeDetails = outcome.safeDetails;
          }
        } else {
          passed = outcome === true;
          reasonCode = passed
            ? ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_PASSED
            : ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED;
        }
      } catch {
        passed = false;
        reasonCode = ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED;
        safeDetails = { threw: true };
      }
    } else if (typeof scenario.passed === "boolean") {
      passed = scenario.passed;
      reasonCode = passed
        ? ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_PASSED
        : ANALYTICS_PRIVACY_REASON_CODE.CERTIFICATION_FAILED;
    }

    const evidenceResult = createPrivacyCertificationEvidence({
      scenarioId: scenarioResult.value.scenarioId,
      passed,
      evaluatedAt: suiteInput.generatedAt,
      reasonCode,
      safeDetails,
      decision: scenario.decision,
    });
    if (!evidenceResult.ok) return evidenceResult;
    evidence.push(evidenceResult.value);
  }

  return createPrivacyCertificationReport({
    reportId: suiteInput.reportId,
    generatedAt: suiteInput.generatedAt,
    evidence,
  });
}
