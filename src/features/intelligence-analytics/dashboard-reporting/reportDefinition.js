/**
 * Report definition, section, and column contracts (I&A-04).
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
  createAnalyticsReportId,
  createAnalyticsReportVersion,
} from "./identifiers.js";
import {
  createAnalyticsAccessScope,
  createAnalyticsTenantApplicability,
} from "./accessScope.js";
import {
  createAnalyticsMetricBinding,
  createAnalyticsQueryBinding,
} from "./bindings.js";
import {
  createAnalyticsExportIntent,
  createAnalyticsFilterDefinition,
  createAnalyticsParameterDefinition,
  createAnalyticsScheduleIntent,
} from "./presentation.js";
import {
  ANALYTICS_REPORT_LIFECYCLE_STATE,
  isEnumValue,
} from "./enums.js";
import { assertNoForbiddenContractContent } from "./forbidden.js";

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsReportColumn(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
        "AnalyticsReportColumn must be a plain object",
        "column"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "column");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.columnId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
        "columnId is required",
        "column.columnId"
      )
    );
  }

  if (typeof input.formatter === "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
        "Report columns must not contain executable formatters",
        "column.formatter"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const column = {
    columnId: String(input.columnId).trim(),
  };

  if (input.label !== undefined) {
    if (!isNonEmptyString(input.label)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          "label must be a non-empty string when provided",
          "column.label"
        )
      );
    }
    column.label = String(input.label).trim();
  }

  if (input.valueType !== undefined) {
    if (!isNonEmptyString(input.valueType)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          "valueType must be a non-empty string when provided",
          "column.valueType"
        )
      );
    }
    column.valueType = String(input.valueType).trim();
  }

  if (input.metricBinding !== undefined) {
    const binding = createAnalyticsMetricBinding(input.metricBinding, options);
    if (!binding.ok) return binding;
    column.metricBinding = binding.value;
  }

  if (input.queryBinding !== undefined) {
    const binding = createAnalyticsQueryBinding(input.queryBinding);
    if (!binding.ok) return binding;
    column.queryBinding = binding.value;
  }

  if (input.displayFormatIntent !== undefined) {
    if (!isNonEmptyString(input.displayFormatIntent)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          "displayFormatIntent must be a non-empty string",
          "column.displayFormatIntent"
        )
      );
    }
    column.displayFormatIntent = String(input.displayFormatIntent).trim();
  }

  return ok(deepFreeze(column));
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsReportSection(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
        "AnalyticsReportSection must be a plain object",
        "section"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "section");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.sectionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
        "sectionId is required",
        "section.sectionId"
      )
    );
  }

  if (!Array.isArray(input.columns)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
        "columns must be an array",
        "section.columns"
      )
    );
  }

  /** @type {unknown[]} */
  const columns = [];
  /** @type {Set<string>} */
  const columnIds = new Set();
  for (const columnInput of input.columns) {
    const column = createAnalyticsReportColumn(columnInput, options);
    if (!column.ok) return column;
    if (columnIds.has(column.value.columnId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          `Duplicate report column ID: ${column.value.columnId}`,
          "section.columns"
        )
      );
    }
    columnIds.add(column.value.columnId);
    columns.push(column.value);
  }

  /** @type {Record<string, unknown>} */
  const section = {
    sectionId: String(input.sectionId).trim(),
    columns: Object.freeze(columns),
  };

  if (input.title !== undefined) {
    if (!isNonEmptyString(input.title)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
          "title must be a non-empty string when provided",
          "section.title"
        )
      );
    }
    section.title = String(input.title).trim();
  }

  if (input.queryBinding !== undefined) {
    const binding = createAnalyticsQueryBinding(input.queryBinding);
    if (!binding.ok) return binding;
    section.queryBinding = binding.value;
  }

  return ok(deepFreeze(section));
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsReportDefinition(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
        "AnalyticsReportDefinition must be a plain object",
        "report"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "report");
  if (!forbidden.ok) return forbidden;

  const idResult = createAnalyticsReportId(input.reportId);
  if (!idResult.ok) return idResult;
  const versionResult = createAnalyticsReportVersion(input.version);
  if (!versionResult.ok) return versionResult;

  const lifecycleState = isEnumValue(
    input.lifecycleState,
    ANALYTICS_REPORT_LIFECYCLE_STATE
  )
    ? input.lifecycleState
    : ANALYTICS_REPORT_LIFECYCLE_STATE.ACTIVE;

  const tenantApplicability = createAnalyticsTenantApplicability(
    input.tenantApplicability
  );
  if (!tenantApplicability.ok) return tenantApplicability;

  const accessScope = createAnalyticsAccessScope(input.accessScope || {});
  if (!accessScope.ok) return accessScope;

  if (!Array.isArray(input.sections)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
        "sections must be an array",
        "report.sections"
      )
    );
  }

  /** @type {unknown[]} */
  const sections = [];
  /** @type {Set<string>} */
  const sectionIds = new Set();
  /** @type {Set<string>} */
  const columnIds = new Set();
  /** @type {Set<string>} */
  const aliases = new Set();

  for (const sectionInput of input.sections) {
    const section = createAnalyticsReportSection(sectionInput, options);
    if (!section.ok) return section;
    if (sectionIds.has(section.value.sectionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
          `Duplicate section ID: ${section.value.sectionId}`,
          "report.sections"
        )
      );
    }
    sectionIds.add(section.value.sectionId);

    for (const column of section.value.columns) {
      if (columnIds.has(column.columnId)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
            `Duplicate report column ID: ${column.columnId}`,
            "report.sections"
          )
        );
      }
      columnIds.add(column.columnId);

      for (const binding of [column.metricBinding, column.queryBinding]) {
        if (binding?.presentationAlias) {
          if (aliases.has(binding.presentationAlias)) {
            return fail(
              analyticsError(
                ANALYTICS_ERROR_CODE.BINDING_INVALID,
                `Duplicate binding presentationAlias: ${binding.presentationAlias}`,
                "report.sections"
              )
            );
          }
          aliases.add(binding.presentationAlias);
        }
      }
    }

    if (section.value.queryBinding?.presentationAlias) {
      const alias = section.value.queryBinding.presentationAlias;
      if (aliases.has(alias)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.BINDING_INVALID,
            `Duplicate binding presentationAlias: ${alias}`,
            "report.sections"
          )
        );
      }
      aliases.add(alias);
    }

    sections.push(section.value);
  }

  /** @type {unknown[]} */
  const filters = [];
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "filters must be an array",
          "report.filters"
        )
      );
    }
    /** @type {Set<string>} */
    const filterIds = new Set();
    for (const filterInput of input.filters) {
      const filter = createAnalyticsFilterDefinition(filterInput);
      if (!filter.ok) return filter;
      if (filterIds.has(filter.value.filterId)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FILTER_DEFINITION_INVALID,
            `Duplicate filter ID: ${filter.value.filterId}`,
            "report.filters"
          )
        );
      }
      filterIds.add(filter.value.filterId);
      filters.push(filter.value);
    }
  }

  /** @type {unknown[]} */
  const parameters = [];
  if (input.parameters !== undefined) {
    if (!Array.isArray(input.parameters)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "parameters must be an array",
          "report.parameters"
        )
      );
    }
    for (const parameterInput of input.parameters) {
      const parameter = createAnalyticsParameterDefinition(parameterInput);
      if (!parameter.ok) return parameter;
      parameters.push(parameter.value);
    }
  }

  /** @type {unknown[]} */
  const queryBindings = [];
  if (input.queryBindings !== undefined) {
    if (!Array.isArray(input.queryBindings)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "queryBindings must be an array",
          "report.queryBindings"
        )
      );
    }
    /** @type {Set<string>} */
    const bindingIds = new Set();
    for (const bindingInput of input.queryBindings) {
      const binding = createAnalyticsQueryBinding(bindingInput);
      if (!binding.ok) return binding;
      if (bindingIds.has(binding.value.bindingId)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.BINDING_INVALID,
            `Duplicate query binding ID: ${binding.value.bindingId}`,
            "report.queryBindings"
          )
        );
      }
      bindingIds.add(binding.value.bindingId);
      if (binding.value.presentationAlias) {
        if (aliases.has(binding.value.presentationAlias)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.BINDING_INVALID,
              `Duplicate binding presentationAlias: ${binding.value.presentationAlias}`,
              "report.queryBindings"
            )
          );
        }
        aliases.add(binding.value.presentationAlias);
      }
      queryBindings.push(binding.value);
    }
  }

  let exportIntent;
  if (input.exportIntent !== undefined) {
    const exportResult = createAnalyticsExportIntent(input.exportIntent);
    if (!exportResult.ok) return exportResult;
    exportIntent = exportResult.value;
  }

  let scheduleIntent;
  if (input.scheduleIntent !== undefined) {
    const scheduleResult = createAnalyticsScheduleIntent(input.scheduleIntent);
    if (!scheduleResult.ok) return scheduleResult;
    scheduleIntent = scheduleResult.value;
  }

  /** @type {Record<string, unknown>} */
  const definition = {
    reportId: idResult.value,
    version: versionResult.value,
    lifecycleState,
    tenantApplicability: tenantApplicability.value,
    accessScope: accessScope.value,
    sections: Object.freeze(sections),
    filters: Object.freeze(filters),
    parameters: Object.freeze(parameters),
    queryBindings: Object.freeze(queryBindings),
  };

  if (exportIntent) definition.exportIntent = exportIntent;
  if (scheduleIntent) definition.scheduleIntent = scheduleIntent;

  if (input.title !== undefined) {
    if (!isNonEmptyString(input.title)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "title must be a non-empty string when provided",
          "report.title"
        )
      );
    }
    definition.title = String(input.title).trim();
  }

  if (input.description !== undefined) {
    if (!isNonEmptyString(input.description)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "description must be a non-empty string when provided",
          "report.description"
        )
      );
    }
    definition.description = String(input.description).trim();
  }

  if (input.provenanceExpectation !== undefined) {
    if (!isNonEmptyString(input.provenanceExpectation)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "provenanceExpectation must be a non-empty string",
          "report.provenanceExpectation"
        )
      );
    }
    definition.provenanceExpectation = String(
      input.provenanceExpectation
    ).trim();
  }

  if (input.freshnessExpectation !== undefined) {
    if (!isNonEmptyString(input.freshnessExpectation)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "freshnessExpectation must be a non-empty string",
          "report.freshnessExpectation"
        )
      );
    }
    definition.freshnessExpectation = String(input.freshnessExpectation).trim();
  }

  if (input.dataStateSemantics !== undefined) {
    if (!isPlainObject(input.dataStateSemantics)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REPORT_DEFINITION_INVALID,
          "dataStateSemantics must be a plain object",
          "report.dataStateSemantics"
        )
      );
    }
    definition.dataStateSemantics = deepFreeze(
      clonePlain(input.dataStateSemantics)
    );
  }

  return ok(deepFreeze(definition));
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function validateReportDefinition(input, options = {}) {
  return createAnalyticsReportDefinition(input, options);
}
