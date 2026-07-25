/**
 * Competition analytics context — tenant + competition identity (I&A-06).
 * Fail-closed when tenant or competition ID is missing.
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
 *   competitionId: string,
 *   competitionVersion?: string,
 *   requestedWindow?: import("../contracts/timeWindow.js").AnalyticsTimeWindow,
 *   generatedAt?: string,
 * }} CompetitionAnalyticsContext
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_CONTEXT_INVALID,
        "CompetitionAnalyticsContext must be a plain object",
        "context"
      )
    );
  }

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "CompetitionAnalyticsContext.tenantScope is required",
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
        "CompetitionAnalyticsContext requires an explicit tenantId",
        "context.tenantScope.tenantId"
      )
    );
  }

  if (!isNonEmptyString(input.competitionId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_ID_REQUIRED,
        "CompetitionAnalyticsContext.competitionId is required",
        "context.competitionId"
      )
    );
  }

  /** @type {CompetitionAnalyticsContext} */
  const context = {
    tenantScope: tenantScopeResult.value,
    competitionId: String(input.competitionId).trim(),
  };

  if (input.competitionVersion !== undefined) {
    if (!isNonEmptyString(input.competitionVersion)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_CONTEXT_INVALID,
          "competitionVersion must be a non-empty string when provided",
          "context.competitionVersion"
        )
      );
    }
    context.competitionVersion = String(input.competitionVersion).trim();
  }

  if (input.generatedAt !== undefined) {
    if (!isValidIsoTimestamp(input.generatedAt)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
          "generatedAt must be a valid ISO timestamp",
          "context.generatedAt"
        )
      );
    }
    context.generatedAt = String(input.generatedAt).trim();
  }

  return ok(deepFreeze(context));
}
