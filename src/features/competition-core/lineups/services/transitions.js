/**
 * CORE-06 Phase 1C — canonical lineup status transition helpers.
 * Role/deadline enforcement remains policy-injected.
 *
 * Override is a compound domain operation: prior revision → SUPERSEDED,
 * new head revision → LOCKED (requires republish). Matrix documents the
 * supersede step; the domain service applies the new LOCKED head.
 */

import { COMPETITION_LINEUP_STATUS } from "../../participants/enums/statuses.js";
import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { LineupRuntimeError } from "../errors/LineupRuntimeError.js";

export const LINEUP_ACTION = Object.freeze({
  SAVE_DRAFT: "save_draft",
  SUBMIT: "submit",
  LOCK: "lock",
  PUBLISH: "publish",
  OVERRIDE: "override",
  VOID: "void",
});

/** @type {ReadonlySet<string>} */
export const LINEUP_IMMUTABLE_STATUSES = new Set([
  COMPETITION_LINEUP_STATUS.LOCKED,
  COMPETITION_LINEUP_STATUS.PUBLISHED,
  COMPETITION_LINEUP_STATUS.SUPERSEDED,
  COMPETITION_LINEUP_STATUS.VOIDED,
]);

/**
 * @typedef {Object} LineupTransitionRow
 * @property {string} action
 * @property {string[]} from
 * @property {string} to
 */

/** @type {ReadonlyArray<LineupTransitionRow>} */
export const LINEUP_TRANSITION_MATRIX = Object.freeze([
  {
    action: LINEUP_ACTION.SAVE_DRAFT,
    from: [
      COMPETITION_LINEUP_STATUS.DRAFT,
      COMPETITION_LINEUP_STATUS.SUBMITTED,
    ],
    to: COMPETITION_LINEUP_STATUS.DRAFT,
  },
  {
    action: LINEUP_ACTION.SUBMIT,
    from: [
      COMPETITION_LINEUP_STATUS.DRAFT,
      COMPETITION_LINEUP_STATUS.SUBMITTED,
    ],
    to: COMPETITION_LINEUP_STATUS.SUBMITTED,
  },
  {
    action: LINEUP_ACTION.LOCK,
    from: [
      COMPETITION_LINEUP_STATUS.DRAFT,
      COMPETITION_LINEUP_STATUS.SUBMITTED,
    ],
    to: COMPETITION_LINEUP_STATUS.LOCKED,
  },
  {
    action: LINEUP_ACTION.PUBLISH,
    from: [COMPETITION_LINEUP_STATUS.LOCKED],
    to: COMPETITION_LINEUP_STATUS.PUBLISHED,
  },
  {
    action: LINEUP_ACTION.OVERRIDE,
    from: [
      COMPETITION_LINEUP_STATUS.LOCKED,
      COMPETITION_LINEUP_STATUS.PUBLISHED,
    ],
    to: COMPETITION_LINEUP_STATUS.SUPERSEDED,
  },
  {
    action: LINEUP_ACTION.VOID,
    from: [
      COMPETITION_LINEUP_STATUS.DRAFT,
      COMPETITION_LINEUP_STATUS.SUBMITTED,
      COMPETITION_LINEUP_STATUS.LOCKED,
    ],
    to: COMPETITION_LINEUP_STATUS.VOIDED,
  },
]);

/**
 * @param {string} action
 * @param {string} fromStatus
 * @returns {LineupTransitionRow|null}
 */
export function findLineupTransition(action, fromStatus) {
  const from = String(fromStatus || "").trim().toUpperCase();
  return (
    LINEUP_TRANSITION_MATRIX.find(
      (row) => row.action === action && row.from.includes(from)
    ) || null
  );
}

/**
 * @param {{ action: string, fromStatus?: string }} params
 * @returns {{ ok: true, fromStatus: string, toStatus: string, action: string } | never}
 */
export function assertLineupTransitionAllowed({
  action,
  fromStatus = COMPETITION_LINEUP_STATUS.DRAFT,
}) {
  const normalizedFrom = String(fromStatus || "")
    .trim()
    .toUpperCase();
  const transition = findLineupTransition(action, normalizedFrom);

  if (!transition) {
    if (LINEUP_IMMUTABLE_STATUSES.has(normalizedFrom)) {
      if (normalizedFrom === COMPETITION_LINEUP_STATUS.PUBLISHED) {
        throw new LineupRuntimeError(
          LINEUP_RUNTIME_ERROR_CODE.LINEUP_ALREADY_PUBLISHED,
          "Published lineup cannot transition via this action",
          { fromStatus: normalizedFrom, action }
        );
      }
      throw new LineupRuntimeError(
        LINEUP_RUNTIME_ERROR_CODE.LINEUP_LOCKED,
        "Lineup is locked and immutable for this action",
        { fromStatus: normalizedFrom, action }
      );
    }
    throw new LineupRuntimeError(
      LINEUP_RUNTIME_ERROR_CODE.LINEUP_STATE_TRANSITION_INVALID,
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
