/**
 * Runtime and access context contracts for I&A-03.
 * Module-neutral. No Platform Core identity, database session, or React context.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";

/**
 * @typedef {{
 *   executionId: string,
 *   tenantId?: string,
 *   actorId?: string,
 *   requestedAt: string,
 *   signal?: AbortSignal,
 * }} AnalyticsRuntimeContext
 *
 * @typedef {{
 *   tenantId?: string,
 *   permittedTenantIds?: ReadonlyArray<string>,
 *   venueId?: string,
 *   clubId?: string,
 *   allowedMetricIds?: ReadonlyArray<string>,
 * }} AnalyticsAccessContext
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsRuntimeContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
        "AnalyticsRuntimeContext must be a plain object",
        "runtimeContext"
      )
    );
  }

  if (!isNonEmptyString(input.executionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
        "AnalyticsRuntimeContext.executionId is required",
        "runtimeContext.executionId"
      )
    );
  }

  if (!isValidIsoTimestamp(input.requestedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
        "AnalyticsRuntimeContext.requestedAt must be an ISO timestamp",
        "runtimeContext.requestedAt"
      )
    );
  }

  /** @type {AnalyticsRuntimeContext} */
  const context = {
    executionId: String(input.executionId).trim(),
    requestedAt: String(input.requestedAt).trim(),
  };

  if (input.tenantId !== undefined) {
    if (!isNonEmptyString(input.tenantId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
          "AnalyticsRuntimeContext.tenantId must be a non-empty string when provided",
          "runtimeContext.tenantId"
        )
      );
    }
    context.tenantId = String(input.tenantId).trim();
  }

  if (input.actorId !== undefined) {
    if (!isNonEmptyString(input.actorId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
          "AnalyticsRuntimeContext.actorId must be a non-empty string when provided",
          "runtimeContext.actorId"
        )
      );
    }
    context.actorId = String(input.actorId).trim();
  }

  if (input.signal !== undefined) {
    if (
      typeof input.signal !== "object" ||
      input.signal === null ||
      typeof /** @type {{ aborted?: unknown }} */ (input.signal).aborted !==
        "boolean"
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.RUNTIME_CONTEXT_INVALID,
          "AnalyticsRuntimeContext.signal must be an AbortSignal-like object",
          "runtimeContext.signal"
        )
      );
    }
    context.signal = /** @type {AbortSignal} */ (input.signal);
  }

  return ok(deepFreeze(context));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsAccessContext(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
        "AnalyticsAccessContext must be a plain object",
        "accessContext"
      )
    );
  }

  /** @type {AnalyticsAccessContext} */
  const context = {};

  if (input.tenantId !== undefined) {
    if (!isNonEmptyString(input.tenantId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
          "AnalyticsAccessContext.tenantId must be a non-empty string when provided",
          "accessContext.tenantId"
        )
      );
    }
    context.tenantId = String(input.tenantId).trim();
  }

  if (input.permittedTenantIds !== undefined) {
    if (!Array.isArray(input.permittedTenantIds)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
          "AnalyticsAccessContext.permittedTenantIds must be an array",
          "accessContext.permittedTenantIds"
        )
      );
    }
    /** @type {string[]} */
    const permitted = [];
    for (const id of input.permittedTenantIds) {
      if (!isNonEmptyString(id)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
            "permittedTenantIds entries must be non-empty strings",
            "accessContext.permittedTenantIds"
          )
        );
      }
      permitted.push(String(id).trim());
    }
    context.permittedTenantIds = Object.freeze([...permitted]);
  }

  if (input.venueId !== undefined) {
    if (!isNonEmptyString(input.venueId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
          "AnalyticsAccessContext.venueId must be a non-empty string when provided",
          "accessContext.venueId"
        )
      );
    }
    context.venueId = String(input.venueId).trim();
  }

  if (input.clubId !== undefined) {
    if (!isNonEmptyString(input.clubId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
          "AnalyticsAccessContext.clubId must be a non-empty string when provided",
          "accessContext.clubId"
        )
      );
    }
    context.clubId = String(input.clubId).trim();
  }

  if (input.allowedMetricIds !== undefined) {
    if (!Array.isArray(input.allowedMetricIds)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
          "AnalyticsAccessContext.allowedMetricIds must be an array",
          "accessContext.allowedMetricIds"
        )
      );
    }
    /** @type {string[]} */
    const allowed = [];
    for (const id of input.allowedMetricIds) {
      if (!isNonEmptyString(id)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.ACCESS_CONTEXT_INVALID,
            "allowedMetricIds entries must be non-empty strings",
            "accessContext.allowedMetricIds"
          )
        );
      }
      allowed.push(String(id).trim());
    }
    context.allowedMetricIds = Object.freeze([...allowed]);
  }

  return ok(deepFreeze(context));
}
