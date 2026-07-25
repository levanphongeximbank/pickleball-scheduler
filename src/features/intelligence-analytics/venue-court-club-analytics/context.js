/**
 * Venue / Court / Club analytics context — tenant + optional entity scope (I&A-07).
 * Fail-closed when tenant is missing. Entity IDs are optional filters.
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
 *   venueId?: string,
 *   courtId?: string,
 *   clubId?: string,
 *   generatedAt?: string,
 * }} VenueCourtClubAnalyticsContext
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createVenueCourtClubAnalyticsContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CONTEXT_INVALID,
        "VenueCourtClubAnalyticsContext must be a plain object",
        "context"
      )
    );
  }

  if (input.tenantScope === undefined || input.tenantScope === null) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "VenueCourtClubAnalyticsContext.tenantScope is required",
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
        "VenueCourtClubAnalyticsContext requires an explicit tenantId",
        "context.tenantScope.tenantId"
      )
    );
  }

  /** @type {VenueCourtClubAnalyticsContext} */
  const context = {
    tenantScope: tenantScopeResult.value,
  };

  for (const key of ["venueId", "courtId", "clubId"]) {
    if (input[key] !== undefined) {
      if (!isNonEmptyString(input[key])) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_CONTEXT_INVALID,
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
          ANALYTICS_ERROR_CODE.VENUE_COURT_CLUB_TIMESTAMP_INVALID,
          "generatedAt must be a valid ISO timestamp",
          "context.generatedAt"
        )
      );
    }
    context.generatedAt = String(input.generatedAt).trim();
  }

  return ok(deepFreeze(context));
}
