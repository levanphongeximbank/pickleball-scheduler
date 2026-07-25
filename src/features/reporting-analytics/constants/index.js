/**
 * Reporting & Analytics constants barrel.
 * Phase id advances with module closure workstream (REPORTING-05).
 */

export const REPORTING_ANALYTICS_PHASE = Object.freeze({
  id: "REPORTING-05",
  name: "Final Certification & Business Module Closure",
  version: "5.0.0",
  foundationWorkstreamId: "REPORTING-01",
});

export {
  REPORT_TYPE,
  REPORT_TYPE_VALUES,
  isReportType,
} from "./reportTypes.js";
export {
  REPORT_SCOPE_KIND,
  REPORT_SCOPE_KIND_VALUES,
  isReportScopeKind,
} from "./reportScopes.js";
export {
  REPORT_AVAILABILITY,
  REPORT_AVAILABILITY_VALUES,
  isReportAvailability,
} from "./availability.js";
export {
  REPORT_PROVENANCE,
  REPORT_PROVENANCE_VALUES,
  isReportProvenance,
} from "./provenance.js";
export {
  REPORT_SOURCE_KIND,
  REPORT_SOURCE_KIND_VALUES,
  isReportSourceKind,
} from "./sourceKinds.js";
export {
  REPORT_PARAMETER_TYPE,
  REPORT_PARAMETER_TYPE_VALUES,
  isReportParameterType,
  REPORT_FILTER_OPERATOR,
  REPORT_FILTER_OPERATOR_VALUES,
  isReportFilterOperator,
  REPORT_SORT_DIRECTION,
  REPORT_SORT_DIRECTION_VALUES,
  isReportSortDirection,
  REPORT_EXPORT_FORMAT,
  REPORT_EXPORT_FORMAT_VALUES,
  isReportExportFormat,
} from "./parameterTypes.js";
export {
  REPORTING_PERMISSIONS,
  REPORTING_PERMISSION_VALUES,
  isReportingPermission,
} from "./permissions.js";
