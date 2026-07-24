/**
 * Organizer operational state projection — aggregates canonical readiness only.
 * Does not compute standings/schedule/eligibility/bracket engines.
 */

import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  MATCH_OPS_STATE,
  ORGANIZER_ACTION,
  ORGANIZER_BLOCKER_CODE,
  ORGANIZER_LIFECYCLE_STATE,
  PARTICIPANT_FIELD_STATE,
  PUBLICATION_OPS_STATE,
} from "../constants.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
  isNonEmptyString,
} from "../fingerprint.js";
import {
  ORGANIZER_ACTION_PERMISSION_MAP,
  resolveOrganizerActionPermissions,
} from "../permissions/organizerActionMap.js";

/**
 * @param {object} record
 * @returns {object[]}
 */
function collectBlockingIssues(record) {
  /** @type {object[]} */
  const issues = [];
  const entries = Array.isArray(record.entries) ? record.entries : [];

  const pendingOrBad = entries.filter((e) => {
    const status = String(e?.status || "");
    return (
      status === ENTRY_OPS_STATUS.PENDING ||
      status === ENTRY_OPS_STATUS.INELIGIBLE ||
      status === ENTRY_OPS_STATUS.INVALID ||
      status === ENTRY_OPS_STATUS.WAITLISTED
    );
  });
  if (
    record.participantFieldState !== PARTICIPANT_FIELD_STATE.LOCKED &&
    pendingOrBad.length > 0
  ) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.ELIGIBILITY_UNRESOLVED,
      message: "Unresolved eligibility or pending entries block participant lock",
      count: pendingOrBad.length,
    });
  }
  if (
    record.participantFieldState === PARTICIPANT_FIELD_STATE.OPEN &&
    entries.length === 0
  ) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.PARTICIPANT_FIELD_INCOMPLETE,
      message: "Participant field is empty",
    });
  }
  if (!record.poolCompositionFingerprint) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.POOL_COMPOSITION_MISSING,
      message: "Pool composition has not been prepared",
    });
  }
  if (!record.scheduleCertified || !record.scheduleFingerprint) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.SCHEDULE_INCOMPLETE,
      message: "Certified schedule is incomplete",
    });
  }
  if (!record.courtAssignmentConfirmed || !record.courtAssignmentFingerprint) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.COURT_ASSIGNMENT_INCOMPLETE,
      message: "Court assignment is incomplete",
    });
  }
  if (record.unresolvedTie) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.UNRESOLVED_TIE,
      message: "Unresolved tie blocks knockout activation",
    });
  }
  if (!record.qualificationReady && record.poolCompositionFingerprint) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.QUALIFICATION_NOT_READY,
      message: "Qualification readiness is not satisfied",
    });
  }

  const matches = Array.isArray(record.matches) ? record.matches : [];
  const active = matches.filter((m) =>
    ["ACTIVE", "IN_PROGRESS", "STARTED", "PAUSED", "SUSPENDED"].includes(
      String(m?.status || "").toUpperCase()
    )
  );
  const incomplete = matches.filter((m) => {
    const status = String(m?.status || "").toUpperCase();
    return status && status !== "COMPLETED" && status !== "CANCELLED";
  });
  if (active.length > 0) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.ACTIVE_MATCHES,
      message: "Active matches block completion/archive",
      count: active.length,
    });
  }
  if (incomplete.length > 0 && record.completionConfirmed !== true) {
    issues.push({
      code: ORGANIZER_BLOCKER_CODE.INCOMPLETE_MATCHES,
      message: "Incomplete matches remain",
      count: incomplete.length,
    });
  }
  if (
    record.checkInRequired &&
    record.checkInState === CHECKIN_STATE.NOT_OPENED &&
    record.matchOpsState === MATCH_OPS_STATE.CLOSED
  ) {
    // informational readiness only when opening matches is next
  }
  return issues;
}

/**
 * @param {object} record
 * @param {Set<string>} grantedPermissions
 * @returns {{ allowed: object[], denied: object[] }}
 */
function buildActionMatrix(record, grantedPermissions) {
  const issues = collectBlockingIssues(record);
  const issueCodes = new Set(issues.map((i) => i.code));
  const allowed = [];
  const denied = [];

  for (const action of Object.keys(ORGANIZER_ACTION_PERMISSION_MAP)) {
    const mapping = resolveOrganizerActionPermissions(action);
    const hasPerm = mapping.requiredPermissions.some((p) =>
      grantedPermissions.has(p)
    );
    if (!hasPerm) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: ORGANIZER_BLOCKER_CODE.PERMISSION_DENIED,
        requiredPermissions: [...mapping.requiredPermissions],
      });
      continue;
    }

    let blocked = null;
    if (
      action === ORGANIZER_ACTION.PARTICIPANTS_LOCK &&
      (issueCodes.has(ORGANIZER_BLOCKER_CODE.ELIGIBILITY_UNRESOLVED) ||
        issueCodes.has(ORGANIZER_BLOCKER_CODE.PARTICIPANT_FIELD_INCOMPLETE))
    ) {
      blocked = ORGANIZER_BLOCKER_CODE.PARTICIPANT_FIELD_INCOMPLETE;
    } else if (
      action === ORGANIZER_ACTION.DRAW_PREPARE &&
      record.participantFieldState !== PARTICIPANT_FIELD_STATE.LOCKED
    ) {
      blocked = ORGANIZER_BLOCKER_CODE.PARTICIPANT_FIELD_INCOMPLETE;
    } else if (
      action === ORGANIZER_ACTION.SCHEDULE_PREPARE &&
      !record.poolCompositionFingerprint
    ) {
      blocked = ORGANIZER_BLOCKER_CODE.POOL_COMPOSITION_MISSING;
    } else if (
      action === ORGANIZER_ACTION.COURTS_CONFIRM &&
      (!record.scheduleCertified || !isNonEmptyString(record.venueId))
    ) {
      blocked = !isNonEmptyString(record.venueId)
        ? ORGANIZER_BLOCKER_CODE.MISSING_VENUE
        : ORGANIZER_BLOCKER_CODE.SCHEDULE_INCOMPLETE;
    } else if (
      action === ORGANIZER_ACTION.MATCHES_CONTROL &&
      record.checkInRequired &&
      record.checkInState !== CHECKIN_STATE.CLOSED &&
      record.checkInState !== CHECKIN_STATE.OPEN
    ) {
      // opening match ops typically needs check-in at least opened; close preferred
      if (record.checkInState === CHECKIN_STATE.NOT_OPENED) {
        blocked = ORGANIZER_BLOCKER_CODE.CHECKIN_NOT_OPEN;
      }
    } else if (
      action === ORGANIZER_ACTION.KNOCKOUT_ACTIVATE &&
      (record.unresolvedTie || !record.qualificationReady)
    ) {
      blocked = record.unresolvedTie
        ? ORGANIZER_BLOCKER_CODE.UNRESOLVED_TIE
        : ORGANIZER_BLOCKER_CODE.QUALIFICATION_NOT_READY;
    } else if (
      action === ORGANIZER_ACTION.COMPLETE &&
      (issueCodes.has(ORGANIZER_BLOCKER_CODE.ACTIVE_MATCHES) ||
        issueCodes.has(ORGANIZER_BLOCKER_CODE.INCOMPLETE_MATCHES))
    ) {
      blocked = issueCodes.has(ORGANIZER_BLOCKER_CODE.ACTIVE_MATCHES)
        ? ORGANIZER_BLOCKER_CODE.ACTIVE_MATCHES
        : ORGANIZER_BLOCKER_CODE.INCOMPLETE_MATCHES;
    } else if (
      action === ORGANIZER_ACTION.ARCHIVE_PREPARE &&
      record.publicationState !== PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED
    ) {
      blocked = ORGANIZER_BLOCKER_CODE.FINAL_PUBLICATION_REQUIRED;
    }

    if (blocked) {
      denied.push({
        action,
        capability: mapping.capability,
        reasonCode: blocked,
        requiredPermissions: [...mapping.requiredPermissions],
      });
    } else {
      allowed.push({
        action,
        capability: mapping.capability,
        requiredPermissions: [...mapping.requiredPermissions],
      });
    }
  }

  return { allowed, denied };
}

/**
 * @param {{
 *   record: object,
 *   grantedPermissions?: string[],
 * }} input
 */
export function buildOrganizerOperationsProjection(input) {
  const record = input.record && typeof input.record === "object" ? input.record : {};
  const grantedPermissions = new Set(
    Array.isArray(input.grantedPermissions)
      ? input.grantedPermissions.map((p) => String(p))
      : []
  );

  const entries = Array.isArray(record.entries) ? record.entries : [];
  const eligibleCount = entries.filter(
    (e) => e?.status === ENTRY_OPS_STATUS.ELIGIBLE
  ).length;
  const matches = Array.isArray(record.matches) ? record.matches : [];
  const checkedIn = Array.isArray(record.checkedInParticipantIds)
    ? record.checkedInParticipantIds
    : [];

  const blockingIssues = collectBlockingIssues(record);
  const { allowed, denied } = buildActionMatrix(record, grantedPermissions);

  const readiness = Object.freeze({
    eligibility:
      entries.length > 0 &&
      entries.every(
        (e) =>
          e?.status === ENTRY_OPS_STATUS.ELIGIBLE ||
          e?.status === ENTRY_OPS_STATUS.WITHDRAWN
      ),
    participantFieldLocked:
      record.participantFieldState === PARTICIPANT_FIELD_STATE.LOCKED,
    divisionCategory: true,
    poolComposition: Boolean(record.poolCompositionFingerprint),
    poolMatchPlan: Boolean(record.poolMatchPlanFingerprint),
    schedule: Boolean(record.scheduleCertified && record.scheduleFingerprint),
    courtAssignment: Boolean(
      record.courtAssignmentConfirmed && record.courtAssignmentFingerprint
    ),
    referee: record.refereeReadiness === true,
    checkIn:
      record.checkInState === CHECKIN_STATE.OPEN ||
      record.checkInState === CHECKIN_STATE.CLOSED,
    liveOperations: record.matchOpsState === MATCH_OPS_STATE.OPEN,
    resultValidation: true,
    standings: record.standingsReady === true,
    qualification: record.qualificationReady === true,
    knockout: record.knockoutActive === true,
    completion: record.completionConfirmed === true,
    archive: record.lifecycleState === ORGANIZER_LIFECYCLE_STATE.ARCHIVE_READY,
  });

  const projection = {
    competitionId: record.competitionId ?? null,
    tenantId: record.tenantId ?? null,
    venueId: record.venueId ?? null,
    templateId: record.templateId ?? null,
    templateVersion: record.templateVersion ?? null,
    formatVersion: record.formatVersion ?? null,
    lifecycleState: record.lifecycleState || ORGANIZER_LIFECYCLE_STATE.UNINITIALIZED,
    publicationState: record.publicationState || PUBLICATION_OPS_STATE.NONE,
    participantFieldState:
      record.participantFieldState || PARTICIPANT_FIELD_STATE.OPEN,
    eligibilityReadiness: readiness.eligibility,
    divisionCategoryReadiness: readiness.divisionCategory,
    poolCompositionReadiness: readiness.poolComposition,
    poolMatchPlanReadiness: readiness.poolMatchPlan,
    scheduleReadiness: readiness.schedule,
    courtAssignmentReadiness: readiness.courtAssignment,
    refereeReadiness: readiness.referee,
    checkInState: record.checkInState || CHECKIN_STATE.NOT_OPENED,
    liveOperationsState: record.matchOpsState || MATCH_OPS_STATE.CLOSED,
    resultValidationReadiness: readiness.resultValidation,
    standingsReadiness: readiness.standings,
    qualificationReadiness: readiness.qualification,
    knockoutReadiness: readiness.knockout,
    completionReadiness: readiness.completion,
    archiveReadiness: readiness.archive,
    readiness,
    participantSummary: Object.freeze({
      total: entries.length,
      eligible: eligibleCount,
      pending: entries.filter((e) => e?.status === ENTRY_OPS_STATUS.PENDING)
        .length,
      ineligible: entries.filter((e) => e?.status === ENTRY_OPS_STATUS.INELIGIBLE)
        .length,
      withdrawn: entries.filter((e) => e?.status === ENTRY_OPS_STATUS.WITHDRAWN)
        .length,
      waitlisted: entries.filter((e) => e?.status === ENTRY_OPS_STATUS.WAITLISTED)
        .length,
      invalid: entries.filter((e) => e?.status === ENTRY_OPS_STATUS.INVALID)
        .length,
    }),
    checkInSummary: Object.freeze({
      state: record.checkInState || CHECKIN_STATE.NOT_OPENED,
      checkedInCount: checkedIn.length,
      notCheckedInParticipantIds: entries
        .filter((e) => e?.status === ENTRY_OPS_STATUS.ELIGIBLE)
        .map((e) => e.participantId)
        .filter((id) => id && !checkedIn.includes(id)),
    }),
    matchSummary: Object.freeze({
      total: matches.length,
      ready: matches.filter((m) => String(m?.status || "").toUpperCase() === "READY")
        .length,
      blocked: matches.filter((m) => String(m?.status || "").toUpperCase() === "BLOCKED")
        .length,
      active: matches.filter((m) =>
        ["ACTIVE", "IN_PROGRESS", "STARTED", "PAUSED", "SUSPENDED"].includes(
          String(m?.status || "").toUpperCase()
        )
      ).length,
      complete: matches.filter(
        (m) => String(m?.status || "").toUpperCase() === "COMPLETED"
      ).length,
    }),
    blockingIssues: Object.freeze(blockingIssues.map((i) => Object.freeze(i))),
    allowedOrganizerActions: Object.freeze(allowed.map((a) => Object.freeze(a))),
    deniedOrganizerActions: Object.freeze(denied.map((d) => Object.freeze(d))),
    revision: Number(record.revision || 0),
  };

  const fingerprint = computeOrganizerFingerprint(
    {
      competitionId: projection.competitionId,
      tenantId: projection.tenantId,
      venueId: projection.venueId,
      lifecycleState: projection.lifecycleState,
      publicationState: projection.publicationState,
      participantFieldState: projection.participantFieldState,
      readiness: projection.readiness,
      participantSummary: projection.participantSummary,
      checkInSummary: projection.checkInSummary,
      matchSummary: projection.matchSummary,
      blockingIssues: projection.blockingIssues,
      allowed: projection.allowedOrganizerActions,
      denied: projection.deniedOrganizerActions,
      revision: projection.revision,
      poolCompositionFingerprint: record.poolCompositionFingerprint,
      scheduleFingerprint: record.scheduleFingerprint,
      courtAssignmentFingerprint: record.courtAssignmentFingerprint,
      knockoutFingerprint: record.knockoutFingerprint,
    },
    "e2e03-proj"
  );

  return deepFreeze({
    ...projection,
    projectionFingerprint: fingerprint,
  });
}
