/**
 * Home card action from assignment + match + CORE-17 status.
 */

import { MATCH_STATUS } from "../../competition-core/matches/index.js";
import { REFEREE_VALIDATION_OPS_STATUS } from "../../competition-engine/operations/referee/constants.js";
import {
  ASSIGNMENT_CARD_ACTION,
  ASSIGNMENT_CARD_ACTION_LABEL,
  RESULT_STATUS,
} from "../constants.js";

/**
 * @param {{
 *   assignmentStatus?: string|null,
 *   matchStatus?: string|null,
 *   resultStatus?: string|null,
 *   validationStatus?: string|null,
 * }} input
 */
export function resolveAssignmentAction(input = {}) {
  const matchStatus = String(input.matchStatus || "").toUpperCase();
  const resultStatus = String(input.resultStatus || "").toUpperCase();
  const validation = String(input.validationStatus || "").toUpperCase();

  if (
    resultStatus === RESULT_STATUS.ACCEPTED_OFFICIAL ||
    validation === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED ||
    matchStatus === MATCH_STATUS.COMPLETED
  ) {
    return Object.freeze({
      action: ASSIGNMENT_CARD_ACTION.VIEW_RESULT,
      label: ASSIGNMENT_CARD_ACTION_LABEL.VIEW_RESULT,
    });
  }

  if (
    matchStatus === MATCH_STATUS.IN_PROGRESS ||
    matchStatus === MATCH_STATUS.PAUSED ||
    matchStatus === MATCH_STATUS.SUSPENDED
  ) {
    return Object.freeze({
      action: ASSIGNMENT_CARD_ACTION.CONTINUE,
      label: ASSIGNMENT_CARD_ACTION_LABEL.CONTINUE,
    });
  }

  return Object.freeze({
    action: ASSIGNMENT_CARD_ACTION.ENTER,
    label: ASSIGNMENT_CARD_ACTION_LABEL.ENTER,
  });
}
