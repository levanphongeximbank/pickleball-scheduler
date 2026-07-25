/**
 * Report definition + saved configuration contracts (REPORTING-01).
 */

import { isReportType } from "../constants/reportTypes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { createParameterDefinition } from "./parametersFilters.js";
import { createReportScope } from "./scope.js";
import { createReportSourceReference } from "./sourceReference.js";
import {
  createColumnDefinition,
  orderColumnsDeterministically,
} from "./sortingColumns.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  optionalIsoInstant,
  optionalNonEmptyString,
  requireNonEmptyString,
  requireOpaqueId,
} from "./shared.js";
import { REPORT_FILTER_OPERATOR } from "../constants/parameterTypes.js";

/**
 * @param {unknown} input
 */
export function createReportDefinition(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
      "Report definition must be a plain object",
      { field: "definition" }
    );
  }

  const reportDefinitionId = requireOpaqueId(
    input.reportDefinitionId,
    "reportDefinitionId"
  );
  const name = requireNonEmptyString(input.name || input.title, "name");
  const title = requireNonEmptyString(input.title || input.name, "title");
  const description = optionalNonEmptyString(input.description, "description");
  const reportType = String(input.reportType || "").trim();
  if (!isReportType(reportType)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
      `Unsupported report type: ${reportType || "(empty)"}`,
      { field: "reportType" }
    );
  }

  const scope = createReportScope(input.scope);
  const source = createReportSourceReference(input.source);

  const parameters = Object.freeze(
    (Array.isArray(input.parameters) ? input.parameters : []).map((p) =>
      createParameterDefinition(p)
    )
  );
  const paramIds = new Set();
  for (const p of parameters) {
    if (paramIds.has(p.parameterId)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
        `Duplicate parameterId: ${p.parameterId}`,
        { field: "parameters" }
      );
    }
    paramIds.add(p.parameterId);
  }

  const filterDefinitions = Object.freeze(
    (Array.isArray(input.filterDefinitions) ? input.filterDefinitions : []).map(
      (raw) => {
        if (!isPlainObject(raw)) {
          failContract(
            REPORTING_ERROR_CODE.INVALID_FILTER,
            "filterDefinitions entries must be plain objects",
            { field: "filterDefinitions" }
          );
        }
        const field = requireNonEmptyString(raw.field, "field");
        const allowedOperators = Array.isArray(raw.allowedOperators)
          ? Object.freeze([...raw.allowedOperators])
          : Object.freeze([REPORT_FILTER_OPERATOR.EQ]);
        return deepFreeze({
          field,
          allowedOperators,
          required: Boolean(raw.required),
          sensitive: Boolean(raw.sensitive),
          valueType: optionalNonEmptyString(raw.valueType, "valueType"),
        });
      }
    )
  );
  const filterFields = new Set();
  for (const f of filterDefinitions) {
    if (filterFields.has(f.field)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
        `Duplicate filter field: ${f.field}`,
        { field: "filterDefinitions" }
      );
    }
    filterFields.add(f.field);
  }

  const columns = orderColumnsDeterministically(
    (Array.isArray(input.columns) ? input.columns : []).map((c) =>
      createColumnDefinition(c)
    )
  );
  if (columns.length === 0) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
      "Report definition requires at least one column",
      { field: "columns" }
    );
  }
  const colFields = new Set();
  for (const c of columns) {
    if (colFields.has(c.field)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
        `Duplicate column field: ${c.field}`,
        { field: "columns" }
      );
    }
    colFields.add(c.field);
  }

  const sortableFields = Object.freeze(
    (Array.isArray(input.sortableFields)
      ? input.sortableFields
      : columns.map((c) => c.field)
    ).map((f) => requireNonEmptyString(f, "sortableFields"))
  );
  for (const f of sortableFields) {
    if (!colFields.has(f)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
        `sortableFields contains unknown column: ${f}`,
        { field: "sortableFields" }
      );
    }
  }

  const groupableFields = Object.freeze(
    (Array.isArray(input.groupableFields) ? input.groupableFields : []).map((f) =>
      requireNonEmptyString(f, "groupableFields")
    )
  );
  for (const f of groupableFields) {
    if (!colFields.has(f)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_REPORT_DEFINITION,
        `groupableFields contains unknown column: ${f}`,
        { field: "groupableFields" }
      );
    }
  }

  const sensitivity = deepFreeze({
    containsSensitiveFields: columns.some((c) => c.sensitive),
    sensitiveFieldNames: Object.freeze(
      columns.filter((c) => c.sensitive).map((c) => c.field)
    ),
  });

  const availabilityPolicy = deepFreeze({
    allowStale: input.availabilityPolicy?.allowStale === true,
    allowPartial: input.availabilityPolicy?.allowPartial === true,
    requireLive: input.availabilityPolicy?.requireLive === true,
  });

  const freshnessExpectations = deepFreeze({
    maxAgeSeconds:
      typeof input.freshnessExpectations?.maxAgeSeconds === "number"
        ? input.freshnessExpectations.maxAgeSeconds
        : null,
    preferLive: input.freshnessExpectations?.preferLive !== false,
  });

  const version =
    typeof input.version === "number" && Number.isInteger(input.version) && input.version >= 1
      ? input.version
      : 1;

  return deepFreeze({
    reportDefinitionId,
    name,
    title,
    description,
    reportType,
    scope,
    source,
    parameters,
    filterDefinitions,
    sortableFields,
    groupableFields,
    columns,
    sensitivity,
    availabilityPolicy,
    freshnessExpectations,
    version,
    createdAt: optionalIsoInstant(input.createdAt, "createdAt"),
    updatedAt: optionalIsoInstant(input.updatedAt, "updatedAt"),
  });
}

/**
 * @param {unknown} input
 */
export function createSavedFilterConfiguration(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SAVED_FILTER,
      "Saved filter must be a plain object",
      { field: "savedFilter" }
    );
  }
  return deepFreeze({
    savedFilterId: requireOpaqueId(input.savedFilterId, "savedFilterId"),
    ownerId: requireOpaqueId(input.ownerId, "ownerId"),
    reportDefinitionId: requireOpaqueId(
      input.reportDefinitionId,
      "reportDefinitionId"
    ),
    scope: createReportScope(input.scope),
    name: requireNonEmptyString(input.name, "name"),
    filters: Object.freeze(
      Array.isArray(input.filters) ? input.filters.map((f) => deepFreeze({ ...f })) : []
    ),
    version:
      typeof input.version === "number" && Number.isInteger(input.version) && input.version >= 1
        ? input.version
        : 1,
    createdAt: optionalIsoInstant(input.createdAt, "createdAt"),
    updatedAt: optionalIsoInstant(input.updatedAt, "updatedAt"),
  });
}

/**
 * @param {unknown} input
 */
export function createSavedReportConfiguration(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SAVED_REPORT,
      "Saved report must be a plain object",
      { field: "savedReport" }
    );
  }
  return deepFreeze({
    savedReportId: requireOpaqueId(input.savedReportId, "savedReportId"),
    ownerId: requireOpaqueId(input.ownerId, "ownerId"),
    reportDefinitionId: requireOpaqueId(
      input.reportDefinitionId,
      "reportDefinitionId"
    ),
    scope: createReportScope(input.scope),
    name: requireNonEmptyString(input.name, "name"),
    parameters: deepFreeze(
      isPlainObject(input.parameters) ? { ...input.parameters } : {}
    ),
    filters: Object.freeze(
      Array.isArray(input.filters) ? input.filters.map((f) => deepFreeze({ ...f })) : []
    ),
    sorting: Object.freeze(
      Array.isArray(input.sorting) ? input.sorting.map((s) => deepFreeze({ ...s })) : []
    ),
    grouping: Object.freeze(
      Array.isArray(input.grouping) ? input.grouping.map((g) => deepFreeze({ ...g })) : []
    ),
    columns: Object.freeze(
      Array.isArray(input.columns) ? input.columns.map(String) : []
    ),
    provenancePreference: optionalNonEmptyString(
      input.provenancePreference,
      "provenancePreference"
    ),
    version:
      typeof input.version === "number" && Number.isInteger(input.version) && input.version >= 1
        ? input.version
        : 1,
    createdAt: optionalIsoInstant(input.createdAt, "createdAt"),
    updatedAt: optionalIsoInstant(input.updatedAt, "updatedAt"),
  });
}
