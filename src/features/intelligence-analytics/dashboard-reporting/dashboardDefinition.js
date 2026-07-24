/**
 * Dashboard definition, section, and widget contracts (I&A-04).
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
  createAnalyticsDrillDownDescriptor,
  createAnalyticsFilterDefinition,
  createAnalyticsParameterDefinition,
  createAnalyticsPresentationIntent,
} from "./presentation.js";
import {
  ANALYTICS_DASHBOARD_LIFECYCLE_STATE,
  ANALYTICS_LAYOUT_INTENT,
  ANALYTICS_WIDGET_KIND,
  isEnumValue,
} from "./enums.js";
import { assertNoForbiddenContractContent } from "./forbidden.js";

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDashboardWidget(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
        "AnalyticsDashboardWidget must be a plain object",
        "widget"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "widget");
  if (!forbidden.ok) return forbidden;

  if (!isNonEmptyString(input.widgetId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
        "widgetId is required",
        "widget.widgetId"
      )
    );
  }

  if (!isEnumValue(input.widgetKind, ANALYTICS_WIDGET_KIND)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
        `Unsupported widget kind: ${input.widgetKind}`,
        "widget.widgetKind"
      )
    );
  }

  const presentationResult = createAnalyticsPresentationIntent(
    input.presentationIntent
  );
  if (!presentationResult.ok) return presentationResult;

  /** @type {Record<string, unknown>} */
  const widget = {
    widgetId: String(input.widgetId).trim(),
    widgetKind: String(input.widgetKind),
    presentationIntent: presentationResult.value,
  };

  if (input.title !== undefined) {
    if (!isNonEmptyString(input.title)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
          "title must be a non-empty string when provided",
          "widget.title"
        )
      );
    }
    widget.title = String(input.title).trim();
  }

  if (input.metricBinding !== undefined) {
    const binding = createAnalyticsMetricBinding(input.metricBinding, options);
    if (!binding.ok) return binding;
    widget.metricBinding = binding.value;
  }

  if (input.queryBinding !== undefined) {
    const binding = createAnalyticsQueryBinding(input.queryBinding);
    if (!binding.ok) return binding;
    widget.queryBinding = binding.value;
  }

  if (
    input.widgetKind !== ANALYTICS_WIDGET_KIND.TEXTUAL_SUMMARY_PLACEHOLDER &&
    !widget.metricBinding &&
    !widget.queryBinding
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
        "Non-placeholder widgets require metricBinding or queryBinding",
        "widget.metricBinding"
      )
    );
  }

  if (input.comparisonMetricBinding !== undefined) {
    const binding = createAnalyticsMetricBinding(
      input.comparisonMetricBinding,
      options
    );
    if (!binding.ok) return binding;
    widget.comparisonMetricBinding = binding.value;
  }

  if (input.drillDown !== undefined) {
    const drillDown = createAnalyticsDrillDownDescriptor(input.drillDown);
    if (!drillDown.ok) return drillDown;
    widget.drillDown = drillDown.value;
  }

  if (input.dataStatePolicy !== undefined) {
    if (!isPlainObject(input.dataStatePolicy)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
          "dataStatePolicy must be a plain object",
          "widget.dataStatePolicy"
        )
      );
    }
    widget.dataStatePolicy = deepFreeze(clonePlain(input.dataStatePolicy));
  }

  return ok(deepFreeze(widget));
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDashboardSection(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
        "AnalyticsDashboardSection must be a plain object",
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

  if (!Array.isArray(input.widgets)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
        "widgets must be an array",
        "section.widgets"
      )
    );
  }

  /** @type {unknown[]} */
  const widgets = [];
  /** @type {Set<string>} */
  const widgetIds = new Set();
  for (const widgetInput of input.widgets) {
    const widget = createAnalyticsDashboardWidget(widgetInput, options);
    if (!widget.ok) return widget;
    if (widgetIds.has(widget.value.widgetId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
          `Duplicate widget ID: ${widget.value.widgetId}`,
          "section.widgets"
        )
      );
    }
    widgetIds.add(widget.value.widgetId);
    widgets.push(widget.value);
  }

  /** @type {Record<string, unknown>} */
  const section = {
    sectionId: String(input.sectionId).trim(),
    widgets: Object.freeze(widgets),
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

  if (input.layoutIntent !== undefined) {
    if (!isEnumValue(input.layoutIntent, ANALYTICS_LAYOUT_INTENT)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
          `Unsupported layout intent: ${input.layoutIntent}`,
          "section.layoutIntent"
        )
      );
    }
    section.layoutIntent = input.layoutIntent;
  } else {
    section.layoutIntent = ANALYTICS_LAYOUT_INTENT.UNSPECIFIED;
  }

  if (input.accessScope !== undefined) {
    const access = createAnalyticsAccessScope(input.accessScope);
    if (!access.ok) return access;
    section.accessScope = access.value;
  }

  return ok(deepFreeze(section));
}

/**
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDashboardDefinition(input, options = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
        "AnalyticsDashboardDefinition must be a plain object",
        "dashboard"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "dashboard");
  if (!forbidden.ok) return forbidden;

  const idResult = createAnalyticsDashboardId(input.dashboardId);
  if (!idResult.ok) return idResult;
  const versionResult = createAnalyticsDashboardVersion(input.version);
  if (!versionResult.ok) return versionResult;

  const lifecycleState = isEnumValue(
    input.lifecycleState,
    ANALYTICS_DASHBOARD_LIFECYCLE_STATE
  )
    ? input.lifecycleState
    : ANALYTICS_DASHBOARD_LIFECYCLE_STATE.ACTIVE;

  const tenantApplicability = createAnalyticsTenantApplicability(
    input.tenantApplicability
  );
  if (!tenantApplicability.ok) return tenantApplicability;

  const accessScope = createAnalyticsAccessScope(input.accessScope || {});
  if (!accessScope.ok) return accessScope;

  if (!Array.isArray(input.sections)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
        "sections must be an array",
        "dashboard.sections"
      )
    );
  }

  /** @type {unknown[]} */
  const sections = [];
  /** @type {Set<string>} */
  const sectionIds = new Set();
  /** @type {Set<string>} */
  const widgetIds = new Set();
  /** @type {Set<string>} */
  const aliases = new Set();

  for (const sectionInput of input.sections) {
    const section = createAnalyticsDashboardSection(sectionInput, options);
    if (!section.ok) return section;
    if (sectionIds.has(section.value.sectionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SECTION_DEFINITION_INVALID,
          `Duplicate section ID: ${section.value.sectionId}`,
          "dashboard.sections"
        )
      );
    }
    sectionIds.add(section.value.sectionId);

    for (const widget of section.value.widgets) {
      if (widgetIds.has(widget.widgetId)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.WIDGET_DEFINITION_INVALID,
            `Duplicate widget ID: ${widget.widgetId}`,
            "dashboard.sections"
          )
        );
      }
      widgetIds.add(widget.widgetId);

      for (const binding of [widget.metricBinding, widget.queryBinding]) {
        if (binding?.presentationAlias) {
          if (aliases.has(binding.presentationAlias)) {
            return fail(
              analyticsError(
                ANALYTICS_ERROR_CODE.BINDING_INVALID,
                `Duplicate binding presentationAlias: ${binding.presentationAlias}`,
                "dashboard.sections"
              )
            );
          }
          aliases.add(binding.presentationAlias);
        }
      }
    }

    sections.push(section.value);
  }

  /** @type {unknown[]} */
  const filters = [];
  if (input.filters !== undefined) {
    if (!Array.isArray(input.filters)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "filters must be an array",
          "dashboard.filters"
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
            "dashboard.filters"
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
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "parameters must be an array",
          "dashboard.parameters"
        )
      );
    }
    for (const parameterInput of input.parameters) {
      const parameter = createAnalyticsParameterDefinition(parameterInput);
      if (!parameter.ok) return parameter;
      parameters.push(parameter.value);
    }
  }

  /** @type {Record<string, unknown>} */
  const definition = {
    dashboardId: idResult.value,
    version: versionResult.value,
    lifecycleState,
    tenantApplicability: tenantApplicability.value,
    accessScope: accessScope.value,
    sections: Object.freeze(sections),
    filters: Object.freeze(filters),
    parameters: Object.freeze(parameters),
  };

  if (input.title !== undefined) {
    if (!isNonEmptyString(input.title)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "title must be a non-empty string when provided",
          "dashboard.title"
        )
      );
    }
    definition.title = String(input.title).trim();
  }

  if (input.description !== undefined) {
    if (!isNonEmptyString(input.description)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "description must be a non-empty string when provided",
          "dashboard.description"
        )
      );
    }
    definition.description = String(input.description).trim();
  }

  if (input.provenanceExpectation !== undefined) {
    if (!isNonEmptyString(input.provenanceExpectation)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "provenanceExpectation must be a non-empty string",
          "dashboard.provenanceExpectation"
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
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "freshnessExpectation must be a non-empty string",
          "dashboard.freshnessExpectation"
        )
      );
    }
    definition.freshnessExpectation = String(input.freshnessExpectation).trim();
  }

  if (input.emptyPartialErrorBehavior !== undefined) {
    if (!isPlainObject(input.emptyPartialErrorBehavior)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "emptyPartialErrorBehavior must be a plain object",
          "dashboard.emptyPartialErrorBehavior"
        )
      );
    }
    definition.emptyPartialErrorBehavior = deepFreeze(
      clonePlain(input.emptyPartialErrorBehavior)
    );
  }

  if (input.compatibilityMetadata !== undefined) {
    if (!isPlainObject(input.compatibilityMetadata)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DASHBOARD_DEFINITION_INVALID,
          "compatibilityMetadata must be a plain object",
          "dashboard.compatibilityMetadata"
        )
      );
    }
    definition.compatibilityMetadata = deepFreeze(
      clonePlain(input.compatibilityMetadata)
    );
  }

  return ok(deepFreeze(definition));
}

/**
 * Validate an existing or raw dashboard definition.
 * @param {unknown} input
 * @param {{ registry?: unknown }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function validateDashboardDefinition(input, options = {}) {
  return createAnalyticsDashboardDefinition(input, options);
}
