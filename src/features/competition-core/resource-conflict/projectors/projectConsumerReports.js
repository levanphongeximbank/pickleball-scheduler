/**
 * CORE-14 Phase 1F — dormant schedule / court / referee report projectors.
 */

import { CORE14_PROJECTOR_CONTRACT_V1 } from "../constants/versions.js";
import { RESOURCE_FINDING_CODE } from "../enums/findingCode.js";
import { RESOLUTION_ACTION_TYPE } from "../resolution/actionTypes.js";
import { SEVERITY } from "../enums/severity.js";
import { INPUT_DIAGNOSTIC_CODE } from "../enums/diagnosticCode.js";
import { createInputDiagnostic } from "../domain/InputDiagnostic.js";
import { compareFindings } from "../catalogs/severityPolicy.js";
import { compareRecommendations } from "../resolution/rankRecommendations.js";
import { compareDiagnostics } from "../catalogs/severityPolicy.js";
import { fingerprintCore14Material } from "../deterministic/fingerprint.js";
import { isPlainObject } from "../deterministic/serialize.js";
import { compareUtf8Bytewise } from "../deterministic/compare.js";

const SCHEDULE_FINDING_CODES = new Set([
  RESOURCE_FINDING_CODE.PLAYER_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.TEAM_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.MANDATORY_REST_VIOLATION,
  RESOURCE_FINDING_CODE.PREFERRED_REST_WARNING,
  RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
  RESOURCE_FINDING_CODE.VENUE_UNAVAILABLE,
]);

const SCHEDULE_ACTION_TYPES = new Set([
  RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
  RESOLUTION_ACTION_TYPE.INSERT_REST_GAP,
  RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
  RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
]);

const COURT_FINDING_CODES = new Set([
  RESOURCE_FINDING_CODE.COURT_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED,
  RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
]);

const COURT_ACTION_TYPES = new Set([
  RESOLUTION_ACTION_TYPE.REASSIGN_COURT,
  RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
  RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
  RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
]);

const REFEREE_FINDING_CODES = new Set([
  RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP,
  RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE,
]);

const REFEREE_ACTION_TYPES = new Set([
  RESOLUTION_ACTION_TYPE.REASSIGN_REFEREE,
  RESOLUTION_ACTION_TYPE.MOVE_ASSIGNMENT_TIME,
  RESOLUTION_ACTION_TYPE.MARK_FOR_MANUAL_REVIEW,
  RESOLUTION_ACTION_TYPE.NO_SAFE_AUTOMATIC_RESOLUTION,
]);

/**
 * @param {unknown} input
 * @param {string} consumer
 */
function emptyProjector(consumer, message) {
  return Object.freeze({
    projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
    consumer,
    findings: Object.freeze([]),
    recommendations: Object.freeze([]),
    externalDiagnostics: Object.freeze([]),
    validationOutcomes: Object.freeze([]),
    selectedCourtId: null,
    selectedRefereeId: null,
    applied: false,
    diagnostics: Object.freeze([
      createInputDiagnostic({
        code: INPUT_DIAGNOSTIC_CODE.ADAPTER_RECORD_INVALID,
        message,
      }),
    ]),
    deterministicFingerprint: fingerprintCore14Material({ projector: consumer, empty: true }),
    metadata: Object.freeze({ automaticApply: false }),
  });
}

/**
 * @param {object} rec
 */
function projectRecommendationFlags(rec) {
  return Object.freeze({
    recommendationId: rec?.recommendationId ?? null,
    actionType: rec?.actionType ?? null,
    rootFindingIds: Object.freeze([...(rec?.rootFindingIds || [])]),
    rootConflictContinuityKey: rec?.rootConflictContinuityKey ?? null,
    automaticEligible: rec?.automaticEligible === true,
    requiresManualApproval: rec?.requiresManualApproval === true,
    violatesLock: rec?.violatesLock === true,
    affectsPublishedAssignment: rec?.affectsPublishedAssignment === true,
    crossesScopeBoundary: rec?.crossesScopeBoundary === true,
    proposedChanges: rec?.proposedChanges ?? null,
  });
}

/**
 * @param {unknown} input
 */
export function projectConflictResultForSchedule(input) {
  if (!isPlainObject(input)) {
    return emptyProjector("CORE_11_SCHEDULE", "schedule projector input must be a plain object");
  }
  const findings = (Array.isArray(input.findings) ? [...input.findings] : [])
    .filter((f) => SCHEDULE_FINDING_CODES.has(f?.code))
    .sort(compareFindings);
  const recommendations = (Array.isArray(input.recommendations) ? [...input.recommendations] : [])
    .filter((r) => SCHEDULE_ACTION_TYPES.has(r?.actionType))
    .sort(compareRecommendations)
    .map(projectRecommendationFlags);
  const externalDiagnostics = (Array.isArray(input.externalDiagnostics)
    ? [...input.externalDiagnostics]
    : []
  ).sort(compareDiagnostics);

  return Object.freeze({
    projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
    consumer: "CORE_11_SCHEDULE",
    findings: Object.freeze(findings.map((f) => Object.freeze({ ...f }))),
    recommendations: Object.freeze(recommendations),
    externalDiagnostics: Object.freeze(externalDiagnostics),
    planStatus: input.planStatus ?? null,
    evaluationStatus: input.evaluationStatus ?? null,
    applied: false,
    deterministicFingerprint: fingerprintCore14Material({
      projector: "projectConflictResultForSchedule",
      findingIds: findings.map((f) => f.findingId).sort(compareUtf8Bytewise),
      recommendationIds: recommendations.map((r) => r.recommendationId).sort(compareUtf8Bytewise),
      externalCodes: externalDiagnostics.map((d) => d.code).sort(compareUtf8Bytewise),
    }),
    metadata: Object.freeze({
      automaticApply: false,
      includesCourtMutationInstructions: false,
      includesRefereeMutationInstructions: false,
    }),
  });
}

/**
 * @param {unknown} input
 */
export function projectConflictResultForCourtAssignment(input) {
  if (!isPlainObject(input)) {
    return emptyProjector("CORE_12_COURT", "court projector input must be a plain object");
  }
  const findings = (Array.isArray(input.findings) ? [...input.findings] : [])
    .filter((f) => {
      if (f?.code === RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE) {
        return f?.resourceKey?.resourceKind === "COURT";
      }
      if (f?.code === RESOURCE_FINDING_CODE.RESOURCE_CAPACITY_EXCEEDED) {
        return f?.resourceKey?.resourceKind === "COURT" || f?.resourceKey?.resourceKind === "VENUE";
      }
      return COURT_FINDING_CODES.has(f?.code);
    })
    .sort(compareFindings);
  const recommendations = (Array.isArray(input.recommendations) ? [...input.recommendations] : [])
    .filter((r) => COURT_ACTION_TYPES.has(r?.actionType))
    .sort(compareRecommendations)
    .map(projectRecommendationFlags);
  const validationOutcomes = Array.isArray(input.validationOutcomes)
    ? [...input.validationOutcomes]
    : [];

  return Object.freeze({
    projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
    consumer: "CORE_12_COURT",
    findings: Object.freeze(findings.map((f) => Object.freeze({ ...f }))),
    recommendations: Object.freeze(recommendations),
    validationOutcomes: Object.freeze(validationOutcomes),
    selectedCourtId: null,
    applied: false,
    deterministicFingerprint: fingerprintCore14Material({
      projector: "projectConflictResultForCourtAssignment",
      findingIds: findings.map((f) => f.findingId).sort(compareUtf8Bytewise),
      recommendationIds: recommendations.map((r) => r.recommendationId).sort(compareUtf8Bytewise),
    }),
    metadata: Object.freeze({
      automaticApply: false,
      courtSelected: false,
      inventoryEnumerated: false,
      lockPublishedManualFlagsPreserved: true,
    }),
  });
}

/**
 * @param {unknown} input
 */
export function projectConflictResultForRefereeAssignment(input) {
  if (!isPlainObject(input)) {
    return emptyProjector("CORE_13_REFEREE", "referee projector input must be a plain object");
  }
  const findings = (Array.isArray(input.findings) ? [...input.findings] : [])
    .filter((f) => {
      if (f?.code === RESOURCE_FINDING_CODE.RESOURCE_UNAVAILABLE) {
        return f?.resourceKey?.resourceKind === "REFEREE";
      }
      return REFEREE_FINDING_CODES.has(f?.code);
    })
    .map((f) => {
      if (f?.code === RESOURCE_FINDING_CODE.REFEREE_TIME_OVERLAP && f.severity !== SEVERITY.HARD) {
        return Object.freeze({ ...f, severity: SEVERITY.HARD });
      }
      return Object.freeze({ ...f });
    })
    .sort(compareFindings);
  const recommendations = (Array.isArray(input.recommendations) ? [...input.recommendations] : [])
    .filter((r) => REFEREE_ACTION_TYPES.has(r?.actionType))
    .sort(compareRecommendations)
    .map(projectRecommendationFlags);
  const validationOutcomes = Array.isArray(input.validationOutcomes)
    ? [...input.validationOutcomes]
    : [];

  return Object.freeze({
    projectorContractVersion: CORE14_PROJECTOR_CONTRACT_V1,
    consumer: "CORE_13_REFEREE",
    findings: Object.freeze(findings),
    recommendations: Object.freeze(recommendations),
    validationOutcomes: Object.freeze(validationOutcomes),
    selectedRefereeId: null,
    applied: false,
    deterministicFingerprint: fingerprintCore14Material({
      projector: "projectConflictResultForRefereeAssignment",
      findingIds: findings.map((f) => f.findingId).sort(compareUtf8Bytewise),
      recommendationIds: recommendations.map((r) => r.recommendationId).sort(compareUtf8Bytewise),
    }),
    metadata: Object.freeze({
      automaticApply: false,
      refereeSelected: false,
      refereeOverlapRemainsHard: true,
      lockPublishedManualFlagsPreserved: true,
    }),
  });
}
