/**
 * validateManualRefereeAssignment — validation only (no persist / apply).
 */

import { REFEREE_ROLE_CODE } from "../enums/roleCodes.js";
import { REFEREE_SNAPSHOT_STATUS } from "../enums/snapshotStatus.js";
import { REFEREE_DIAGNOSTIC_SEVERITY } from "../enums/diagnosticSeverity.js";
import { REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE } from "../errors/diagnosticCodes.js";
import { createManualRefereeAssignmentRequest } from "../contracts/manualRefereeAssignmentRequest.js";
import {
  createManualAssignmentRejection,
  createRefereeAssignmentFailure,
} from "../contracts/refereeAssignmentFailure.js";
import { createRefereeAssignment } from "../contracts/refereeAssignment.js";
import { REFEREE_ASSIGNMENT_SOURCE } from "../enums/assignmentSource.js";
import { REFEREE_ASSIGNMENT_STATUS } from "../enums/assignmentStatus.js";
import { ownedFreeze } from "../contracts/shared.js";
import { compareStableString } from "../deterministic/compare.js";
import { evaluateRefereeEligibility } from "./evaluateRefereeEligibility.js";
import { collectReasonCodes } from "../contracts/refereeEligibilityResult.js";

/**
 * @param {object} input
 * @returns {Readonly<object>}
 */
export function validateManualRefereeAssignment(input = {}) {
  let request;
  try {
    request =
      input.request?.schemaVersion && input.request?.matchId
        ? input.request
        : createManualRefereeAssignmentRequest(input.request || input);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? /** @type {{ code: string }} */ (err).code
        : REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.INVALID_ASSIGNMENT_REQUEST;
    return ownedFreeze({
      ok: false,
      accepted: false,
      failure: createManualAssignmentRejection(code, {
        message:
          err instanceof Error ? err.message : "Invalid manual request",
        matchId: input.request?.matchId || null,
        refereeId: input.request?.refereeId || null,
        reasonCodes: [code],
      }),
    });
  }

  // ANY as concrete role
  if (request.roleCode === REFEREE_ROLE_CODE.ANY) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_ROLE_UNSUPPORTED]
    );
  }

  // Snapshot checks — required snapshots
  const dir = input.directorySnapshot;
  const schedule = input.scheduleSnapshot;
  const existing = input.existingAssignmentSnapshot;
  const quals = input.qualificationSnapshot;
  const avail = input.availabilitySnapshot;

  for (const [name, snap] of [
    ["directory", dir],
    ["schedule", schedule],
    ["existingAssignments", existing],
  ]) {
    const fatal = snapshotFatal(snap);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: name, status: snap?.status ?? null },
      });
    }
  }

  // Qualifications / availability may be empty but not missing when provided as required
  if (input.requireQualificationSnapshot !== false) {
    const fatal = snapshotFatal(quals);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: "qualifications" },
      });
    }
  }
  if (input.requireAvailabilitySnapshot !== false) {
    const fatal = snapshotFatal(avail);
    if (fatal) {
      return reject(request, fatal, [fatal], {
        details: { snapshot: "availability" },
      });
    }
  }

  const candidates = Array.isArray(dir?.items) ? dir.items : [];
  const candidate = candidates.find(
    (c) => String(c.refereeId) === String(request.refereeId)
  );
  if (!candidate) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.REFEREE_NOT_FOUND]
    );
  }

  const scheduleRows = Array.isArray(schedule?.items) ? schedule.items : [];
  const match =
    scheduleRows.find((m) => String(m.matchId) === String(request.matchId)) ||
    input.match ||
    null;
  if (!match) {
    return reject(
      request,
      REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED,
      [REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MATCH_SCOPE_REQUIRED]
    );
  }

  const eligibility = evaluateRefereeEligibility({
    tenantId: request.tenantId,
    tournamentId: request.tournamentId,
    candidate,
    match,
    roleCode: request.roleCode,
    qualifications: Array.isArray(quals?.items) ? quals.items : [],
    availabilityWindows: Array.isArray(avail?.items) ? avail.items : [],
    existingAssignments: Array.isArray(existing?.items) ? existing.items : [],
    scheduleRows,
    conflictPolicy: input.conflictPolicy,
    policy: input.policy,
    candidateTeamIds: input.candidateTeamIds,
    preferredTags: input.preferredTags,
    preferredRoleCode: input.preferredRoleCode,
    requireCertification: input.requireCertification === true,
  });

  const hardCodes = collectReasonCodes(eligibility.hardFailures);
  if (hardCodes.length > 0) {
    return reject(request, hardCodes[0], hardCodes, {
      details: { hardFailures: eligibility.hardFailures },
    });
  }

  // Soft notes: block only when soft notes exist AND allowSoftOverride is false
  const allowSoft =
    request.allowSoftOverride === true ||
    input.allowSoftOverride === true ||
    input.policy?.allowSoftOverride === true;

  if (eligibility.softNotes.length > 0 && !allowSoft) {
    const softCodes = [
      ...new Set(eligibility.softNotes.map((n) => n.code)),
    ].sort(compareStableString);
    // Soft preference without override — treat as manual rejection with primary soft code
    // but these are not hard constraint codes; use MANUAL envelope with soft codes
    return ownedFreeze({
      ok: false,
      accepted: false,
      eligibility,
      failure: createRefereeAssignmentFailure({
        code: REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.MANUAL_ASSIGNMENT_REJECTED,
        message: `Manual assignment rejected: soft preferences require allowSoftOverride`,
        severity: REFEREE_DIAGNOSTIC_SEVERITY.FATAL,
        causedBy: softCodes[0],
        reasonCodes: softCodes,
        matchId: request.matchId,
        refereeId: request.refereeId,
        details: { softNotes: eligibility.softNotes },
      }),
    });
  }

  const assignmentId =
    typeof input.assignmentId === "string" && input.assignmentId.trim()
      ? input.assignmentId.trim()
      : `manual:${request.tenantId}:${request.tournamentId}:${request.matchId}:${request.roleCode}:${request.refereeId}`;

  const assignment = createRefereeAssignment({
    assignmentId,
    matchId: request.matchId,
    refereeId: request.refereeId,
    roleCode: request.roleCode,
    status: REFEREE_ASSIGNMENT_STATUS.PLANNED,
    source: REFEREE_ASSIGNMENT_SOURCE.MANUAL,
    constraintsSatisfied: eligibility.evaluatedConstraintKinds,
  });

  return ownedFreeze({
    ok: true,
    accepted: true,
    eligibility,
    assignment,
    failure: null,
  });
}

function snapshotFatal(snap) {
  if (snap == null) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING;
  }
  if (snap.status === REFEREE_SNAPSHOT_STATUS.MISSING) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_MISSING;
  }
  if (snap.status === REFEREE_SNAPSHOT_STATUS.INVALID) {
    return REFEREE_ASSIGNMENT_DIAGNOSTIC_CODE.SNAPSHOT_INVALID;
  }
  return null;
}

function reject(request, causedBy, reasonCodes, extra = {}) {
  const uniqueSorted = [...new Set(reasonCodes.filter(Boolean))].sort(
    compareStableString
  );
  return ownedFreeze({
    ok: false,
    accepted: false,
    failure: createManualAssignmentRejection(causedBy, {
      matchId: request.matchId,
      refereeId: request.refereeId,
      reasonCodes: uniqueSorted,
      details: extra.details || {},
      message: `Manual assignment rejected: ${causedBy}`,
    }),
  });
}
