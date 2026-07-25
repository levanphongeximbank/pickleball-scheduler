/**
 * Single public facade for Reporting & Analytics (REPORTING-01).
 * Canonical factory: createReportingAnalyticsFacade / reportingAnalyticsFacade.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";
import {
  authorizeDashboardView,
  authorizeSaveFilter,
  authorizeSaveReport,
} from "../authorization/index.js";
import {
  createReportDefinition,
  createSavedFilterConfiguration,
  createSavedReportConfiguration,
} from "../contracts/definitions.js";
import {
  matchesClockPort,
  matchesExportExecutorPort,
  matchesIdProviderPort,
  matchesReportDataSourcePort,
  matchesReportDefinitionRepositoryPort,
  matchesSavedFilterRepositoryPort,
  matchesSavedReportRepositoryPort,
} from "../ports/index.js";
import {
  reportingFailFromCaught,
  reportingOk,
  projectReportingOperationInstant,
} from "../platform/reportingPlatformAdoption.js";
import { executeOperationalReport } from "./executeReport.js";
import { exportOperationalReport } from "./exportReport.js";

export const REPORTING_ANALYTICS_FACADE_METHODS = Object.freeze([
  "saveReportDefinition",
  "getReportDefinition",
  "listReportDefinitions",
  "saveSavedReport",
  "getSavedReport",
  "listSavedReports",
  "saveSavedFilter",
  "getSavedFilter",
  "listSavedFilters",
  "authorizeDashboardView",
  "executeReport",
  "exportReport",
]);

/**
 * @param {object} deps
 */
export function createReportingAnalyticsFacade(deps) {
  if (!deps || !matchesReportDefinitionRepositoryPort(deps.reportDefinitions)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "createReportingAnalyticsFacade requires a ReportDefinitionRepositoryPort",
      { field: "reportDefinitions" }
    );
  }
  if (!matchesSavedReportRepositoryPort(deps.savedReports)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "createReportingAnalyticsFacade requires a SavedReportRepositoryPort",
      { field: "savedReports" }
    );
  }
  if (!matchesSavedFilterRepositoryPort(deps.savedFilters)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "createReportingAnalyticsFacade requires a SavedFilterRepositoryPort",
      { field: "savedFilters" }
    );
  }
  if (!matchesClockPort(deps.clock)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "createReportingAnalyticsFacade requires a ClockPort",
      { field: "clock" }
    );
  }
  if (!matchesIdProviderPort(deps.idProvider)) {
    throw new ReportingError(
      REPORTING_ERROR_CODE.INVALID_CONTRACT,
      "createReportingAnalyticsFacade requires an IdProviderPort",
      { field: "idProvider" }
    );
  }

  const dataSource = matchesReportDataSourcePort(deps.dataSource)
    ? deps.dataSource
    : null;
  const exportExecutor = matchesExportExecutorPort(deps.exportExecutor)
    ? deps.exportExecutor
    : null;

  function nowOrThrow() {
    const instant = deps.clock.now();
    const parsed = projectReportingOperationInstant(instant);
    if (!parsed.ok) {
      throw new ReportingError(
        REPORTING_ERROR_CODE.INVALID_CONTRACT,
        "ClockPort.now must return a strict ISO instant",
        { value: instant }
      );
    }
    return /** @type {string} */ (parsed.value);
  }

  const api = {
    async saveReportDefinition(input) {
      try {
        const now = nowOrThrow();
        const definition = createReportDefinition({
          ...input,
          createdAt: input.createdAt || now,
          updatedAt: now,
        });
        const saved = await deps.reportDefinitions.save(definition);
        return reportingOk(saved);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async getReportDefinition(reportDefinitionId) {
      try {
        const found = await deps.reportDefinitions.getById(reportDefinitionId);
        if (!found) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND,
            "Report definition not found",
            { reportDefinitionId }
          );
        }
        return reportingOk(found);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async listReportDefinitions(tenantId) {
      try {
        const list = await deps.reportDefinitions.listByTenant(tenantId);
        return reportingOk(list);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async saveSavedReport(input, actor) {
      try {
        const auth = authorizeSaveReport(actor, input.scope);
        if (!auth.ok) {
          return reportingFailFromCaught(
            new ReportingError(auth.code, auth.error, auth.details || {})
          );
        }
        const now = nowOrThrow();
        const saved = createSavedReportConfiguration({
          ...input,
          ownerId: input.ownerId || auth.actor.userId,
          createdAt: input.createdAt || now,
          updatedAt: now,
        });
        const persisted = await deps.savedReports.save(saved);
        return reportingOk(persisted);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async getSavedReport(savedReportId) {
      try {
        const found = await deps.savedReports.getById(savedReportId);
        if (!found) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.SAVED_REPORT_NOT_FOUND,
            "Saved report not found",
            { savedReportId }
          );
        }
        return reportingOk(found);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async listSavedReports(ownerId, tenantId) {
      try {
        const list = await deps.savedReports.listByOwner(ownerId, tenantId);
        return reportingOk(list);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async saveSavedFilter(input, actor) {
      try {
        const auth = authorizeSaveFilter(actor, input.scope);
        if (!auth.ok) {
          return reportingFailFromCaught(
            new ReportingError(auth.code, auth.error, auth.details || {})
          );
        }
        const now = nowOrThrow();
        const saved = createSavedFilterConfiguration({
          ...input,
          ownerId: input.ownerId || auth.actor.userId,
          createdAt: input.createdAt || now,
          updatedAt: now,
        });
        const persisted = await deps.savedFilters.save(saved);
        return reportingOk(persisted);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async getSavedFilter(savedFilterId) {
      try {
        const found = await deps.savedFilters.getById(savedFilterId);
        if (!found) {
          throw new ReportingError(
            REPORTING_ERROR_CODE.SAVED_FILTER_NOT_FOUND,
            "Saved filter not found",
            { savedFilterId }
          );
        }
        return reportingOk(found);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async listSavedFilters(ownerId, tenantId) {
      try {
        const list = await deps.savedFilters.listByOwner(ownerId, tenantId);
        return reportingOk(list);
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    authorizeDashboardView(actor, scope) {
      return authorizeDashboardView(actor, scope);
    },

    async executeReport(request) {
      try {
        const result = await executeOperationalReport(
          {
            reportDefinitions: deps.reportDefinitions,
            dataSource,
            clock: deps.clock,
            idProvider: deps.idProvider,
            onAuthorized: deps.onAuthorized,
            onSourceExecute: deps.onSourceExecute,
          },
          request
        );
        return result.ok ? reportingOk(result) : reportingFailFromCaught(
          new ReportingError(
            result.errorCode || REPORTING_ERROR_CODE.UNAVAILABLE,
            result.errorMessage || "Report execution unavailable",
            { availability: result.availability, executionId: result.executionId }
          )
        );
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },

    async exportReport(request) {
      try {
        const result = await exportOperationalReport(
          {
            reportDefinitions: deps.reportDefinitions,
            dataSource,
            exportExecutor,
            clock: deps.clock,
            idProvider: deps.idProvider,
          },
          request
        );
        return result.ok
          ? reportingOk(result)
          : reportingFailFromCaught(
              new ReportingError(
                result.errorCode || REPORTING_ERROR_CODE.UNAVAILABLE,
                result.errorMessage || "Export unavailable",
                { availability: result.availability, exportJobId: result.exportJobId }
              )
            );
      } catch (err) {
        return reportingFailFromCaught(err);
      }
    },
  };

  return Object.freeze(api);
}

export const reportingAnalyticsFacade = createReportingAnalyticsFacade;
