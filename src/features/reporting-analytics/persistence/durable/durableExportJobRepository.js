import { REPORTING_ERROR_CODE } from "../../errors/errorCodes.js";
import { ReportingError } from "../../errors/ReportingError.js";
import {
  REPORT_EXPORT_JOB_STATUS,
  REPORT_EXPORT_JOB_STATUS_TRANSITIONS,
  isAllowedLifecycleTransition,
} from "../../lifecycle/statuses.js";
import { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "../databaseClientPort.js";
import { withReportingPersistenceErrors } from "../errorTranslation.js";
import { mapExportJobDomainToRow, mapExportJobRowToDomain } from "../mapping/reportingMapping.js";

export function createDurableExportJobRepository({ db } = {}) {
  const client = requireReportingDatabaseClientPort(db);
  return {
    async getById(exportJobId) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({ table: REPORTING_02_TABLES.EXPORT_JOBS, filters: { export_job_id: String(exportJobId) }, limit: 1 });
        return rows?.[0] ? mapExportJobRowToDomain(rows[0]) : null;
      });
    },
    async save(job) {
      return withReportingPersistenceErrors(async () => {
        const row = mapExportJobDomainToRow(job);
        if (row.status === REPORT_EXPORT_JOB_STATUS.SUCCEEDED && !row.output_artifact_reference) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.INVALID_CONTRACT,
            "A succeeded export job requires outputArtifactReference."
          );
        }
        const existingRows = await client.select({ table: REPORTING_02_TABLES.EXPORT_JOBS, filters: { export_job_id: row.export_job_id }, limit: 1 });
        if (!existingRows?.[0]) {
          const rows = await client.insert({ table: REPORTING_02_TABLES.EXPORT_JOBS, rows: row, returning: true });
          return mapExportJobRowToDomain(rows[0] || row);
        }
        const existing = existingRows[0];
        if (
          existing.status !== row.status &&
          !isAllowedLifecycleTransition(existing.status, row.status, REPORT_EXPORT_JOB_STATUS_TRANSITIONS)
        ) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.INVALID_STATUS_TRANSITION,
            `Export job status cannot transition from ${existing.status} to ${row.status}.`
          );
        }
        const rows = await client.update({
          table: REPORTING_02_TABLES.EXPORT_JOBS,
          values: row,
          filters: { export_job_id: row.export_job_id, version: Number(row.version) - 1 },
          returning: true,
        });
        if (!rows?.[0]) throw new ReportingError(REPORTING_ERROR_CODE.VERSION_CONFLICT, "Export job version conflict.");
        return mapExportJobRowToDomain(rows[0]);
      });
    },
    async findByIdempotencyKey(tenantId, key) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({
          table: REPORTING_02_TABLES.EXPORT_JOBS,
          filters: { tenant_id: String(tenantId), idempotency_key: String(key) },
          limit: 1,
        });
        return rows?.[0] ? mapExportJobRowToDomain(rows[0]) : null;
      });
    },
    async listByTenant(tenantId) {
      return withReportingPersistenceErrors(async () =>
        (await client.select({
          table: REPORTING_02_TABLES.EXPORT_JOBS,
          filters: { tenant_id: String(tenantId) },
          order: [{ column: "created_at", ascending: false }],
        })).map(mapExportJobRowToDomain)
      );
    },
    async deleteById(exportJobId) {
      return withReportingPersistenceErrors(async () => {
        const count = await client.delete({ table: REPORTING_02_TABLES.EXPORT_JOBS, filters: { export_job_id: String(exportJobId) } });
        if (!count) throw new ReportingError(REPORTING_ERROR_CODE.EXPORT_JOB_NOT_FOUND, "Export job not found.");
        return true;
      });
    },
  };
}
