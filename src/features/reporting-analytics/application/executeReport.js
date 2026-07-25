/**
 * Report execution orchestration (REPORTING-01 + REPORTING-02 durable lifecycle).
 *
 * validate → resolve definition/saved configs → authorize → validate params
 * → reserve execution (idempotency) → source execute → persist metadata → finalize.
 * No analytical runtime. No silent live→mock fallback. No raw sensitive row persistence.
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
  createReportExecutionRecord,
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
import {
  REPORT_EXECUTION_STATUS,
  REPORT_EXECUTION_STATUS_TRANSITIONS,
  isAllowedLifecycleTransition,
} from "../lifecycle/statuses.js";
import {
  matchesReportDataSourcePort,
  matchesReportExecutionRepositoryPort,
} from "../ports/repositoryPorts.js";

/**
 * @param {object} deps
 * @param {object} record
 */
async function persistExecution(deps, record) {
  if (!matchesReportExecutionRepositoryPort(deps.executions)) return null;
  return deps.executions.save(createReportExecutionRecord(record));
}

/**
 * @param {object} deps
 * @param {object} existing
 * @param {object} patch
 */
async function transitionExecution(deps, existing, patch) {
  if (!matchesReportExecutionRepositoryPort(deps.executions)) return null;
  const nextStatus = patch.status || existing.status;
  if (
    nextStatus !== existing.status &&
    !isAllowedLifecycleTransition(
      existing.status,
      nextStatus,
      REPORT_EXECUTION_STATUS_TRANSITIONS
    )
  ) {
    throw Object.assign(
      new Error(`Invalid execution status transition ${existing.status} → ${nextStatus}`),
      { code: REPORTING_ERROR_CODE.INVALID_STATUS_TRANSITION }
    );
  }
  return deps.executions.save(
    createReportExecutionRecord({
      ...existing,
      ...patch,
      version: Number(existing.version || 1) + 1,
    })
  );
}

/**
 * Build a result from a durable execution record (idempotent retry).
 * @param {object} record
 */
function resultFromExecutionRecord(record) {
  if (
    record.status === REPORT_EXECUTION_STATUS.SUCCEEDED ||
    record.status === REPORT_EXECUTION_STATUS.FAILED ||
    record.status === REPORT_EXECUTION_STATUS.UNAVAILABLE
  ) {
    const availability =
      record.availability ||
      (record.status === REPORT_EXECUTION_STATUS.SUCCEEDED
        ? REPORT_AVAILABILITY.AVAILABLE
        : REPORT_AVAILABILITY.UNAVAILABLE);
    return createReportExecutionResult({
      reportDefinitionId: record.reportDefinitionId,
      executionId: record.executionId,
      availability,
      provenance: record.provenance,
      rows: [],
      fields: [],
      warnings: record.warningCodes || [],
      sourceReferences: record.sourceReferences || [],
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      payload: {
        durableReplay: true,
        status: record.status,
        rowCount: record.rowCount || 0,
      },
    });
  }
  return createTypedExecutionFailure({
    reportDefinitionId: record.reportDefinitionId,
    executionId: record.executionId,
    availability: REPORT_AVAILABILITY.UNAVAILABLE,
    errorCode: REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT,
    errorMessage: "Execution with this idempotency key is already in progress",
    provenance: {
      state: REPORT_PROVENANCE.UNAVAILABLE,
      fallbackReason: "idempotency_in_progress",
    },
  });
}

/**
 * @param {object} deps
 * @param {object} rawRequest
 */
export async function executeOperationalReport(deps, rawRequest) {
  const request = createReportExecutionRequest(rawRequest);
  const now = deps.clock?.now?.() || new Date().toISOString();
  const executionId =
    request.correlationId ||
    (deps.idProvider ? deps.idProvider.nextId("rex") : `rex_${Date.now()}`);
  const idempotencyKey =
    request.idempotencyKey || request.correlationId || executionId;

  // Idempotent replay before any source work
  if (matchesReportExecutionRepositoryPort(deps.executions)) {
    const prior = await deps.executions.findByIdempotencyKey(
      request.scope.tenantId,
      idempotencyKey
    );
    if (prior) {
      return resultFromExecutionRecord(prior);
    }
  }

  // Resolve saved report / filter overlays (optional)
  let effectiveRequest = request;
  if (request.savedReportId) {
    if (!deps.savedReports || typeof deps.savedReports.getById !== "function") {
      return createTypedExecutionFailure({
        reportDefinitionId: request.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: REPORTING_ERROR_CODE.SAVED_REPORT_NOT_FOUND,
        errorMessage: "Saved report repository is not configured",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_report_repository_missing",
        },
      });
    }
    const saved = await deps.savedReports.getById(request.savedReportId);
    if (!saved) {
      return createTypedExecutionFailure({
        reportDefinitionId: request.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: REPORTING_ERROR_CODE.SAVED_REPORT_NOT_FOUND,
        errorMessage: "Saved report not found",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_report_not_found",
        },
      });
    }
    if (!reportScopesEqual(saved.scope, request.scope)) {
      return createTypedExecutionFailure({
        reportDefinitionId: request.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.INVALID_SCOPE,
        errorCode: REPORTING_ERROR_CODE.INVALID_SCOPE,
        errorMessage: "Saved report scope does not match request scope",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_report_scope_mismatch",
        },
      });
    }
    effectiveRequest = createReportExecutionRequest({
      ...request,
      reportDefinitionId: saved.reportDefinitionId || request.reportDefinitionId,
      parameters: { ...saved.parameters, ...request.parameters },
      filters: request.filters.length ? request.filters : saved.filters,
      sorting: request.sorting.length ? request.sorting : saved.sorting,
      grouping: request.grouping.length ? request.grouping : saved.grouping,
      columns: request.columns != null ? request.columns : saved.columns,
    });
  }

  if (effectiveRequest.savedFilterId || request.savedFilterId) {
    const savedFilterId = effectiveRequest.savedFilterId || request.savedFilterId;
    if (!deps.savedFilters || typeof deps.savedFilters.getById !== "function") {
      return createTypedExecutionFailure({
        reportDefinitionId: effectiveRequest.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: REPORTING_ERROR_CODE.SAVED_FILTER_NOT_FOUND,
        errorMessage: "Saved filter repository is not configured",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_filter_repository_missing",
        },
      });
    }
    const savedFilter = await deps.savedFilters.getById(savedFilterId);
    if (!savedFilter) {
      return createTypedExecutionFailure({
        reportDefinitionId: effectiveRequest.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: REPORTING_ERROR_CODE.SAVED_FILTER_NOT_FOUND,
        errorMessage: "Saved filter not found",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_filter_not_found",
        },
      });
    }
    if (!reportScopesEqual(savedFilter.scope, effectiveRequest.scope)) {
      return createTypedExecutionFailure({
        reportDefinitionId: effectiveRequest.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.INVALID_SCOPE,
        errorCode: REPORTING_ERROR_CODE.INVALID_SCOPE,
        errorMessage: "Saved filter scope does not match request scope",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "saved_filter_scope_mismatch",
        },
      });
    }
    effectiveRequest = createReportExecutionRequest({
      ...effectiveRequest,
      filters: effectiveRequest.filters.length
        ? effectiveRequest.filters
        : savedFilter.filters,
    });
  }

  // Resolve definition
  if (!deps.reportDefinitions || typeof deps.reportDefinitions.getById !== "function") {
    return createTypedExecutionFailure({
      reportDefinitionId: effectiveRequest.reportDefinitionId,
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

  let definition;
  try {
    definition = await deps.reportDefinitions.getById(effectiveRequest.reportDefinitionId);
  } catch (err) {
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE) {
      return createTypedExecutionFailure({
        reportDefinitionId: effectiveRequest.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
        errorMessage: err.message,
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "repository_unavailable",
        },
      });
    }
    throw err;
  }

  if (!definition) {
    return createTypedExecutionFailure({
      reportDefinitionId: effectiveRequest.reportDefinitionId,
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

  if (!reportScopesEqual(effectiveRequest.scope, definition.scope)) {
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

  // Authorize BEFORE source / before durable running transition
  const auth = authorizeExecuteReport(effectiveRequest.actor, effectiveRequest.scope);
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

  if (typeof deps.onAuthorized === "function") {
    deps.onAuthorized({ permission: REPORTING_PERMISSIONS.REPORT_EXECUTE });
  }

  try {
    validateParameterValues(definition.parameters, effectiveRequest.parameters);
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
    validateFilterValues(definition.filterDefinitions, effectiveRequest.filters);
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
    validateSorting(definition.sortableFields, effectiveRequest.sorting);
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
    validateGrouping(definition.groupableFields, effectiveRequest.grouping);
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

  const needsSensitive = (effectiveRequest.columns || [])
    .map(String)
    .some((field) => definition.columns.some((c) => c.field === field && c.sensitive));
  const defaultNeedsSensitive =
    effectiveRequest.columns == null &&
    definition.columns.some((c) => c.sensitive && c.defaultSelected !== false);

  let allowSensitive = false;
  if (needsSensitive || defaultNeedsSensitive) {
    const sens = authorizeSensitiveFields(effectiveRequest.actor, effectiveRequest.scope);
    if (!sens.ok) {
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
      effectiveRequest.columns == null && !allowSensitive
        ? definition.columns.filter((c) => !c.sensitive).map((c) => c.field)
        : effectiveRequest.columns;
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

  // Reserve durable execution (PENDING → RUNNING) before source
  let executionRecord = null;
  if (matchesReportExecutionRepositoryPort(deps.executions)) {
    try {
      executionRecord = await persistExecution(deps, {
        executionId,
        reportDefinitionId: definition.reportDefinitionId,
        savedReportId: request.savedReportId || null,
        savedFilterId: request.savedFilterId || null,
        actorId: auth.actor.userId,
        scope: effectiveRequest.scope,
        idempotencyKey,
        requestSnapshot: {
          parameters: effectiveRequest.parameters,
          filters: effectiveRequest.filters,
          sorting: effectiveRequest.sorting,
          grouping: effectiveRequest.grouping,
          columns: selectedColumns.map((c) => c.field || c),
          purpose: effectiveRequest.purpose,
        },
        status: REPORT_EXECUTION_STATUS.PENDING,
        provenance: { state: REPORT_PROVENANCE.UNAVAILABLE },
        freshness: {},
        sourceReferences: [definition.source],
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      executionRecord = await transitionExecution(deps, executionRecord, {
        status: REPORT_EXECUTION_STATUS.RUNNING,
        startedAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (
        isReportingError(err) &&
        (err.code === REPORTING_ERROR_CODE.DUPLICATE_IDENTITY ||
          err.code === REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT)
      ) {
        const prior = await deps.executions.findByIdempotencyKey(
          effectiveRequest.scope.tenantId,
          idempotencyKey
        );
        if (prior) return resultFromExecutionRecord(prior);
      }
      return createTypedExecutionFailure({
        reportDefinitionId: definition.reportDefinitionId,
        executionId,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        errorCode: isReportingError(err)
          ? err.code
          : REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
        errorMessage: err instanceof Error ? err.message : "Failed to reserve execution",
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "execution_reserve_failed",
        },
      });
    }
  }

  if (!definition.source.configured || definition.source.kind === "UNAVAILABLE") {
    const failure = createTypedExecutionFailure({
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
    if (executionRecord) {
      await transitionExecution(deps, executionRecord, {
        status: REPORT_EXECUTION_STATUS.UNAVAILABLE,
        availability: failure.availability,
        provenance: failure.provenance,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return failure;
  }

  if (!matchesReportDataSourcePort(deps.dataSource)) {
    const failure = createTypedExecutionFailure({
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
    if (executionRecord) {
      await transitionExecution(deps, executionRecord, {
        status: REPORT_EXECUTION_STATUS.UNAVAILABLE,
        availability: failure.availability,
        provenance: failure.provenance,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return failure;
  }

  if (typeof deps.onSourceExecute === "function") {
    deps.onSourceExecute();
  }

  try {
    const raw = await deps.dataSource.execute({
      definition,
      request: effectiveRequest,
      selectedColumns,
      executionId,
    });

    if (raw && raw.liveFailed === true) {
      assertNoSilentLiveToMockFallback({
        liveFailed: true,
        resultProvenance: raw.provenance?.state,
      });
      const failure = createTypedExecutionFailure({
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
      if (executionRecord) {
        await transitionExecution(deps, executionRecord, {
          status: REPORT_EXECUTION_STATUS.FAILED,
          availability: failure.availability,
          provenance: failure.provenance,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          rowCount: 0,
          completedAt: deps.clock?.now?.() || now,
          updatedAt: deps.clock?.now?.() || now,
        });
      }
      return failure;
    }

    const availability = raw?.availability || REPORT_AVAILABILITY.AVAILABLE;
    const provenance = createProvenanceMetadata(
      raw?.provenance || {
        state: REPORT_PROVENANCE.LIVE,
        sourceKind: definition.source.kind,
        generatedAt: deps.clock?.now?.() || null,
      }
    );
    const result = createReportExecutionResult({
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

    if (executionRecord) {
      const terminalStatus = result.ok
        ? REPORT_EXECUTION_STATUS.SUCCEEDED
        : availability === REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED ||
            availability === REPORT_AVAILABILITY.UNAVAILABLE
          ? REPORT_EXECUTION_STATUS.UNAVAILABLE
          : REPORT_EXECUTION_STATUS.FAILED;
      await transitionExecution(deps, executionRecord, {
        status: terminalStatus,
        availability,
        provenance,
        freshness: {
          generatedAt: provenance.generatedAt || null,
          observedAt: provenance.observedAt || null,
          lastSuccessfulRefreshAt: provenance.lastSuccessfulRefreshAt || null,
        },
        sourceReferences: [definition.source],
        rowCount: result.ok ? result.rows.length : 0,
        warningCodes: result.warnings,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }

    return result;
  } catch (err) {
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED) {
      const failure = createTypedExecutionFailure({
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
      if (executionRecord) {
        await transitionExecution(deps, executionRecord, {
          status: REPORT_EXECUTION_STATUS.UNAVAILABLE,
          availability: failure.availability,
          provenance: failure.provenance,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          completedAt: deps.clock?.now?.() || now,
          updatedAt: deps.clock?.now?.() || now,
        });
      }
      return failure;
    }
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.SILENT_FALLBACK_REJECTED) {
      const failure = createTypedExecutionFailure({
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
      if (executionRecord) {
        await transitionExecution(deps, executionRecord, {
          status: REPORT_EXECUTION_STATUS.FAILED,
          availability: failure.availability,
          provenance: failure.provenance,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          completedAt: deps.clock?.now?.() || now,
          updatedAt: deps.clock?.now?.() || now,
        });
      }
      return failure;
    }
    const failure = createTypedExecutionFailure({
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
    if (executionRecord) {
      await transitionExecution(deps, executionRecord, {
        status: REPORT_EXECUTION_STATUS.FAILED,
        availability: failure.availability,
        provenance: failure.provenance,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return failure;
  }
}
