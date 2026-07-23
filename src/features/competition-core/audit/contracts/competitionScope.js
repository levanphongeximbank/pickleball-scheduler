import { AUDIT_ERROR_CODE } from "../errors/auditErrorCodes.js";
import { AuditError } from "../errors/AuditError.js";
import { isNonEmptyString, isPlainObject, deepFreezeClone } from "../utils/helpers.js";

/**
 * @typedef {Object} CompetitionScope
 * @property {string} competitionId
 * @property {string|null} [seasonId]
 * @property {string|null} [clubId]
 * @property {string|null} [divisionId]
 */

/**
 * @param {unknown} partial
 * @returns {Readonly<CompetitionScope>}
 */
export function createCompetitionScope(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "competitionScope must be a plain object",
      {}
    );
  }

  const competitionId = isNonEmptyString(partial.competitionId)
    ? String(partial.competitionId).trim()
    : "";
  if (!competitionId) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "competitionScope.competitionId is required",
      {}
    );
  }

  return Object.freeze(
    /** @type {CompetitionScope} */ (
      deepFreezeClone({
        competitionId,
        seasonId:
          partial.seasonId == null || partial.seasonId === ""
            ? null
            : String(partial.seasonId).trim(),
        clubId:
          partial.clubId == null || partial.clubId === ""
            ? null
            : String(partial.clubId).trim(),
        divisionId:
          partial.divisionId == null || partial.divisionId === ""
            ? null
            : String(partial.divisionId).trim(),
      })
    )
  );
}

/**
 * @param {unknown} partial
 * @returns {Readonly<{ capability: string, moduleId: string }>}
 */
export function createAuditSource(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "source must be a plain object",
      {}
    );
  }
  const capability = isNonEmptyString(partial.capability)
    ? String(partial.capability).trim()
    : "";
  const moduleId = isNonEmptyString(partial.moduleId)
    ? String(partial.moduleId).trim()
    : "";
  if (!capability || !moduleId) {
    throw new AuditError(
      AUDIT_ERROR_CODE.AUDIT_INVALID_EVENT,
      "source.capability and source.moduleId are required",
      { capability, moduleId }
    );
  }
  return Object.freeze(
    deepFreezeClone({
      capability,
      moduleId,
    })
  );
}
