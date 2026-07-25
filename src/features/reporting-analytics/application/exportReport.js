/**
 * Export orchestration (REPORTING-01 + REPORTING-02 durable job lifecycle).
 * Operates on presentation-ready report results. No production blob writes
 * unless an injected ArtifactStoragePort is configured.
 */

import { REPORT_AVAILABILITY } from "../constants/availability.js";
import { REPORT_PROVENANCE } from "../constants/provenance.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { isReportingError } from "../errors/ReportingError.js";
import { authorizeExport } from "../authorization/reportingAuthorize.js";
import {
  createExportJobResult,
  createExportRequest,
} from "../contracts/export.js";
import { createExportJobRecord } from "../contracts/persistenceRecords.js";
import {
  REPORT_EXPORT_JOB_STATUS,
  REPORT_EXPORT_JOB_STATUS_TRANSITIONS,
  isAllowedLifecycleTransition,
} from "../lifecycle/statuses.js";
import {
  matchesExportExecutorPort,
  matchesExportJobRepositoryPort,
} from "../ports/repositoryPorts.js";
import { executeOperationalReport } from "./executeReport.js";

/**
 * @param {object} deps
 * @param {object} record
 */
async function persistExportJob(deps, record) {
  if (!matchesExportJobRepositoryPort(deps.exportJobs)) return null;
  return deps.exportJobs.save(createExportJobRecord(record));
}

/**
 * @param {object} deps
 * @param {object} existing
 * @param {object} patch
 */
async function transitionExportJob(deps, existing, patch) {
  if (!matchesExportJobRepositoryPort(deps.exportJobs)) return null;
  const nextStatus = patch.status || existing.status;
  if (
    nextStatus !== existing.status &&
    !isAllowedLifecycleTransition(
      existing.status,
      nextStatus,
      REPORT_EXPORT_JOB_STATUS_TRANSITIONS
    )
  ) {
    throw Object.assign(
      new Error(`Invalid export status transition ${existing.status} → ${nextStatus}`),
      { code: REPORTING_ERROR_CODE.INVALID_STATUS_TRANSITION }
    );
  }
  return deps.exportJobs.save(
    createExportJobRecord({
      ...existing,
      ...patch,
      version: Number(existing.version || 1) + 1,
    })
  );
}

/**
 * @param {object} record
 */
function resultFromExportJobRecord(record) {
  if (
    record.status === REPORT_EXPORT_JOB_STATUS.SUCCEEDED ||
    record.status === REPORT_EXPORT_JOB_STATUS.FAILED ||
    record.status === REPORT_EXPORT_JOB_STATUS.UNAVAILABLE
  ) {
    const availability =
      record.status === REPORT_EXPORT_JOB_STATUS.SUCCEEDED
        ? REPORT_AVAILABILITY.AVAILABLE
        : REPORT_AVAILABILITY.UNAVAILABLE;
    return createExportJobResult({
      exportJobId: record.exportJobId,
      exportRecordId: record.exportRecordId,
      reportDefinitionId: record.reportDefinitionId,
      format: record.format,
      availability,
      provenance: {
        state:
          record.status === REPORT_EXPORT_JOB_STATUS.SUCCEEDED
            ? REPORT_PROVENANCE.LIVE
            : REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "durable_export_replay",
      },
      outputReference:
        record.status === REPORT_EXPORT_JOB_STATUS.SUCCEEDED
          ? record.outputArtifactReference
          : null,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
    });
  }
  return createExportJobResult({
    exportJobId: record.exportJobId,
    reportDefinitionId: record.reportDefinitionId,
    format: record.format,
    availability: REPORT_AVAILABILITY.UNAVAILABLE,
    provenance: {
      state: REPORT_PROVENANCE.UNAVAILABLE,
      fallbackReason: "idempotency_in_progress",
    },
    errorCode: REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT,
    errorMessage: "Export job with this idempotency key is already in progress",
  });
}

/**
 * @param {object} deps
 * @param {object} rawRequest
 */
export async function exportOperationalReport(deps, rawRequest) {
  const request = createExportRequest(rawRequest);
  const now = deps.clock?.now?.() || new Date().toISOString();
  const exportJobId = deps.idProvider
    ? deps.idProvider.nextId("xjob")
    : `xjob_${Date.now()}`;
  const idempotencyKey = request.idempotencyKey || exportJobId;

  if (matchesExportJobRepositoryPort(deps.exportJobs)) {
    const prior = await deps.exportJobs.findByIdempotencyKey(
      request.scope.tenantId,
      idempotencyKey
    );
    if (prior) return resultFromExportJobRecord(prior);
  }

  const auth = authorizeExport(request.actor, request.scope);
  if (!auth.ok) {
    return createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: REPORT_AVAILABILITY.AUTHORIZATION_DENIED,
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "export_authorization_denied",
      },
      errorCode: auth.code || REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
      errorMessage: auth.error || "Export authorization denied",
    });
  }

  let jobRecord = null;
  if (matchesExportJobRepositoryPort(deps.exportJobs)) {
    try {
      jobRecord = await persistExportJob(deps, {
        exportJobId,
        reportDefinitionId: request.reportDefinitionId,
        executionId: request.executionId || null,
        actorId: auth.actor.userId,
        scope: request.scope,
        format: request.format,
        selectedColumns: request.columns,
        idempotencyKey,
        status: REPORT_EXPORT_JOB_STATUS.PENDING,
        authorizationOutcome: "ALLOWED",
        contentMetadata: {},
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      jobRecord = await transitionExportJob(deps, jobRecord, {
        status: REPORT_EXPORT_JOB_STATUS.RUNNING,
        startedAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if (
        isReportingError(err) &&
        (err.code === REPORTING_ERROR_CODE.DUPLICATE_IDENTITY ||
          err.code === REPORTING_ERROR_CODE.IDEMPOTENCY_CONFLICT)
      ) {
        const prior = await deps.exportJobs.findByIdempotencyKey(
          request.scope.tenantId,
          idempotencyKey
        );
        if (prior) return resultFromExportJobRecord(prior);
      }
      return createExportJobResult({
        exportJobId,
        reportDefinitionId: request.reportDefinitionId,
        format: request.format,
        availability: REPORT_AVAILABILITY.UNAVAILABLE,
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "export_reserve_failed",
        },
        errorCode: isReportingError(err)
          ? err.code
          : REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
        errorMessage: err instanceof Error ? err.message : "Failed to reserve export job",
      });
    }
  }

  if (!matchesExportExecutorPort(deps.exportExecutor)) {
    const result = createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "export_executor_not_configured",
      },
      errorCode: REPORTING_ERROR_CODE.EXPORT_EXECUTOR_NOT_CONFIGURED,
      errorMessage: "Export executor port is not configured",
    });
    if (jobRecord) {
      await transitionExportJob(deps, jobRecord, {
        status: REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return result;
  }

  const execution = await executeOperationalReport(deps, {
    actor: request.actor,
    scope: request.scope,
    reportDefinitionId: request.reportDefinitionId,
    parameters: request.parameters,
    filters: request.filters,
    columns: request.columns.length ? request.columns : null,
    idempotencyKey: request.executionId
      ? `export-exec:${request.executionId}`
      : `export-exec:${idempotencyKey}`,
    correlationId: request.executionId || undefined,
  });

  if (!execution.ok) {
    const result = createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: execution.availability,
      provenance: execution.provenance,
      errorCode: execution.errorCode,
      errorMessage: execution.errorMessage || "Export blocked by report execution failure",
      warnings: execution.warnings,
    });
    if (jobRecord) {
      await transitionExportJob(deps, jobRecord, {
        status: REPORT_EXPORT_JOB_STATUS.FAILED,
        executionId: execution.executionId || null,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return result;
  }

  try {
    const raw = await deps.exportExecutor.execute({
      request,
      execution,
      exportJobId,
    });

    const availability = raw?.availability || REPORT_AVAILABILITY.AVAILABLE;
    const outputReference = raw?.outputReference ?? null;
    const errorCode = raw?.errorCode;
    const ok =
      availability === REPORT_AVAILABILITY.AVAILABLE ||
      availability === REPORT_AVAILABILITY.STALE ||
      availability === REPORT_AVAILABILITY.PARTIAL;

    if (!ok || !outputReference) {
      const failCode =
        errorCode ||
        (errorCode === REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
          ? REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
          : raw?.errorCode) ||
        (availability === REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
          ? REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
          : REPORTING_ERROR_CODE.SOURCE_FAILED);
      const result = createExportJobResult({
        exportJobId,
        exportRecordId: raw?.exportRecordId || null,
        reportDefinitionId: request.reportDefinitionId,
        format: request.format,
        availability:
          failCode === REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
            ? REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
            : availability === REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
              ? REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
              : REPORT_AVAILABILITY.SOURCE_FAILED,
        provenance: raw?.provenance || {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "export_executor_unsuccessful",
        },
        outputReference: null,
        warnings: raw?.warnings || [],
        errorCode:
          raw?.errorCode ||
          (availability === REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
            ? REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
            : REPORTING_ERROR_CODE.SOURCE_FAILED),
        errorMessage: raw?.errorMessage || "Export did not produce an artifact reference",
      });
      if (jobRecord) {
        await transitionExportJob(deps, jobRecord, {
          status:
            result.errorCode === REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED ||
            result.errorCode === REPORTING_ERROR_CODE.EXPORT_EXECUTOR_NOT_CONFIGURED
              ? REPORT_EXPORT_JOB_STATUS.UNAVAILABLE
              : REPORT_EXPORT_JOB_STATUS.FAILED,
          executionId: execution.executionId,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          outputArtifactReference: null,
          completedAt: deps.clock?.now?.() || now,
          updatedAt: deps.clock?.now?.() || now,
        });
      }
      return result;
    }

    const result = createExportJobResult({
      exportJobId,
      exportRecordId: raw?.exportRecordId || null,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability,
      provenance: raw?.provenance || execution.provenance,
      outputReference,
      warnings: raw?.warnings || [],
      errorCode: raw?.errorCode,
      errorMessage: raw?.errorMessage,
    });

    if (jobRecord) {
      await transitionExportJob(deps, jobRecord, {
        status: REPORT_EXPORT_JOB_STATUS.SUCCEEDED,
        executionId: execution.executionId,
        exportRecordId: result.exportRecordId,
        outputArtifactReference: outputReference,
        contentMetadata: {
          format: request.format,
          columnCount: Array.isArray(request.columns) ? request.columns.length : 0,
        },
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }

    return result;
  } catch (err) {
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED) {
      const result = createExportJobResult({
        exportJobId,
        reportDefinitionId: request.reportDefinitionId,
        format: request.format,
        availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "export_port_unimplemented",
        },
        errorCode: REPORTING_ERROR_CODE.EXPORT_EXECUTOR_NOT_CONFIGURED,
        errorMessage: err.message,
      });
      if (jobRecord) {
        await transitionExportJob(deps, jobRecord, {
          status: REPORT_EXPORT_JOB_STATUS.UNAVAILABLE,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          completedAt: deps.clock?.now?.() || now,
          updatedAt: deps.clock?.now?.() || now,
        });
      }
      return result;
    }
    const result = createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: REPORT_AVAILABILITY.SOURCE_FAILED,
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "export_executor_failed",
      },
      errorCode: REPORTING_ERROR_CODE.SOURCE_FAILED,
      errorMessage: err instanceof Error ? err.message : "Export executor failed",
    });
    if (jobRecord) {
      await transitionExportJob(deps, jobRecord, {
        status: REPORT_EXPORT_JOB_STATUS.FAILED,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        completedAt: deps.clock?.now?.() || now,
        updatedAt: deps.clock?.now?.() || now,
      });
    }
    return result;
  }
}
