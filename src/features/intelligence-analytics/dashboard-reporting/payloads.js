/**
 * Dashboard / report payload and data-state contracts (I&A-04).
 * EMPTY ≠ zero; PARTIAL ≠ READY; STALE keeps freshness; ERROR keeps typed error.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  createAnalyticsMetricId,
  createAnalyticsMetricVersion,
} from "../contracts/identifiers.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsTimeWindow } from "../contracts/timeWindow.js";
import { createAnalyticsGranularity } from "../contracts/timeWindow.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ANALYTICS_COMPARISON_METHOD,
  ANALYTICS_DATA_STATE,
  ANALYTICS_MISSING_CATEGORY_SEMANTICS,
  isEnumValue,
} from "./enums.js";
import { createAnalyticsMetricBinding } from "./bindings.js";
import { assertNoForbiddenContractContent } from "./forbidden.js";

/**
 * @typedef {{
 *   state: string,
 *   isCurrent: boolean,
 *   warnings: ReadonlyArray<import("../contracts/analyticsResult.js").AnalyticsWarning>,
 *   error?: import("../contracts/errors.js").AnalyticsError | Readonly<{code:string,message:string,field?:string,details?:*}>,
 *   freshness?: string,
 *   provenance?: import("../contracts/source.js").AnalyticsMetricProvenance,
 * }} AnalyticsDataStateEnvelope
 */

/**
 * @param {unknown} warningsInput
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeWarnings(warningsInput) {
  if (warningsInput === undefined) return ok(Object.freeze([]));
  if (!Array.isArray(warningsInput)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "warnings must be an array",
        "warnings"
      )
    );
  }
  /** @type {unknown[]} */
  const warnings = [];
  for (const warning of warningsInput) {
    const created = createAnalyticsWarning(warning);
    if (!created.ok) return created;
    warnings.push(created.value);
  }
  return ok(Object.freeze(warnings));
}

/**
 * Build a validated data-state envelope with semantic guards.
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsDataState(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
        "AnalyticsDataState must be a plain object",
        "dataState"
      )
    );
  }

  if (!isEnumValue(input.state, ANALYTICS_DATA_STATE)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
        `Unsupported data state: ${input.state}`,
        "dataState.state"
      )
    );
  }

  const state = String(input.state);
  const warningsResult = normalizeWarnings(input.warnings);
  if (!warningsResult.ok) return warningsResult;

  /** @type {AnalyticsDataStateEnvelope} */
  const envelope = {
    state,
    isCurrent: false,
    warnings: warningsResult.value,
  };

  if (input.freshness !== undefined) {
    if (!Object.values(ANALYTICS_FRESHNESS_STATE).includes(input.freshness)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
          `Unsupported freshness: ${input.freshness}`,
          "dataState.freshness"
        )
      );
    }
    envelope.freshness = input.freshness;
  }

  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    envelope.provenance = provenanceResult.value;
  }

  if (state === ANALYTICS_DATA_STATE.ERROR) {
    if (!isPlainObject(input.error) || !isNonEmptyString(input.error.code)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
          "ERROR state requires a typed error with code",
          "dataState.error"
        )
      );
    }
    envelope.error = Object.freeze({
      code: String(input.error.code).trim(),
      message: isNonEmptyString(input.error.message)
        ? String(input.error.message).trim()
        : "Analytics payload error",
      ...(input.error.field !== undefined
        ? { field: String(input.error.field) }
        : {}),
      ...(input.error.details !== undefined
        ? { details: Object.freeze({ ...input.error.details }) }
        : {}),
    });
  } else if (input.error !== undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
        "Typed error is only allowed on ERROR state",
        "dataState.error"
      )
    );
  }

  if (state === ANALYTICS_DATA_STATE.STALE) {
    if (!envelope.freshness) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
          "STALE state must retain freshness metadata",
          "dataState.freshness"
        )
      );
    }
    if (envelope.freshness === ANALYTICS_FRESHNESS_STATE.FRESH) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
          "STALE state must not claim freshness=fresh / current",
          "dataState.freshness"
        )
      );
    }
    envelope.isCurrent = false;
  }

  if (state === ANALYTICS_DATA_STATE.READY) {
    envelope.isCurrent =
      input.isCurrent === undefined ? true : Boolean(input.isCurrent);
  } else {
    // Non-READY states are never "current success".
    envelope.isCurrent = false;
  }

  if (state === ANALYTICS_DATA_STATE.LOADING && input.payload !== undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
        "LOADING must not carry a success payload",
        "dataState.payload"
      )
    );
  }

  if (
    state === ANALYTICS_DATA_STATE.UNAVAILABLE &&
    input.treatAsEmpty === true
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DATA_STATE_INVALID,
        "UNAVAILABLE must not be coerced to EMPTY",
        "dataState"
      )
    );
  }

  return ok(deepFreeze(envelope));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
function requireMetricIdentity(input) {
  const idResult = createAnalyticsMetricId(input.metricId);
  if (!idResult.ok) return idResult;
  const versionResult = createAnalyticsMetricVersion(input.metricVersion);
  if (!versionResult.ok) return versionResult;
  return ok({ metricId: idResult.value, metricVersion: versionResult.value });
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsKpiPayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "AnalyticsKpiPayload must be a plain object",
        "kpiPayload"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "kpiPayload");
  if (!forbidden.ok) return forbidden;

  const identity = requireMetricIdentity(input);
  if (!identity.ok) return identity;

  const stateResult = createAnalyticsDataState(input.dataState || input);
  if (!stateResult.ok) return stateResult;
  const dataState = stateResult.value;

  if (dataState.state === ANALYTICS_DATA_STATE.READY) {
    if (input.value === undefined) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "READY KPI payload requires value",
          "kpiPayload.value"
        )
      );
    }
  }

  if (input.value !== undefined && input.value !== null && !isFiniteNumber(input.value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "KPI value must be a finite number or null",
        "kpiPayload.value"
      )
    );
  }

  // Missing data must remain null — never silently coerce to zero here.
  const value =
    input.value === undefined
      ? undefined
      : input.value === null
        ? null
        : input.value;

  if (
    dataState.state === ANALYTICS_DATA_STATE.EMPTY &&
    value === 0 &&
    input.missingCoercedToZero === true
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "EMPTY must not coerce missing data to zero",
        "kpiPayload.value"
      )
    );
  }

  const windowResult = createAnalyticsTimeWindow(input.effectiveWindow);
  if (!windowResult.ok) return windowResult;

  if (!dataState.provenance && input.provenance === undefined) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "KPI payload requires provenance",
        "kpiPayload.provenance"
      )
    );
  }

  let provenance = dataState.provenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    metricId: identity.value.metricId,
    metricVersion: identity.value.metricVersion,
    value,
    unit: isNonEmptyString(input.unit) ? String(input.unit).trim() : undefined,
    effectiveWindow: windowResult.value,
    dataState,
    provenance,
    warnings: dataState.warnings,
  };

  if (input.comparisonValue !== undefined) {
    if (input.comparisonValue !== null && !isFiniteNumber(input.comparisonValue)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "comparisonValue must be a finite number or null",
          "kpiPayload.comparisonValue"
        )
      );
    }
    payload.comparisonValue = input.comparisonValue;
  }
  if (input.delta !== undefined) {
    if (input.delta !== null && !isFiniteNumber(input.delta)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "delta must be a finite number or null",
          "kpiPayload.delta"
        )
      );
    }
    payload.delta = input.delta;
  }

  if (dataState.state === ANALYTICS_DATA_STATE.PARTIAL && payload.warnings.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "PARTIAL KPI payload must retain warnings",
        "kpiPayload.warnings"
      )
    );
  }

  return ok(deepFreeze(payload));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsTimeSeriesPayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "AnalyticsTimeSeriesPayload must be a plain object",
        "timeSeriesPayload"
      )
    );
  }

  const identity = requireMetricIdentity(input);
  if (!identity.ok) return identity;

  const stateResult = createAnalyticsDataState(
    input.dataState || { state: input.state, warnings: input.warnings, freshness: input.freshness, provenance: input.provenance, error: input.error }
  );
  if (!stateResult.ok) return stateResult;

  if (!isNonEmptyString(input.seriesId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "seriesId is required",
        "timeSeriesPayload.seriesId"
      )
    );
  }

  const granularityResult = createAnalyticsGranularity(input.granularity);
  if (!granularityResult.ok) return granularityResult;
  const windowResult = createAnalyticsTimeWindow(input.effectiveWindow);
  if (!windowResult.ok) return windowResult;

  if (!Array.isArray(input.points)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "points must be an array",
        "timeSeriesPayload.points"
      )
    );
  }

  /** @type {Record<string, unknown>[]} */
  const points = [];
  for (const point of input.points) {
    if (!isPlainObject(point) || !isNonEmptyString(point.key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "each point requires a key",
          "timeSeriesPayload.points"
        )
      );
    }
    if (point.value !== null && point.value !== undefined && !isFiniteNumber(point.value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "point value must be finite number or null",
          "timeSeriesPayload.points"
        )
      );
    }
    points.push(
      deepFreeze({
        key: String(point.key).trim(),
        value: point.value === undefined ? null : point.value,
        ...(point.missing !== undefined ? { missing: Boolean(point.missing) } : {}),
      })
    );
  }

  // Deterministic ordering by key ascending.
  points.sort((a, b) => String(a.key).localeCompare(String(b.key)));

  let provenance = stateResult.value.provenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  }

  return ok(
    deepFreeze({
      metricId: identity.value.metricId,
      metricVersion: identity.value.metricVersion,
      seriesId: String(input.seriesId).trim(),
      points: Object.freeze(points),
      granularity: granularityResult.value,
      effectiveWindow: windowResult.value,
      dataState: stateResult.value,
      freshness: stateResult.value.freshness,
      provenance,
      warnings: stateResult.value.warnings,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsBreakdownPayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "AnalyticsBreakdownPayload must be a plain object",
        "breakdownPayload"
      )
    );
  }

  const identity = requireMetricIdentity(input);
  if (!identity.ok) return identity;

  const stateResult = createAnalyticsDataState(
    input.dataState || {
      state: input.state,
      warnings: input.warnings,
      freshness: input.freshness,
      provenance: input.provenance,
      error: input.error,
    }
  );
  if (!stateResult.ok) return stateResult;

  if (!isNonEmptyString(input.dimension)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "dimension is required",
        "breakdownPayload.dimension"
      )
    );
  }

  if (!Array.isArray(input.categories) || !Array.isArray(input.values)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "categories and values arrays are required",
        "breakdownPayload.categories"
      )
    );
  }
  if (input.categories.length !== input.values.length) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "categories and values must have equal length",
        "breakdownPayload.values"
      )
    );
  }

  const missingSemantics = isEnumValue(
    input.missingCategorySemantics,
    ANALYTICS_MISSING_CATEGORY_SEMANTICS
  )
    ? input.missingCategorySemantics
    : ANALYTICS_MISSING_CATEGORY_SEMANTICS.OMIT;

  /** @type {{ category: string, value: number | null }[]} */
  const pairs = [];
  for (let i = 0; i < input.categories.length; i += 1) {
    const category = input.categories[i];
    const value = input.values[i];
    if (!isNonEmptyString(category) && category !== null) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "category must be a non-empty string or null",
          "breakdownPayload.categories"
        )
      );
    }
    if (value !== null && !isFiniteNumber(value)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "breakdown values must be finite numbers or null",
          "breakdownPayload.values"
        )
      );
    }
    if (category === null && missingSemantics === ANALYTICS_MISSING_CATEGORY_SEMANTICS.FAIL) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "missing category not allowed under FAIL semantics",
          "breakdownPayload.categories"
        )
      );
    }
    if (category === null && missingSemantics === ANALYTICS_MISSING_CATEGORY_SEMANTICS.OMIT) {
      continue;
    }
    pairs.push({
      category: category === null ? "__null__" : String(category).trim(),
      value,
    });
  }

  pairs.sort((a, b) => a.category.localeCompare(b.category));

  let provenance = stateResult.value.provenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  }

  return ok(
    deepFreeze({
      metricId: identity.value.metricId,
      metricVersion: identity.value.metricVersion,
      dimension: String(input.dimension).trim(),
      categories: Object.freeze(pairs.map((p) => p.category)),
      values: Object.freeze(pairs.map((p) => p.value)),
      missingCategorySemantics: missingSemantics,
      dataState: stateResult.value,
      provenance,
      warnings: stateResult.value.warnings,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsComparisonPayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "AnalyticsComparisonPayload must be a plain object",
        "comparisonPayload"
      )
    );
  }

  const primary = createAnalyticsMetricBinding(input.primaryMetricBinding);
  if (!primary.ok) return primary;
  const comparison = createAnalyticsMetricBinding(input.comparisonMetricBinding);
  if (!comparison.ok) return comparison;

  if (!isEnumValue(input.comparisonMethod, ANALYTICS_COMPARISON_METHOD)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        `Unsupported comparison method: ${input.comparisonMethod}`,
        "comparisonPayload.comparisonMethod"
      )
    );
  }

  const stateResult = createAnalyticsDataState(
    input.dataState || {
      state: input.state,
      warnings: input.warnings,
      freshness: input.freshness,
      provenance: input.provenance,
      error: input.error,
    }
  );
  if (!stateResult.ok) return stateResult;

  /** @type {Record<string, unknown>} */
  const payload = {
    primaryMetricBinding: primary.value,
    comparisonMetricBinding: comparison.value,
    comparisonMethod: input.comparisonMethod,
    dataState: stateResult.value,
    warnings: stateResult.value.warnings,
  };

  if (input.absoluteResult !== undefined) {
    if (input.absoluteResult !== null && !isFiniteNumber(input.absoluteResult)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "absoluteResult must be finite number or null",
          "comparisonPayload.absoluteResult"
        )
      );
    }
    payload.absoluteResult = input.absoluteResult;
  }
  if (input.relativeResult !== undefined) {
    if (input.relativeResult !== null && !isFiniteNumber(input.relativeResult)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "relativeResult must be finite number or null",
          "comparisonPayload.relativeResult"
        )
      );
    }
    payload.relativeResult = input.relativeResult;
  }

  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    payload.provenance = provenanceResult.value;
  } else if (stateResult.value.provenance) {
    payload.provenance = stateResult.value.provenance;
  }

  return ok(deepFreeze(payload));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsTablePayload(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "AnalyticsTablePayload must be a plain object",
        "tablePayload"
      )
    );
  }

  const forbidden = assertNoForbiddenContractContent(input, "tablePayload");
  if (!forbidden.ok) return forbidden;

  const stateResult = createAnalyticsDataState(
    input.dataState || {
      state: input.state,
      warnings: input.warnings,
      freshness: input.freshness,
      provenance: input.provenance,
      error: input.error,
    }
  );
  if (!stateResult.ok) return stateResult;

  if (!Array.isArray(input.columns) || input.columns.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "columns must be a non-empty array",
        "tablePayload.columns"
      )
    );
  }

  /** @type {Record<string, unknown>[]} */
  const columns = [];
  /** @type {Set<string>} */
  const columnIds = new Set();
  for (const column of input.columns) {
    if (!isPlainObject(column) || !isNonEmptyString(column.columnId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          "each column requires columnId",
          "tablePayload.columns"
        )
      );
    }
    if (typeof column.formatter === "function") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.FORBIDDEN_CONTRACT,
          "Report/table columns must not contain executable formatters",
          "tablePayload.columns.formatter"
        )
      );
    }
    const columnId = String(column.columnId).trim();
    if (columnIds.has(columnId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COLUMN_DEFINITION_INVALID,
          `Duplicate column ID: ${columnId}`,
          "tablePayload.columns"
        )
      );
    }
    columnIds.add(columnId);
    columns.push(
      deepFreeze({
        columnId,
        ...(isNonEmptyString(column.label) ? { label: String(column.label).trim() } : {}),
        ...(isNonEmptyString(column.valueType)
          ? { valueType: String(column.valueType).trim() }
          : {}),
      })
    );
  }

  if (!Array.isArray(input.rows)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
        "rows must be an array",
        "tablePayload.rows"
      )
    );
  }

  /** @type {Record<string, unknown>[]} */
  const rows = [];
  /** @type {Set<string>} */
  const rowIds = new Set();
  for (const row of input.rows) {
    if (!isPlainObject(row) || !isNonEmptyString(row.rowId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "each row requires rowId",
          "tablePayload.rows"
        )
      );
    }
    const rowId = String(row.rowId).trim();
    if (rowIds.has(rowId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          `Duplicate row ID: ${rowId}`,
          "tablePayload.rows"
        )
      );
    }
    rowIds.add(rowId);
    const cells = isPlainObject(row.cells) ? clonePlain(row.cells) : {};
    rows.push(deepFreeze({ rowId, cells: deepFreeze(cells) }));
  }

  // Deterministic ordering by rowId unless explicit order keys provided.
  if (Array.isArray(input.ordering) && input.ordering.length > 0) {
    const orderIndex = new Map(
      input.ordering.map((id, index) => [String(id), index])
    );
    rows.sort((a, b) => {
      const ai = orderIndex.has(a.rowId) ? orderIndex.get(a.rowId) : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.rowId) ? orderIndex.get(b.rowId) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return /** @type {number} */ (ai) - /** @type {number} */ (bi);
      return String(a.rowId).localeCompare(String(b.rowId));
    });
  } else {
    rows.sort((a, b) => String(a.rowId).localeCompare(String(b.rowId)));
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    columns: Object.freeze(columns),
    rows: Object.freeze(rows),
    dataState: stateResult.value,
    warnings: stateResult.value.warnings,
  };

  if (input.boundedResult !== undefined) {
    if (!isPlainObject(input.boundedResult)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PAYLOAD_INVALID,
          "boundedResult must be a plain object",
          "tablePayload.boundedResult"
        )
      );
    }
    payload.boundedResult = deepFreeze({
      limit: isFiniteNumber(input.boundedResult.limit)
        ? input.boundedResult.limit
        : undefined,
      truncated: Boolean(input.boundedResult.truncated),
      totalCount: isFiniteNumber(input.boundedResult.totalCount)
        ? input.boundedResult.totalCount
        : undefined,
    });
  }

  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    payload.provenance = provenanceResult.value;
  } else if (stateResult.value.provenance) {
    payload.provenance = stateResult.value.provenance;
  }

  return ok(deepFreeze(payload));
}
