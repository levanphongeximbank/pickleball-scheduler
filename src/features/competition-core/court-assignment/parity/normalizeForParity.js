/**
 * CORE-12 Phase 1C — normalize CORE-12 assignment result for parity compare.
 */

import { compareStableString } from "../deterministic/compare.js";
import { COURT_ASSIGNMENT_STATUS } from "../enums/status.js";

/**
 * @param {unknown} core12Result
 * @returns {Readonly<object>}
 */
export function normalizeCore12ResultForParity(core12Result) {
  if (core12Result == null || typeof core12Result !== "object") {
    return Object.freeze({
      shape: "invalid",
      status: null,
      committable: false,
      assignmentsByMatchId: Object.freeze({}),
      assignmentMatchIds: Object.freeze([]),
      unassignedMatchIds: Object.freeze([]),
      conflictCodes: Object.freeze([]),
    });
  }

  const result = /** @type {Record<string, unknown>} */ (core12Result);
  const assignments = Array.isArray(result.assignments) ? result.assignments : [];
  const unassigned = Array.isArray(result.unassigned) ? result.unassigned : [];
  const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];

  /** @type {Record<string, string>} */
  const assignmentsByMatchId = {};
  for (const row of assignments) {
    if (row == null || typeof row !== "object") continue;
    const matchId =
      /** @type {any} */ (row).matchId != null
        ? String(/** @type {any} */ (row).matchId)
        : null;
    const courtId =
      /** @type {any} */ (row).courtId != null
        ? String(/** @type {any} */ (row).courtId)
        : null;
    if (matchId && courtId) {
      assignmentsByMatchId[matchId] = courtId;
    }
  }

  const assignmentMatchIds = Object.keys(assignmentsByMatchId).sort(
    compareStableString
  );
  const unassignedMatchIds = unassigned
    .map((u) =>
      u != null && typeof u === "object" && /** @type {any} */ (u).matchId != null
        ? String(/** @type {any} */ (u).matchId)
        : null
    )
    .filter((id) => id != null)
    .sort(compareStableString);

  const conflictCodes = conflicts
    .map((c) =>
      c != null && typeof c === "object" && /** @type {any} */ (c).code != null
        ? String(/** @type {any} */ (c).code)
        : null
    )
    .filter((c) => c != null)
    .sort(compareStableString);

  const status = result.status == null ? null : String(result.status);
  const successLike =
    status === COURT_ASSIGNMENT_STATUS.SUCCESS ||
    status === COURT_ASSIGNMENT_STATUS.PARTIAL;

  return Object.freeze({
    shape: "core12_assign_courts",
    status,
    committable: result.committable === true,
    successLike,
    assignmentsByMatchId: Object.freeze({ ...assignmentsByMatchId }),
    assignmentMatchIds: Object.freeze(assignmentMatchIds),
    unassignedMatchIds: Object.freeze(unassignedMatchIds),
    conflictCodes: Object.freeze(conflictCodes),
    resultFingerprint:
      result.resultFingerprint == null ? null : String(result.resultFingerprint),
  });
}

/**
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 */
export function assignmentMapsEqual(a, b) {
  const ak = Object.keys(a).sort(compareStableString);
  const bk = Object.keys(b).sort(compareStableString);
  if (ak.length !== bk.length) return false;
  for (let i = 0; i < ak.length; i += 1) {
    if (ak[i] !== bk[i]) return false;
    if (a[ak[i]] !== b[bk[i]]) return false;
  }
  return true;
}
