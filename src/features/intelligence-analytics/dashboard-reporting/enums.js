/**
 * Dashboard / reporting enumeration contracts (I&A-04).
 * Presentation-neutral — no React, chart-library, or CSS values.
 */

export const ANALYTICS_DASHBOARD_LIFECYCLE_STATE = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  RETIRED: "retired",
});

export const ANALYTICS_REPORT_LIFECYCLE_STATE = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  DEPRECATED: "deprecated",
  RETIRED: "retired",
});

export const ANALYTICS_WIDGET_KIND = Object.freeze({
  KPI: "KPI",
  TIME_SERIES: "TIME_SERIES",
  BREAKDOWN: "BREAKDOWN",
  COMPARISON: "COMPARISON",
  TABLE: "TABLE",
  TEXTUAL_SUMMARY_PLACEHOLDER: "TEXTUAL_SUMMARY_PLACEHOLDER",
});

export const ANALYTICS_PRESENTATION_INTENT = Object.freeze({
  SINGLE_VALUE: "SINGLE_VALUE",
  TREND: "TREND",
  SERIES: "SERIES",
  CATEGORY_BREAKDOWN: "CATEGORY_BREAKDOWN",
  COMPARISON: "COMPARISON",
  TABULAR: "TABULAR",
  STATUS: "STATUS",
});

export const ANALYTICS_DATA_STATE = Object.freeze({
  LOADING: "LOADING",
  READY: "READY",
  EMPTY: "EMPTY",
  PARTIAL: "PARTIAL",
  STALE: "STALE",
  ERROR: "ERROR",
  UNAVAILABLE: "UNAVAILABLE",
});

export const ANALYTICS_EXPORT_FORMAT = Object.freeze({
  CSV: "CSV",
  XLSX: "XLSX",
  PDF: "PDF",
  PRINT: "PRINT",
});

export const ANALYTICS_PARAMETER_TYPE = Object.freeze({
  TIME_RANGE: "TIME_RANGE",
  DIMENSION: "DIMENSION",
  ENUM: "ENUM",
  NUMERIC: "NUMERIC",
  TEXT: "TEXT",
  TENANT_SAFE_REFERENCE: "TENANT_SAFE_REFERENCE",
});

export const ANALYTICS_LAYOUT_INTENT = Object.freeze({
  STACK: "STACK",
  ROW: "ROW",
  GRID: "GRID",
  UNSPECIFIED: "UNSPECIFIED",
});

export const ANALYTICS_DASHBOARD_REPORT_COMPATIBILITY = Object.freeze({
  IDENTICAL: "identical",
  BACKWARD_COMPATIBLE: "backward_compatible",
  BREAKING: "breaking",
  INDETERMINATE: "indeterminate",
});

export const ANALYTICS_COMPARISON_METHOD = Object.freeze({
  ABSOLUTE_DELTA: "ABSOLUTE_DELTA",
  RELATIVE_DELTA: "RELATIVE_DELTA",
  SIDE_BY_SIDE: "SIDE_BY_SIDE",
});

export const ANALYTICS_MISSING_CATEGORY_SEMANTICS = Object.freeze({
  OMIT: "OMIT",
  INCLUDE_NULL: "INCLUDE_NULL",
  FAIL: "FAIL",
});

/**
 * @param {unknown} value
 * @param {Readonly<Record<string, string>>} enumObject
 * @returns {boolean}
 */
export function isEnumValue(value, enumObject) {
  return typeof value === "string" && Object.values(enumObject).includes(value);
}
