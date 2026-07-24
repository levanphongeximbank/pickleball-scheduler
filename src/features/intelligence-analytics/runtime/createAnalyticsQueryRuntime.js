/**
 * Read-only analytics query runtime facade (I&A-03).
 * Composes registry resolution + source adapter + deterministic projection.
 * No global singleton. No write/command surface.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createAnalyticsRuntimeContext } from "./context.js";
import { normalizeAnalyticsQuery } from "./normalizeQuery.js";
import { validateAnalyticsQueryExecution } from "./validateExecution.js";
import {
  resolveMetricFromRegistry,
  validateQueryAgainstMetricDefinition,
} from "./resolveMetric.js";
import {
  createAnalyticsSourceRequest,
  wrapSourceFailure,
} from "./sourceAdapter.js";
import { executeAnalyticsProjection } from "./executeProjection.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyAnalyticsQueryRuntime does not expose write/command operations";

/**
 * @typedef {{
 *   descriptor: import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor,
 *   result: import("../contracts/analyticsResult.js").AnalyticsResult,
 *   projection: object,
 *   resolvedMetric: object,
 *   sourceRequest: import("./sourceAdapter.js").AnalyticsSourceRequest,
 *   executionId: string,
 * }} AnalyticsQueryExecutionResult
 */

/**
 * @param {unknown} deps
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsQueryRuntime(deps) {
  if (!isPlainObject(deps)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "createAnalyticsQueryRuntime requires a dependencies object",
        "deps"
      )
    );
  }

  const registry = deps.registry;
  const sourceAdapter = deps.sourceAdapter;

  if (!isPlainObject(registry) || typeof registry.getMetric !== "function") {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "createAnalyticsQueryRuntime requires registry.getMetric",
        "deps.registry"
      )
    );
  }

  if (
    !isPlainObject(sourceAdapter) ||
    typeof sourceAdapter.query !== "function"
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "createAnalyticsQueryRuntime requires a read-only sourceAdapter.query",
        "deps.sourceAdapter"
      )
    );
  }

  const nowIso =
    typeof deps.nowIso === "function"
      ? deps.nowIso
      : () => new Date().toISOString();

  /** @type {((event: object) => void) | null} */
  const onEvent = typeof deps.onEvent === "function" ? deps.onEvent : null;

  /**
   * @param {string} type
   * @param {Record<string, unknown>} [payload]
   */
  function emit(type, payload = {}) {
    if (!onEvent) return;
    try {
      onEvent(deepFreeze({ type, ...payload, at: nowIso() }));
    } catch {
      // Observability hooks must never break query execution.
    }
  }

  let executionCounter = 0;

  /**
   * @param {unknown} queryInput
   * @param {unknown} [accessInput]
   * @param {unknown} [options]
   */
  function execute(queryInput, accessInput = {}, options = {}) {
    const optionsObj = isPlainObject(options) ? options : {};

    // Capture a structural snapshot to prove non-mutation of caller input.
    const inputSnapshot = isPlainObject(queryInput)
      ? JSON.stringify(queryInput)
      : null;

    const normalized = normalizeAnalyticsQuery(queryInput);
    if (!normalized.ok) {
      emit("query.invalid", { error: normalized.error });
      return normalized;
    }

    if (inputSnapshot !== null && JSON.stringify(queryInput) !== inputSnapshot) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.INVALID_QUERY,
          "Query input must not be mutated during normalization",
          "query"
        )
      );
    }

    const { descriptor, resultLimit } = normalized.value;

    const accessCheck = validateAnalyticsQueryExecution(descriptor, accessInput);
    if (!accessCheck.ok) {
      emit("query.access_rejected", { error: accessCheck.error });
      return accessCheck;
    }

    const resolved = resolveMetricFromRegistry(
      registry,
      descriptor.metricId,
      descriptor.metricVersion
    );
    if (!resolved.ok) {
      emit("query.metric_resolve_failed", { error: resolved.error });
      return resolved;
    }

    const againstDef = validateQueryAgainstMetricDefinition(
      descriptor,
      resolved.value.entry
    );
    if (!againstDef.ok) {
      emit("query.definition_mismatch", { error: againstDef.error });
      return againstDef;
    }

    executionCounter += 1;
    const executionId =
      typeof optionsObj.executionId === "string" && optionsObj.executionId.trim()
        ? String(optionsObj.executionId).trim()
        : `ia03-${executionCounter}-${descriptor.metricId}`;

    const runtimeContextResult = createAnalyticsRuntimeContext({
      executionId,
      tenantId: descriptor.tenantScope.tenantId,
      actorId:
        isPlainObject(accessInput) && typeof accessInput.actorId === "string"
          ? accessInput.actorId
          : undefined,
      requestedAt: nowIso(),
      signal: optionsObj.signal,
    });
    if (!runtimeContextResult.ok) return runtimeContextResult;

    if (runtimeContextResult.value.signal?.aborted) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
          "Query execution aborted before source fetch",
          "signal"
        )
      );
    }

    const dimensionKeys = [
      ...new Set([
        ...descriptor.filters.map((f) => f.field).filter((f) => f !== "value"),
        ...(descriptor.grouping
          ? descriptor.grouping.dimensions.map((d) => d.key)
          : []),
      ]),
    ].sort();

    const sourceRequestResult = createAnalyticsSourceRequest({
      metricId: descriptor.metricId,
      metricVersion: descriptor.metricVersion,
      tenantScope: descriptor.tenantScope,
      timeWindow: descriptor.timeWindow,
      dimensions: dimensionKeys,
      executionId,
    });
    if (!sourceRequestResult.ok) return sourceRequestResult;
    const sourceRequest = sourceRequestResult.value;

    emit("query.source_request", { executionId, sourceRequest });

    let sourceResponse;
    try {
      sourceResponse = sourceAdapter.query(sourceRequest);
    } catch (error) {
      const wrapped = wrapSourceFailure(error);
      emit("query.source_failure", { error: wrapped.error });
      return wrapped;
    }

    // Support sync Result only in this foundation slice (no Promise adapters yet).
    if (
      sourceResponse &&
      typeof sourceResponse === "object" &&
      typeof sourceResponse.then === "function"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.SOURCE_FAILURE,
          "Async source adapters are deferred; use a synchronous Result-returning adapter",
          "sourceAdapter"
        )
      );
    }

    if (!sourceResponse || sourceResponse.ok !== true) {
      if (sourceResponse && sourceResponse.ok === false) {
        const code = sourceResponse.error?.code;
        if (
          code === ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE ||
          code === ANALYTICS_ERROR_CODE.SOURCE_FAILURE ||
          code === ANALYTICS_ERROR_CODE.INVALID_OBSERVATION
        ) {
          emit("query.source_failure", { error: sourceResponse.error });
          return sourceResponse;
        }
        const wrapped = wrapSourceFailure(sourceResponse.error);
        emit("query.source_failure", { error: wrapped.error });
        return wrapped;
      }
      return wrapSourceFailure(sourceResponse);
    }

    const projection = executeAnalyticsProjection(
      {
        descriptor,
        definition: resolved.value.entry.definition,
        resultLimit,
        generatedAt: nowIso(),
        sourceProvenance: sourceResponse.value.provenance,
        sourceFreshness: sourceResponse.value.freshness,
        sourceTimestamp: sourceResponse.value.sourceTimestamp,
        warnings: resolved.value.warnings,
      },
      {
        observations: sourceResponse.value.observations,
      }
    );

    if (!projection.ok) {
      emit("query.projection_failure", { error: projection.error });
      return projection;
    }

    /** @type {AnalyticsQueryExecutionResult} */
    const executionResult = {
      descriptor,
      result: projection.value.result,
      projection: projection.value.projection,
      resolvedMetric: {
        metricId: resolved.value.entry.metricId,
        version: resolved.value.entry.version,
        lifecycleState: resolved.value.entry.lifecycleState,
        deprecation: resolved.value.deprecation,
      },
      sourceRequest: clonePlain(sourceRequest),
      executionId,
    };

    emit("query.completed", { executionId });
    return ok(deepFreeze(executionResult));
  }

  /**
   * Validate-only path — never calls the source adapter.
   * @param {unknown} queryInput
   * @param {unknown} [accessInput]
   */
  function validate(queryInput, accessInput = {}) {
    const normalized = normalizeAnalyticsQuery(queryInput);
    if (!normalized.ok) return normalized;

    const accessCheck = validateAnalyticsQueryExecution(
      normalized.value.descriptor,
      accessInput
    );
    if (!accessCheck.ok) return accessCheck;

    const resolved = resolveMetricFromRegistry(
      registry,
      normalized.value.descriptor.metricId,
      normalized.value.descriptor.metricVersion
    );
    if (!resolved.ok) return resolved;

    const againstDef = validateQueryAgainstMetricDefinition(
      normalized.value.descriptor,
      resolved.value.entry
    );
    if (!againstDef.ok) return againstDef;

    return ok(
      deepFreeze({
        descriptor: normalized.value.descriptor,
        resultLimit: normalized.value.resultLimit,
        resolvedMetric: {
          metricId: resolved.value.entry.metricId,
          version: resolved.value.entry.version,
          lifecycleState: resolved.value.entry.lifecycleState,
        },
        warnings: resolved.value.warnings,
      })
    );
  }

  /** @type {Record<string, unknown>} */
  const runtime = {
    execute,
    validate,
    normalizeQuery: normalizeAnalyticsQuery,
    validateExecution: validateAnalyticsQueryExecution,
  };

  const rejectedWriteOps = [
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
    "register",
  ];
  for (let i = 0; i < rejectedWriteOps.length; i += 1) {
    const rejectedOp = rejectedWriteOps[i];
    Object.defineProperty(runtime, rejectedOp, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              rejectedOp
            )
          );
      },
    });
  }

  return ok(Object.freeze(runtime));
}

/**
 * Alias emphasizing the read-only facade contract.
 * @param {unknown} deps
 */
export function createReadOnlyAnalyticsQueryRuntime(deps) {
  return createAnalyticsQueryRuntime(deps);
}
