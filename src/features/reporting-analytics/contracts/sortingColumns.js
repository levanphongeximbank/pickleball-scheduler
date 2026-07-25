/**
 * Sorting, grouping, and column selection contracts (REPORTING-01).
 */

import {
  REPORT_SORT_DIRECTION,
  isReportSortDirection,
} from "../constants/parameterTypes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isPlainObject,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @param {unknown} input
 */
export function createSortClause(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SORT,
      "Sort clause must be a plain object",
      { field: "sort" }
    );
  }
  const field = requireNonEmptyString(input.field, "field");
  const direction = String(input.direction || REPORT_SORT_DIRECTION.ASC).trim();
  if (!isReportSortDirection(direction)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_SORT,
      `Unsupported sort direction: ${direction}`,
      { field: "direction" }
    );
  }
  return deepFreeze({ field, direction });
}

/**
 * @param {ReadonlyArray<string>} allowedFields
 * @param {unknown} sorting
 */
export function validateSorting(allowedFields, sorting) {
  const allowed = new Set(Array.isArray(allowedFields) ? allowedFields : []);
  const list = Array.isArray(sorting) ? sorting : sorting == null ? [] : [sorting];
  /** @type {object[]} */
  const out = [];
  for (const raw of list) {
    const clause = createSortClause(raw);
    if (!allowed.has(clause.field)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_SORT,
        `Unknown sort field: ${clause.field}`,
        { field: clause.field }
      );
    }
    out.push(clause);
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} input
 */
export function createGroupingClause(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_GROUPING,
      "Grouping clause must be a plain object",
      { field: "grouping" }
    );
  }
  const field = requireNonEmptyString(input.field, "field");
  return deepFreeze({ field });
}

/**
 * @param {ReadonlyArray<string>} allowedFields
 * @param {unknown} grouping
 */
export function validateGrouping(allowedFields, grouping) {
  const allowed = new Set(Array.isArray(allowedFields) ? allowedFields : []);
  const list = Array.isArray(grouping) ? grouping : grouping == null ? [] : [grouping];
  /** @type {object[]} */
  const out = [];
  for (const raw of list) {
    const clause = createGroupingClause(raw);
    if (!allowed.has(clause.field)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_GROUPING,
        `Unknown grouping field: ${clause.field}`,
        { field: clause.field }
      );
    }
    out.push(clause);
  }
  return Object.freeze(out);
}

/**
 * @param {unknown} input
 */
export function createColumnDefinition(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_COLUMN_SELECTION,
      "Column definition must be a plain object",
      { field: "column" }
    );
  }
  const field = requireNonEmptyString(input.field, "field");
  const label = requireNonEmptyString(input.label || field, "label");
  const sensitive = Boolean(input.sensitive);
  const defaultSelected = input.defaultSelected !== false;
  const order =
    typeof input.order === "number" && Number.isFinite(input.order)
      ? input.order
      : 0;
  return deepFreeze({ field, label, sensitive, defaultSelected, order });
}

/**
 * Deterministic column order: explicit order asc, then field name.
 * @param {ReadonlyArray<object>} columns
 */
export function orderColumnsDeterministically(columns) {
  const list = Array.isArray(columns) ? [...columns] : [];
  list.sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 0;
    const bo = typeof b.order === "number" ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return String(a.field).localeCompare(String(b.field));
  });
  return Object.freeze(list.map((c) => deepFreeze({ ...c })));
}

/**
 * @param {ReadonlyArray<object>} allowedColumns
 * @param {unknown} requestedFields
 * @param {{ allowSensitive?: boolean }} [opts]
 */
export function validateColumnSelection(allowedColumns, requestedFields, opts = {}) {
  const allowed = Array.isArray(allowedColumns) ? allowedColumns : [];
  const byField = new Map(allowed.map((c) => [c.field, c]));
  let fields;
  if (requestedFields == null) {
    fields = allowed.filter((c) => c.defaultSelected !== false).map((c) => c.field);
  } else if (Array.isArray(requestedFields)) {
    fields = requestedFields.map((f) => String(f));
  } else {
    failContract(
      REPORTING_ERROR_CODE.INVALID_COLUMN_SELECTION,
      "Column selection must be an array of field names",
      { field: "columns" }
    );
  }

  /** @type {object[]} */
  const selected = [];
  const seen = new Set();
  for (const field of fields) {
    if (seen.has(field)) continue;
    seen.add(field);
    const col = byField.get(field);
    if (!col) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_COLUMN_SELECTION,
        `Unknown or unauthorized column: ${field}`,
        { field }
      );
    }
    if (col.sensitive && opts.allowSensitive !== true) {
      failContract(
        REPORTING_ERROR_CODE.AUTHORIZATION_DENIED,
        `Sensitive column requires authorization: ${field}`,
        { field }
      );
    }
    selected.push(col);
  }

  return orderColumnsDeterministically(selected);
}
