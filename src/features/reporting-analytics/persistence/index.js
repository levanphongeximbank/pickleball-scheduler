import { createDurableExportJobRepository } from "./durable/durableExportJobRepository.js";
import { createDurableReportDefinitionRepository } from "./durable/durableReportDefinitionRepository.js";
import { createDurableReportExecutionRepository } from "./durable/durableReportExecutionRepository.js";
import { createDurableSavedFilterRepository } from "./durable/durableSavedFilterRepository.js";
import { createDurableSavedReportRepository } from "./durable/durableSavedReportRepository.js";

export { REPORTING_02_TABLES, requireReportingDatabaseClientPort } from "./databaseClientPort.js";
export { createFakeReportingDatabaseClient } from "./createFakeReportingDatabaseClient.js";

export function createDurableReportingRepositories({ db } = {}) {
  return Object.freeze({
    reportDefinitions: createDurableReportDefinitionRepository({ db }),
    savedReports: createDurableSavedReportRepository({ db }),
    savedFilters: createDurableSavedFilterRepository({ db }),
    executions: createDurableReportExecutionRepository({ db }),
    exportJobs: createDurableExportJobRepository({ db }),
  });
}
