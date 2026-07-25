/**
 * Built-in export executor using presentation renderer + optional artifact storage.
 */

import { REPORT_AVAILABILITY } from "../constants/availability.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { isReportingError } from "../errors/ReportingError.js";
import { renderPresentationExport } from "./presentationRenderer.js";
import { matchesArtifactStoragePort } from "./artifactStoragePort.js";

/**
 * @param {{
 *   artifactStorage?: object,
 *   idProvider?: { nextId: (prefix?: string) => string },
 * }} [deps]
 */
export function createPresentationExportExecutor(deps = {}) {
  return {
    async execute({ request, execution, exportJobId }) {
      if (!matchesArtifactStoragePort(deps.artifactStorage)) {
        return {
          availability: REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED,
          errorCode: REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED,
          errorMessage: "Export artifact storage is not configured",
          outputReference: null,
        };
      }

      const columns =
        (request.columns && request.columns.length
          ? request.columns
          : (execution.fields || []).map((f) => (typeof f === "string" ? f : f.field))
        ).filter(Boolean);

      try {
        const rendered = renderPresentationExport({
          format: request.format,
          columns,
          rows: execution.rows || [],
        });
        const artifact = await deps.artifactStorage.put({
          exportJobId,
          format: rendered.format,
          contentType: rendered.contentType,
          body: rendered.body,
          byteLength: rendered.byteLength,
          metadata: {
            reportDefinitionId: request.reportDefinitionId,
            executionId: execution.executionId,
            columnCount: columns.length,
            rowCount: Array.isArray(execution.rows) ? execution.rows.length : 0,
          },
        });
        const exportRecordId = deps.idProvider
          ? deps.idProvider.nextId("xrec")
          : `xrec_${exportJobId}`;
        return {
          exportRecordId,
          availability: REPORT_AVAILABILITY.AVAILABLE,
          provenance: execution.provenance,
          outputReference: artifact,
          warnings: [],
        };
      } catch (err) {
        if (isReportingError(err)) {
          return {
            availability:
              err.code === REPORTING_ERROR_CODE.EXPORT_STORAGE_NOT_CONFIGURED
                ? REPORT_AVAILABILITY.SOURCE_NOT_CONFIGURED
                : REPORT_AVAILABILITY.SOURCE_FAILED,
            errorCode: err.code,
            errorMessage: err.message,
            outputReference: null,
          };
        }
        return {
          availability: REPORT_AVAILABILITY.SOURCE_FAILED,
          errorCode: REPORTING_ERROR_CODE.SOURCE_FAILED,
          errorMessage: err instanceof Error ? err.message : "Export render failed",
          outputReference: null,
        };
      }
    },
  };
}
