/**
 * Export-facing contracts (REPORTING-01). No production file generation.
 */

import {
  REPORT_EXPORT_FORMAT,
  isReportExportFormat,
} from "../constants/parameterTypes.js";
import { REPORT_AVAILABILITY, isReportAvailability } from "../constants/availability.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { createProvenanceMetadata } from "./provenance.js";
import { createReportScope } from "./scope.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalNonEmptyString,
  requireOpaqueId,
} from "./shared.js";

/**
 * @param {unknown} input
 */
export function createExportRequest(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_EXPORT_REQUEST,
      "Export request must be a plain object",
      { field: "exportRequest" }
    );
  }
  if (!isPlainObject(input.actor)) {
    failContract(
      REPORTING_ERROR_CODE.MISSING_ACTOR,
      "Export request requires actor",
      { field: "actor" }
    );
  }
  const format = String(input.format || "").trim();
  if (!isReportExportFormat(format)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_EXPORT_FORMAT,
      `Unsupported export format: ${format || "(empty)"}`,
      { field: "format" }
    );
  }
  return deepFreeze({
    actor: deepFreeze({ ...input.actor }),
    scope: createReportScope(input.scope),
    reportDefinitionId: requireOpaqueId(
      input.reportDefinitionId,
      "reportDefinitionId"
    ),
    executionId: optionalNonEmptyString(input.executionId, "executionId"),
    idempotencyKey: optionalNonEmptyString(input.idempotencyKey, "idempotencyKey"),
    format,
    columns: Object.freeze(
      Array.isArray(input.columns) ? input.columns.map(String) : []
    ),
    parameters: deepFreeze(
      isPlainObject(input.parameters) ? { ...input.parameters } : {}
    ),
    filters: Object.freeze(
      Array.isArray(input.filters) ? input.filters.map((f) => deepFreeze({ ...f })) : []
    ),
  });
}

/**
 * @param {unknown} input
 */
export function createExportJobResult(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_EXPORT_REQUEST,
      "Export result must be a plain object",
      { field: "exportResult" }
    );
  }
  const availability = String(input.availability || "").trim();
  if (!isReportAvailability(availability)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported export availability: ${availability || "(empty)"}`,
      { field: "availability" }
    );
  }
  const format = String(input.format || "").trim();
  if (format && !isReportExportFormat(format)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_EXPORT_FORMAT,
      `Unsupported export format: ${format}`,
      { field: "format" }
    );
  }
  const ok =
    availability === REPORT_AVAILABILITY.AVAILABLE ||
    availability === REPORT_AVAILABILITY.STALE ||
    availability === REPORT_AVAILABILITY.PARTIAL;

  return deepFreeze({
    ok,
    exportJobId: requireOpaqueId(input.exportJobId, "exportJobId"),
    exportRecordId: optionalNonEmptyString(input.exportRecordId, "exportRecordId"),
    reportDefinitionId: requireOpaqueId(
      input.reportDefinitionId,
      "reportDefinitionId"
    ),
    format: format || REPORT_EXPORT_FORMAT.CSV,
    availability,
    provenance: createProvenanceMetadata(
      input.provenance || { state: "UNAVAILABLE" }
    ),
    outputReference: input.outputReference == null
      ? null
      : deepFreeze(
          isPlainObject(input.outputReference)
            ? { ...input.outputReference }
            : { value: input.outputReference }
        ),
    errorCode: optionalNonEmptyString(input.errorCode, "errorCode"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    warnings: Object.freeze(
      Array.isArray(input.warnings) ? input.warnings.map(String) : []
    ),
  });
}
