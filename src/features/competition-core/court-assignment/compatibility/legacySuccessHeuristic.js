/**
 * CORE-12 Phase 1C — normalize legacy TE assignCourts success heuristic.
 *
 * Legacy:
 *   ok = conflicts.length === 0 || assignments.length > 0
 * This can report success for partial or otherwise incomplete assignment sets.
 *
 * CORE-12 does not reproduce this heuristic. Parity maps it explicitly.
 */

export const LEGACY_SUCCESS_CLASS = Object.freeze({
  FULL_SUCCESS: "FULL_SUCCESS",
  PARTIAL_REPORTED_OK: "PARTIAL_REPORTED_OK",
  EMPTY_FAILURE: "EMPTY_FAILURE",
  VALIDATION_FAILURE: "VALIDATION_FAILURE",
  UNKNOWN: "UNKNOWN",
});

export const LEGACY_SUCCESS_CLASS_VALUES = Object.freeze(
  Object.values(LEGACY_SUCCESS_CLASS)
);

/**
 * @param {unknown} legacyResult
 * @returns {{
 *   legacyOk: boolean|null,
 *   successClass: string,
 *   assignmentCount: number,
 *   conflictCount: number,
 *   ambiguousHeuristic: boolean,
 * }}
 */
export function normalizeLegacySuccessHeuristic(legacyResult) {
  if (legacyResult == null || typeof legacyResult !== "object") {
    return Object.freeze({
      legacyOk: null,
      successClass: LEGACY_SUCCESS_CLASS.UNKNOWN,
      assignmentCount: 0,
      conflictCount: 0,
      ambiguousHeuristic: false,
    });
  }

  const result = /** @type {Record<string, unknown>} */ (legacyResult);
  const data =
    result.data != null && typeof result.data === "object"
      ? /** @type {Record<string, unknown>} */ (result.data)
      : {};
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
  const assignmentCount = assignments.length;
  const conflictCount = conflicts.length;
  const legacyOk = result.ok === true;

  if (result.ok === false && assignmentCount === 0 && conflictCount === 0) {
    return Object.freeze({
      legacyOk: false,
      successClass: LEGACY_SUCCESS_CLASS.VALIDATION_FAILURE,
      assignmentCount,
      conflictCount,
      ambiguousHeuristic: false,
    });
  }

  if (legacyOk && conflictCount === 0 && assignmentCount >= 0) {
    // Empty assignable set with ok:true is rare; treat as full when no conflicts.
    return Object.freeze({
      legacyOk: true,
      successClass: LEGACY_SUCCESS_CLASS.FULL_SUCCESS,
      assignmentCount,
      conflictCount,
      ambiguousHeuristic: false,
    });
  }

  if (legacyOk && conflictCount > 0 && assignmentCount > 0) {
    return Object.freeze({
      legacyOk: true,
      successClass: LEGACY_SUCCESS_CLASS.PARTIAL_REPORTED_OK,
      assignmentCount,
      conflictCount,
      ambiguousHeuristic: true,
    });
  }

  if (!legacyOk && assignmentCount === 0) {
    return Object.freeze({
      legacyOk: false,
      successClass: LEGACY_SUCCESS_CLASS.EMPTY_FAILURE,
      assignmentCount,
      conflictCount,
      ambiguousHeuristic: false,
    });
  }

  return Object.freeze({
    legacyOk,
    successClass: LEGACY_SUCCESS_CLASS.UNKNOWN,
    assignmentCount,
    conflictCount,
    ambiguousHeuristic: legacyOk === true && conflictCount > 0,
  });
}
