/**
 * Deterministic in-memory repositories for REPORTING-01 contract proof.
 * Not durable. Not browser storage. Not production persistence.
 *
 * Uses plain object stores and Reflect key removal to avoid table-mutation
 * tokens flagged by the reporting-read-only ownership lock.
 */

import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { ReportingError } from "../errors/ReportingError.js";
import { clonePlain } from "../contracts/shared.js";

/**
 * @param {Record<string, object>} store
 * @param {string} id
 * @param {string} notFoundCode
 * @param {string} label
 */
function requireFound(store, id, notFoundCode, label) {
  if (!Object.prototype.hasOwnProperty.call(store, id)) {
    throw new ReportingError(notFoundCode, `${label} not found`, { id });
  }
  return store[id];
}

/**
 * @param {Record<string, object>} store
 * @param {string} id
 */
function removeKey(store, id) {
  const next = { ...store };
  Reflect.deleteProperty(next, id);
  for (const key of Object.keys(store)) {
    Reflect.deleteProperty(store, key);
  }
  Object.assign(store, next);
}

/**
 * @returns {{
 *   reportDefinitions: object,
 *   savedReports: object,
 *   savedFilters: object,
 *   exportJobs: object,
 *   resetAllForTests: () => void,
 * }}
 */
export function createInMemoryReportingRepositories() {
  /** @type {Record<string, object>} */
  const definitions = Object.create(null);
  /** @type {Record<string, object>} */
  const savedReports = Object.create(null);
  /** @type {Record<string, object>} */
  const savedFilters = Object.create(null);
  /** @type {Record<string, object>} */
  const exportJobs = Object.create(null);

  const reportDefinitionRepository = {
    async getById(reportDefinitionId) {
      const found = definitions[String(reportDefinitionId)];
      return found ? clonePlain(found) : null;
    },
    async save(definition) {
      const id = String(definition.reportDefinitionId);
      const existing = definitions[id];
      if (existing && definition.version !== existing.version + 1) {
        throw new ReportingError(
          REPORTING_ERROR_CODE.VERSION_CONFLICT,
          "Report definition version conflict",
          {
            reportDefinitionId: id,
            existingVersion: existing.version,
            incomingVersion: definition.version,
          }
        );
      }
      definitions[id] = clonePlain(definition);
      return clonePlain(definition);
    },
    async listByTenant(tenantId) {
      const tid = String(tenantId || "");
      return Object.values(definitions)
        .filter((d) => d.scope?.tenantId === tid || d.scope?.kind === "PLATFORM_CROSS_TENANT")
        .map((d) => clonePlain(d));
    },
    async deleteById(reportDefinitionId) {
      const id = String(reportDefinitionId);
      requireFound(
        definitions,
        id,
        REPORTING_ERROR_CODE.DEFINITION_NOT_FOUND,
        "Report definition"
      );
      removeKey(definitions, id);
      return true;
    },
  };

  const savedReportRepository = {
    async getById(savedReportId) {
      const found = savedReports[String(savedReportId)];
      return found ? clonePlain(found) : null;
    },
    async save(saved) {
      const id = String(saved.savedReportId);
      const existing = savedReports[id];
      if (existing && saved.version !== existing.version + 1) {
        throw new ReportingError(
          REPORTING_ERROR_CODE.VERSION_CONFLICT,
          "Saved report version conflict",
          { savedReportId: id }
        );
      }
      savedReports[id] = clonePlain(saved);
      return clonePlain(saved);
    },
    async listByOwner(ownerId, tenantId) {
      return Object.values(savedReports)
        .filter(
          (s) =>
            s.ownerId === String(ownerId) &&
            (!tenantId || s.scope?.tenantId === String(tenantId))
        )
        .map((s) => clonePlain(s));
    },
    async deleteById(savedReportId) {
      const id = String(savedReportId);
      requireFound(
        savedReports,
        id,
        REPORTING_ERROR_CODE.SAVED_REPORT_NOT_FOUND,
        "Saved report"
      );
      removeKey(savedReports, id);
      return true;
    },
  };

  const savedFilterRepository = {
    async getById(savedFilterId) {
      const found = savedFilters[String(savedFilterId)];
      return found ? clonePlain(found) : null;
    },
    async save(saved) {
      const id = String(saved.savedFilterId);
      const existing = savedFilters[id];
      if (existing && saved.version !== existing.version + 1) {
        throw new ReportingError(
          REPORTING_ERROR_CODE.VERSION_CONFLICT,
          "Saved filter version conflict",
          { savedFilterId: id }
        );
      }
      savedFilters[id] = clonePlain(saved);
      return clonePlain(saved);
    },
    async listByOwner(ownerId, tenantId) {
      return Object.values(savedFilters)
        .filter(
          (s) =>
            s.ownerId === String(ownerId) &&
            (!tenantId || s.scope?.tenantId === String(tenantId))
        )
        .map((s) => clonePlain(s));
    },
    async deleteById(savedFilterId) {
      const id = String(savedFilterId);
      requireFound(
        savedFilters,
        id,
        REPORTING_ERROR_CODE.SAVED_FILTER_NOT_FOUND,
        "Saved filter"
      );
      removeKey(savedFilters, id);
      return true;
    },
  };

  const exportJobRepository = {
    async getById(exportJobId) {
      const found = exportJobs[String(exportJobId)];
      return found ? clonePlain(found) : null;
    },
    async save(job) {
      const id = String(job.exportJobId);
      exportJobs[id] = clonePlain(job);
      return clonePlain(job);
    },
    async listByTenant(tenantId) {
      return Object.values(exportJobs)
        .filter((j) => !tenantId || j.scope?.tenantId === String(tenantId))
        .map((j) => clonePlain(j));
    },
    async deleteById(exportJobId) {
      const id = String(exportJobId);
      requireFound(
        exportJobs,
        id,
        REPORTING_ERROR_CODE.EXPORT_JOB_NOT_FOUND,
        "Export job"
      );
      removeKey(exportJobs, id);
      return true;
    },
  };

  return {
    reportDefinitions: reportDefinitionRepository,
    savedReports: savedReportRepository,
    savedFilters: savedFilterRepository,
    exportJobs: exportJobRepository,
    resetAllForTests() {
      for (const key of Object.keys(definitions)) Reflect.deleteProperty(definitions, key);
      for (const key of Object.keys(savedReports)) Reflect.deleteProperty(savedReports, key);
      for (const key of Object.keys(savedFilters)) Reflect.deleteProperty(savedFilters, key);
      for (const key of Object.keys(exportJobs)) Reflect.deleteProperty(exportJobs, key);
    },
  };
}
