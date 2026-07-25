/**
 * Repository and executor ports (REPORTING-01) — contracts only; no durable adapter.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";

export const REPORT_DEFINITION_REPOSITORY_METHODS = Object.freeze([
  "getById",
  "save",
  "listByTenant",
  "deleteById",
]);

export const SAVED_REPORT_REPOSITORY_METHODS = Object.freeze([
  "getById",
  "save",
  "listByOwner",
  "deleteById",
]);

export const SAVED_FILTER_REPOSITORY_METHODS = Object.freeze([
  "getById",
  "save",
  "listByOwner",
  "deleteById",
]);

export const EXPORT_JOB_REPOSITORY_METHODS = Object.freeze([
  "getById",
  "save",
  "findByIdempotencyKey",
  "listByTenant",
  "deleteById",
]);

export const REPORT_EXECUTION_REPOSITORY_METHODS = Object.freeze([
  "getById",
  "save",
  "findByIdempotencyKey",
  "listByTenant",
  "deleteById",
]);

export const REPORT_DATA_SOURCE_PORT_METHODS = Object.freeze(["execute"]);

export const EXPORT_EXECUTOR_PORT_METHODS = Object.freeze(["execute"]);

export const REPORTING_REPOSITORY_PORTS = Object.freeze({
  reportDefinitions: "reportDefinitions",
  savedReports: "savedReports",
  savedFilters: "savedFilters",
  executions: "executions",
  exportJobs: "exportJobs",
});

/**
 * @param {unknown} port
 * @param {ReadonlyArray<string>} methods
 */
function matchesMethods(port, methods) {
  if (!port || typeof port !== "object") return false;
  return methods.every(
    (m) => typeof /** @type {Record<string, unknown>} */ (port)[m] === "function"
  );
}

export function matchesReportDefinitionRepositoryPort(port) {
  return matchesMethods(port, REPORT_DEFINITION_REPOSITORY_METHODS);
}

export function matchesSavedReportRepositoryPort(port) {
  return matchesMethods(port, SAVED_REPORT_REPOSITORY_METHODS);
}

export function matchesSavedFilterRepositoryPort(port) {
  return matchesMethods(port, SAVED_FILTER_REPOSITORY_METHODS);
}

export function matchesReportExecutionRepositoryPort(port) {
  return matchesMethods(port, REPORT_EXECUTION_REPOSITORY_METHODS);
}

export function matchesExportJobRepositoryPort(port) {
  return matchesMethods(port, EXPORT_JOB_REPOSITORY_METHODS);
}

export function matchesReportDataSourcePort(port) {
  return matchesMethods(port, REPORT_DATA_SOURCE_PORT_METHODS);
}

export function matchesExportExecutorPort(port) {
  return matchesMethods(port, EXPORT_EXECUTOR_PORT_METHODS);
}

/**
 * @param {string} portName
 * @param {string} method
 * @returns {never}
 */
function throwUnimplemented(portName, method) {
  throw new ReportingError(
    REPORTING_ERROR_CODE.PORT_OPERATION_UNIMPLEMENTED,
    `${portName}.${method} is not implemented`,
    { portName, method }
  );
}

export function createUnimplementedReportDefinitionRepositoryPort() {
  return {
    async getById() {
      throwUnimplemented("ReportDefinitionRepositoryPort", "getById");
    },
    async save() {
      throwUnimplemented("ReportDefinitionRepositoryPort", "save");
    },
    async listByTenant() {
      throwUnimplemented("ReportDefinitionRepositoryPort", "listByTenant");
    },
    async deleteById() {
      throwUnimplemented("ReportDefinitionRepositoryPort", "deleteById");
    },
  };
}

export function createUnimplementedSavedReportRepositoryPort() {
  return {
    async getById() {
      throwUnimplemented("SavedReportRepositoryPort", "getById");
    },
    async save() {
      throwUnimplemented("SavedReportRepositoryPort", "save");
    },
    async listByOwner() {
      throwUnimplemented("SavedReportRepositoryPort", "listByOwner");
    },
    async deleteById() {
      throwUnimplemented("SavedReportRepositoryPort", "deleteById");
    },
  };
}

export function createUnimplementedSavedFilterRepositoryPort() {
  return {
    async getById() {
      throwUnimplemented("SavedFilterRepositoryPort", "getById");
    },
    async save() {
      throwUnimplemented("SavedFilterRepositoryPort", "save");
    },
    async listByOwner() {
      throwUnimplemented("SavedFilterRepositoryPort", "listByOwner");
    },
    async deleteById() {
      throwUnimplemented("SavedFilterRepositoryPort", "deleteById");
    },
  };
}

export function createUnimplementedExportJobRepositoryPort() {
  return {
    async getById() {
      throwUnimplemented("ExportJobRepositoryPort", "getById");
    },
    async save() {
      throwUnimplemented("ExportJobRepositoryPort", "save");
    },
    async findByIdempotencyKey() {
      throwUnimplemented("ExportJobRepositoryPort", "findByIdempotencyKey");
    },
    async listByTenant() {
      throwUnimplemented("ExportJobRepositoryPort", "listByTenant");
    },
    async deleteById() {
      throwUnimplemented("ExportJobRepositoryPort", "deleteById");
    },
  };
}

export function createUnimplementedReportExecutionRepositoryPort() {
  return {
    async getById() {
      throwUnimplemented("ReportExecutionRepositoryPort", "getById");
    },
    async save() {
      throwUnimplemented("ReportExecutionRepositoryPort", "save");
    },
    async findByIdempotencyKey() {
      throwUnimplemented("ReportExecutionRepositoryPort", "findByIdempotencyKey");
    },
    async listByTenant() {
      throwUnimplemented("ReportExecutionRepositoryPort", "listByTenant");
    },
    async deleteById() {
      throwUnimplemented("ReportExecutionRepositoryPort", "deleteById");
    },
  };
}

/**
 * Fail-closed data source when not wired — never returns mock as live success.
 */
export function createUnimplementedReportDataSourcePort() {
  return {
    async execute() {
      throwUnimplemented("ReportDataSourcePort", "execute");
    },
  };
}

export function createUnimplementedExportExecutorPort() {
  return {
    async execute() {
      throwUnimplemented("ExportExecutorPort", "execute");
    },
  };
}
