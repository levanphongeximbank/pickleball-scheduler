/**
 * Repository / reference port method lists — no persistence adapters in Phase 1.
 */

export const CATEGORY_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "archive",
]);

export const DIVISION_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "archive",
]);

export const DIVISION_CATEGORY_REPOSITORY_PORT_METHODS = Object.freeze([
  "getById",
  "listByCompetition",
  "save",
  "archive",
  "findByDivisionAndCategory",
]);

/**
 * Fail-closed reference checker for OPEN → DRAFT and hard-delete guards.
 *
 * @typedef {Object} ClassificationReferenceSnapshot
 * @property {number} entryCount
 * @property {number} reservationCount
 * @property {number} drawCount
 * @property {number} matchCount
 *
 * @typedef {Object} ClassificationReferenceCheckerPort
 * @property {() => ClassificationReferenceSnapshot|Promise<ClassificationReferenceSnapshot>} getReferenceSnapshot
 */

export const REFERENCE_CHECKER_PORT_METHODS = Object.freeze(["getReferenceSnapshot"]);
