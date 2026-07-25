/**
 * Deterministic deduplication and correlation key generation (I&A-10).
 * Keys never use random values or rely solely on generated timestamps.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import { OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION } from "./enums.js";

/**
 * @param {unknown} parts
 * @returns {string}
 */
function stableJoin(parts) {
  return parts
    .map((part) =>
      part === undefined || part === null || part === ""
        ? "-"
        : String(part).replace(/\|/g, "/")
    )
    .join("|");
}

/**
 * @param {unknown} entityScope
 * @returns {string}
 */
function entityScopeKey(entityScope) {
  if (!isPlainObject(entityScope)) return "-";
  return Object.keys(entityScope)
    .sort()
    .map((key) => `${key}=${entityScope[key]}`)
    .join(",");
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertDeduplicationKey(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "createAlertDeduplicationKey requires a plain object",
        "dedup"
      )
    );
  }
  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "dedup key requires tenantId",
        "dedup.tenantId"
      )
    );
  }
  if (!isNonEmptyString(input.ruleId) || !isNonEmptyString(input.ruleVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "dedup key requires ruleId and ruleVersion",
        "dedup.ruleId"
      )
    );
  }
  if (!isNonEmptyString(input.metricId) || !isNonEmptyString(input.metricVersion)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SIGNAL_INVALID,
        "dedup key requires metricId and metricVersion",
        "dedup.metricId"
      )
    );
  }

  const key = stableJoin([
    "ia10-dedup",
    input.tenantId,
    input.ruleId,
    input.ruleVersion,
    entityScopeKey(input.entityScope),
    input.signalId || input.metricId,
    input.signalVersion || input.metricVersion,
    input.metricId,
    input.metricVersion,
    input.timeBucket || "-",
    input.conditionIdentity || "-",
  ]);

  return ok(
    deepFreeze({
      deduplicationKey: key,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.DEDUP,
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertCorrelationKey(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_EVALUATION_INVALID,
        "createAlertCorrelationKey requires a plain object",
        "correlation"
      )
    );
  }
  if (!isNonEmptyString(input.tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "correlation key requires tenantId",
        "correlation.tenantId"
      )
    );
  }

  const key = stableJoin([
    "ia10-corr",
    input.tenantId,
    input.domain || "-",
    entityScopeKey(input.entityScope),
    input.metricId || "-",
    input.correlationGroup || input.ruleFamily || "-",
  ]);

  return ok(
    deepFreeze({
      correlationKey: key,
      methodVersion: OPERATIONAL_ALERTS_INSIGHTS_METHOD_VERSION.CORRELATION,
    })
  );
}
