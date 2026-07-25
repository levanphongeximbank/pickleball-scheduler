/**
 * Parameter / filter / export typed enums (REPORTING-01).
 */

export const REPORT_PARAMETER_TYPE = Object.freeze({
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  DATE: "DATE",
  DATE_RANGE: "DATE_RANGE",
  ENUM: "ENUM",
  ID_REFERENCE: "ID_REFERENCE",
});

export const REPORT_PARAMETER_TYPE_VALUES = Object.freeze(
  Object.values(REPORT_PARAMETER_TYPE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportParameterType(value) {
  return REPORT_PARAMETER_TYPE_VALUES.includes(/** @type {string} */ (value));
}

export const REPORT_FILTER_OPERATOR = Object.freeze({
  EQ: "EQ",
  NEQ: "NEQ",
  IN: "IN",
  NOT_IN: "NOT_IN",
  GT: "GT",
  GTE: "GTE",
  LT: "LT",
  LTE: "LTE",
  BETWEEN: "BETWEEN",
  CONTAINS: "CONTAINS",
  STARTS_WITH: "STARTS_WITH",
});

export const REPORT_FILTER_OPERATOR_VALUES = Object.freeze(
  Object.values(REPORT_FILTER_OPERATOR)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportFilterOperator(value) {
  return REPORT_FILTER_OPERATOR_VALUES.includes(/** @type {string} */ (value));
}

export const REPORT_SORT_DIRECTION = Object.freeze({
  ASC: "ASC",
  DESC: "DESC",
});

export const REPORT_SORT_DIRECTION_VALUES = Object.freeze(
  Object.values(REPORT_SORT_DIRECTION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportSortDirection(value) {
  return REPORT_SORT_DIRECTION_VALUES.includes(/** @type {string} */ (value));
}

export const REPORT_EXPORT_FORMAT = Object.freeze({
  CSV: "CSV",
  XLSX: "XLSX",
  PDF: "PDF",
  JSON: "JSON",
});

export const REPORT_EXPORT_FORMAT_VALUES = Object.freeze(
  Object.values(REPORT_EXPORT_FORMAT)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReportExportFormat(value) {
  return REPORT_EXPORT_FORMAT_VALUES.includes(/** @type {string} */ (value));
}
