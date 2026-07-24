/**
 * Immutable dashboard/report catalog and read-only discovery facade (I&A-04).
 * No singleton. No persistence commands. Fixtures only in tests.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  createAnalyticsDashboardId,
  createAnalyticsDashboardVersion,
  createAnalyticsReportId,
  createAnalyticsReportVersion,
  dashboardIdentityKey,
  reportIdentityKey,
} from "./identifiers.js";
import { createAnalyticsDashboardDefinition } from "./dashboardDefinition.js";
import { createAnalyticsReportDefinition } from "./reportDefinition.js";
import {
  ANALYTICS_DASHBOARD_LIFECYCLE_STATE,
  ANALYTICS_REPORT_LIFECYCLE_STATE,
  isEnumValue,
} from "./enums.js";

export const ANALYTICS_CATALOG_REGISTRATION_STATUS = Object.freeze({
  REGISTERED: "registered",
  IDEMPOTENT: "idempotent",
});

const WRITE_REJECT_MESSAGE =
  "ReadOnlyDashboardReportCatalog does not expose write/persistence operations";

/**
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function definitionsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {ReadonlyArray<*>} dashboards
 * @param {ReadonlyArray<*>} reports
 * @returns {Readonly<*>}
 */
function buildReadOnlyCatalog(dashboards, reports) {
  /** @type {Map<string, *>} */
  const dashboardsByIdentity = new Map();
  /** @type {*[]} */
  const orderedDashboards = [];
  for (const dashboard of dashboards) {
    const key = dashboardIdentityKey(dashboard.dashboardId, dashboard.version);
    dashboardsByIdentity.set(key, dashboard);
    orderedDashboards.push(dashboard);
  }

  /** @type {Map<string, *>} */
  const reportsByIdentity = new Map();
  /** @type {*[]} */
  const orderedReports = [];
  for (const report of reports) {
    const key = reportIdentityKey(report.reportId, report.version);
    reportsByIdentity.set(key, report);
    orderedReports.push(report);
  }

  /**
   * @param {unknown} dashboardId
   * @param {unknown} version
   */
  function getDashboard(dashboardId, version) {
    const idResult = createAnalyticsDashboardId(dashboardId);
    if (!idResult.ok) return idResult;
    const versionResult = createAnalyticsDashboardVersion(version);
    if (!versionResult.ok) return versionResult;
    const found = dashboardsByIdentity.get(
      dashboardIdentityKey(idResult.value, versionResult.value)
    );
    if (!found) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CATALOG_NOT_FOUND,
          "Dashboard not found for exact ID/version",
          "lookup",
          { dashboardId: idResult.value, version: versionResult.value }
        )
      );
    }
    return ok(clonePlain(found));
  }

  /**
   * @param {unknown} reportId
   * @param {unknown} version
   */
  function getReport(reportId, version) {
    const idResult = createAnalyticsReportId(reportId);
    if (!idResult.ok) return idResult;
    const versionResult = createAnalyticsReportVersion(version);
    if (!versionResult.ok) return versionResult;
    const found = reportsByIdentity.get(
      reportIdentityKey(idResult.value, versionResult.value)
    );
    if (!found) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.CATALOG_NOT_FOUND,
          "Report not found for exact ID/version",
          "lookup",
          { reportId: idResult.value, version: versionResult.value }
        )
      );
    }
    return ok(clonePlain(found));
  }

  /**
   * @param {unknown} [filter]
   */
  function listDashboards(filter) {
    let result = orderedDashboards.slice();
    if (filter !== undefined) {
      if (!isPlainObject(filter)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
            "listDashboards filter must be a plain object",
            "filter"
          )
        );
      }
      if (filter.lifecycleState !== undefined) {
        if (
          !isEnumValue(filter.lifecycleState, ANALYTICS_DASHBOARD_LIFECYCLE_STATE)
        ) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              `Unsupported lifecycle filter: ${filter.lifecycleState}`,
              "filter.lifecycleState"
            )
          );
        }
        result = result.filter((d) => d.lifecycleState === filter.lifecycleState);
      }
      if (filter.tenantScopeKind !== undefined) {
        if (!isNonEmptyString(filter.tenantScopeKind)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "tenantScopeKind must be a non-empty string",
              "filter.tenantScopeKind"
            )
          );
        }
        const kind = String(filter.tenantScopeKind).trim();
        result = result.filter((d) =>
          d.tenantApplicability.supportedTenantScopeKinds.includes(kind)
        );
      }
      if (filter.role !== undefined) {
        if (!isNonEmptyString(filter.role)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "role must be a non-empty string",
              "filter.role"
            )
          );
        }
        const role = String(filter.role).trim();
        result = result.filter((d) => {
          const roles = d.accessScope?.roles || [];
          return roles.length === 0 || roles.includes(role);
        });
      }
      if (filter.permission !== undefined) {
        if (!isNonEmptyString(filter.permission)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "permission must be a non-empty string",
              "filter.permission"
            )
          );
        }
        const permission = String(filter.permission).trim();
        result = result.filter((d) => {
          const permissions = d.accessScope?.permissions || [];
          return permissions.length === 0 || permissions.includes(permission);
        });
      }
    }
    return ok(deepFreeze(result.map((d) => clonePlain(d))));
  }

  /**
   * @param {unknown} [filter]
   */
  function listReports(filter) {
    let result = orderedReports.slice();
    if (filter !== undefined) {
      if (!isPlainObject(filter)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
            "listReports filter must be a plain object",
            "filter"
          )
        );
      }
      if (filter.lifecycleState !== undefined) {
        if (!isEnumValue(filter.lifecycleState, ANALYTICS_REPORT_LIFECYCLE_STATE)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              `Unsupported lifecycle filter: ${filter.lifecycleState}`,
              "filter.lifecycleState"
            )
          );
        }
        result = result.filter((r) => r.lifecycleState === filter.lifecycleState);
      }
      if (filter.tenantScopeKind !== undefined) {
        if (!isNonEmptyString(filter.tenantScopeKind)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "tenantScopeKind must be a non-empty string",
              "filter.tenantScopeKind"
            )
          );
        }
        const kind = String(filter.tenantScopeKind).trim();
        result = result.filter((r) =>
          r.tenantApplicability.supportedTenantScopeKinds.includes(kind)
        );
      }
      if (filter.role !== undefined) {
        if (!isNonEmptyString(filter.role)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "role must be a non-empty string",
              "filter.role"
            )
          );
        }
        const role = String(filter.role).trim();
        result = result.filter((r) => {
          const roles = r.accessScope?.roles || [];
          return roles.length === 0 || roles.includes(role);
        });
      }
      if (filter.permission !== undefined) {
        if (!isNonEmptyString(filter.permission)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
              "permission must be a non-empty string",
              "filter.permission"
            )
          );
        }
        const permission = String(filter.permission).trim();
        result = result.filter((r) => {
          const permissions = r.accessScope?.permissions || [];
          return permissions.length === 0 || permissions.includes(permission);
        });
      }
    }
    return ok(deepFreeze(result.map((r) => clonePlain(r))));
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    get dashboardCount() {
      return orderedDashboards.length;
    },
    get reportCount() {
      return orderedReports.length;
    },
    get size() {
      return orderedDashboards.length + orderedReports.length;
    },
    get isEmpty() {
      return orderedDashboards.length === 0 && orderedReports.length === 0;
    },
    getDashboard,
    getReport,
    listDashboards,
    listReports,
    hasDashboard(dashboardId, version) {
      if (!isNonEmptyString(dashboardId) || !isNonEmptyString(version)) {
        return false;
      }
      return dashboardsByIdentity.has(
        dashboardIdentityKey(String(dashboardId).trim(), String(version).trim())
      );
    },
    hasReport(reportId, version) {
      if (!isNonEmptyString(reportId) || !isNonEmptyString(version)) {
        return false;
      }
      return reportsByIdentity.has(
        reportIdentityKey(String(reportId).trim(), String(version).trim())
      );
    },
  };

  function makeReject(operationName) {
    return function rejectedWrite() {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
          WRITE_REJECT_MESSAGE,
          operationName
        )
      );
    };
  }

  facade.register = makeReject("register");
  facade.write = makeReject("write");
  facade.command = makeReject("command");
  facade.mutate = makeReject("mutate");
  facade.insert = makeReject("insert");
  facade.update = makeReject("update");
  facade.upsert = makeReject("upsert");
  facade.delete = makeReject("delete");
  facade.save = makeReject("save");
  facade.persist = makeReject("persist");
  facade.schedule = makeReject("schedule");
  facade.export = makeReject("export");

  return Object.freeze(facade);
}

/**
 * Create an immutable dashboard/report catalog from explicit definitions.
 *
 * @param {unknown} [input]
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createDashboardReportCatalog(input = {}, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CATALOG_ENTRY_INVALID,
        "createDashboardReportCatalog input must be a plain object",
        "input"
      )
    );
  }

  // Snapshot input arrays so caller mutation cannot affect catalog construction mid-flight.
  const dashboardInputs = Array.isArray(input.dashboards)
    ? input.dashboards.slice()
    : [];
  const reportInputs = Array.isArray(input.reports) ? input.reports.slice() : [];

  /** @type {Map<string, *>} */
  const dashboardsByIdentity = new Map();
  /** @type {*[]} */
  const orderedDashboards = [];
  /** @type {import("../contracts/result.js").Result[]} */
  const dashboardRegistrations = [];

  for (const raw of dashboardInputs) {
    const created = createAnalyticsDashboardDefinition(raw, options);
    if (!created.ok) {
      dashboardRegistrations.push(created);
      continue;
    }
    const key = dashboardIdentityKey(
      created.value.dashboardId,
      created.value.version
    );
    const existing = dashboardsByIdentity.get(key);
    if (!existing) {
      dashboardsByIdentity.set(key, created.value);
      orderedDashboards.push(created.value);
      dashboardRegistrations.push(
        ok(
          deepFreeze({
            status: ANALYTICS_CATALOG_REGISTRATION_STATUS.REGISTERED,
            definition: created.value,
          })
        )
      );
      continue;
    }
    if (definitionsEqual(existing, created.value)) {
      dashboardRegistrations.push(
        ok(
          deepFreeze({
            status: ANALYTICS_CATALOG_REGISTRATION_STATUS.IDEMPOTENT,
            definition: existing,
          })
        )
      );
    } else {
      dashboardRegistrations.push(
        fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CATALOG_CONFLICT,
            "Same dashboard ID/version with different definition",
            "dashboards",
            {
              dashboardId: created.value.dashboardId,
              version: created.value.version,
            }
          )
        )
      );
    }
  }

  /** @type {Map<string, *>} */
  const reportsByIdentity = new Map();
  /** @type {*[]} */
  const orderedReports = [];
  /** @type {import("../contracts/result.js").Result[]} */
  const reportRegistrations = [];

  for (const raw of reportInputs) {
    const created = createAnalyticsReportDefinition(raw, options);
    if (!created.ok) {
      reportRegistrations.push(created);
      continue;
    }
    const key = reportIdentityKey(created.value.reportId, created.value.version);
    const existing = reportsByIdentity.get(key);
    if (!existing) {
      reportsByIdentity.set(key, created.value);
      orderedReports.push(created.value);
      reportRegistrations.push(
        ok(
          deepFreeze({
            status: ANALYTICS_CATALOG_REGISTRATION_STATUS.REGISTERED,
            definition: created.value,
          })
        )
      );
      continue;
    }
    if (definitionsEqual(existing, created.value)) {
      reportRegistrations.push(
        ok(
          deepFreeze({
            status: ANALYTICS_CATALOG_REGISTRATION_STATUS.IDEMPOTENT,
            definition: existing,
          })
        )
      );
    } else {
      reportRegistrations.push(
        fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CATALOG_CONFLICT,
            "Same report ID/version with different definition",
            "reports",
            {
              reportId: created.value.reportId,
              version: created.value.version,
            }
          )
        )
      );
    }
  }

  const catalog = buildReadOnlyCatalog(orderedDashboards, orderedReports);

  return ok(
    deepFreeze({
      catalog,
      dashboardRegistrations: Object.freeze([...dashboardRegistrations]),
      reportRegistrations: Object.freeze([...reportRegistrations]),
      dashboardCount: orderedDashboards.length,
      reportCount: orderedReports.length,
      size: orderedDashboards.length + orderedReports.length,
    })
  );
}

/**
 * Fail-closed read-only catalog: any invalid/conflict entry rejects create.
 *
 * @param {unknown} [input]
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createReadOnlyDashboardReportCatalog(input = {}, options = {}) {
  const created = createDashboardReportCatalog(input, options);
  if (!created.ok) return created;

  for (const registration of created.value.dashboardRegistrations) {
    if (!registration.ok) return registration;
  }
  for (const registration of created.value.reportRegistrations) {
    if (!registration.ok) return registration;
  }

  return ok(created.value.catalog);
}

