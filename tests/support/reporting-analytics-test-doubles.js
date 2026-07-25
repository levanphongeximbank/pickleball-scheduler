/**
 * REPORTING-01 test helpers — test scope only. Not production SoT.
 */

import * as reporting from "../../src/features/reporting-analytics/index.js";

export function baseActor(overrides = {}) {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    venueIds: ["venue-1"],
    clubIds: ["club-1"],
    authenticated: true,
    permissions: [
      reporting.REPORTING_PERMISSIONS.DASHBOARD_VIEW,
      reporting.REPORTING_PERMISSIONS.REPORT_EXECUTE,
      reporting.REPORTING_PERMISSIONS.SENSITIVE_FIELD_VIEW,
      reporting.REPORTING_PERMISSIONS.REPORT_SAVE,
      reporting.REPORTING_PERMISSIONS.FILTER_SAVE,
      reporting.REPORTING_PERMISSIONS.REPORT_EXPORT,
      reporting.REPORTING_PERMISSIONS.SCOPE_TENANT,
      reporting.REPORTING_PERMISSIONS.SCOPE_VENUE,
      reporting.REPORTING_PERMISSIONS.SCOPE_CLUB,
    ],
    ...overrides,
  };
}

export function clubScope(overrides = {}) {
  return {
    kind: reporting.REPORT_SCOPE_KIND.CLUB,
    tenantId: "tenant-1",
    clubId: "club-1",
    ...overrides,
  };
}

export function baseDefinitionInput(overrides = {}) {
  return {
    reportDefinitionId: "rdef_demo",
    name: "Club bookings operational table",
    title: "Club bookings operational table",
    description: "Operational booking rows for a club",
    reportType: reporting.REPORT_TYPE.OPERATIONAL_TABLE,
    scope: clubScope(),
    source: {
      kind: reporting.REPORT_SOURCE_KIND.OPERATIONAL,
      sourceId: "ops-bookings",
      configured: true,
    },
    parameters: [
      {
        parameterId: "from",
        type: reporting.REPORT_PARAMETER_TYPE.STRING,
        required: true,
      },
      {
        parameterId: "to",
        type: reporting.REPORT_PARAMETER_TYPE.STRING,
        required: true,
      },
    ],
    filterDefinitions: [
      {
        field: "status",
        allowedOperators: [
          reporting.REPORT_FILTER_OPERATOR.EQ,
          reporting.REPORT_FILTER_OPERATOR.IN,
        ],
        valueType: "string",
      },
    ],
    columns: [
      { field: "bookingId", label: "Booking", order: 1 },
      { field: "status", label: "Status", order: 2 },
      { field: "amount", label: "Amount", order: 3, sensitive: true },
    ],
    sortableFields: ["bookingId", "status", "amount"],
    groupableFields: ["status"],
    ...overrides,
  };
}

/**
 * @param {object} [opts]
 */
export function createReportingTestFacade(opts = {}) {
  const repos = reporting.createInMemoryReportingRepositories();
  let sourceExecuted = false;
  let authorized = false;

  const dataSource =
    opts.dataSource === undefined
      ? {
          async execute() {
            sourceExecuted = true;
            return {
              availability: reporting.REPORT_AVAILABILITY.AVAILABLE,
              provenance: {
                state: reporting.REPORT_PROVENANCE.LIVE,
                sourceKind: reporting.REPORT_SOURCE_KIND.OPERATIONAL,
                generatedAt: "2026-07-25T00:00:00.000Z",
              },
              rows: [{ bookingId: "b1", status: "confirmed", amount: 100 }],
            };
          },
        }
      : opts.dataSource;

  const exportExecutor =
    opts.exportExecutor === undefined
      ? {
          async execute({ request, exportJobId }) {
            return {
              availability: reporting.REPORT_AVAILABILITY.AVAILABLE,
              provenance: {
                state: reporting.REPORT_PROVENANCE.LIVE,
                sourceKind: reporting.REPORT_SOURCE_KIND.OPERATIONAL,
                generatedAt: "2026-07-25T00:00:00.000Z",
              },
              exportRecordId: `xrec_${exportJobId}`,
              outputReference: { kind: "memory", format: request.format },
            };
          },
        }
      : opts.exportExecutor;

  const facade = reporting.createReportingAnalyticsFacade({
    reportDefinitions: repos.reportDefinitions,
    savedReports: repos.savedReports,
    savedFilters: repos.savedFilters,
    clock: reporting.createFixedClockPort("2026-07-25T00:00:00.000Z"),
    idProvider: reporting.createSequentialIdProviderPort(1),
    dataSource,
    exportExecutor,
    onAuthorized() {
      authorized = true;
    },
    onSourceExecute() {
      sourceExecuted = true;
    },
  });

  return {
    facade,
    repos,
    wasSourceExecuted: () => sourceExecuted,
    wasAuthorized: () => authorized,
    resetFlags() {
      sourceExecuted = false;
      authorized = false;
    },
  };
}
