import { REPORTING_ERROR_CODE } from "../../errors/errorCodes.js";
import { ReportingError } from "../../errors/ReportingError.js";
import { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "../databaseClientPort.js";
import { withReportingPersistenceErrors } from "../errorTranslation.js";
import { mapSavedFilterDomainToRow, mapSavedFilterRowToDomain } from "../mapping/reportingMapping.js";

export function createDurableSavedFilterRepository({ db } = {}) {
  const client = requireReportingDatabaseClientPort(db);
  return {
    async getById(savedFilterId) {
      return withReportingPersistenceErrors(async () => {
        const rows = await client.select({ table: REPORTING_02_TABLES.SAVED_FILTERS, filters: { saved_filter_id: String(savedFilterId) }, limit: 1 });
        return rows?.[0] ? mapSavedFilterRowToDomain(rows[0]) : null;
      });
    },
    async save(savedFilter) {
      return withReportingPersistenceErrors(async () => {
        const row = mapSavedFilterDomainToRow(savedFilter);
        const existing = await client.select({ table: REPORTING_02_TABLES.SAVED_FILTERS, filters: { saved_filter_id: row.saved_filter_id }, limit: 1 });
        if (!existing?.[0]) {
          const rows = await client.insert({ table: REPORTING_02_TABLES.SAVED_FILTERS, rows: row, returning: true });
          return mapSavedFilterRowToDomain(rows[0] || row);
        }
        const rows = await client.update({
          table: REPORTING_02_TABLES.SAVED_FILTERS,
          values: row,
          filters: { saved_filter_id: row.saved_filter_id, version: Number(row.version) - 1 },
          returning: true,
        });
        if (!rows?.[0]) throw new ReportingError(REPORTING_ERROR_CODE.VERSION_CONFLICT, "Saved filter version conflict.");
        return mapSavedFilterRowToDomain(rows[0]);
      });
    },
    async listByOwner(ownerId, tenantId = null) {
      return withReportingPersistenceErrors(async () =>
        (await client.select({
          table: REPORTING_02_TABLES.SAVED_FILTERS,
          filters: { owner_id: String(ownerId), ...(tenantId ? { tenant_id: String(tenantId) } : {}) },
          order: [{ column: "saved_filter_id", ascending: true }],
        })).map(mapSavedFilterRowToDomain)
      );
    },
    async deleteById(savedFilterId) {
      return withReportingPersistenceErrors(async () => {
        const count = await client.delete({ table: REPORTING_02_TABLES.SAVED_FILTERS, filters: { saved_filter_id: String(savedFilterId) } });
        if (!count) throw new ReportingError(REPORTING_ERROR_CODE.SAVED_FILTER_NOT_FOUND, "Saved filter not found.");
        return true;
      });
    },
  };
}
