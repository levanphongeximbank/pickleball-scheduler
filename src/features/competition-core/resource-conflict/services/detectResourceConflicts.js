/**
 * CORE-14 Phase 1D — dormant conflict detection orchestration.
 * Pure / dependency-injected. No production wiring. recommendationCount stays 0.
 */

import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { EVALUATION_STATUS } from "../enums/evaluationStatus.js";
import { PLAN_STATUS } from "../enums/planStatus.js";
import {
  AVAILABILITY_CERTIFICATION,
  AVAILABILITY_MODE,
} from "../enums/availabilityCertification.js";
import { SEVERITY } from "../enums/severity.js";
import { compareDiagnostics, compareFindings } from "../catalogs/severityPolicy.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";
import { validateResourceOccupancy } from "../domain/ResourceOccupancy.js";
import { evaluateDuplicateIntegrity } from "../domain/duplicateIntegrity.js";
import { serializeCanonicalResourceKey } from "../domain/CanonicalResourceKey.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import {
  createDetectionResult,
  createRejectedInvalidInputResult,
} from "../domain/DetectionResult.js";
import { normalizeCapacityPolicy } from "../policy/capacityPolicy.js";
import { normalizeRestPolicy } from "../policy/restPolicy.js";
import {
  normalizeAvailabilityMode,
  deriveAvailabilityCertification,
} from "../policy/availabilityPolicy.js";
import { detectTimeOverlaps } from "../detectors/detectTimeOverlaps.js";
import { detectCapacityExceeded } from "../detectors/detectCapacityExceeded.js";
import { detectRestViolations } from "../detectors/detectRestViolations.js";
import {
  detectAvailabilityFindings,
  materializeAvailabilityFactsFromPort,
} from "../detectors/detectAvailabilityFindings.js";
import { suppressDuplicateRootCauses } from "../detectors/suppressDuplicateRootCauses.js";

/**
 * Derive plan/evaluation statuses from completed findings + certification.
 *
 * @param {{
 *   findings: readonly object[],
 *   availabilityCertification: string,
 *   availabilityCheckEnabled: boolean,
 * }} input
 * @returns {{ evaluationStatus: string, planStatus: string }}
 */
export function deriveResultStatuses(input) {
  const findings = input.findings || [];
  let hard = 0;
  let soft = 0;
  for (const f of findings) {
    if (f?.severity === SEVERITY.HARD) hard += 1;
    else if (f?.severity === SEVERITY.SOFT) soft += 1;
  }

  if (hard > 0) {
    return {
      evaluationStatus: EVALUATION_STATUS.COMPLETED,
      planStatus: PLAN_STATUS.INVALID_HARD_CONFLICTS,
    };
  }

  const cert = input.availabilityCertification;
  const hasSoftOrPartial =
    soft > 0 ||
    (input.availabilityCheckEnabled &&
      cert === AVAILABILITY_CERTIFICATION.PARTIAL);

  if (hasSoftOrPartial) {
    return {
      evaluationStatus: EVALUATION_STATUS.COMPLETED,
      planStatus: PLAN_STATUS.VALID_WITH_WARNINGS,
    };
  }

  return {
    evaluationStatus: EVALUATION_STATUS.COMPLETED,
    planStatus: PLAN_STATUS.VALID,
  };
}

/**
 * Detect resource conflicts (dormant entry point).
 * Does not mutate caller arrays or nested occupancy data.
 *
 * @param {{
 *   occupancies?: readonly object[],
 *   capacityCheckEnabled?: boolean,
 *   capacityPolicy?: object | null,
 *   restPolicy?: object | null,
 *   availabilityMode?: string,
 *   availabilityCheckEnabled?: boolean,
 *   availabilityFacts?: readonly object[] | null,
 *   availabilityPort?: object | null,
 *   externalDiagnostics?: readonly object[],
 *   policyVersion?: string,
 *   requireAssignmentId?: boolean,
 *   requestId?: string | null,
 *   deterministicContext?: object | null,
 *   metadata?: Record<string, unknown> | null,
 * }} request
 */
export function detectResourceConflicts(request = {}) {
  const rawOccupancies = Array.isArray(request.occupancies)
    ? request.occupancies
    : [];
  // Shallow copy of the outer array only; validate produces frozen copies.
  const occupancySnapshot = [...rawOccupancies];

  /** @type {object[]} */
  const inputDiagnostics = [];
  /** @type {object[]} */
  const normalized = [];

  for (let i = 0; i < occupancySnapshot.length; i += 1) {
    const result = validateResourceOccupancy(occupancySnapshot[i]);
    if (!result.ok) {
      for (const d of result.diagnostics) {
        inputDiagnostics.push(
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            path: d.path ?? `occupancies[${i}]`,
            occupancyId: d.occupancyId,
            details: d.details,
          })
        );
      }
      continue;
    }
    if (request.requireAssignmentId === true) {
      const asg = result.value.assignmentId;
      if (typeof asg !== "string" || asg.length === 0) {
        inputDiagnostics.push(
          createInputDiagnostic({
            code: INPUT_DIAGNOSTIC_CODE.ASSIGNMENT_ID_MISSING,
            message: "assignmentId required by request.requireAssignmentId",
            path: `occupancies[${i}]`,
            occupancyId: result.value.occupancyId,
          })
        );
        continue;
      }
    }
    normalized.push(result.value);
  }

  if (inputDiagnostics.length > 0) {
    return createRejectedInvalidInputResult(
      [...inputDiagnostics].sort(compareDiagnostics),
      {
        evaluatedOccupancyCount: 0,
        evaluatedResourceCount: 0,
        externalDiagnostics: [...(request.externalDiagnostics || [])],
        availabilityMode: request.availabilityMode ?? null,
        metadata: request.metadata ?? null,
      }
    );
  }

  const dup = evaluateDuplicateIntegrity(normalized);
  if (!dup.ok) {
    const diagnostics = dup.diagnostics.map((d) =>
      createInputDiagnostic({
        code: d.code,
        message: d.message,
        path: d.path,
        occupancyId: d.occupancyId,
        assignmentId: d.assignmentId,
        details: d.details,
      })
    );
    return createRejectedInvalidInputResult(
      [...diagnostics].sort(compareDiagnostics),
      {
        evaluatedOccupancyCount: 0,
        evaluatedResourceCount: 0,
        externalDiagnostics: [...(request.externalDiagnostics || [])],
        availabilityMode: request.availabilityMode ?? null,
        metadata: request.metadata ?? null,
      }
    );
  }

  const modeResult = normalizeAvailabilityMode(request.availabilityMode);
  if (!modeResult.ok) {
    return createRejectedInvalidInputResult(
      modeResult.diagnostics.map((d) =>
        createInputDiagnostic({
          code: d.code,
          message: d.message,
          details: d.details,
        })
      ),
      {
        externalDiagnostics: [...(request.externalDiagnostics || [])],
        availabilityMode: request.availabilityMode ?? null,
      }
    );
  }
  const availabilityMode = modeResult.value;

  const capacityCheckEnabled = request.capacityCheckEnabled === true;
  /** @type {object | null} */
  let capacityPolicy;
  if (capacityCheckEnabled) {
    const cap = normalizeCapacityPolicy(request.capacityPolicy);
    if (!cap.ok) {
      return createRejectedInvalidInputResult(
        cap.diagnostics.map((d) =>
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            details: d.details,
          })
        ),
        {
          externalDiagnostics: [...(request.externalDiagnostics || [])],
          availabilityMode,
        }
      );
    }
    capacityPolicy = cap.value;
  } else {
    // Still allow exclusive-location flags for overlap without full capacity scan.
    const cap = normalizeCapacityPolicy(request.capacityPolicy || {});
    if (!cap.ok) {
      return createRejectedInvalidInputResult(
        cap.diagnostics.map((d) =>
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            details: d.details,
          })
        ),
        {
          externalDiagnostics: [...(request.externalDiagnostics || [])],
          availabilityMode,
        }
      );
    }
    capacityPolicy = cap.value;
  }

  const restResult = normalizeRestPolicy(request.restPolicy);
  if (!restResult.ok) {
    return createRejectedInvalidInputResult(
      restResult.diagnostics.map((d) =>
        createInputDiagnostic({
          code: d.code,
          message: d.message,
          details: d.details,
        })
      ),
      {
        externalDiagnostics: [...(request.externalDiagnostics || [])],
        availabilityMode,
      }
    );
  }
  const restPolicy = restResult.value;

  const exclusiveLocationKeys = capacityPolicy
    ? capacityPolicy.exclusiveLocationKeys
    : new Set();

  // 4. Overlap
  let findings = detectTimeOverlaps(normalized, {
    exclusiveLocationKeys,
    policyVersion: capacityPolicy?.policyVersion,
  });

  // 5. Capacity
  /** @type {object[]} */
  let runtimeDiagnostics = [];
  if (capacityCheckEnabled && capacityPolicy) {
    const capacityOut = detectCapacityExceeded(normalized, { capacityPolicy });
    if (capacityOut.diagnostics.length > 0) {
      return createRejectedInvalidInputResult(
        capacityOut.diagnostics.map((d) =>
          createInputDiagnostic({
            code: d.code,
            message: d.message,
            details: d.details,
          })
        ),
        {
          externalDiagnostics: [...(request.externalDiagnostics || [])],
          availabilityMode,
        }
      );
    }
    findings = findings.concat(capacityOut.findings);
  }

  // 6. Rest
  if (restPolicy) {
    findings = findings.concat(
      detectRestViolations(normalized, { restPolicy })
    );
  }

  // 7. Availability
  const availabilityCheckEnabled = request.availabilityCheckEnabled === true;
  let availabilityCertification = AVAILABILITY_CERTIFICATION.NOT_EVALUATED;
  /** @type {string[]} */
  let providerVersions = [];

  if (availabilityCheckEnabled) {
    let facts = Array.isArray(request.availabilityFacts)
      ? [...request.availabilityFacts]
      : [];
    if (facts.length === 0 && request.availabilityPort) {
      facts = materializeAvailabilityFactsFromPort(
        normalized,
        request.availabilityPort,
        { requestId: request.requestId ?? null }
      );
    }

    const avail = detectAvailabilityFindings(normalized, facts, {
      availabilityMode,
    });
    runtimeDiagnostics = runtimeDiagnostics.concat(avail.diagnostics);
    findings = findings.concat(avail.findings);
    providerVersions = avail.providerVersions;
    const authoritativeFailure = avail.authoritativeFailure;

    if (authoritativeFailure && availabilityMode === AVAILABILITY_MODE.AUTHORITATIVE) {
      const resourceKeys = new Set(
        normalized.map((o) => serializeCanonicalResourceKey(o.resourceKey))
      );
      return createDetectionResult({
        evaluationStatus: EVALUATION_STATUS.DATA_UNAVAILABLE,
        planStatus: PLAN_STATUS.NOT_EVALUATED,
        findings: [],
        inputDiagnostics: [...runtimeDiagnostics].sort(compareDiagnostics),
        externalDiagnostics: [...(request.externalDiagnostics || [])],
        evaluatedOccupancyCount: normalized.length,
        evaluatedResourceCount: resourceKeys.size,
        availabilityCertification: AVAILABILITY_CERTIFICATION.NOT_EVALUATED,
        availabilityMode,
        recommendations: [],
        policyVersion: request.policyVersion || "core14-detection-request-result-v1",
        metadata: Object.freeze({
          policyVersion: request.policyVersion || "core14-detection-request-result-v1",
          availabilityMode,
          availabilityCertification: AVAILABILITY_CERTIFICATION.NOT_EVALUATED,
          availabilityFullyCertified: false,
          providerVersions,
          fingerprintVersion:
            request.deterministicContext?.fingerprintVersion ?? "CORE14_FP_V1",
        }),
      });
    }

    availabilityCertification = deriveAvailabilityCertification({
      availabilityCheckEnabled: true,
      availabilityMode,
      authoritativeFailure: false,
      queriedCount: avail.queriedCount,
      definitiveCount: avail.definitiveCount,
      unknownOrProviderFailureCount: avail.unknownOrProviderFailureCount,
    });
  }

  // 8. Suppression
  findings = suppressDuplicateRootCauses(findings);

  // 9. Sort
  findings = [...findings].sort(compareFindings);
  runtimeDiagnostics = [...runtimeDiagnostics].sort(compareDiagnostics);

  // Collect severity-override diagnostics from findings.
  for (const f of findings) {
    if (f.severityOverrideDiagnostic) {
      runtimeDiagnostics.push(
        createInputDiagnostic({
          code: f.severityOverrideDiagnostic.code,
          message: f.severityOverrideDiagnostic.message,
          path: f.severityOverrideDiagnostic.path,
          details: f.severityOverrideDiagnostic.details,
        })
      );
    }
  }
  runtimeDiagnostics = [...runtimeDiagnostics].sort(compareDiagnostics);

  const resourceKeys = new Set(
    normalized.map((o) => serializeCanonicalResourceKey(o.resourceKey))
  );

  const statuses = deriveResultStatuses({
    findings,
    availabilityCertification,
    availabilityCheckEnabled,
  });

  return createDetectionResult({
    evaluationStatus: statuses.evaluationStatus,
    planStatus: statuses.planStatus,
    findings,
    inputDiagnostics: runtimeDiagnostics,
    externalDiagnostics: [...(request.externalDiagnostics || [])],
    evaluatedOccupancyCount: normalized.length,
    evaluatedResourceCount: resourceKeys.size,
    availabilityCertification,
    availabilityMode,
    recommendations: [],
    policyVersion: request.policyVersion || "core14-detection-request-result-v1",
    metadata: Object.freeze({
      policyVersion: request.policyVersion || "core14-detection-request-result-v1",
      availabilityMode,
      availabilityCertification,
      availabilityFullyCertified:
        availabilityCertification === AVAILABILITY_CERTIFICATION.FULL,
      providerVersions: [...providerVersions].sort(compareUtf8Bytewise),
      fingerprintVersion:
        request.deterministicContext?.fingerprintVersion ?? "CORE14_FP_V1",
    }),
  });
}
