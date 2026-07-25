import { REPORTING_ERROR_CODE } from "../../errors/errorCodes.js";
import { ReportingError } from "../../errors/ReportingError.js";
import {
  REPORT_EXECUTION_STATUS_TRANSITIONS,
  isAllowedLifecycleTransition,
} from "../../lifecycle/statuses.js";
import { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "../databaseClientPort.js";
import { withReportingPersistenceErrors } from "../errorTranslation.js";
import { mapExecutionDomainToRow, mapExecutionRowToDomain } from "../mapping/reportingMapping.js";

export function createDurableReportExecutionRepository({ db } = {}) {
  const client = requireReportingDatabaseClientPort(db);
  return {
    async getById(executionId) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({ table: REPORTING_02_TABLES.EXECUTIONS, filters: { execution_id: String(executionId) }, limit: 1 });
        return rows?.[0] ? mapExecutionRowToDomain(rows[0]) : null;
      });
    },
    async save(record) {
      return withReportingPersistenceErrors(async () => {
        const row = mapExecutionDomainToRow(record);
        const existingRows = await client.select({ table: REPORTING_02_TABLES.EXECUTIONS, filters: { execution_id: row.execution_id }, limit: 1 });
        if (!existingRows?.[0]) {
          const rows = await client.insert({ table: REPORTING_02_TABLES.EXECUTIONS, rows: row, returning: true });
          return mapExecutionRowToDomain(rows[0] || row);
        }
        const existing = existingRows[0];
        if (
          existing.status !== row.status &&
          !isAllowedLifecycleTransition(existing.status, row.status, REPORT_EXECUTION_STATUS_TRANSITIONS)
        ) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.INVALID_STATUS_TRANSITION,
            `Execution status cannot transition from ${existing.status} to ${row.status}.`
          );
        }
        const rows = await client.update({
          table: REPORTING_02_TABLES.EXECUTIONS,
          values: row,
          filters: { execution_id: row.execution_id, version: Number(row.version) - 1 },
          returning: true,
        });
        if (!rows?.[0]) throw new ReportingError(REPORTING_ERROR_CODE.VERSION_CONFLICT, "Execution version conflict.");
        return mapExecutionRowToDomain(rows[0]);
      });
    },
    async findByIdempotencyKey(tenantId, key) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({
          table: REPORTING_02_TABLES.EXECUTIONS,
          filters: { tenant_id: String(tenantId), idempotency_key: String(key) },
          limit: 1,
        });
        return rows?.[0] ? mapExecutionRowToDomain(rows[0]) : null;
      });
    },
    async listByTenant(tenantId) {
      return withReportingPersistenceErrors(async () =>
        (await client.select({
          table: REPORTING_02_TABLES.EXECUTIONS,
          filters: { tenant_id: String(tenantId) },
          order: [{ column: "created_at", ascending: false }],
        })).map(mapExecutionRowToDomain)
      );
    },
    async deleteById(executionId) {
      return withReportingPersistenceErrors(async () => {
        const count = await client.delete({ table: REPORTING_02_TABLES.EXECUTIONS, filters: { execution_id: String(executionId) } });
        if (!count) throw new ReportingError(REPORTING_ERROR_CODE.EXECUTION_NOT_FOUND, "Execution not found.");
        return true;
      });
    },
  };
}
