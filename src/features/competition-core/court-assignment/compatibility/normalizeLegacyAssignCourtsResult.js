/**
 * CORE-12 Phase 1C — normalize legacy TE assignCourts result for parity.
 * Does not mutate the legacy result object.
 */

import { compareStableString } from "../deterministic/compare.js";
import { normalizeLegacySuccessHeuristic } from "./legacySuccessHeuristic.js";

/**
 * @param {unknown} legacyResult
 * @returns {Readonly<object>}
 */
export function normalizeLegacyAssignCourtsResult(legacyResult) {
  const heuristic = normalizeLegacySuccessHeuristic(legacyResult);
  if (legacyResult == null || typeof legacyResult !== "object") {
    return Object.freeze({
      shape: "invalid",
      heuristic,
      assignmentsByMatchId: Object.freeze({}),
      conflictMatchIds: Object.freeze([]),
      assignmentMatchIds: Object.freeze([]),
    });
  }

  const result = /** @type {Record<string, unknown>} */ (legacyResult);
  const data =
    result.data != null && typeof result.data === "object"
      ? /** @type {Record<string, unknown>} */ (result.data)
      : {};
  const assignments = Array.isArray(data.assignments) ? data.assignments : [];
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];

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

  const conflictMatchIds = conflicts
    .map((c) =>
      c != null && typeof c === "object" && /** @type {any} */ (c).matchId != null
        ? String(/** @type {any} */ (c).matchId)
        : null
    )
    .filter((id) => id != null)
    .sort(compareStableString);

  const assignmentMatchIds = Object.keys(assignmentsByMatchId).sort(
    compareStableString
  );

  return Object.freeze({
    shape: "legacy_assign_courts",
    heuristic,
    assignmentsByMatchId: Object.freeze({ ...assignmentsByMatchId }),
    conflictMatchIds: Object.freeze(conflictMatchIds),
    assignmentMatchIds: Object.freeze(assignmentMatchIds),
    warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
    explainCount: Array.isArray(result.explain) ? result.explain.length : 0,
  });
}
