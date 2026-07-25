/**
 * Report execution orchestration foundation (REPORTING-01).
 *
 * validate → resolve definition → authorize → validate params/filters/sort/group/columns
 * → resolve source port → execute → normalize result with provenance.
 * No analytical runtime. No silent live→mock fallback.
 */

import { REPORT_AVAILABILITY } from "../constants/availability.js";
import { REPORT_PROVENANCE } from "../constants/provenance.js";
import { REPORTING_PERMISSIONS } from "../constants/permissions.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { isReportingError } from "../errors/ReportingError.js";
import {
  authorizeExecuteReport,
  authorizeSensitiveFields,
} from "../authorization/reportingAuthorize.js";
import {
  assertNoSilentLiveToMockFallback,
  createProvenanceMetadata,
  createReportExecutionRequest,
  createReportExecutionResult,
  createTypedExecutionFailure,
  validateColumnSelection,
  validateFilterValues,
  validateGrouping,
  validateParameterValues,
  validateSorting,
} from "../contracts/index.js";
import { reportScopesEqual } from "../contracts/scope.js";
import { matchesReportDataSourcePort } from "../ports/repositoryPorts.js";

/**
 * @param {object} deps
 * @param {object} rawRequest
 */
export async function executeOperationalReport(deps, rawRequest) {
  const request = createReportExecutionRequest(rawRequest);
  const executionId =
    request.correlationId ||
    (deps.idProvider ? deps.idProvider.nextId("rex") : `rex_${Date.now()}`);

  // 1–2. Resolve definition
  if (!deps.reportDefinitions || typeof deps.reportDefinitions.getById !== "function") {
    return createTypedExecutionFailure({
      reportDefinitionId: request.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
      errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
      errorMessage: "Report definition repository is not configured",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "definition_repository_not_configured",
      },
    });
  }

  const definition = await deps.reportDefinitions.getById(request.reportDefinitionId);
  if (!definition) {
    return createTypedExecutionFailure({
      reportDefinitionId: request.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.UNAVAILABLE,
      errorCode: REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND,
      errorMessage: "Report definition not found",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "definition_not_found",
      },
    });
  }

  // 3. Validate report scope vs definition scope
  if (!reportScopesEqual(request.scope, definition.scope)) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.INVALID_SCOPE,
      errorCode: REPORTING_ERROR_CODE.INVALID_SCOPE,
      errorMessage: "Request scope does not match report definition scope",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "scope_mismatch",
      },
    });
  }

  // 4–5. Authorize execute + scope BEFORE source execution
  const auth = authorizeExecuteReport(request.actor, request.scope);
  if (!auth.ok) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.AUTHORIZATION_DENIED,
      errorCode: auth.code || REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
      errorMessage: auth.error || "Authorization denied",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "authorization_denied",
      },
    });
  }

  // Track whether source was invoked (for authz-before-execution tests)
  if (typeof deps.onAuthorized === "function") {
    deps.onAuthorized({ permission: REPORTING_PERMISSIONS.REPORT_EXECUTE });
  }

  // 6–8. Validate parameters / filters / sorting / grouping / columns
  try {
    validateParameterValues(definition.parameters, request.parameters);
  } catch (err) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.INVALID_PARAMETERS,
      errorCode: isReportingError(err) ? err.code : REPORTING_ERROR_CODE.INVALID_PARAMETERS,
      errorMessage: err instanceof Error ? err.message : "Invalid parameters",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "invalid_parameters",
      },
    });
  }

  try {
    validateFilterValues(definition.filterDefinitions, request.filters);
  } catch (err) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.INVALID_FILTER,
      errorCode: isReportingError(err) ? err.code : REPORTING_ERROR_CODE.INVALID_FILTER,
      errorMessage: err instanceof Error ? err.message : "Invalid filters",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "invalid_filter",
      },
    });
  }

  try {
    validateSorting(definition.sortableFields, request.sorting);
  } catch (err) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.INVALID_SORT,
      errorCode: isReportingError(err) ? err.code : REPORTING_ERROR_CODE.INVALID_SORT,
      errorMessage: err instanceof Error ? err.message : "Invalid sorting",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "invalid_sort",
      },
    });
  }

  try {
    validateGrouping(definition.groupableFields, request.grouping);
  } catch (err) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.INVALID_GROUPING,
      errorCode: isReportingError(err) ? err.code : REPORTING_ERROR_CODE.INVALID_GROUPING,
      errorMessage: err instanceof Error ? err.message : "Invalid grouping",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "invalid_grouping",
      },
    });
  }

  const needsSensitive = (request.columns || [])
    .map(String)
    .some((field) => definition.columns.some((c) => c.field === field && c.sensitive));
  const defaultNeedsSensitive =
    request.columns == null &&
    definition.columns.some((c) => c.sensitive && c.defaultSelected !== false);

  let allowSensitive = false;
  if (needsSensitive || defaultNeedsSensitive) {
    const sens = authorizeSensitiveFields(request.actor, request.scope);
    if (!sens.ok) {
      // If caller explicitly requested sensitive columns → deny.
      // If defaults include sensitive and actor lacks permission, strip via validate with allowSensitive false
      // by selecting only non-sensitive defaults when columns omitted.
      if (needsSensitive) {
        return createTypedExecutionFailure({
          reportDefinitionId: definition.reportDefinitionId,
          executionId,
          availability: REPORT_AVAILABILITY.AUTHORIZATION_DENIED,
          errorCode: sens.code || REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
          errorMessage: sens.error || "Sensitive field authorization denied",
          provenance: {
            state: REPORT_PROVENANCE.UNAVAILABLE,
            fallbackReason: "sensitive_fields_denied",
          },
        });
      }
      allowSensitive = false;
    } else {
      allowSensitive = true;
    }
  }

  let selectedColumns;
  try {
    const columnRequest =
      request.columns == null && !allowSensitive
        ? definition.columns.filter((c) => !c.sensitive).map((c) => c.field)
        : request.columns;
    selectedColumns = validateColumnSelection(definition.columns, columnRequest, {
      allowSensitive,
    });
  } catch (err) {
    const code = isReportingError(err) ? err.code : REPORTING_ERROR_CODE.INVALID_COLUMN_SELECTION;
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability:
        code === REPORTING_ERROR_CODE.AUTHORIZATION_DENIED
          ? REPORT_AVAILABILITY.AUTHORIZATION_DENIED
          : REPORT_AVAILABILITY.INVALID_COLUMN_SELECTION,
      errorCode: code,
      errorMessage: err instanceof Error ? err.message : "Invalid column selection",
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "invalid_column_selection",
      },
    });
  }

  // 9. Resolve source
  if (!definition.source.configured || definition.source.kind === "UNAVAILABLE") {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
      errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
      errorMessage: "Report data source is not configured",
      sourceReferences: [definition.source],
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        sourceKind: definition.source.kind,
        fallbackReason: "source_not_configured",
      },
    });
  }

  if (!matchesReportDataSourcePort(deps.dataSource)) {
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
      errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
      errorMessage: "Report data source port is not wired",
      sourceReferences: [definition.source],
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        sourceKind: definition.source.kind,
        fallbackReason: "data_source_port_not_wired",
      },
    });
  }

  if (typeof deps.onSourceExecute === "function") {
    deps.onSourceExecute();
  }

  // 10–12. Execute + normalize
  try {
    const raw = await deps.dataSource.execute({
      definition,
      request,
      selectedColumns,
      executionId,
    });

    if (raw && raw.liveFailed === true) {
      assertNoSilentLiveToMockFallback({
        liveFailed: true,
        resultProvenance: raw.provenance?.state,
      });
      return createTypedExecutionFailure({
        reportDefinitionId: definition.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.SOURCE_FAILED,
        errorCode: REPORTING_ERROR_CODE.SOURCE_FAILED,
        errorMessage: raw.errorMessage || "Live source failed",
        sourceReferences: [definition.source],
        provenance: createProvenanceMetadata(
          raw.provenance || {
            state: REPORT_PROVENANCE.UNAVAILABLE,
            sourceKind: definition.source.kind,
            fallbackReason: "live_source_failed",
          }
        ),
      });
    }

    const availability = raw?.availability || REPORT_AVAILABILITY.AVAILABLE;
    const provenance = createProvenanceMetadata(
      raw?.provenance || {
        state: REPORT_PROVENANCE.LIVE,
        sourceKind: definition.source.kind,
        generatedAt: deps.clock?.now?.() || null,
      }
    );

    return createReportExecutionResult({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability,
      provenance,
      rows: raw?.rows || [],
      fields: selectedColumns,
      warnings: raw?.warnings || [],
      sourceReferences: [definition.source],
      payload: raw?.payload ?? null,
      errorCode: raw?.errorCode,
      errorMessage: raw?.errorMessage,
    });
  } catch (err) {
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED) {
      return createTypedExecutionFailure({
        reportDefinitionId: definition.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
        errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
        errorMessage: err.message,
        sourceReferences: [definition.source],
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          sourceKind: definition.source.kind,
          fallbackReason: "port_unimplemented",
        },
      });
    }
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED) {
      return createTypedExecutionFailure({
        reportDefinitionId: definition.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.SOURCE_FAILED,
        errorCode: err.code,
        errorMessage: err.message,
        sourceReferences: [definition.source],
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          sourceKind: definition.source.kind,
          fallbackReason: "silent_fallback_rejected",
        },
      });
    }
    return createTypedExecutionFailure({
      reportDefinitionId: definition.reportDefinitionId,
      executionId,
      availability: REPORT_AVAILABILITY.SOURCE_FAILED,
      errorCode: REPORTING_ERROR_CODE.SOURCE_FAILED,
      errorMessage: err instanceof Error ? err.message : "Source execution failed",
      sourceReferences: [definition.source],
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        sourceKind: definition.source.kind,
        fallbackReason: "source_threw",
      },
    });
  }
}
