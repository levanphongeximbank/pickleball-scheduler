/**
 * replaceRefereeAssignment — pure deterministic replacement (no persistence).
 */

import { CORE13_SCHEMA_VERSION } from "../constants/versions.js";
import { REFEREE_ROLE_CODE } from "../enums/roleCodes.js";
import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";
import { REFEREE_ASSIGNMENT_STATUS } from "../enums/assignmentStatus.js";
import { REFEREE_ASSIGNMENT_SOURCE } from "../enums/assignmentSource.js";
import { REFEREE_AUDIT_ACTION } from "../enums/auditAction.js";
import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { createRefereeReplacementRequest } from "../contracts/refereeReplacementRequest.js";
import { createRefereeAssignment } from "../contracts/refereeAssignment.js";
import {
  createRefereeAssignmentFailure,
} from "../contracts/refereeAssignmentFailure.js";
import { createRefereeAssignmentAuditRecord } from "../contracts/refereeAssignmentAuditRecord.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import {
  buildReplacementId,
  fingerprintValue,
  CORE13_DIGEST_DOMAIN,
  CORE13_ID_PREFIX,
  digestCanonical,
} from "../deterministic/fingerprint.js";
import { evaluateRefereeEligibility } from "../services/evaluateRefereeEligibility.js";
import { normalizeConflictPolicy } from "../services/conflictPolicyNormalize.js";
import { createRefereeAssignmentPolicy } from "../contracts/refereeAssignmentPolicy.js";

/**
 * @param {object} input
 */
export function replaceRefereeAssignment(input = {}) {
  let request;
  try {
    request =
      input.request?.requestId && input.request?.incomingRefereeId
        ? input.request.schemaVersion
          ? input.request
          : createRefereeReplacementRequest(input.request)
        : createRefereeReplacementRequest(input.request || input);
  } catch (err) {
    return rejectResult(
      input.request?.requestId || "unknown",
      err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [err?.code || REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      err instanceof Error ? err.message : "Invalid replacement request"
    );
  }

  if (request.roleCode === REFEREE_ROLE_CODE.ANY) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }

  for (const [name, snap] of [
    ["directory", input.directorySnapshot],
    ["schedule", input.scheduleSnapshot],
    ["existingAssignments", input.existingAssignmentSnapshot],
    ["qualifications", input.qualificationSnapshot],
    ["availability", input.availabilitySnapshot],
  ]) {
    if (snap == null || snap.status === REFEREE_SNAPSHOT_STATUS.MISSING) {
      return rejectResult(
        request.requestId,
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
        [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING],
        `Missing snapshot: ${name}`
      );
    }
    if (snap.status === REFEREE_SNAPSHOT_STATUS.INVALID) {
      return rejectResult(
        request.requestId,
        REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
        [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID],
        `Invalid snapshot: ${name}`
      );
    }
  }

  const existing = Array.isArray(input.existingAssignmentSnapshot.items)
    ? input.existingAssignmentSnapshot.items
    : [];
  const prior = resolvePrior(existing, request);
  if (!prior) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Prior assignment not found"
    );
  }
  if (prior.status === REFEREE_ASSIGNMENT_STATUS.RELEASED) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Cannot replace RELEASED assignment"
    );
  }
  if (prior.status === REFEREE_ASSIGNMENT_STATUS.REPLACED) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Cannot replace already REPLACED assignment"
    );
  }
  if (
    prior.status !== REFEREE_ASSIGNMENT_STATUS.PLANNED &&
    prior.status !== REFEREE_ASSIGNMENT_STATUS.CONFIRMED
  ) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Prior assignment must be PLANNED or CONFIRMED"
    );
  }

  if (String(prior.refereeId) === String(request.incomingRefereeId)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED],
      "Replacement with same referee rejected by default",
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ALREADY_ASSIGNED
    );
  }

  const concreteRole = request.roleCode || prior.roleCode;
  if (concreteRole === REFEREE_ROLE_CODE.ANY || !concreteRole) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }

  // Preserve match and role scope
  if (request.matchId && String(request.matchId) !== String(prior.matchId)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Replacement must preserve matchId"
    );
  }
  if (request.roleCode && String(request.roleCode) !== String(prior.roleCode)) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST],
      "Replacement must preserve roleCode"
    );
  }

  const candidates = Array.isArray(input.directorySnapshot.items)
    ? input.directorySnapshot.items
    : [];
  const candidate = candidates.find(
    (c) => String(c.refereeId) === String(request.incomingRefereeId)
  );
  if (!candidate) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND]
    );
  }

  const scheduleRows = Array.isArray(input.scheduleSnapshot.items)
    ? input.scheduleSnapshot.items
    : [];
  const match =
    scheduleRows.find((m) => String(m.matchId) === String(prior.matchId)) ||
    input.match ||
    null;
  if (!match) {
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED]
    );
  }

  // Ignore outgoing only for target overlap/capacity evaluation
  const assignmentsForEval = existing.filter(
    (a) => String(a.assignmentId) !== String(prior.assignmentId)
  );

  const policy =
    input.policy?.policyId
      ? input.policy.schemaVersion
        ? input.policy
        : createRefereeAssignmentPolicy(input.policy)
      : createRefereeAssignmentPolicy({
          policyId: "pol-replace",
          policyVersion: "1",
        });

  const eligibility = evaluateRefereeEligibility({
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    candidate,
    match,
    roleCode: concreteRole,
    qualifications: Array.isArray(input.qualificationSnapshot.items)
      ? input.qualificationSnapshot.items
      : [],
    availabilityWindows: Array.isArray(input.availabilitySnapshot.items)
      ? input.availabilitySnapshot.items
      : [],
    existingAssignments: assignmentsForEval,
    scheduleRows,
    conflictPolicy: normalizeConflictPolicy(input.conflictPolicy),
    policy,
  });

  if (!eligibility.eligible) {
    const codes = eligibility.hardFailures.map((f) => f.code);
    const unique = [...new Set(codes)].sort(compareStableString);
    return rejectResult(
      request.requestId,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED,
      unique,
      `Replacement rejected: ${unique[0]}`,
      unique[0]
    );
  }

  const replacedPrior = createRefereeAssignment({
    assignmentId: prior.assignmentId,
    matchId: prior.matchId,
    refereeId: prior.refereeId,
    roleCode: prior.roleCode,
    status: REFEREE_ASSIGNMENT_STATUS.REPLACED,
    source: prior.source || REFEREE_ASSIGNMENT_SOURCE.AUTO,
    constraintsSatisfied: prior.constraintsSatisfied || [],
    metadata: {
      ...(prior.metadata || {}),
      replacedByRequestId: request.requestId,
    },
  });

  const incomingAssignmentId = buildReplacementId({
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId: request.requestId,
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    matchId: prior.matchId,
    roleCode: concreteRole,
    slotIndex: 0,
    refereeId: request.incomingRefereeId,
    priorAssignmentId: prior.assignmentId,
    source: REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT,
  });

  const incomingAssignment = createRefereeAssignment({
    assignmentId: incomingAssignmentId,
    matchId: prior.matchId,
    refereeId: request.incomingRefereeId,
    roleCode: concreteRole,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
    source: REFEREE_ASSIGNMENT_SOURCE.REPLACEMENT,
    constraintsSatisfied: eligibility.evaluatedConstraintKinds,
  });

  const resultFingerprint = fingerprintValue(
    {
      requestId: request.requestId,
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId,
      matchId: prior.matchId,
      roleCode: concreteRole,
      outgoingRefereeId: prior.refereeId,
      incomingRefereeId: request.incomingRefereeId,
      reasonCode: request.reasonCode || "REPLACEMENT",
    },
    CORE13_DIGEST_DOMAIN.REPLACEMENT_RESULT
  );

  const auditId = `${CORE13_ID_PREFIX.AUDIT}${digestCanonical(
    CORE13_DIGEST_DOMAIN.AUDIT,
    {
      requestId: request.requestId,
      resultFingerprint,
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId,
    }
  ).slice(0, 32)}`;

  const auditPayload = createRefereeAssignmentAuditRecord({
    auditId,
    action: REFEREE_AUDIT_ACTION.REPLACED,
    requestId: request.requestId,
    planFingerprint: resultFingerprint,
    beforeRef: prior.assignmentId,
    afterRef: incomingAssignmentId,
    actorRef: request.actorRef,
    reasonCode: request.reasonCode || "REPLACEMENT",
    // recordedAt intentionally omitted — sink owns timestamps
    payload: {
      priorAssignmentId: prior.assignmentId,
      incomingAssignmentId,
      resultFingerprint,
    },
  });

  // Project evidence without shared object identity (deepFreeze rejects cycles).
  const validationEvidence = {
    schemaVersion: eligibility.schemaVersion,
    refereeId: eligibility.refereeId,
    matchId: eligibility.matchId,
    roleCode: eligibility.roleCode,
    eligible: eligibility.eligible,
    hardFailures: eligibility.hardFailures.map((f) => ({
      code: f.code,
      severity: f.severity,
      constraintKind: f.constraintKind,
      message: f.message,
      details: { ...(f.details || {}) },
    })),
    softNotes: eligibility.softNotes.map((n) => ({
      code: n.code,
      severity: n.severity,
      constraintKind: n.constraintKind,
      message: n.message,
      details: { ...(n.details || {}) },
    })),
    evaluatedConstraintKinds: [...eligibility.evaluatedConstraintKinds],
    evidenceRefs: [...eligibility.evidenceRefs],
  };
  const conflictEvidence = validationEvidence.hardFailures.map((f) => ({
    ...f,
    details: { ...(f.details || {}) },
  }));

  return ownedFreeze({
    ok: true,
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId: request.requestId,
    priorAssignmentRef: prior.assignmentId,
    outgoingAssignment: replacedPrior,
    incomingAssignment,
    replacementIdentity: incomingAssignmentId,
    reasonCode: request.reasonCode || "REPLACEMENT",
    validationEvidence,
    conflictEvidence,
    auditPayload,
    resultFingerprint,
    failure: null,
  });
}

function resolvePrior(existing, request) {
  if (request.assignmentId) {
    return (
      existing.find(
        (a) => String(a.assignmentId) === String(request.assignmentId)
      ) || null
    );
  }
  if (request.matchId && request.roleCode) {
    return (
      existing.find(
        (a) =>
          String(a.matchId) === String(request.matchId) &&
          String(a.roleCode) === String(request.roleCode) &&
          (a.status === REFEREE_ASSIGNMENT_STATUS.PLANNED ||
            a.status === REFEREE_ASSIGNMENT_STATUS.CONFIRMED)
      ) || null
    );
  }
  return null;
}

function rejectResult(
  requestId,
  envelopeOrCode,
  reasonCodes,
  message,
  causedBy
) {
  const unique = [...new Set(reasonCodes.filter(Boolean))].sort(
    compareStableString
  );
  const primary = causedBy || unique[0] || envelopeOrCode;
  const fatalCodes = new Set([
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_REPLACEMENT_REQUEST,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
    REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
  ]);
  const useEnvelope = !fatalCodes.has(envelopeOrCode);
  const code = useEnvelope
    ? REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REPLACEMENT_REFEREE_REJECTED
    : envelopeOrCode;

  return ownedFreeze({
    ok: false,
    schemaVersion: CORE13_SCHEMA_VERSION,
    requestId,
    outgoingAssignment: null,
    incomingAssignment: null,
    failure: createRefereeAssignmentFailure({
      code,
      message: message || `Replacement rejected: ${primary}`,
      severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
      causedBy: useEnvelope ? primary : unique[0] || primary,
      reasonCodes: unique.length > 0 ? unique : [primary],
    }),
    resultFingerprint: null,
    auditPayload: null,
  });
}
