import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isSubjectType } from "../enums/subjectTypes.js";
import { isNonEmptyString, isPlainObject, deepFreezeClone } from "../utils/helpers.js";

/**
 * @typedef {Object} SubjectReference
 * @property {string} subjectType
 * @property {string} subjectId
 * @property {string|null} [competitionId]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<SubjectReference>}
 */
export function createSubjectReference(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SUBJECT,
      "SubjectReference must be a plain object",
      {}
    );
  }

  const subjectType = isNonEmptyString(partial.subjectType)
    ? String(partial.subjectType).trim()
    : "";
  const subjectId = isNonEmptyString(partial.subjectId)
    ? String(partial.subjectId).trim()
    : "";

  if (!isSubjectType(subjectType)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SUBJECT,
      "Invalid subjectType",
      { subjectType: partial.subjectType }
    );
  }
  if (!subjectId) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_SUBJECT,
      "subjectId is required",
      {}
    );
  }

  const competitionId =
    partial.competitionId == null || partial.competitionId === ""
      ? null
      : String(partial.competitionId).trim();

  return Object.freeze(
    /** @type {SubjectReference} */ (
      deepFreezeClone({
        subjectType,
        subjectId,
        competitionId,
      })
    )
  );
}
