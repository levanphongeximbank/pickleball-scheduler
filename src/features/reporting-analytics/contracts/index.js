/**
 * Reporting & Analytics contracts barrel (REPORTING-01).
 */

export {
  failContract,
  isNonEmptyString,
  isPlainObject,
  isValidIsoInstant,
  requireNonEmptyString,
  requireOpaqueId,
  optionalNonEmptyString,
  optionalOpaqueId,
  requireIsoInstant,
  optionalIsoInstant,
  createSeededId,
  deepFreeze,
  clonePlain,
} from "./shared.js";

export {
  createReportDefinitionId,
  createSavedReportId,
  createSavedFilterId,
  createExecutionId,
  createExportJobId,
  createExportRecordId,
} from "./identifiers.js";

export {
  createReportScope,
  reportScopesEqual,
  requireTenantId,
} from "./scope.js";

export {
  createReportSourceReference,
  createIntelligenceProjectionReference,
  createStatisticsSourceReference,
  createDashboardAdapterSourceReference,
} from "./sourceReference.js";

export {
  createParameterDefinition,
  validateParameterValues,
  createFilterDefinition,
  validateFilterValues,
} from "./parametersFilters.js";

export {
  createSortClause,
  validateSorting,
  createGroupingClause,
  validateGrouping,
  createColumnDefinition,
  orderColumnsDeterministically,
  validateColumnSelection,
} from "./sortingColumns.js";

export {
  createProvenanceMetadata,
  assertNoSilentLiveToMockFallback,
} from "./provenance.js";

export {
  createReportDefinition,
  createSavedFilterConfiguration,
  createSavedReportConfiguration,
} from "./definitions.js";

export {
  createReportExecutionRequest,
  createReportExecutionResult,
  createTypedExecutionFailure,
} from "./execution.js";

export {
  createExportRequest,
  createExportJobResult,
} from "./export.js";
