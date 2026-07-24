/**
 * Enforce canonical referee assignment scope (CORE-13 reuse, ops boundary).
 */

import {
  REFEREE_ASSIGNMENT_OPS_STATUS,
  REFEREE_ERROR_CODE,
} from "../constants.js";
import { failReferee } from "../errors.js";
import { isNonEmptyString } from "../../fingerprint.js";

const ACTIVE_STATUSES = new Set([
  REFEREE_ASSIGNMENT_OPS_STATUS.ASSIGNED,
  REFEREE_ASSIGNMENT_OPS_STATUS.ACKNOWLEDGED,
  REFEREE_ASSIGNMENT_OPS_STATUS.READY,
]);

/**
 * @param {{
 *   assignment: object|null|undefined,
 *   refereeId: string,
 *   tenantId: string,
 *   competitionId: string,
 *   venueId?: string|null,
 *   matchId?: string|null,
 * }} input
 */
export function assertRefereeAssignmentScope(input) {
  const assignment = input.assignment;
  if (!assignment || typeof assignment !== "object") {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Referee is not assigned to this match",
      { matchId: input.matchId || null, refereeId: input.refereeId }
    );
  }

  const refereeId = String(input.refereeId || "").trim();
  const assignedRefereeId = String(
    assignment.refereeId || assignment.assigneeId || ""
  ).trim();
  if (!refereeId || assignedRefereeId !== refereeId) {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Referee identity does not match assignment",
      { refereeId, assignedRefereeId, matchId: assignment.matchId || null }
    );
  }

  const tenantId = String(input.tenantId || "").trim();
  if (
    isNonEmptyString(assignment.tenantId) &&
    String(assignment.tenantId).trim() !== tenantId
  ) {
    failReferee(
      REFEREE_ERROR_CODE.CROSS_TENANT_REJECTED,
      "Assignment tenant mismatch",
      { tenantId, assignmentTenantId: assignment.tenantId }
    );
  }

  const competitionId = String(input.competitionId || "").trim();
  if (
    isNonEmptyString(assignment.competitionId) &&
    String(assignment.competitionId).trim() !== competitionId
  ) {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Assignment competition mismatch",
      { competitionId, assignmentCompetitionId: assignment.competitionId }
    );
  }

  if (
    isNonEmptyString(input.venueId) &&
    isNonEmptyString(assignment.venueId) &&
    String(assignment.venueId).trim() !== String(input.venueId).trim()
  ) {
    failReferee(
      REFEREE_ERROR_CODE.MISSING_VENUE,
      "Assignment venue mismatch",
      { venueId: input.venueId, assignmentVenueId: assignment.venueId }
    );
  }

  if (
    isNonEmptyString(input.matchId) &&
    isNonEmptyString(assignment.matchId) &&
    String(assignment.matchId).trim() !== String(input.matchId).trim()
  ) {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Assignment match mismatch",
      { matchId: input.matchId, assignmentMatchId: assignment.matchId }
    );
  }

  const status = String(assignment.status || "").toUpperCase();
  if (
    status === REFEREE_ASSIGNMENT_OPS_STATUS.RELEASED ||
    status === REFEREE_ASSIGNMENT_OPS_STATUS.REASSIGNED
  ) {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Assignment is no longer active",
      { status, matchId: assignment.matchId || null }
    );
  }

  if (status && !ACTIVE_STATUSES.has(status)) {
    failReferee(
      REFEREE_ERROR_CODE.NOT_ASSIGNED,
      "Assignment status does not allow match control",
      { status }
    );
  }

  return Object.freeze({ ...assignment });
}

/**
 * @param {string} status
 * @returns {boolean}
 */
export function isActiveRefereeAssignmentStatus(status) {
  return ACTIVE_STATUSES.has(String(status || "").toUpperCase());
}
