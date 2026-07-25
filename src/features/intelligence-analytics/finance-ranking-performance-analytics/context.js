/**
 * Finance / Ranking / Performance analytics context — tenant + optional
 * accounting/ranking/rating/competition/player/team/currency scope
 * (I&A-09). Fail-closed when tenant is missing. All scope identifiers are
 * opaque filters — never names or other PII.
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

const OPTIONAL_STRING_KEYS = Object.freeze([
  "accountingContextId",
  "rankingSystemId",
  "rankingSystemVersion",
  "ratingSystemId",
  "ratingSystemVersion",
  "competitionId",
  "playerId",
  "teamId",
  "currencyCode",
]);

/**
 * @typedef {{
 *   tenantScope: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 *   accountingContextId?: string,
 *   rankingSystemId?: string,
 *   rankingSystemVersion?: string,
 *   ratingSystemId?: string,
 *   ratingSystemVersion?: string,
 *   competitionId?: string,
 *   playerId?: string,
 *   teamId?: string,
 *   currencyCode?: string,
 *   generatedAt?: string,
 * }} FinanceRankingPerformanceAnalyticsContext
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createFinanceRankingPerformanceAnalyticsContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CONTEXT_INVALID,
        "FinanceRankingPerformanceAnalyticsContext must be a plain object",
        "context"
      )
    );
  }

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "FinanceRankingPerformanceAnalyticsContext.tenantScope is required",
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
        "FinanceRankingPerformanceAnalyticsContext requires an explicit tenantId",
        "context.tenantScope.tenantId"
      )
    );
  }

  /** @type {FinanceRankingPerformanceAnalyticsContext} */
  const context = {
    tenantScope: tenantScopeResult.value,
  };

  for (const key of OPTIONAL_STRING_KEYS) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_CONTEXT_INVALID,
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
          ANALYTICS_ERROR_CODE.FINANCE_RANKING_PERFORMANCE_TIMESTAMP_INVALID,
          "generatedAt must be a valid ISO timestamp",
          "context.generatedAt"
        )
      );
    }
    context.generatedAt = String(input.generatedAt).trim();
  }

  return ok(deepFreeze(context));
}
