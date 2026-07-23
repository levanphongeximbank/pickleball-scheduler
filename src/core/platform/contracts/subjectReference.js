/**
 * Subject Reference contract (Platform Core Phase 1C).
 *
 * Technical reference for an object being acted on, audited, or cited.
 * Does not check existence, ownership, tenant membership, or module type.
 */

import { fail, ok } from "./result.js";
import { normalizeOpaqueId } from "./opaqueId.js";

/**
 * @typedef {{ subjectType: string, subjectId: string }} SubjectReference
 */

export const SUBJECT_REFERENCE_ERROR = Object.freeze({
  INVALID: "SUBJECT_REFERENCE_INVALID",
  TYPE_INVALID: "SUBJECT_TYPE_INVALID",
  ID_INVALID: "SUBJECT_ID_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 * @returns {{ code: string, message: string, field?: string }}
 */
function subjectReferenceError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {import("./result.js").Result}
 */
export function createSubjectReference(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return fail(
      subjectReferenceError(
        SUBJECT_REFERENCE_ERROR.INVALID,
        "SubjectReference input must be a plain object"
      )
    );
  }

  if (typeof input.subjectType !== "string") {
    return fail(
      subjectReferenceError(
        SUBJECT_REFERENCE_ERROR.TYPE_INVALID,
        "SubjectReference subjectType must be a string",
        "subjectType"
      )
    );
  }

  const subjectType = input.subjectType.trim();
  if (subjectType.length === 0) {
    return fail(
      subjectReferenceError(
        SUBJECT_REFERENCE_ERROR.TYPE_INVALID,
        "SubjectReference subjectType must be a non-empty string",
        "subjectType"
      )
    );
  }

  const subjectIdResult = normalizeOpaqueId(input.subjectId);
  if (!subjectIdResult.ok) {
    return fail(
      subjectReferenceError(
        SUBJECT_REFERENCE_ERROR.ID_INVALID,
        "SubjectReference subjectId must be a non-empty opaque identifier",
        "subjectId"
      )
    );
  }

  /** @type {SubjectReference} */
  const reference = {
    subjectType,
    subjectId: subjectIdResult.value,
  };
  return ok(Object.freeze(reference));
}

/**
 * @param {*} value
 * @returns {value is SubjectReference}
 */
export function isSubjectReference(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (
    typeof value.subjectType !== "string" ||
    typeof value.subjectId !== "string"
  ) {
    return false;
  }
  return createSubjectReference(value).ok === true;
}
