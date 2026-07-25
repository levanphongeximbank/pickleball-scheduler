/**
 * Platform Core adoption — consume public barrel only (REPORTING-01).
 *
 * Canonical operational Reporting module home:
 *   src/features/reporting-analytics/
 *
 * Legacy dashboard-analytics/platform adapter remains for existing UI projections.
 */

import {
  fail,
  ok,
  isOk,
  isFail,
  parseIsoStrict,
  projectTenantScope,
  projectIdentityActor,
} from "../../../core/platform/index.js";
import { REPORTING_ERROR_CODE } from "../errors/errorCodes.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";

export const REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "REPORTING_ANALYTICS_PLATFORM_ADAPTER_INVALID",
  ACTOR_REQUIRED: "REPORTING_ANALYTICS_PLATFORM_ADAPTER_ACTOR_REQUIRED",
  TENANT_REQUIRED: "REPORTING_ANALYTICS_PLATFORM_ADAPTER_TENANT_REQUIRED",
  INSTANT_INVALID: "REPORTING_ANALYTICS_PLATFORM_ADAPTER_INSTANT_INVALID",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) error.field = field;
  return Object.freeze(error);
}

/**
 * @param {*} value
 * @param {*} [metadata]
 */
export function reportingOk(value, metadata) {
  return arguments.length > 1 ? ok(value, metadata) : ok(value);
}

/**
 * @param {*} error
 * @param {*} [metadata]
 */
export function reportingFail(error, metadata) {
  return arguments.length > 1 ? fail(error, metadata) : fail(error);
}

/**
 * @param {unknown} err
 */
export function reportingFailFromCaught(err) {
  if (
    err &&
    typeof err === "object" &&
    /** @type {{ name?: string }} */ (err).name === "ReportingError"
  ) {
    const e = /** @type {{ code: string, message: string, details?: * }} */ (err);
    return fail(
      Object.freeze({
        code: e.code,
        message: e.message,
        details: e.details || {},
      })
    );
  }
  return fail(
    Object.freeze({
      code: REPORTING_ERROR_CODE.INVALID_CONTRACT,
      message: err instanceof Error ? err.message : "Unknown reporting error",
      details: {},
    })
  );
}

/**
 * @param {*} input
 */
export function projectReportingAnalyticsActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting actor input must be a plain object"
      )
    );
  }
  const actorId =
    input.actorId ?? input.userId ?? input.authUserId;
  if (actorId == null || actorId === "") {
    return fail(
      adapterError(
        REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR.ACTOR_REQUIRED,
        "Reporting actor id is required",
        "actorId"
      )
    );
  }
  return projectIdentityActor({
    actorId: String(actorId),
    actorType: input.actorType || "USER",
    displayName: input.displayName,
  });
}

/**
 * @param {*} input
 */
export function projectReportingAnalyticsTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting tenant scope input must be a plain object"
      )
    );
  }
  const tenantId = input.tenantId;
  if (tenantId == null || tenantId === "") {
    return fail(
      adapterError(
        REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR.TENANT_REQUIRED,
        "Reporting tenantId is required",
        "tenantId"
      )
    );
  }
  return projectTenantScope({
    scopeType: input.scopeType || "TENANT",
    tenantId: String(tenantId),
    venueId: input.venueId,
    clubId: input.clubId,
  });
}

/**
 * @param {*} instant
 */
export function projectReportingOperationInstant(instant) {
  const parsed = parseIsoStrict(instant);
  if (!parsed.ok) {
    return fail(
      adapterError(
        REPORTING_ANALYTICS_PLATFORM_ADAPTER_ERROR.INSTANT_INVALID,
        "Reporting operation instant must be a strict ISO timestamp",
        "instant"
      )
    );
  }
  return parsed;
}

/**
 * Lightweight surface assertion for platform adoption tests.
 */
export function assertReportingAnalyticsPlatformSurface() {
  return deepFreeze({
    moduleId: "reporting-analytics",
    workstreamId: "REPORTING-01",
    consumes: Object.freeze([
      "ok",
      "fail",
      "isOk",
      "isFail",
      "parseIsoStrict",
      "projectTenantScope",
      "projectIdentityActor",
    ]),
    publicFacade: "src/features/reporting-analytics/index.js",
  });
}

export { isOk, isFail };
