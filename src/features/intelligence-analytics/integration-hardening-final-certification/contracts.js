/**
 * Certification scenario / evidence / result / report contracts (I&A-13).
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
  ANALYTICS_CERTIFICATION_COMPLETENESS,
  ANALYTICS_CERTIFICATION_REASON_CODE,
  ANALYTICS_CERTIFICATION_SEVERITY,
  ANALYTICS_CERTIFICATION_STATUS,
  INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
} from "./enums.js";
import { createSafeCertificationFingerprint } from "./fingerprint.js";

const FORBIDDEN_EVIDENCE_KEYS = Object.freeze([
  "rawValue",
  "email",
  "phone",
  "cardNumber",
  "pan",
  "cvv",
  "password",
  "apiKey",
  "token",
  "secret",
  "ssn",
  "fact",
  "cohortCount",
  "prompt",
  "chainOfThought",
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsCertificationScenario(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "CertificationScenario must be a plain object",
        "scenario"
      )
    );
  }

  if (!isNonEmptyString(input.scenarioId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "scenarioId is required",
        "scenario.scenarioId"
      )
    );
  }

  if (!isNonEmptyString(input.dimensionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "dimensionId is required",
        "scenario.dimensionId"
      )
    );
  }

  if (!isNonEmptyString(input.title)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "title is required",
        "scenario.title"
      )
    );
  }

  return ok(
    deepFreeze({
      scenarioId: String(input.scenarioId).trim(),
      dimensionId: String(input.dimensionId).trim(),
      title: String(input.title).trim(),
      version: isNonEmptyString(input.version)
        ? String(input.version).trim()
        : "1.0.0",
      expectedStatus: isNonEmptyString(input.expectedStatus)
        ? String(input.expectedStatus).trim()
        : ANALYTICS_CERTIFICATION_STATUS.PASS,
      severity: isNonEmptyString(input.severity)
        ? String(input.severity).trim()
        : ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
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
export function createIntelligenceAnalyticsCertificationEvidence(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "CertificationEvidence must be a plain object",
        "evidence"
      )
    );
  }

  if (!isNonEmptyString(input.scenarioId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "scenarioId is required",
        "evidence.scenarioId"
      )
    );
  }

  if (!isNonEmptyString(input.dimensionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "dimensionId is required",
        "evidence.dimensionId"
      )
    );
  }

  if (!isNonEmptyString(input.status)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "status is required",
        "evidence.status"
      )
    );
  }

  if (
    !Object.values(ANALYTICS_CERTIFICATION_STATUS).includes(
      String(input.status).trim()
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "status must be PASS|FAIL|BLOCKED|NOT_APPLICABLE",
        "evidence.status"
      )
    );
  }

  if (!isValidIsoTimestamp(input.evaluatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "evaluatedAt must be a valid ISO timestamp",
        "evidence.evaluatedAt"
      )
    );
  }

  const status = String(input.status).trim();
  const reasonCode = isNonEmptyString(input.reasonCode)
    ? String(input.reasonCode).trim()
    : status === ANALYTICS_CERTIFICATION_STATUS.PASS
      ? ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_PASSED
      : status === ANALYTICS_CERTIFICATION_STATUS.BLOCKED
        ? ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_BLOCKED
        : status === ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE
          ? ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_NOT_APPLICABLE
          : ANALYTICS_CERTIFICATION_REASON_CODE.CERTIFICATION_FAILED;

  return ok(
    deepFreeze({
      scenarioId: String(input.scenarioId).trim(),
      dimensionId: String(input.dimensionId).trim(),
      status,
      evaluatedAt: String(input.evaluatedAt).trim(),
      reasonCode,
      severity: isNonEmptyString(input.severity)
        ? String(input.severity).trim()
        : ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER,
      warning: input.warning === true,
      safeDetails: Object.freeze(
        isPlainObject(input.safeDetails)
          ? Object.fromEntries(
              Object.entries(input.safeDetails).filter(
                ([key, value]) =>
                  !FORBIDDEN_EVIDENCE_KEYS.includes(key) &&
                  (typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean" ||
                    value === null)
              )
            )
          : {}
      ),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsCertificationResult(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "CertificationResult must be a plain object",
        "result"
      )
    );
  }

  if (!isNonEmptyString(input.dimensionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "dimensionId is required",
        "result.dimensionId"
      )
    );
  }

  if (!isNonEmptyString(input.status)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "status is required",
        "result.status"
      )
    );
  }

  const status = String(input.status).trim();
  if (!Object.values(ANALYTICS_CERTIFICATION_STATUS).includes(status)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "status must be PASS|FAIL|BLOCKED|NOT_APPLICABLE",
        "result.status"
      )
    );
  }

  return ok(
    deepFreeze({
      dimensionId: String(input.dimensionId).trim(),
      status,
      blocking: status === ANALYTICS_CERTIFICATION_STATUS.FAIL ||
        status === ANALYTICS_CERTIFICATION_STATUS.BLOCKED,
      warningCount:
        typeof input.warningCount === "number" && Number.isFinite(input.warningCount)
          ? input.warningCount
          : 0,
      evidenceIds: Object.freeze(
        Array.isArray(input.evidenceIds)
          ? input.evidenceIds
              .filter(isNonEmptyString)
              .map((e) => String(e).trim())
          : []
      ),
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createIntelligenceAnalyticsFinalReport(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "FinalReport must be a plain object",
        "report"
      )
    );
  }

  if (!isNonEmptyString(input.reportId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "reportId is required",
        "report.reportId"
      )
    );
  }

  if (!isValidIsoTimestamp(input.generatedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "generatedAt must be a valid ISO timestamp",
        "report.generatedAt"
      )
    );
  }

  if (!isNonEmptyString(input.manifestVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INTEGRATION_CERTIFICATION_INVALID,
        "manifestVersion is required",
        "report.manifestVersion"
      )
    );
  }

  const evidenceItems = Array.isArray(input.evidence) ? input.evidence : [];
  /** @type {unknown[]} */
  const normalizedEvidence = [];
  for (const item of evidenceItems) {
    const evidenceResult = createIntelligenceAnalyticsCertificationEvidence(item);
    if (!evidenceResult.ok) return evidenceResult;
    normalizedEvidence.push(evidenceResult.value);
  }

  normalizedEvidence.sort((a, b) => {
    const left = /** @type {{ scenarioId: string, dimensionId: string }} */ (a);
    const right = /** @type {{ scenarioId: string, dimensionId: string }} */ (b);
    const dimCmp =
      left.dimensionId < right.dimensionId
        ? -1
        : left.dimensionId > right.dimensionId
          ? 1
          : 0;
    if (dimCmp !== 0) return dimCmp;
    return left.scenarioId < right.scenarioId
      ? -1
      : left.scenarioId > right.scenarioId
        ? 1
        : 0;
  });

  const dimensionResultsInput = Array.isArray(input.dimensionResults)
    ? input.dimensionResults
    : [];
  /** @type {unknown[]} */
  const dimensionResults = [];
  for (const item of dimensionResultsInput) {
    const result = createIntelligenceAnalyticsCertificationResult(item);
    if (!result.ok) return result;
    dimensionResults.push(result.value);
  }

  dimensionResults.sort((a, b) => {
    const left = /** @type {{ dimensionId: string }} */ (a).dimensionId;
    const right = /** @type {{ dimensionId: string }} */ (b).dimensionId;
    return left < right ? -1 : left > right ? 1 : 0;
  });

  const blockingFailures = Object.freeze(
    normalizedEvidence
      .filter(
        (e) =>
          (/** @type {{ status: string, severity: string }} */ (e).status ===
            ANALYTICS_CERTIFICATION_STATUS.FAIL ||
            /** @type {{ status: string }} */ (e).status ===
              ANALYTICS_CERTIFICATION_STATUS.BLOCKED) &&
          /** @type {{ severity: string }} */ (e).severity ===
            ANALYTICS_CERTIFICATION_SEVERITY.BLOCKER
      )
      .map((e) => ({
        scenarioId: /** @type {{ scenarioId: string }} */ (e).scenarioId,
        dimensionId: /** @type {{ dimensionId: string }} */ (e).dimensionId,
        status: /** @type {{ status: string }} */ (e).status,
        reasonCode: /** @type {{ reasonCode: string }} */ (e).reasonCode,
      }))
  );

  const warnings = Object.freeze(
    normalizedEvidence
      .filter((e) => /** @type {{ warning: boolean }} */ (e).warning === true)
      .map((e) => ({
        scenarioId: /** @type {{ scenarioId: string }} */ (e).scenarioId,
        dimensionId: /** @type {{ dimensionId: string }} */ (e).dimensionId,
        reasonCode: /** @type {{ reasonCode: string }} */ (e).reasonCode,
      }))
  );

  const completeness =
    blockingFailures.length === 0 && normalizedEvidence.length > 0
      ? ANALYTICS_CERTIFICATION_COMPLETENESS.COMPLETE
      : blockingFailures.length > 0 &&
          normalizedEvidence.length > blockingFailures.length
        ? ANALYTICS_CERTIFICATION_COMPLETENESS.PARTIAL
        : ANALYTICS_CERTIFICATION_COMPLETENESS.FAILED;

  const overallStatus =
    blockingFailures.length === 0 &&
    dimensionResults.every(
      (r) =>
        /** @type {{ status: string }} */ (r).status ===
          ANALYTICS_CERTIFICATION_STATUS.PASS ||
        /** @type {{ status: string }} */ (r).status ===
          ANALYTICS_CERTIFICATION_STATUS.NOT_APPLICABLE
    )
      ? ANALYTICS_CERTIFICATION_STATUS.PASS
      : dimensionResults.some(
            (r) =>
              /** @type {{ status: string }} */ (r).status ===
              ANALYTICS_CERTIFICATION_STATUS.BLOCKED
          )
        ? ANALYTICS_CERTIFICATION_STATUS.BLOCKED
        : ANALYTICS_CERTIFICATION_STATUS.FAIL;

  const structuralFingerprint = createSafeCertificationFingerprint({
    reportId: String(input.reportId).trim(),
    manifestVersion: String(input.manifestVersion).trim(),
    certificationVersion: isNonEmptyString(input.certificationVersion)
      ? String(input.certificationVersion).trim()
      : INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
    sourceCommit: isNonEmptyString(input.sourceCommit)
      ? String(input.sourceCommit).trim()
      : "UNKNOWN",
    evidence: normalizedEvidence.map((e) => {
      const item = /** @type {{ scenarioId: string, dimensionId: string, status: string, reasonCode: string }} */ (
        e
      );
      return {
        scenarioId: item.scenarioId,
        dimensionId: item.dimensionId,
        status: item.status,
        reasonCode: item.reasonCode,
      };
    }),
    dimensionResults: dimensionResults.map((r) => {
      const item = /** @type {{ dimensionId: string, status: string }} */ (r);
      return { dimensionId: item.dimensionId, status: item.status };
    }),
    overallStatus,
  });

  return ok(
    deepFreeze({
      reportId: String(input.reportId).trim(),
      generatedAt: String(input.generatedAt).trim(),
      manifestId: isNonEmptyString(input.manifestId)
        ? String(input.manifestId).trim()
        : null,
      manifestVersion: String(input.manifestVersion).trim(),
      certificationVersion: isNonEmptyString(input.certificationVersion)
        ? String(input.certificationVersion).trim()
        : INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
      methodVersion: INTEGRATION_HARDENING_FINAL_CERTIFICATION_METHOD_VERSION,
      sourceCommit: isNonEmptyString(input.sourceCommit)
        ? String(input.sourceCommit).trim()
        : "UNKNOWN",
      overallStatus,
      completeness,
      dimensionResults: Object.freeze(dimensionResults),
      evidence: Object.freeze(normalizedEvidence),
      blockingFailures,
      warnings,
      structuralFingerprint,
      closureReady: blockingFailures.length === 0 &&
        overallStatus === ANALYTICS_CERTIFICATION_STATUS.PASS,
      isProductionReadyClaim: false,
      isCanonicalBusinessState: false,
      provenance: Object.freeze({
        workstreamId: "I&A-13",
        isCertificationOnly: true,
        ...(isPlainObject(input.provenance) ? input.provenance : {}),
      }),
    })
  );
}
