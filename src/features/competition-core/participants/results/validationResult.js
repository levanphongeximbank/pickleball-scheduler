/**
 * Pure validation result helpers (no throw for business invalid data).
 */

/**
 * @typedef {Object} ParticipantValidationIssue
 * @property {string} code
 * @property {string} path
 * @property {string} message
 * @property {'error'|'warning'} [severity]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} ParticipantValidationResult
 * @property {boolean} valid
 * @property {ParticipantValidationIssue[]} errors
 * @property {ParticipantValidationIssue[]} warnings
 */

/**
 * @param {Partial<ParticipantValidationResult>} [partial]
 * @returns {ParticipantValidationResult}
 */
export function createParticipantValidationResult(partial = {}) {
  const errors = Array.isArray(partial.errors) ? partial.errors.map(cloneIssue) : [];
  const warnings = Array.isArray(partial.warnings) ? partial.warnings.map(cloneIssue) : [];
  return {
    valid: partial.valid === true || (partial.valid !== false && errors.length === 0),
    errors,
    warnings,
  };
}

/**
 * @param {ParticipantValidationIssue[]} errors
 * @param {ParticipantValidationIssue[]} [warnings]
 * @returns {ParticipantValidationResult}
 */
export function validationOk(warnings = []) {
  return createParticipantValidationResult({ valid: true, errors: [], warnings });
}

/**
 * @param {ParticipantValidationIssue[]} errors
 * @param {ParticipantValidationIssue[]} [warnings]
 * @returns {ParticipantValidationResult}
 */
export function validationFail(errors, warnings = []) {
  return createParticipantValidationResult({
    valid: false,
    errors,
    warnings,
  });
}

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [metadata]
 * @returns {ParticipantValidationIssue}
 */
export function validationError(code, path, message, metadata) {
  return {
    code: String(code),
    path: String(path || ""),
    message: String(message || ""),
    severity: "error",
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };
}

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @param {Record<string, unknown>} [metadata]
 * @returns {ParticipantValidationIssue}
 */
export function validationWarning(code, path, message, metadata) {
  return {
    code: String(code),
    path: String(path || ""),
    message: String(message || ""),
    severity: "warning",
    ...(metadata ? { metadata: { ...metadata } } : {}),
  };
}

/**
 * @param {ParticipantValidationIssue} issue
 * @returns {ParticipantValidationIssue}
 */
function cloneIssue(issue) {
  return {
    code: String(issue?.code || "UNKNOWN"),
    path: String(issue?.path || ""),
    message: String(issue?.message || ""),
    severity: issue?.severity === "warning" ? "warning" : "error",
    ...(issue?.metadata && typeof issue.metadata === "object"
      ? { metadata: { ...issue.metadata } }
      : {}),
  };
}
