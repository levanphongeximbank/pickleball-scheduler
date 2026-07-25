/**
 * Legacy coaching adapter (COACHING-04).
 *
 * ONLY runtime module allowed to import ../services/coachingService.js.
 * Maps UI collection ops onto the localStorage prototype — COMPATIBILITY_ONLY.
 */

import {
  listCoaches,
  saveCoach,
  deleteCoach,
  listStudents,
  saveStudent,
  deleteStudent,
  listClasses,
  saveClass,
  deleteClass,
  listSchedule,
  saveScheduleEntry,
  deleteScheduleEntry,
  listPackages,
  savePackage,
  deletePackage,
  listAttendance,
  saveAttendance,
  deleteAttendance,
  listEvaluations,
  saveEvaluation,
  deleteEvaluation,
} from "../services/coachingService.js";
import { createCoachingRuntimeError, COACHING_RUNTIME_ERROR_CODES } from "./errors.js";

const LIST_FNS = Object.freeze({
  coaches: listCoaches,
  students: listStudents,
  classes: listClasses,
  schedule: listSchedule,
  packages: listPackages,
  attendance: listAttendance,
  evaluations: listEvaluations,
});

const SAVE_FNS = Object.freeze({
  coaches: saveCoach,
  students: saveStudent,
  classes: saveClass,
  schedule: saveScheduleEntry,
  packages: savePackage,
  attendance: saveAttendance,
  evaluations: saveEvaluation,
});

const DELETE_FNS = Object.freeze({
  coaches: deleteCoach,
  students: deleteStudent,
  classes: deleteClass,
  schedule: deleteScheduleEntry,
  packages: deletePackage,
  attendance: deleteAttendance,
  evaluations: deleteEvaluation,
});

/**
 * @returns {{
 *   list: (name: string, clubId: string) => { ok: boolean, data?: unknown[], error?: string, code?: string },
 *   save: (name: string, clubId: string, row: object) => { ok: boolean, data?: object, error?: string, code?: string },
 *   delete: (name: string, clubId: string, id: string) => { ok: boolean, data?: object, error?: string, code?: string },
 * }}
 */
export function createLegacyCoachingAdapter() {
  function list(name, clubId) {
    const fn = LIST_FNS[name];
    if (!fn) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        `Unknown coaching collection: ${name}`
      );
    }
    try {
      const data = fn(clubId);
      return { ok: true, data: Array.isArray(data) ? data : [] };
    } catch (err) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.LEGACY_ONLY,
        err?.message || "Legacy list failed."
      );
    }
  }

  function save(name, clubId, row) {
    const fn = SAVE_FNS[name];
    if (!fn) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        `Unknown coaching collection: ${name}`
      );
    }
    try {
      const result = fn(clubId, row);
      if (!result?.ok) {
        return createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.LEGACY_ONLY,
          result?.error || "Legacy save failed."
        );
      }
      return { ok: true, data: result.store || result };
    } catch (err) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.LEGACY_ONLY,
        err?.message || "Legacy save failed."
      );
    }
  }

  function remove(name, clubId, id) {
    const fn = DELETE_FNS[name];
    if (!fn) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.UNSUPPORTED_MODE,
        `Unknown coaching collection: ${name}`
      );
    }
    try {
      const result = fn(clubId, id);
      if (!result?.ok) {
        return createCoachingRuntimeError(
          COACHING_RUNTIME_ERROR_CODES.LEGACY_ONLY,
          result?.error || "Legacy delete failed."
        );
      }
      return { ok: true, data: result.store || result };
    } catch (err) {
      return createCoachingRuntimeError(
        COACHING_RUNTIME_ERROR_CODES.LEGACY_ONLY,
        err?.message || "Legacy delete failed."
      );
    }
  }

  return Object.freeze({
    list,
    save,
    delete: remove,
  });
}
