/**
 * Access / tenant / metric-policy validation before source fetch.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_TENANT_SCOPE_KIND } from "../contracts/tenantScope.js";
import { isPlainObject } from "../contracts/shared.js";
import { createAnalyticsAccessContext } from "./context.js";

/**
 * Fail-closed tenant and access checks for a normalized query.
 *
 * @param {import("../contracts/queryDescriptor.js").AnalyticsQueryDescriptor} descriptor
 * @param {unknown} accessInput
 * @returns {import("../contracts/result.js").Result}
 */
export function validateAnalyticsQueryExecution(descriptor, accessInput = {}) {
  if (!isPlainObject(descriptor)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.INVALID_QUERY,
        "validateAnalyticsQueryExecution requires a query descriptor",
        "descriptor"
      )
    );
  }

  const accessResult = createAnalyticsAccessContext(accessInput);
  if (!accessResult.ok) return accessResult;
  const access = accessResult.value;

  const scope = descriptor.tenantScope;
  const tenantBound =
    scope.kind === ANALYTICS_TENANT_SCOPE_KIND.TENANT ||
    scope.kind === ANALYTICS_TENANT_SCOPE_KIND.VENUE ||
    scope.kind === ANALYTICS_TENANT_SCOPE_KIND.CLUB;

  if (tenantBound) {
    if (!scope.tenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
          "Tenant-scoped query requires an explicit tenantId (fail closed)",
          "tenantScope.tenantId"
        )
      );
    }

    if (access.tenantId && access.tenantId !== scope.tenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH,
          "Access tenantId does not match query tenant scope",
          "accessContext.tenantId",
          { accessTenantId: access.tenantId, queryTenantId: scope.tenantId }
        )
      );
    }

    if (
      Array.isArray(access.permittedTenantIds) &&
      access.permittedTenantIds.length > 0 &&
      !access.permittedTenantIds.includes(scope.tenantId)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH,
          "Query tenantId is not in permittedTenantIds",
          "accessContext.permittedTenantIds",
          { queryTenantId: scope.tenantId }
        )
      );
    }

    if (
      scope.kind === ANALYTICS_TENANT_SCOPE_KIND.VENUE &&
      access.venueId &&
      scope.venueId &&
      access.venueId !== scope.venueId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH,
          "Access venueId does not match query venue scope",
          "accessContext.venueId",
          { accessVenueId: access.venueId, queryVenueId: scope.venueId }
        )
      );
    }

    if (
      scope.kind === ANALYTICS_TENANT_SCOPE_KIND.CLUB &&
      access.clubId &&
      scope.clubId &&
      access.clubId !== scope.clubId
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_MISMATCH,
          "Access clubId does not match query club scope",
          "accessContext.clubId",
          { accessClubId: access.clubId, queryClubId: scope.clubId }
        )
      );
    }
  }

  if (
    Array.isArray(access.allowedMetricIds) &&
    access.allowedMetricIds.length > 0 &&
    !access.allowedMetricIds.includes(descriptor.metricId)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.METRIC_NOT_FOUND,
        "Metric is not permitted by access context policy",
        "accessContext.allowedMetricIds",
        { metricId: descriptor.metricId }
      )
    );
  }

  return ok(access);
}
