import { REPORTING_ERROR_CODE } from "../../errors/errorCodes.js";
import { ReportingError } from "../../errors/ReportingError.js";
import { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "../databaseClientPort.js";
import { withReportingPersistenceErrors } from "../errorTranslation.js";
import { mapDefinitionDomainToRow, mapDefinitionRowToDomain } from "../mapping/reportingMapping.js";

export function createDurableReportDefinitionRepository({ db } = {}) {
  const client = requireReportingDatabaseClientPort(db);
  return {
    async getById(reportDefinitionId) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({
          table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
          filters: { report_definition_id: String(reportDefinitionId) },
          limit: 1,
        });
        return rows?.[0] ? mapDefinitionRowToDomain(rows[0]) : null;
      });
    },
    async save(definition) {
      return withReportingPersistenceErrors(async () => {
        const row = mapDefinitionDomainToRow(definition);
        const existing = await client.select({
          table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
          filters: { report_definition_id: row.report_definition_id },
          limit: 1,
        });
        if (!existing?.[0]) {
          const inserted = await client.insert({
            table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
            rows: row,
            returning: true,
          });
          return mapDefinitionRowToDomain(inserted[0] || row);
        }
        const updated = await client.update({
          table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
          values: row,
          filters: {
            report_definition_id: row.report_definition_id,
            version: Number(row.version) - 1,
          },
          returning: true,
        });
        if (!updated?.[0]) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.VERSION_CONFLICT,
            "Report definition version conflict."
          );
        }
        return mapDefinitionRowToDomain(updated[0]);
      });
    },
    async listByTenant(tenantId) {
      return withReportingPersistenceErrors(async () => {
        const tid = String(tenantId);
        const [scoped, platform] = await Promise.all([
          client.select({
            table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
            filters: { tenant_id: tid },
            order: [{ column: "report_definition_id", ascending: true }],
          }),
          client.select({
            table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
            filters: { scope_kind: "PLATFORM_CROSS_TENANT" },
            order: [{ column: "report_definition_id", ascending: true }],
          }),
        ]);
        const byId = new Map();
        for (const row of [...(scoped || []), ...(platform || [])]) {
          byId.set(row.report_definition_id, mapDefinitionRowToDomain(row));
        }
        return [...byId.values()];
      });
    },
    async deleteById(reportDefinitionId) {
      return withReportingPersistenceErrors(async () => {
        const count = await client.delete({
          table: REPORTING_02_TABLES.REPORT_DEFINITIONS,
          filters: { report_definition_id: String(reportDefinitionId) },
        });
        if (!count) {
          throw new ReportingError(REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND, "Report definition not found.");
        }
        return true;
      });
    },
  };
}
