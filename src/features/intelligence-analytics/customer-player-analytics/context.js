/**
 * Customer / Player analytics context — tenant + optional customer/player
 * scope (I&A-08). Fail-closed when tenant is missing. Customer/player IDs
 * are optional opaque filters — never names or other PII.
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

/**
 * @typedef {{
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 *   customerId?: string,
 *   playerId?: string,
 *   generatedAt?: string,
 * }} CustomerPlayerAnalyticsContext
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CONTEXT_INVALID,
        "CustomerPlayerAnalyticsContext must be a plain object",
        "context"
      )
    );
  }

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "CustomerPlayerAnalyticsContext.tenantScope is required",
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
        "CustomerPlayerAnalyticsContext requires an explicit tenantId",
        "context.tenantScope.tenantId"
      )
    );
  }

  /** @type {CustomerPlayerAnalyticsContext} */
  const context = {
    tenantScope: tenantScopeResult.value,
  };

  for (const key of ["customerId", "playerId"]) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_CONTEXT_INVALID,
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
          ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TIMESTAMP_INVALID,
          "generatedAt must be a valid ISO timestamp",
          "context.generatedAt"
        )
      );
    }
    context.generatedAt = String(input.generatedAt).trim();
  }

  return ok(deepFreeze(context));
}
