/**
 * Operation-aware Contract #01 referee evidence subject selection for trusted Edge.
 *
 * Outgoing assignment authority for REPLACE/UNASSIGN comes from canonical
 * persistence, not caller-supplied outgoing refereeId on the command.
 */

import { ASSIGNMENT_COMMAND } from "../constants.js";

const READ_ACTIONS = Object.freeze([
  "getMatchAssignmentVersion",
  "getActiveAssignment",
  "listActiveAssignments",
]);

/**
 * @param {string} action
 * @returns {boolean}
 */
export function isReadOnlyAssignmentAction(action) {
  const normalized = String(action || "").trim();
  return READ_ACTIONS.includes(normalized);
}

/**
 * Resolve which canonical subjectId requires Contract #01 directory evidence.
 *
 * @param {string} action
 * @param {object} [command]
 * @returns {string|null}
 */
export function resolveRefereeEvidenceSubjectId(action, command = {}) {
  const normalized = String(action || "").trim();

  if (isReadOnlyAssignmentAction(normalized)) {
    return null;
  }

  if (
    normalized === ASSIGNMENT_COMMAND.UNASSIGN ||
    normalized === "unassignReferee"
  ) {
    return null;
  }

  if (
    normalized === ASSIGNMENT_COMMAND.REPLACE ||
    normalized === "replaceReferee"
  ) {
    const incoming = String(command.newRefereeId || command.refereeId || "").trim();
    return incoming || null;
  }

  if (
    normalized === ASSIGNMENT_COMMAND.ASSIGN ||
    normalized === "assignReferee"
  ) {
    const assignTarget = String(command.refereeId || "").trim();
    return assignTarget || null;
  }

  return null;
}
