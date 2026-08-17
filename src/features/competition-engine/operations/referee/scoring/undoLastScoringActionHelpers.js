/**
 * Server-side eligibility + ledger helpers for UNDO_LAST_SCORING_ACTION.
 * CORE-16 SUPERSEDE_EVENT remains the correction authority.
 */

import { SCORING_EVENT_TYPE } from "../../../../competition-core/scoring/index.js";
import { MATCH_STATUS } from "../../../../competition-core/matches/index.js";
import {
  REFEREE_ERROR_CODE,
  REFEREE_VALIDATION_OPS_STATUS,
} from "../constants.js";
import { failReferee } from "../errors.js";

export const SCORING_ACTION_LEDGER_KIND = Object.freeze({
  SCORING: "SCORING",
  CHANGE_ENDS: "CHANGE_ENDS",
  SUPERSEDE: "SUPERSEDE",
});

/**
 * @param {object} state CORE-16 scoring state
 * @returns {object|null}
 */
export function findLastEligibleScoringEvent(state) {
  const events = Array.isArray(state?.events) ? state.events : [];
  const superseded = new Set(state?.supersededEventIds || []);
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (!ev || superseded.has(ev.eventId)) continue;
    if (
      ev.eventType === SCORING_EVENT_TYPE.POINT_RECORDED ||
      ev.eventType === SCORING_EVENT_TYPE.POINT_DENIED_NO_SCORE
    ) {
      return ev;
    }
  }
  return null;
}

/**
 * @param {object[]} ledger
 * @param {string} eventId
 */
export function findScoringLedgerEntry(ledger, eventId) {
  const list = Array.isArray(ledger) ? ledger : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const row = list[i];
    if (
      row?.kind === SCORING_ACTION_LEDGER_KIND.SCORING &&
      String(row.eventId) === String(eventId)
    ) {
      return row;
    }
  }
  return null;
}

/**
 * True when a CHANGE_ENDS ACK was recorded after the target scoring action.
 * @param {object[]} ledger
 * @param {object} scoringEntry
 */
export function hasChangeEndAckAfterScoring(ledger, scoringEntry) {
  if (!scoringEntry) return false;
  const list = Array.isArray(ledger) ? ledger : [];
  const scoringIdx = list.findIndex(
    (row) =>
      row?.kind === SCORING_ACTION_LEDGER_KIND.SCORING &&
      String(row.eventId) === String(scoringEntry.eventId)
  );
  if (scoringIdx < 0) {
    // Fall back to revision ordering when ledger entry missing event linkage.
    const at = Number(scoringEntry.atRevision || 0);
    return list.some(
      (row) =>
        row?.kind === SCORING_ACTION_LEDGER_KIND.CHANGE_ENDS &&
        Number(row.atRevision || 0) > at
    );
  }
  for (let i = scoringIdx + 1; i < list.length; i += 1) {
    if (list[i]?.kind === SCORING_ACTION_LEDGER_KIND.CHANGE_ENDS) return true;
  }
  return false;
}

/**
 * Fail-closed eligibility for quick scoring undo (v1).
 * @param {{
 *   match?: object|null,
 *   session?: object|null,
 *   validation?: object|null,
 *   court?: object|null,
 *   expectedVersion?: number|string|null,
 *   actualVersion?: number|string|null,
 *   targetEvent?: object|null,
 *   ledger?: object[],
 * }} input
 */
export function assertUndoLastScoringEligible(input = {}) {
  const match = input.match;
  const status = String(match?.status || "").toUpperCase();
  if (status !== MATCH_STATUS.IN_PROGRESS && status !== "ACTIVE") {
    failReferee(
      REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE,
      "Undo requires an editable IN_PROGRESS match",
      { status: status || null }
    );
  }

  const validation = input.validation;
  const validationStatus = String(validation?.status || "").toUpperCase();
  if (validationStatus === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED) {
    failReferee(
      REFEREE_ERROR_CODE.RESULT_BOUNDARY_BLOCKED,
      "Quick scoring undo rejected after accepted official result",
      { validationStatus }
    );
  }

  if (
    status === MATCH_STATUS.COMPLETED ||
    status === MATCH_STATUS.CANCELLED ||
    status === "LOCKED" ||
    status === "FINAL"
  ) {
    failReferee(
      REFEREE_ERROR_CODE.LIFECYCLE_BOUNDARY_BLOCKED,
      "Quick scoring undo rejected for terminal/locked lifecycle",
      { status }
    );
  }

  if (input.expectedVersion != null && input.actualVersion != null) {
    if (Number(input.expectedVersion) !== Number(input.actualVersion)) {
      failReferee(
        REFEREE_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        {
          expectedVersion: input.expectedVersion,
          actualVersion: input.actualVersion,
          stale: true,
        }
      );
    }
  }

  const session = input.session;
  if (!session?.state) {
    failReferee(
      REFEREE_ERROR_CODE.SCORE_ENTRY_NOT_READY,
      "Score entry session is required before undo",
      {}
    );
  }

  const targetEvent = input.targetEvent;
  if (!targetEvent) {
    failReferee(
      REFEREE_ERROR_CODE.UNDO_NOT_ELIGIBLE,
      "No eligible scoring action to undo",
      {}
    );
  }

  const ledger = input.ledger || session.actionLedger || [];
  const scoringEntry =
    findScoringLedgerEntry(ledger, targetEvent.eventId) || {
      eventId: targetEvent.eventId,
      atRevision: targetEvent.revision || targetEvent.sequence,
      causedSideChangeDue: false,
    };

  if (hasChangeEndAckAfterScoring(ledger, scoringEntry)) {
    failReferee(
      REFEREE_ERROR_CODE.FAIL_CLOSED_UNSUPPORTED_FOR_QUICK_UNDO,
      "Quick undo rejected after confirmChangeEnds ACK (v1)",
      {
        targetEventId: targetEvent.eventId,
        policy: "CHANGE_END_ACKED_UNSUPPORTED_FOR_QUICK_UNDO_V1",
      }
    );
  }

  const court = input.court || {};
  if (
    scoringEntry.causedSideChangeDue === true &&
    court.sideChangeAcknowledgedAtThreshold != null
  ) {
    failReferee(
      REFEREE_ERROR_CODE.FAIL_CLOSED_UNSUPPORTED_FOR_QUICK_UNDO,
      "Quick undo rejected after confirmChangeEnds ACK (v1)",
      {
        targetEventId: targetEvent.eventId,
        sideChangeAcknowledgedAtThreshold:
          court.sideChangeAcknowledgedAtThreshold,
        policy: "CHANGE_END_ACKED_UNSUPPORTED_FOR_QUICK_UNDO_V1",
      }
    );
  }

  return Object.freeze({
    targetEvent,
    scoringEntry,
    ledger,
  });
}

/**
 * Server-derived undo availability for F5 / projections.
 * @param {object} input same shape as assertUndoLastScoringEligible
 */
export function evaluateUndoAvailability(input = {}) {
  try {
    assertUndoLastScoringEligible(input);
    return Object.freeze({
      undoAvailable: true,
      reasonCode: null,
    });
  } catch (err) {
    return Object.freeze({
      undoAvailable: false,
      reasonCode: err?.code || REFEREE_ERROR_CODE.UNDO_NOT_ELIGIBLE,
      message: err?.message || null,
    });
  }
}
