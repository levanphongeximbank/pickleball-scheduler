/**
 * Durable reporting execution and export record contracts (REPORTING-02).
 */

import {
  REPORT_EXECUTION_STATUS,
  REPORT_EXPORT_JOB_STATUS,
  isReportExecutionStatus,
  isReportExportJobStatus,
} from "../lifecycle/statuses.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalIsoInstant,
  optionalNonEmptyString,
  optionalOpaqueId,
  requireNonEmptyString,
  requireOpaqueId,
} from "./shared.js";
import { createProvenanceMetadata } from "./provenance.js";
import { createReportScope } from "./scope.js";
import { createReportSourceReference } from "./sourceReference.js";

function cloneJson(value, fallback) {
  if (Array.isArray(value)) return value.map((entry) => cloneJson(entry, entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneJson(entry, entry)])
    );
  }
  return value == null ? fallback : value;
}

function requireStatus(value, predicate, field) {
  const status = String(value || "").trim();
  if (!predicate(status)) {
    failContract(REPORTING_ERROR_CODE.INVALID_CONTRACT, `Unsupported ${field}: ${status}`, {
      field,
    });
  }
  return status;
}

/**
 * @param {unknown} input
 */
export function createReportExecutionRecord(input) {
  if (!isPlainObject(input)) {
    failContract(REPORTING_ERROR_CODE.INVALID_CONTRACT, "Execution record must be a plain object");
  }
  const requestSnapshot = isPlainObject(input.requestSnapshot)
    ? { ...input.requestSnapshot }
    : {};
  Reflect.deleteProperty(requestSnapshot, "rows");
  return deepFreeze({
    executionId: requireOpaqueId(input.executionId, "executionId"),
    reportDefinitionId: requireOpaqueId(input.reportDefinitionId, "reportDefinitionId"),
    savedReportId: optionalOpaqueId(input.savedReportId, "savedReportId"),
    savedFilterId: optionalOpaqueId(input.savedFilterId, "savedFilterId"),
    actorId: requireOpaqueId(input.actorId, "actorId"),
    scope: createReportScope(input.scope),
    idempotencyKey: requireNonEmptyString(input.idempotencyKey, "idempotencyKey"),
    requestSnapshot: deepFreeze(cloneJson(requestSnapshot, {})),
    status: requireStatus(input.status || REPORT_EXECUTION_STATUS.PENDING, isReportExecutionStatus, "status"),
    availability: optionalNonEmptyString(input.availability, "availability"),
    provenance: createProvenanceMetadata(input.provenance || { state: "UNAVAILABLE" }),
    freshness: deepFreeze(cloneJson(input.freshness, {})),
    sourceReferences: Object.freeze(
      (Array.isArray(input.sourceReferences) ? input.sourceReferences : []).map(
        createReportSourceReference
      )
    ),
    rowCount: Number.isInteger(input.rowCount) && input.rowCount >= 0 ? input.rowCount : 0,
    warningCodes: Object.freeze(
      (Array.isArray(input.warningCodes) ? input.warningCodes : []).map(String)
    ),
    errorCode: optionalNonEmptyString(input.errorCode, "errorCode"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    startedAt: optionalIsoInstant(input.startedAt, "startedAt"),
    completedAt: optionalIsoInstant(input.completedAt, "completedAt"),
    version: Number.isInteger(input.version) && input.version >= 1 ? input.version : 1,
    createdAt: optionalIsoInstant(input.createdAt, "createdAt"),
    updatedAt: optionalIsoInstant(input.updatedAt, "updatedAt"),
  });
}

/**
 * @param {unknown} input
 */
export function createExportJobRecord(input) {
  if (!isPlainObject(input)) {
    failContract(REPORTING_ERROR_CODE.INVALID_CONTRACT, "Export job record must be a plain object");
  }
  return deepFreeze({
    exportJobId: requireOpaqueId(input.exportJobId, "exportJobId"),
    exportRecordId: optionalOpaqueId(input.exportRecordId, "exportRecordId"),
    executionId: optionalOpaqueId(input.executionId, "executionId"),
    reportDefinitionId: requireOpaqueId(input.reportDefinitionId, "reportDefinitionId"),
    actorId: requireOpaqueId(input.actorId, "actorId"),
    scope: createReportScope(input.scope),
    format: requireOpaqueId(input.format, "format"),
    selectedColumns: Object.freeze(
      (Array.isArray(input.selectedColumns) ? input.selectedColumns : []).map(String)
    ),
    idempotencyKey: requireNonEmptyString(input.idempotencyKey, "idempotencyKey"),
    status: requireStatus(input.status || REPORT_EXPORT_JOB_STATUS.PENDING, isReportExportJobStatus, "status"),
    authorizationOutcome: optionalNonEmptyString(
      input.authorizationOutcome,
      "authorizationOutcome"
    ),
    outputArtifactReference:
      input.outputArtifactReference == null
        ? null
        : deepFreeze(cloneJson(input.outputArtifactReference, {})),
    contentMetadata: deepFreeze(cloneJson(input.contentMetadata, {})),
    expiresAt: optionalIsoInstant(input.expiresAt, "expiresAt"),
    retentionUntil: optionalIsoInstant(input.retentionUntil, "retentionUntil"),
    errorCode: optionalNonEmptyString(input.errorCode, "errorCode"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    startedAt: optionalIsoInstant(input.startedAt, "startedAt"),
    completedAt: optionalIsoInstant(input.completedAt, "completedAt"),
    version: Number.isInteger(input.version) && input.version >= 1 ? input.version : 1,
    createdAt: optionalIsoInstant(input.createdAt, "createdAt"),
    updatedAt: optionalIsoInstant(input.updatedAt, "updatedAt"),
  });
}
