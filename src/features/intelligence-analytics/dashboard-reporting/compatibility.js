/**
 * Compatibility classification for dashboard/report definitions (I&A-04).
 * Minimal deterministic rules — not a semantic migration engine.
 */

import { ok } from "../contracts/result.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY } from "./enums.js";
import { createAnalyticsDashboardDefinition } from "./dashboardDefinition.js";
import { createAnalyticsReportDefinition } from "./reportDefinition.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeDashboard(input) {
  if (
    isPlainObject(input) &&
    typeof input.dashboardId === "string" &&
    typeof input.version === "string" &&
    Array.isArray(input.sections) &&
    Object.isFrozen(input)
  ) {
    return ok(input);
  }
  return createAnalyticsDashboardDefinition(input);
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeReport(input) {
  if (
    isPlainObject(input) &&
    typeof input.reportId === "string" &&
    typeof input.version === "string" &&
    Array.isArray(input.sections) &&
    Object.isFrozen(input)
  ) {
    return ok(input);
  }
  return createAnalyticsReportDefinition(input);
}

/**
 * @param {ReadonlyArray<*>} sections
 * @returns {Map<string, *>}
 */
function widgetMap(sections) {
  /** @type {Map<string, *>} */
  const map = new Map();
  for (const section of sections) {
    for (const widget of section.widgets || []) {
      map.set(widget.widgetId, widget);
    }
  }
  return map;
}

/**
 * @param {ReadonlyArray<*>} sections
 * @returns {Map<string, *>}
 */
function columnMap(sections) {
  /** @type {Map<string, *>} */
  const map = new Map();
  for (const section of sections) {
    for (const column of section.columns || []) {
      map.set(column.columnId, column);
    }
  }
  return map;
}

/**
 * @param {ReadonlyArray<*>} filters
 * @returns {Map<string, *>}
 */
function filterMap(filters) {
  /** @type {Map<string, *>} */
  const map = new Map();
  for (const filter of filters || []) {
    map.set(filter.filterId, filter);
  }
  return map;
}

/**
 * @param {*} before
 * @param {*} after
 * @returns {{ classification: string, reasons: string[] }}
 */
function classifyDashboardPair(before, after) {
  /** @type {string[]} */
  const reasons = [];
  let breaking = false;
  let additive = false;
  let indeterminate = false;

  if (before.dashboardId !== after.dashboardId) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.INDETERMINATE,
      reasons: ["dashboardId_mismatch"],
    };
  }

  const beforeWidgets = widgetMap(before.sections);
  const afterWidgets = widgetMap(after.sections);
  for (const id of beforeWidgets.keys()) {
    if (!afterWidgets.has(id)) {
      breaking = true;
      reasons.push("widget_removed");
    }
  }
  for (const id of afterWidgets.keys()) {
    if (!beforeWidgets.has(id)) {
      additive = true;
      reasons.push("widget_added");
    } else {
      const bw = beforeWidgets.get(id);
      const aw = afterWidgets.get(id);
      if (bw.widgetKind !== aw.widgetKind) {
        breaking = true;
        reasons.push("widget_kind_changed");
      }
      if (
        bw.metricBinding?.metricVersion !== aw.metricBinding?.metricVersion ||
        bw.metricBinding?.metricId !== aw.metricBinding?.metricId
      ) {
        if (bw.metricBinding && aw.metricBinding) {
          if (bw.metricBinding.metricId !== aw.metricBinding.metricId) {
            breaking = true;
            reasons.push("metric_binding_id_changed");
          } else if (
            bw.metricBinding.metricVersion !== aw.metricBinding.metricVersion
          ) {
            breaking = true;
            reasons.push("metric_binding_version_changed");
          }
        } else {
          breaking = true;
          reasons.push("metric_binding_changed");
        }
      }
      if (
        JSON.stringify(bw.presentationIntent) !==
        JSON.stringify(aw.presentationIntent)
      ) {
        if (bw.presentationIntent?.intent !== aw.presentationIntent?.intent) {
          breaking = true;
          reasons.push("presentation_intent_changed");
        } else {
          indeterminate = true;
          reasons.push("presentation_metadata_changed");
        }
      }
      if (
        JSON.stringify(bw.drillDown || null) !==
        JSON.stringify(aw.drillDown || null)
      ) {
        breaking = true;
        reasons.push("drill_down_target_changed");
      }
      if (
        JSON.stringify(bw.dataStatePolicy || null) !==
        JSON.stringify(aw.dataStatePolicy || null)
      ) {
        breaking = true;
        reasons.push("data_state_policy_changed");
      }
    }
  }

  const beforeSections = new Set(before.sections.map((s) => s.sectionId));
  const afterSections = new Set(after.sections.map((s) => s.sectionId));
  for (const id of beforeSections) {
    if (!afterSections.has(id)) {
      breaking = true;
      reasons.push("section_removed");
    }
  }
  for (const id of afterSections) {
    if (!beforeSections.has(id)) {
      additive = true;
      reasons.push("section_added");
    }
  }

  const beforeFilters = filterMap(before.filters);
  const afterFilters = filterMap(after.filters);
  for (const [id, filter] of afterFilters.entries()) {
    if (!beforeFilters.has(id) && filter.required) {
      breaking = true;
      reasons.push("required_filter_added");
    } else if (!beforeFilters.has(id)) {
      additive = true;
      reasons.push("optional_filter_added");
    }
  }
  for (const id of beforeFilters.keys()) {
    if (!afterFilters.has(id)) {
      breaking = true;
      reasons.push("filter_removed");
    }
  }

  if (
    JSON.stringify(before.tenantApplicability) !==
    JSON.stringify(after.tenantApplicability)
  ) {
    breaking = true;
    reasons.push("tenant_scope_changed");
  }
  if (JSON.stringify(before.accessScope) !== JSON.stringify(after.accessScope)) {
    breaking = true;
    reasons.push("access_scope_changed");
  }

  const fullyEqual = JSON.stringify(before) === JSON.stringify(after);
  if (fullyEqual) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.IDENTICAL,
      reasons: [],
    };
  }
  if (breaking) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BREAKING,
      reasons,
    };
  }
  if (additive && !indeterminate) {
    return {
      classification:
        ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BACKWARD_COMPATIBLE,
      reasons,
    };
  }
  return {
    classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.INDETERMINATE,
    reasons: reasons.length ? reasons : ["definition_drift"],
  };
}

/**
 * @param {*} before
 * @param {*} after
 * @returns {{ classification: string, reasons: string[] }}
 */
function classifyReportPair(before, after) {
  /** @type {string[]} */
  const reasons = [];
  let breaking = false;
  let additive = false;
  let indeterminate = false;

  if (before.reportId !== after.reportId) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.INDETERMINATE,
      reasons: ["reportId_mismatch"],
    };
  }

  const beforeColumns = columnMap(before.sections);
  const afterColumns = columnMap(after.sections);
  for (const id of beforeColumns.keys()) {
    if (!afterColumns.has(id)) {
      breaking = true;
      reasons.push("column_removed");
    }
  }
  for (const id of afterColumns.keys()) {
    if (!beforeColumns.has(id)) {
      additive = true;
      reasons.push("column_added");
    } else {
      const bc = beforeColumns.get(id);
      const ac = afterColumns.get(id);
      if (
        bc.metricBinding?.metricVersion !== ac.metricBinding?.metricVersion ||
        bc.metricBinding?.metricId !== ac.metricBinding?.metricId
      ) {
        breaking = true;
        reasons.push("metric_binding_version_changed");
      }
      if ((bc.valueType || "") !== (ac.valueType || "")) {
        breaking = true;
        reasons.push("column_meaning_changed");
      }
    }
  }

  const beforeSections = new Set(before.sections.map((s) => s.sectionId));
  const afterSections = new Set(after.sections.map((s) => s.sectionId));
  for (const id of beforeSections) {
    if (!afterSections.has(id)) {
      breaking = true;
      reasons.push("section_removed");
    }
  }
  for (const id of afterSections) {
    if (!beforeSections.has(id)) {
      additive = true;
      reasons.push("section_added");
    }
  }

  const beforeFilters = filterMap(before.filters);
  const afterFilters = filterMap(after.filters);
  for (const [id, filter] of afterFilters.entries()) {
    if (!beforeFilters.has(id) && filter.required) {
      breaking = true;
      reasons.push("required_filter_added");
    } else if (!beforeFilters.has(id)) {
      additive = true;
      reasons.push("optional_filter_added");
    }
  }

  if (
    JSON.stringify(before.tenantApplicability) !==
    JSON.stringify(after.tenantApplicability)
  ) {
    breaking = true;
    reasons.push("tenant_scope_changed");
  }
  if (JSON.stringify(before.accessScope) !== JSON.stringify(after.accessScope)) {
    breaking = true;
    reasons.push("access_scope_changed");
  }
  if (
    JSON.stringify(before.exportIntent || null) !==
    JSON.stringify(after.exportIntent || null)
  ) {
    // Export intent changes are breaking for consumers that depend on formats.
    breaking = true;
    reasons.push("export_intent_changed");
  }

  if (
    JSON.stringify(before.dataStateSemantics || null) !==
    JSON.stringify(after.dataStateSemantics || null)
  ) {
    breaking = true;
    reasons.push("data_state_policy_changed");
  }

  // Unused for now but retained for future non-breaking drift signals.
  void indeterminate;

  const fullyEqual = JSON.stringify(before) === JSON.stringify(after);
  if (fullyEqual) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.IDENTICAL,
      reasons: [],
    };
  }
  if (breaking) {
    return {
      classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BREAKING,
      reasons,
    };
  }
  if (additive) {
    return {
      classification:
        ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.BACKWARD_COMPATIBLE,
      reasons,
    };
  }
  return {
    classification: ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY.INDETERMINATE,
    reasons: reasons.length ? reasons : ["definition_drift"],
  };
}

/**
 * @param {unknown} beforeInput
 * @param {unknown} afterInput
 * @returns {import("../contracts/result.js").Result}
 */
export function compareDashboardDefinitions(beforeInput, afterInput) {
  const before = normalizeDashboard(beforeInput);
  if (!before.ok) return before;
  const after = normalizeDashboard(afterInput);
  if (!after.ok) return after;

  const classified = classifyDashboardPair(before.value, after.value);
  return ok(
    deepFreeze({
      classification: classified.classification,
      reasons: Object.freeze([...classified.reasons]),
      beforeDashboardId: before.value.dashboardId,
      beforeVersion: before.value.version,
      afterDashboardId: after.value.dashboardId,
      afterVersion: after.value.version,
    })
  );
}

/**
 * @param {unknown} beforeInput
 * @param {unknown} afterInput
 * @returns {import("../contracts/result.js").Result}
 */
export function compareReportDefinitions(beforeInput, afterInput) {
  const before = normalizeReport(beforeInput);
  if (!before.ok) return before;
  const after = normalizeReport(afterInput);
  if (!after.ok) return after;

  const classified = classifyReportPair(before.value, after.value);
  return ok(
    deepFreeze({
      classification: classified.classification,
      reasons: Object.freeze([...classified.reasons]),
      beforeReportId: before.value.reportId,
      beforeVersion: before.value.version,
      afterReportId: after.value.reportId,
      afterVersion: after.value.version,
    })
  );
}
