/**
 * Organizer-side check-in operations boundary (E2E-03).
 * Player-facing check-in UX belongs to E2E-04.
 * Does not create a second persistence SoT for mobile QR — ops window only.
 */

import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  ORGANIZER_ERROR_CODE,
  ORGANIZER_LIFECYCLE_STATE,
} from "../constants.js";
import { failOrganizer } from "../errors.js";
import { deepFreeze } from "../fingerprint.js";

/**
 * @param {object} record
 * @returns {Readonly<object>}
 */
export function summarizeOrganizerCheckIn(record) {
  const entries = Array.isArray(record.entries) ? record.entries : [];
  const checkedIn = new Set(
    Array.isArray(record.checkedInParticipantIds)
      ? record.checkedInParticipantIds
      : []
  );
  const eligible = entries.filter((e) => e?.status === ENTRY_OPS_STATUS.ELIGIBLE);
  const notCheckedIn = eligible
    .map((e) => e.participantId)
    .filter((id) => id && !checkedIn.has(id));

  return deepFreeze({
    state: record.checkInState || CHECKIN_STATE.NOT_OPENED,
    required: record.checkInRequired !== false,
    checkedInCount: checkedIn.size,
    eligibleCount: eligible.length,
    notCheckedInParticipantIds: notCheckedIn,
    readyToOpenMatches:
      record.checkInRequired === false ||
      record.checkInState === CHECKIN_STATE.CLOSED ||
      (record.checkInState === CHECKIN_STATE.OPEN && notCheckedIn.length === 0),
  });
}

/**
 * @param {object} record
 * @param {{ requireAllCheckedIn?: boolean }} [options]
 */
export function assertMatchOpsCheckInGate(record, options = {}) {
  const summary = summarizeOrganizerCheckIn(record);
  if (record.checkInRequired === false) {
    return summary;
  }
  if (record.checkInState === CHECKIN_STATE.NOT_OPENED) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.CHECKIN_NOT_OPEN,
      "Check-in must be opened before match operations",
      { checkInState: record.checkInState }
    );
  }
  if (
    options.requireAllCheckedIn !== false &&
    summary.notCheckedInParticipantIds.length > 0 &&
    record.checkInState !== CHECKIN_STATE.CLOSED
  ) {
    // Allow opening match ops when check-in is still open only if all required are in;
    // otherwise require close or complete check-in.
    failOrganizer(
      ORGANIZER_ERROR_CODE.CHECKIN_REQUIRED_MISSING,
      "Required participant check-in is incomplete",
      {
        notCheckedInParticipantIds: summary.notCheckedInParticipantIds,
      }
    );
  }
  return summary;
}

/**
 * @param {object} draft
 */
export function applyOpenCheckIn(draft) {
  if (draft.checkInState === CHECKIN_STATE.OPEN) {
    return { idempotent: true };
  }
  if (draft.checkInState === CHECKIN_STATE.CLOSED) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.CHECKIN_ALREADY_CLOSED,
      "Check-in is already closed and cannot be re-opened in E2E-03 MVP",
      { checkInState: draft.checkInState }
    );
  }
  draft.checkInState = CHECKIN_STATE.OPEN;
  draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.CHECKIN_OPEN;
  return { idempotent: false };
}

/**
 * @param {object} draft
 */
export function applyCloseCheckIn(draft) {
  if (draft.checkInState === CHECKIN_STATE.CLOSED) {
    return { idempotent: true };
  }
  if (draft.checkInState !== CHECKIN_STATE.OPEN) {
    failOrganizer(
      ORGANIZER_ERROR_CODE.CHECKIN_NOT_OPEN,
      "Check-in is not open",
      { checkInState: draft.checkInState }
    );
  }
  draft.checkInState = CHECKIN_STATE.CLOSED;
  draft.lifecycleState = ORGANIZER_LIFECYCLE_STATE.CHECKIN_CLOSED;
  return { idempotent: false };
}
