/**
 * CORE-22 — Redaction profile contract.
 *
 * Does not implement domain-specific PII extraction in Phase 1B.
 * Prohibits re-leaking removed values through diagnostics / metadata surfaces.
 */

import {
  AUDIT_SECTION_POLICY,
  AUDIT_SECTION_POLICY_VALUES,
  DEFAULT_AUDIT_SECTION_POLICY,
  DEFAULT_REDACTION_PROFILE_ID,
  REDACTION_NO_RELEAK_SURFACES,
  REDACTION_PROFILE_ID,
  REDACTION_PROFILE_ID_VALUES,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isPlainObject,
  normalizeStringArray,
} from "../utils/helpers.js";

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createRedactionProfile(partial = {}) {
  if (partial == null) {
    return createDefaultRedactionProfile();
  }
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "RedactionProfile must be a plain object",
      {}
    );
  }

  const profileId = String(
    partial.profileId ?? DEFAULT_REDACTION_PROFILE_ID
  ).trim();
  if (!REDACTION_PROFILE_ID_VALUES.has(profileId)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "Unknown redaction profileId",
      { profileId }
    );
  }

  const auditSectionPolicy = String(
    partial.auditSectionPolicy ?? DEFAULT_AUDIT_SECTION_POLICY
  ).trim();
  if (!AUDIT_SECTION_POLICY_VALUES.has(auditSectionPolicy)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      "Unknown auditSectionPolicy",
      { auditSectionPolicy }
    );
  }

  const noReleakSurfaces = Array.isArray(partial.noReleakSurfaces)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.noReleakSurfaces)
      )
    : REDACTION_NO_RELEAK_SURFACES;

  for (const required of REDACTION_NO_RELEAK_SURFACES) {
    if (!noReleakSurfaces.includes(required)) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
        `Redaction profile must prohibit re-leak on ${required}`,
        { surface: required }
      );
    }
  }

  const removedPaths = Array.isArray(partial.removedPaths)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.removedPaths)
      )
    : Object.freeze([]);

  return Object.freeze(
    deepFreezeClone({
      profileId,
      auditSectionPolicy,
      noReleakSurfaces,
      removedPaths,
      allowsPiiExtraction: false,
      checksumAfterRedaction: true,
    })
  );
}

/**
 * @returns {Readonly<object>}
 */
export function createDefaultRedactionProfile() {
  return createRedactionProfile({
    profileId: REDACTION_PROFILE_ID.PORTABLE_SAFE_V1,
    auditSectionPolicy: AUDIT_SECTION_POLICY.REFERENCES_ONLY,
  });
}

/**
 * Assert a diagnostic / metadata payload does not re-leak removed values.
 * Contract guard only — does not perform domain PII extraction.
 *
 * @param {unknown} payload
 * @param {ReadonlyArray<string>} removedValues
 * @param {string} surface
 */
export function assertNoRedactionReleak(payload, removedValues, surface) {
  if (!REDACTION_NO_RELEAK_SURFACES.includes(surface)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
      `Unknown redaction surface: ${surface}`,
      { surface }
    );
  }
  if (!Array.isArray(removedValues) || removedValues.length === 0) {
    return;
  }
  const serialized =
    payload == null
      ? ""
      : typeof payload === "string"
        ? payload
        : JSON.stringify(payload);
  for (const value of removedValues) {
    if (value && serialized.includes(String(value))) {
      throw new ImportExportError(
        IMPORT_EXPORT_ERROR_CODE.REDACTION_VIOLATION,
        `Redacted value re-leaked through ${surface}`,
        { surface }
      );
    }
  }
}

export {
  REDACTION_PROFILE_ID,
  AUDIT_SECTION_POLICY,
  REDACTION_NO_RELEAK_SURFACES,
};
