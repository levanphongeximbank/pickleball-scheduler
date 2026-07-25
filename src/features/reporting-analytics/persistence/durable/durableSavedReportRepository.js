import { REPORTING_ERROR_CODE } from "../../errors/errorCodes.js";
import { ReportingError } from "../../errors/ReportingError.js";
import { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "../databaseClientPort.js";
import { withReportingPersistenceErrors } from "../errorTranslation.js";
import { mapSavedReportDomainToRow, mapSavedReportRowToDomain } from "../mapping/reportingMapping.js";

export function createDurableSavedReportRepository({ db } = {}) {
  const client = requireReportingDatabaseClientPort(db);
  return {
    async getById(savedReportId) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({ table: REPORTING_02_TABLES.SAVED_REPORTS, filters: { saved_report_id: String(savedReportId) }, limit: 1 });
        return rows?.[0] ? mapSavedReportRowToDomain(rows[0]) : null;
      });
    },
    async save(savedReport) {
      return withReportingPersistenceErrors(async () => {
        const row = mapSavedReportDomainToRow(savedReport);
        const existing = await client.select({ table: REPORTING_02_TABLES.SAVED_REPORTS, filters: { saved_report_id: row.saved_report_id }, limit: 1 });
        if (!existing?.[0]) {
          const rows = await client.insert({ table: REPORTING_02_TABLES.SAVED_REPORTS, rows: row, returning: true });
          return mapSavedReportRowToDomain(rows[0] || row);
        }
        const rows = await client.update({
          table: REPORTING_02_TABLES.SAVED_REPORTS,
          values: row,
          filters: { saved_report_id: row.saved_report_id, version: Number(row.version) - 1 },
          returning: true,
        });
        if (!rows?.[0]) throw new ReportingError(REPORTING_ERROR_CODE.VERSION_CONFLICT, "Saved report version conflict.");
        return mapSavedReportRowToDomain(rows[0]);
      });
    },
    async listByOwner(ownerId, tenantId = null) {
      return withReportingPersistenceErrors(async () =>
        (await client.select({
          table: REPORTING_02_TABLES.SAVED_REPORTS,
          filters: { owner_id: String(ownerId), ...(tenantId ? { tenant_id: String(tenantId) } : {}) },
          order: [{ column: "saved_report_id", ascending: true }],
        })).map(mapSavedReportRowToDomain)
      );
    },
    async deleteById(savedReportId) {
      return withReportingPersistenceErrors(async () => {
        const count = await client.delete({ table: REPORTING_02_TABLES.SAVED_REPORTS, filters: { saved_report_id: String(savedReportId) } });
        if (!count) throw new ReportingError(REPORTING_ERROR_CODE.SAVED_REPORT_NOT_FOUND, "Saved report not found.");
        return true;
      });
    },
  };
}
