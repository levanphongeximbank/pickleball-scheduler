/**
 * Operational Alerts evaluation context — tenant + optional entity /
 * currency / ranking scopes (I&A-10). Fail-closed when tenant is missing.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { createAnalyticsTenantScope } from "../contracts/tenantScope.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { rejectForbiddenOperationalAlertFields } from "./privacy.js";

const OPTIONAL_STRING_KEYS = Object.freeze([
  "venueId",
  "courtId",
  "clubId",
  "competitionId",
  "customerId",
  "playerId",
  "teamId",
  "currencyCode",
  "rankingSystemId",
  "rankingSystemVersion",
  "ratingSystemId",
  "ratingSystemVersion",
  "entityId",
  "entityType",
]);

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAlertEvaluationContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONTEXT_INVALID,
        "AlertEvaluationContext must be a plain object",
        "context"
      )
    );
  }

  const privacyReject = rejectForbiddenOperationalAlertFields(input, "context");
  if (privacyReject) return privacyReject;

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "AlertEvaluationContext.tenantScope is required",
        "context.tenantScope"
      )
    );
  }

  const tenantScopeResult = createAnalyticsTenantScope(input.tenantScope);
  if (!tenantScopeResult.ok) return tenantScopeResult;

  if (!tenantScopeResult.value.tenantId) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "AlertEvaluationContext requires an explicit tenantId",
        "context.tenantScope.tenantId"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const context = {
    tenantScope: tenantScopeResult.value,
  };

  for (const key of OPTIONAL_STRING_KEYS) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_CONTEXT_INVALID,
            `${key} must be a non-empty string when provided`,
            `context.${key}`
          )
        );
      }
      context[key] = String(input[key]).trim();
    }
  }

  if (input.generatedAt !== undefined) {
    if (!isValidIsoTimestamp(input.generatedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_TIMESTAMP_INVALID,
          "generatedAt must be a valid ISO timestamp",
          "context.generatedAt"
        )
      );
    }
    context.generatedAt = String(input.generatedAt).trim();
  }

  return ok(deepFreeze(context));
}

/**
 * Alias matching the operational naming in the workstream contract.
 * @param {unknown} input
 */
export function createOperationalAlertsInsightsContext(input) {
  return createAlertEvaluationContext(input);
}
