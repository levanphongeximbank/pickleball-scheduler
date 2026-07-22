/**
 * CORE-12 — structural request validation (fail closed).
 */

import { COURT_ASSIGNMENT_REJECTION_CODE } from "../enums/conflictCodes.js";
import { createCourtAssignmentRequest } from "../contracts/courtAssignmentRequest.js";
import { CourtAssignmentContractError } from "../errors/CourtAssignmentContractError.js";

/**
 * @typedef {{ ok: true, request: object } | { ok: false, code: string, message: string, details: object }} ValidationOutcome
 */

/**
 * Validate and normalize a CourtAssignmentRequest.
 * Does not mutate caller input.
 *
 * @param {unknown} input
 * @returns {ValidationOutcome}
 */
export function validateCourtAssignmentRequest(input) {
  try {
    const request = createCourtAssignmentRequest(
      /** @type {object} */ (input ?? {})
    );
    const structural = validateNormalizedRequest(request);
    if (!structural.ok) return structural;
    return { ok: true, request };
  } catch (err) {
    if (err instanceof CourtAssignmentContractError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        details: err.details ?? {},
      };
    }
    throw err;
  }
}

/**
 * @param {object} request
 * @returns {ValidationOutcome}
 */
export function validateNormalizedRequest(request) {
  const matchIds = new Set();
  for (const match of request.matches) {
    if (matchIds.has(match.matchId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_MATCH_ID,
        `Duplicate matchId: ${match.matchId}`,
        { matchId: match.matchId }
      );
    }
    matchIds.add(match.matchId);

    if (match.competitionId !== request.competitionId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.SCOPE_MISMATCH,
        `Match ${match.matchId} competitionId does not match request`,
        {
          matchId: match.matchId,
          competitionId: match.competitionId,
          requestCompetitionId: request.competitionId,
        }
      );
    }
    if (match.tenantId != null && match.tenantId !== request.tenantId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_TENANT_REFERENCE,
        `Match ${match.matchId} tenantId does not match request`,
        { matchId: match.matchId, tenantId: match.tenantId }
      );
    }
    if (match.venueId != null && match.venueId !== request.venueId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_VENUE_REFERENCE,
        `Match ${match.matchId} venueId does not match request`,
        { matchId: match.matchId, venueId: match.venueId }
      );
    }
    if (match.clubId != null && match.clubId !== request.clubId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_CLUB_REFERENCE,
        `Match ${match.matchId} clubId does not match request`,
        { matchId: match.matchId, clubId: match.clubId }
      );
    }
    if (
      match.timezone != null &&
      request.timezone != null &&
      match.timezone !== request.timezone
    ) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.SCOPE_MISMATCH,
        `Match ${match.matchId} timezone does not match request`,
        { matchId: match.matchId, timezone: match.timezone }
      );
    }
    if (match.manualCourtLock && !match.existingCourtId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.INVALID_REQUEST,
        `Match ${match.matchId} has manualCourtLock without existingCourtId`,
        { matchId: match.matchId }
      );
    }
  }

  const courtIds = new Set();
  for (const court of request.courts) {
    if (courtIds.has(court.courtId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_COURT_ID,
        `Duplicate courtId: ${court.courtId}`,
        { courtId: court.courtId }
      );
    }
    courtIds.add(court.courtId);

    if (court.venueId !== request.venueId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_VENUE_REFERENCE,
        `Court ${court.courtId} venueId does not match request`,
        { courtId: court.courtId, venueId: court.venueId }
      );
    }
    if (court.clubId !== request.clubId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_CLUB_REFERENCE,
        `Court ${court.courtId} clubId does not match request`,
        { courtId: court.courtId, clubId: court.clubId }
      );
    }
    if (court.tenantId != null && court.tenantId !== request.tenantId) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.CROSS_TENANT_REFERENCE,
        `Court ${court.courtId} tenantId does not match request`,
        { courtId: court.courtId, tenantId: court.tenantId }
      );
    }
  }

  if (
    request.lockedAssignments.length > 0 &&
    !request.policy.acceptLockedAssignments
  ) {
    return fail(
      COURT_ASSIGNMENT_REJECTION_CODE.LOCKS_NOT_ACCEPTED,
      "Locked assignments present but policy.acceptLockedAssignments is false",
      { lockCount: request.lockedAssignments.length }
    );
  }

  const lockMatchIds = new Set();
  for (const lock of request.lockedAssignments) {
    if (lockMatchIds.has(lock.matchId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_LOCK,
        `Duplicate locked assignment for matchId: ${lock.matchId}`,
        { matchId: lock.matchId }
      );
    }
    lockMatchIds.add(lock.matchId);

    if (!matchIds.has(lock.matchId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.LOCK_REFERENCES_UNKNOWN_MATCH,
        `Locked assignment references unknown matchId: ${lock.matchId}`,
        { matchId: lock.matchId }
      );
    }
    if (!courtIds.has(lock.courtId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.LOCK_REFERENCES_UNKNOWN_COURT,
        `Locked assignment references unknown courtId: ${lock.courtId}`,
        { courtId: lock.courtId, matchId: lock.matchId }
      );
    }
  }

  // Implicit locks from match.manualCourtLock + existingCourtId
  for (const match of request.matches) {
    if (!match.manualCourtLock) continue;
    if (lockMatchIds.has(match.matchId)) {
      const existing = request.lockedAssignments.find(
        (l) => l.matchId === match.matchId
      );
      if (existing && existing.courtId !== match.existingCourtId) {
        return fail(
          COURT_ASSIGNMENT_REJECTION_CODE.DUPLICATE_LOCK,
          `Contradictory lock for matchId: ${match.matchId}`,
          {
            matchId: match.matchId,
            lockedCourtId: existing.courtId,
            existingCourtId: match.existingCourtId,
          }
        );
      }
      continue;
    }
    if (!courtIds.has(match.existingCourtId)) {
      return fail(
        COURT_ASSIGNMENT_REJECTION_CODE.LOCK_REFERENCES_UNKNOWN_COURT,
        `manualCourtLock references unknown courtId: ${match.existingCourtId}`,
        { matchId: match.matchId, courtId: match.existingCourtId }
      );
    }
  }

  return { ok: true, request };
}

/**
 * @param {string} code
 * @param {string} message
 * @param {object} details
 * @returns {{ ok: false, code: string, message: string, details: object }}
 */
function fail(code, message, details) {
  return { ok: false, code, message, details };
}
