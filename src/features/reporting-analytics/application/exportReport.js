/**
 * Export orchestration foundation (REPORTING-01).
 * No production file generation / blob / storage writes.
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
import { matchesExportExecutorPort } from "../ports/repositoryPorts.js";
import { executeOperationalReport } from "./executeReport.js";

/**
 * @param {object} deps
 * @param {object} rawRequest
 */
export async function exportOperationalReport(deps, rawRequest) {
  const request = createExportRequest(rawRequest);
  const exportJobId = deps.idProvider
    ? deps.idProvider.nextId("xjob")
    : `xjob_${Date.now()}`;

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

  if (!matchesExportExecutorPort(deps.exportExecutor)) {
    return createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
      provenance: {
        state: REPORT_PROVENANCE.UNAVAILABLE,
        fallbackReason: "export_executor_not_configured",
      },
      errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
      errorMessage: "Export executor port is not configured",
    });
  }

  // Ensure report execute is also authorized + validated via execution foundation
  const execution = await executeOperationalReport(deps, {
    actor: request.actor,
    scope: request.scope,
    reportDefinitionId: request.reportDefinitionId,
    parameters: request.parameters,
    filters: request.filters,
    columns: request.columns.length ? request.columns : null,
  });

  if (!execution.ok) {
    return createExportJobResult({
      exportJobId,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: execution.availability,
      provenance: execution.provenance,
      errorCode: execution.errorCode,
      errorMessage: execution.errorMessage || "Export blocked by report execution failure",
      warnings: execution.warnings,
    });
  }

  try {
    const raw = await deps.exportExecutor.execute({
      request,
      execution,
      exportJobId,
    });
    return createExportJobResult({
      exportJobId,
      exportRecordId: raw?.exportRecordId || null,
      reportDefinitionId: request.reportDefinitionId,
      format: request.format,
      availability: raw?.availability || REPORT_AVAILABILITY.AVAILABLE,
      provenance: raw?.provenance || execution.provenance,
      outputReference: raw?.outputReference ?? null,
      warnings: raw?.warnings || [],
      errorCode: raw?.errorCode,
      errorMessage: raw?.errorMessage,
    });
  } catch (err) {
    if (isReportingError(err) && err.code === REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED) {
      return createExportJobResult({
        exportJobId,
        reportDefinitionId: request.reportDefinitionId,
        format: request.format,
        availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
        provenance: {
          state: REPORT_PROVENANCE.UNAVAILABLE,
          fallbackReason: "export_port_unimplemented",
        },
        errorCode: REPORTING_ERROR_CODE.SOURCE_NOT_CONFIGURED,
        errorMessage: err.message,
      });
    }
    return createExportJobResult({
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
  }
}
