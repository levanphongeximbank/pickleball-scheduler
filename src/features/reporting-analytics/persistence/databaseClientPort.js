/**
 * Narrow injectable database client contract for REPORTING-02 persistence.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

export const REPORTING_02_TABLES = Object.freeze({
  REPORT_DEFINITIONS: "reporting_report_definitions",
  SAVED_REPORTS: "reporting_saved_reports",
  SAVED_FILTERS: "reporting_saved_filters",
  EXECUTIONS: "reporting_executions",
  EXPORT_JOBS: "reporting_export_jobs",
});

/**
 * @param {object} client
 */
export function requireReportingDatabaseClientPort(client) {
  if (!client || typeof client !== "object") {
    throw new ReportingError(
      REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
      "ReportingDatabaseClientPort is required for durable reporting persistence."
    );
  }
  for (const method of ["select", "insert", "update", "delete", "rpc"]) {
    if (typeof client[method] !== "function") {
      throw new ReportingError(
        REPORTING_ERROR_CODE.REPOSITORY_UNAVAILABLE,
        `ReportingDatabaseClientPort.${method} must be a function.`,
        { method }
      );
    }
  }
  return Object.freeze({
    select: client.select.bind(client),
    insert: client.insert.bind(client),
    update: client.update.bind(client),
    delete: client.delete.bind(client),
    rpc: client.rpc.bind(client),
  });
}
