/**
 * Phase 3F — canonical match status transition helpers.
 * Format rules (lineups pending, WO authority) remain policy-injected.
 */

import { MATCH_STATUS } from "../enums/matchStatuses.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

export const MATCH_ACTION = Object.freeze({
  MARK_READY: "mark_ready",
  SCHEDULE: "schedule",
  REQUIRE_LINEUPS: "require_lineups",
  MARK_READY_TO_START: "mark_ready_to_start",
  START: "start",
  SUSPEND: "suspend",
  RESUME: "resume",
  COMPLETE: "complete",
  CANCEL: "cancel",
  POSTPONE: "postpone",
  RESCHEDULE: "reschedule",
});

/** @type {ReadonlySet<string>} */
export const MATCH_IMMUTABLE_STATUSES = new Set([
  MATCH_STATUS.COMPLETED,
  MATCH_STATUS.CANCELLED,
]);

/**
 * @typedef {Object} MatchTransitionRow
 * @property {string} action
 * @property {string[]} from
 * @property {string} to
 */

/** @type {ReadonlyArray<MatchTransitionRow>} */
export const MATCH_TRANSITION_MATRIX = Object.freeze([
  {
    action: MATCH_ACTION.MARK_READY,
    from: [MATCH_STATUS.DRAFT],
    to: MATCH_STATUS.READY,
  },
  {
    action: MATCH_ACTION.SCHEDULE,
    from: [MATCH_STATUS.DRAFT, MATCH_STATUS.READY],
    to: MATCH_STATUS.SCHEDULED,
  },
  {
    action: MATCH_ACTION.REQUIRE_LINEUPS,
    from: [
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
    ],
    to: MATCH_STATUS.LINEUPS_PENDING,
  },
  {
    action: MATCH_ACTION.MARK_READY_TO_START,
    from: [
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.POSTPONED,
    ],
    to: MATCH_STATUS.READY_TO_START,
  },
  {
    action: MATCH_ACTION.START,
    from: [MATCH_STATUS.READY_TO_START, MATCH_STATUS.SCHEDULED],
    to: MATCH_STATUS.IN_PROGRESS,
  },
  {
    action: MATCH_ACTION.SUSPEND,
    from: [MATCH_STATUS.IN_PROGRESS],
    to: MATCH_STATUS.SUSPENDED,
  },
  {
    action: MATCH_ACTION.RESUME,
    from: [MATCH_STATUS.SUSPENDED],
    to: MATCH_STATUS.IN_PROGRESS,
  },
  {
    action: MATCH_ACTION.COMPLETE,
    from: [MATCH_STATUS.IN_PROGRESS, MATCH_STATUS.SUSPENDED],
    to: MATCH_STATUS.COMPLETED,
  },
  {
    action: MATCH_ACTION.CANCEL,
    from: [
      MATCH_STATUS.DRAFT,
      MATCH_STATUS.READY,
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.READY_TO_START,
      MATCH_STATUS.IN_PROGRESS,
      MATCH_STATUS.SUSPENDED,
      MATCH_STATUS.POSTPONED,
    ],
    to: MATCH_STATUS.CANCELLED,
  },
  {
    action: MATCH_ACTION.POSTPONE,
    from: [
      MATCH_STATUS.SCHEDULED,
      MATCH_STATUS.LINEUPS_PENDING,
      MATCH_STATUS.READY_TO_START,
    ],
    to: MATCH_STATUS.POSTPONED,
  },
  {
    action: MATCH_ACTION.RESCHEDULE,
    from: [MATCH_STATUS.POSTPONED],
    to: MATCH_STATUS.SCHEDULED,
  },
]);

/**
 * @param {string} action
 * @param {string} fromStatus
 * @returns {MatchTransitionRow|null}
 */
export function findMatchTransition(action, fromStatus) {
  const from = String(fromStatus || "").trim().toUpperCase();
  return (
    MATCH_TRANSITION_MATRIX.find(
      (row) => row.action === action && row.from.includes(from)
    ) || null
  );
}

/**
 * @param {{ action: string, fromStatus?: string }} params
 * @returns {{ ok: true, fromStatus: string, toStatus: string, action: string }}
 */
export function assertMatchTransitionAllowed({
  action,
  fromStatus = MATCH_STATUS.DRAFT,
}) {
  const normalizedFrom = String(fromStatus || "")
    .trim()
    .toUpperCase();
  const transition = findMatchTransition(action, normalizedFrom);

  if (!transition) {
    if (MATCH_IMMUTABLE_STATUSES.has(normalizedFrom)) {
      if (normalizedFrom === MATCH_STATUS.COMPLETED) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_COMPLETED_IMMUTABLE,
          "Completed match is immutable",
          { fromStatus: normalizedFrom, action }
        );
      }
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_ALREADY_COMPLETED,
        "Terminal match cannot transition via this action",
        { fromStatus: normalizedFrom, action }
      );
    }
    if (
      normalizedFrom === MATCH_STATUS.IN_PROGRESS &&
      action === MATCH_ACTION.START
    ) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_ALREADY_STARTED,
        "Match already in progress",
        { fromStatus: normalizedFrom, action }
      );
    }
    if (
      action === MATCH_ACTION.SUSPEND &&
      normalizedFrom !== MATCH_STATUS.IN_PROGRESS
    ) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_NOT_IN_PROGRESS,
        "Match is not in progress",
        { fromStatus: normalizedFrom, action }
      );
    }
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_STATE_TRANSITION_INVALID,
      `Cannot ${action} from status "${normalizedFrom}"`,
      { fromStatus: normalizedFrom, action }
    );
  }

  return {
    ok: true,
    fromStatus: normalizedFrom,
    toStatus: transition.to,
    action,
  };
}
