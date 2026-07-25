/**
 * Report execution request / result contracts (REPORTING-01).
 */

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
export function createReportExecutionRequest(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "Execution request must be a plain object",
      { field: "request" }
    );
  }
  if (!isPlainObject(input.actor)) {
    failContract(
      REPORTING_ERROR_CODE.MISSING_ACTOR,
      "Execution request requires actor",
      { field: "actor" }
    );
  }
  const reportDefinitionId = requireOpaqueId(
    input.reportDefinitionId,
    "reportDefinitionId"
  );
  const scope = createReportScope(input.scope);
  return deepFreeze({
    actor: deepFreeze({ ...input.actor }),
    scope,
    reportDefinitionId,
    savedReportId: optionalNonEmptyString(input.savedReportId, "savedReportId"),
    savedFilterId: optionalNonEmptyString(input.savedFilterId, "savedFilterId"),
    idempotencyKey: optionalNonEmptyString(input.idempotencyKey, "idempotencyKey"),
    parameters: deepFreeze(
      isPlainObject(input.parameters) ? { ...input.parameters } : {}
    ),
    filters: Object.freeze(
      Array.isArray(input.filters) ? input.filters.map((f) => deepFreeze({ ...f })) : []
    ),
    sorting: Object.freeze(
      Array.isArray(input.sorting) ? input.sorting.map((s) => deepFreeze({ ...s })) : []
    ),
    grouping: Object.freeze(
      Array.isArray(input.grouping) ? input.grouping.map((g) => deepFreeze({ ...g })) : []
    ),
    columns: Object.freeze(
      Array.isArray(input.columns) ? input.columns.map(String) : null
    ),
    purpose: optionalNonEmptyString(input.purpose, "purpose"),
    freshnessPolicy: deepFreeze({
      allowStale: input.freshnessPolicy?.allowStale === true,
      allowPartial: input.freshnessPolicy?.allowPartial === true,
      rejectSilentMockFallback: input.freshnessPolicy?.rejectSilentMockFallback !== false,
    }),
    correlationId: optionalNonEmptyString(input.correlationId, "correlationId"),
  });
}

/**
 * Presentation-ready operational report result boundary.
 * @param {unknown} input
 */
export function createReportExecutionResult(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "Execution result must be a plain object",
      { field: "result" }
    );
  }
  const availability = String(input.availability || "").trim();
  if (!isReportAvailability(availability)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      `Unsupported availability: ${availability || "(empty)"}`,
      { field: "availability" }
    );
  }
  const provenance = createProvenanceMetadata(input.provenance || { state: "UNAVAILABLE" });
  const ok = availability === REPORT_AVAILABILITY.AVAILABLE
    || availability === REPORT_AVAILABILITY.STALE
    || availability === REPORT_AVAILABILITY.PARTIAL
    || availability === REPORT_AVAILABILITY.MIXED;

  const rows = Array.isArray(input.rows)
    ? Object.freeze(input.rows.map((r) => deepFreeze(isPlainObject(r) ? { ...r } : { value: r })))
    : Object.freeze([]);
  const fields = Object.freeze(
    Array.isArray(input.fields) ? input.fields.map((f) => deepFreeze({ ...f })) : []
  );
  const warnings = Object.freeze(
    Array.isArray(input.warnings) ? input.warnings.map(String) : []
  );
  const sourceReferences = Object.freeze(
    Array.isArray(input.sourceReferences)
      ? input.sourceReferences.map((s) => deepFreeze({ ...s }))
      : []
  );

  return deepFreeze({
    ok,
    reportDefinitionId: requireOpaqueId(
      input.reportDefinitionId,
      "reportDefinitionId"
    ),
    executionId: requireOpaqueId(input.executionId, "executionId"),
    availability,
    provenance,
    rows: ok ? rows : Object.freeze([]),
    fields,
    warnings,
    sourceReferences,
    errorCode: optionalNonEmptyString(input.errorCode, "errorCode"),
    errorMessage: optionalNonEmptyString(input.errorMessage, "errorMessage"),
    payload: input.payload == null ? null : deepFreeze(
      isPlainObject(input.payload) ? { ...input.payload } : { value: input.payload }
    ),
  });
}

/**
 * Normalize executor/port failure into typed operational result (no mock success).
 * @param {object} args
 */
export function createTypedExecutionFailure(args) {
  const availability = args.availability || REPORT_AVAILABILITY.SOURCE_FAILED;
  return createReportExecutionResult({
    reportDefinitionId: args.reportDefinitionId,
    executionId: args.executionId,
    availability,
    provenance: args.provenance || {
      state: "UNAVAILABLE",
      sourceKind: args.sourceKind || null,
      fallbackReason: args.fallbackReason || availability,
      warnings: args.warnings || [],
    },
    rows: [],
    fields: args.fields || [],
    warnings: args.warnings || [],
    sourceReferences: args.sourceReferences || [],
    errorCode: args.errorCode || REPORTING_ERROR_CODE.SOURCE_FAILED,
    errorMessage: args.errorMessage || "Report execution failed",
    payload: null,
  });
}
