/**
 * CORE-22 — Reference and ID mapping plan contracts.
 */

import {
  ID_MAPPING_ACTION,
  ID_MAPPING_ACTION_VALUES,
  ID_MAPPING_STATUS,
  ID_MAPPING_STATUS_VALUES,
} from "../constants.js";
import {
  ImportExportError,
  IMPORT_EXPORT_ERROR_CODE,
} from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  normalizeStringArray,
} from "../utils/helpers.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (!isNonEmptyString(value)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      `${field} is required`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createIdMappingEntry(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "IdMappingEntry must be a plain object",
      {}
    );
  }

  const action = String(partial.action ?? "").trim();
  if (!ID_MAPPING_ACTION_VALUES.has(action)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "Unknown ID mapping action",
      { action: partial.action }
    );
  }

  const status = String(partial.status ?? ID_MAPPING_STATUS.PLANNED).trim();
  if (!ID_MAPPING_STATUS_VALUES.has(status)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "Unknown ID mapping status",
      { status: partial.status }
    );
  }

  const sourceNamespace = requireNonEmptyString(
    partial.sourceNamespace,
    "sourceNamespace"
  );
  const sourceId = requireNonEmptyString(partial.sourceId, "sourceId");
  const entityType = requireNonEmptyString(partial.entityType, "entityType");

  const targetNamespace =
    partial.targetNamespace == null || partial.targetNamespace === ""
      ? null
      : String(partial.targetNamespace).trim();
  const targetId =
    partial.targetId == null || partial.targetId === ""
      ? null
      : String(partial.targetId).trim();

  // CREATE_NEW may leave targetId null until apply; PRESERVE/REMAP/REUSE need targets.
  if (
    (action === ID_MAPPING_ACTION.PRESERVE ||
      action === ID_MAPPING_ACTION.REMAP ||
      action === ID_MAPPING_ACTION.REUSE_EXISTING) &&
    (targetNamespace == null || targetId == null)
  ) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      `${action} requires targetNamespace and targetId`,
      { action }
    );
  }

  const conflictIds = Array.isArray(partial.conflictIds)
    ? /** @type {ReadonlyArray<string>} */ (
        normalizeStringArray(partial.conflictIds)
      )
    : Object.freeze([]);

  return Object.freeze(
    deepFreezeClone({
      sourceNamespace,
      sourceId,
      entityType,
      targetNamespace,
      targetId,
      action,
      status,
      conflictIds,
      explanation:
        partial.explanation == null || partial.explanation === ""
          ? null
          : String(partial.explanation),
    })
  );
}

/**
 * Reference mapping plan entry (namespace-level or pointer-level).
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createReferenceMappingEntry(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "ReferenceMappingEntry must be a plain object",
      {}
    );
  }

  const sourceNamespace = requireNonEmptyString(
    partial.sourceNamespace,
    "sourceNamespace"
  );
  const sourceReference = requireNonEmptyString(
    partial.sourceReference,
    "sourceReference"
  );

  const action = String(
    partial.action ?? ID_MAPPING_ACTION.EXTERNAL_REFERENCE
  ).trim();
  if (!ID_MAPPING_ACTION_VALUES.has(action)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "Unknown reference mapping action",
      { action: partial.action }
    );
  }

  return Object.freeze(
    deepFreezeClone({
      sourceNamespace,
      sourceReference,
      targetNamespace:
        partial.targetNamespace == null || partial.targetNamespace === ""
          ? null
          : String(partial.targetNamespace).trim(),
      targetReference:
        partial.targetReference == null || partial.targetReference === ""
          ? null
          : String(partial.targetReference).trim(),
      action,
      status: String(partial.status ?? ID_MAPPING_STATUS.PLANNED).trim(),
      explanation:
        partial.explanation == null || partial.explanation === ""
          ? null
          : String(partial.explanation),
    })
  );
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createIdMappingPlan(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new ImportExportError(
      IMPORT_EXPORT_ERROR_CODE.UNRESOLVED_REFERENCE,
      "IdMappingPlan must be a plain object",
      {}
    );
  }

  const entries = Array.isArray(partial.entries)
    ? Object.freeze(
        partial.entries.map((e) =>
          createIdMappingEntry(/** @type {object} */ (e))
        )
      )
    : Object.freeze([]);

  const references = Array.isArray(partial.references)
    ? Object.freeze(
        partial.references.map((r) =>
          createReferenceMappingEntry(/** @type {object} */ (r))
        )
      )
    : Object.freeze([]);

  return Object.freeze(
    deepFreezeClone({
      entries,
      references,
      unresolvedCount: entries.filter(
        (e) =>
          e.action === ID_MAPPING_ACTION.UNRESOLVED ||
          e.action === ID_MAPPING_ACTION.REJECTED
      ).length,
    })
  );
}

export { ID_MAPPING_ACTION, ID_MAPPING_STATUS };
