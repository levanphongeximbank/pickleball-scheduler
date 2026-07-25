/**
 * Report parameter & filter definition contracts (REPORTING-01).
 */

import {
  REPORT_FILTER_OPERATOR,
  REPORT_PARAMETER_TYPE,
  isReportFilterOperator,
  isReportParameterType,
} from "../constants/parameterTypes.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isNonEmptyString,
  isPlainObject,
  optionalNonEmptyString,
  requireNonEmptyString,
  requireOpaqueId,
} from "./shared.js";

/**
 * @param {unknown} input
 */
export function createParameterDefinition(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_PARAMETERS,
      "Parameter definition must be a plain object",
      { field: "parameter" }
    );
  }
  const parameterId = requireOpaqueId(input.parameterId, "parameterId");
  const type = String(input.type || "").trim();
  if (!isReportParameterType(type)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_PARAMETERS,
      `Unsupported parameter type: ${type || "(empty)"}`,
      { field: "type", parameterId }
    );
  }
  const required = Boolean(input.required);
  const sensitive = Boolean(input.sensitive);
  const label = optionalNonEmptyString(input.label, "label");
  const defaultValue =
    input.defaultValue === undefined ? undefined : input.defaultValue;
  if (required && defaultValue === undefined && input.allowEmptyDefault !== true) {
    // allowed — required without default means caller must supply
  }
  let allowedValues = null;
  if (input.allowedValues != null) {
    if (!Array.isArray(input.allowedValues) || input.allowedValues.length === 0) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        "allowedValues must be a non-empty array when provided",
        { field: "allowedValues", parameterId }
      );
    }
    allowedValues = Object.freeze([...input.allowedValues]);
  }
  if (type === REPORT_PARAMETER_TYPE.ENUM && (!allowedValues || allowedValues.length === 0)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_PARAMETERS,
      "ENUM parameter requires allowedValues",
      { field: "allowedValues", parameterId }
    );
  }

  return deepFreeze({
    parameterId,
    type,
    required,
    sensitive,
    label,
    defaultValue,
    allowedValues,
  });
}

/**
 * @param {ReadonlyArray<object>} definitions
 * @param {Record<string, unknown>} values
 */
export function validateParameterValues(definitions, values) {
  if (!Array.isArray(definitions)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_PARAMETERS,
      "Parameter definitions must be an array",
      { field: "parameters" }
    );
  }
  const provided = isPlainObject(values) ? values : {};
  /** @type {Record<string, unknown>} */
  const resolved = {};
  const known = new Set(definitions.map((d) => d.parameterId));

  for (const key of Object.keys(provided)) {
    if (!known.has(key)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        `Unknown parameter: ${key}`,
        { field: key }
      );
    }
  }

  for (const def of definitions) {
    const hasValue = Object.prototype.hasOwnProperty.call(provided, def.parameterId);
    let value = hasValue ? provided[def.parameterId] : def.defaultValue;
    if (!hasValue && def.defaultValue === undefined && def.required) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        `Missing required parameter: ${def.parameterId}`,
        { field: def.parameterId }
      );
    }
    if (value === undefined || value === null) {
      if (def.required) {
        failContract(
          REPORTING_ERROR_CODE.INVALID_PARAMETERS,
          `Missing required parameter: ${def.parameterId}`,
          { field: def.parameterId }
        );
      }
      continue;
    }
    if (def.type === REPORT_PARAMETER_TYPE.STRING || def.type === REPORT_PARAMETER_TYPE.ID_REFERENCE) {
      if (!isNonEmptyString(value) && typeof value !== "string") {
        failContract(
          REPORTING_ERROR_CODE.INVALID_PARAMETERS,
          `Parameter ${def.parameterId} must be a string`,
          { field: def.parameterId }
        );
      }
    }
    if (def.type === REPORT_PARAMETER_TYPE.NUMBER && typeof value !== "number") {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        `Parameter ${def.parameterId} must be a number`,
        { field: def.parameterId }
      );
    }
    if (def.type === REPORT_PARAMETER_TYPE.BOOLEAN && typeof value !== "boolean") {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        `Parameter ${def.parameterId} must be a boolean`,
        { field: def.parameterId }
      );
    }
    if (def.allowedValues && !def.allowedValues.includes(value)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_PARAMETERS,
        `Parameter ${def.parameterId} value not in allowedValues`,
        { field: def.parameterId, value }
      );
    }
    resolved[def.parameterId] = value;
  }

  return deepFreeze(resolved);
}

/**
 * @param {unknown} input
 */
export function createFilterDefinition(input) {
  if (!isPlainObject(input)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_FILTER,
      "Filter definition must be a plain object",
      { field: "filter" }
    );
  }
  const field = requireNonEmptyString(input.field, "field");
  const operator = String(input.operator || "").trim();
  if (!isReportFilterOperator(operator)) {
    failContract(
      REPORTING_ERROR_CODE.INVALID_FILTER,
      `Unsupported filter operator: ${operator || "(empty)"}`,
      { field: "operator", filterField: field }
    );
  }
  let allowedOperators = null;
  if (input.allowedOperators != null) {
    if (!Array.isArray(input.allowedOperators) || input.allowedOperators.length === 0) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        "allowedOperators must be a non-empty array when provided",
        { field: "allowedOperators" }
      );
    }
    for (const op of input.allowedOperators) {
      if (!isReportFilterOperator(op)) {
        failContract(
          REPORTING_ERROR_CODE.INVALID_FILTER,
          `Unknown allowed operator: ${op}`,
          { field: "allowedOperators", value: op }
        );
      }
    }
    allowedOperators = Object.freeze([...input.allowedOperators]);
    if (!allowedOperators.includes(operator)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Operator ${operator} not allowed for field ${field}`,
        { field: "operator", filterField: field }
      );
    }
  }

  const required = Boolean(input.required);
  const sensitive = Boolean(input.sensitive);
  const valueType = optionalNonEmptyString(input.valueType, "valueType");

  return deepFreeze({
    field,
    operator,
    value: input.value === undefined ? null : input.value,
    valueType,
    required,
    sensitive,
    allowedOperators,
  });
}

/**
 * @param {ReadonlyArray<object>} allowedFilterFields - definitions with field + allowedOperators
 * @param {ReadonlyArray<object>} filters
 */
export function validateFilterValues(allowedFilterFields, filters) {
  const defs = Array.isArray(allowedFilterFields) ? allowedFilterFields : [];
  const byField = new Map(defs.map((d) => [d.field, d]));
  const list = Array.isArray(filters) ? filters : [];
  /** @type {object[]} */
  const out = [];

  for (const raw of list) {
    const filter = createFilterDefinition(raw);
    const def = byField.get(filter.field);
    if (!def) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Unknown filter field: ${filter.field}`,
        { field: filter.field }
      );
    }
    const allowed =
      def.allowedOperators ||
      Object.freeze([
        REPORT_FILTER_OPERATOR.EQ,
        REPORT_FILTER_OPERATOR.NEQ,
        REPORT_FILTER_OPERATOR.IN,
      ]);
    if (!allowed.includes(filter.operator)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Unsupported operator ${filter.operator} for field ${filter.field}`,
        { field: filter.field, operator: filter.operator }
      );
    }
    if (def.required && (filter.value === null || filter.value === undefined || filter.value === "")) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Required filter value missing for ${filter.field}`,
        { field: filter.field }
      );
    }
    if (def.valueType === "number" && filter.value != null && typeof filter.value !== "number") {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Filter ${filter.field} expects number value`,
        { field: filter.field }
      );
    }
    if (def.valueType === "string" && filter.value != null && typeof filter.value !== "string") {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Filter ${filter.field} expects string value`,
        { field: filter.field }
      );
    }
    out.push(
      deepFreeze({
        ...filter,
        sensitive: Boolean(def.sensitive) || filter.sensitive,
      })
    );
  }

  for (const def of defs) {
    if (def.required && !out.some((f) => f.field === def.field)) {
      failContract(
        REPORTING_ERROR_CODE.INVALID_FILTER,
        `Required filter missing: ${def.field}`,
        { field: def.field }
      );
    }
  }

  return Object.freeze(out);
}
