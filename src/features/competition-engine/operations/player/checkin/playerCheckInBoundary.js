/**
 * Player-side check-in boundary (E2E-04).
 * Compatible with E2E-03 Organizer check-in window state.
 * Does not let the client self-declare eligibility.
 */

import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
} from "../../constants.js";
import { PLAYER_CHECKIN_MARK, PLAYER_ERROR_CODE } from "../constants.js";
import { failPlayer } from "../errors.js";
import { deepFreeze } from "../../fingerprint.js";

/**
 * @param {object} record
 * @param {{ participantId: string }} ownership
 */
export function summarizePlayerCheckIn(record, ownership) {
  const checkedIn = new Set(
    Array.isArray(record.checkedInParticipantIds)
      ? record.checkedInParticipantIds.map((id) => String(id))
      : []
  );
  const participantId = String(ownership.participantId || "").trim();
  const mark = checkedIn.has(participantId)
    ? PLAYER_CHECKIN_MARK.CHECKED_IN
    : PLAYER_CHECKIN_MARK.NOT_CHECKED_IN;

  return deepFreeze({
    windowState: record.checkInState || CHECKIN_STATE.NOT_OPENED,
    required: record.checkInRequired !== false,
    participantId,
    mark,
    checkedIn: mark === PLAYER_CHECKIN_MARK.CHECKED_IN,
    checkedInCount: checkedIn.size,
  });
}

/**
 * @param {object} record
 * @param {{ participantId: string, entry?: { status?: string } }} ownership
 */
export function assertPlayerCheckInAllowed(record, ownership) {
  const windowState = record.checkInState || CHECKIN_STATE.NOT_OPENED;
  if (windowState === CHECKIN_STATE.NOT_OPENED) {
    failPlayer(
      PLAYER_ERROR_CODE.CHECKIN_NOT_OPEN,
      "Check-in window is not open",
      { checkInState: windowState }
    );
  }
  if (windowState === CHECKIN_STATE.CLOSED) {
    failPlayer(
      PLAYER_ERROR_CODE.CHECKIN_CLOSED,
      "Check-in window is closed",
      { checkInState: windowState }
    );
  }

  const status = String(ownership.entry?.status || ENTRY_OPS_STATUS.ELIGIBLE)
    .trim()
    .toUpperCase();
  if (status !== ENTRY_OPS_STATUS.ELIGIBLE) {
    failPlayer(
      PLAYER_ERROR_CODE.ENTRY_INELIGIBLE,
      "Only eligible entries may check in; client cannot self-confirm eligibility",
      { status, participantId: ownership.participantId }
    );
  }

  return summarizePlayerCheckIn(record, ownership);
}

/**
 * Mutates draft.checkedInParticipantIds idempotently.
 * @param {object} draft
 * @param {string} participantId
 * @returns {{ idempotent: boolean }}
 */
export function applyPlayerCheckInMark(draft, participantId) {
  const id = String(participantId || "").trim();
  if (!id) {
    failPlayer(
      PLAYER_ERROR_CODE.INVALID_INPUT,
      "participantId is required for check-in",
      {}
    );
  }
  const list = Array.isArray(draft.checkedInParticipantIds)
    ? [...draft.checkedInParticipantIds]
    : [];
  if (list.includes(id)) {
    draft.checkedInParticipantIds = list;
    return { idempotent: true };
  }
  list.push(id);
  list.sort();
  draft.checkedInParticipantIds = list;
  return { idempotent: false };
}
