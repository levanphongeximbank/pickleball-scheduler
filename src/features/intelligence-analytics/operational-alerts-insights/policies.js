/**
 * Deduplication, correlation, suppression, cooldown, and resolution
 * policy contracts (I&A-10).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import {
  ALERT_LIFECYCLE_STATE,
  isOperationalAlertsInsightsEnumValue,
} from "./enums.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertDeduplicationPolicy(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "AlertDeduplicationPolicy must be a plain object",
        "deduplicationPolicy"
      )
    );
  }
  return ok(
    deepFreeze({
      includeTimeBucket: input.includeTimeBucket !== false,
      includeConditionIdentity: input.includeConditionIdentity !== false,
      methodVersion: "ia10.dedup_key_v1",
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertCooldownPolicy(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "AlertCooldownPolicy must be a plain object",
        "cooldownPolicy"
      )
    );
  }
  if (!isFiniteNumber(input.durationMs) || input.durationMs < 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "cooldown durationMs must be a non-negative finite number",
        "cooldownPolicy.durationMs"
      )
    );
  }

  const startBasis = isNonEmptyString(input.startBasis)
    ? String(input.startBasis).trim()
    : "evaluatedAt";

  /** @type {string[]} */
  const applicableStatuses = [];
  if (Array.isArray(input.applicableStatuses)) {
    for (const status of input.applicableStatuses) {
      if (!isOperationalAlertsInsightsEnumValue(status, ALERT_LIFECYCLE_STATE)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
            "cooldown applicableStatuses must use ALERT_LIFECYCLE_STATE",
            "cooldownPolicy.applicableStatuses"
          )
        );
      }
      applicableStatuses.push(/** @type {string} */ (status));
    }
  } else {
    applicableStatuses.push(
      ALERT_LIFECYCLE_STATE.OPEN,
      ALERT_LIFECYCLE_STATE.ACKNOWLEDGED,
      ALERT_LIFECYCLE_STATE.SUPPRESSED
    );
  }

  const suppressionReason = isNonEmptyString(input.suppressionReason)
    ? String(input.suppressionReason).trim()
    : "cooldown_active";

  return ok(
    deepFreeze({
      durationMs: input.durationMs,
      startBasis,
      applicableStatuses: Object.freeze([...applicableStatuses]),
      suppressionReason,
      ruleVersion: isNonEmptyString(input.ruleVersion)
        ? String(input.ruleVersion).trim()
        : undefined,
      methodVersion: "ia10.cooldown_v1",
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertSuppressionPolicy(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "AlertSuppressionPolicy must be a plain object",
        "suppressionPolicy"
      )
    );
  }
  return ok(
    deepFreeze({
      enabled: input.enabled !== false,
      requireReason: input.requireReason !== false,
      methodVersion: "ia10.suppression_v1",
    })
  );
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertResolutionPolicy(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_RULE_INVALID,
        "AlertResolutionPolicy must be a plain object",
        "resolutionPolicy"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const policy = {
    resolveWhenConditionClears: input.resolveWhenConditionClears === true,
    expireAfterMs:
      input.expireAfterMs !== undefined && isFiniteNumber(input.expireAfterMs)
        ? input.expireAfterMs
        : null,
    requireExplicitAcknowledgement: input.requireExplicitAcknowledgement !== false,
    methodVersion: "ia10.resolution_v1",
  };

  return ok(deepFreeze(policy));
}
