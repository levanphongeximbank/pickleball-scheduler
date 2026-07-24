/**
 * Access scope and tenant applicability metadata for dashboards/reports (I&A-04).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  ANALYTICS_TENANT_SCOPE_KIND,
  createAnalyticsTenantScope,
} from "../contracts/tenantScope.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";

/**
 * @typedef {{
 *   roles?: ReadonlyArray<string>,
 *   permissions?: ReadonlyArray<string>,
 *   requireAuthenticated?: boolean,
 *   notes?: string,
 * }} AnalyticsAccessScope
 *
 * @typedef {{
 *   supportedTenantScopeKinds: ReadonlyArray<string>,
 *   defaultTenantScope?: import("../contracts/tenantScope.js").AnalyticsTenantScope,
 * }} AnalyticsTenantApplicability
 */

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsAccessScope(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.ACCESS_SCOPE_INVALID,
        "AnalyticsAccessScope must be a plain object",
        "accessScope"
      )
    );
  }

  /** @type {AnalyticsAccessScope} */
  const scope = {};

  if (input.roles !== undefined) {
    if (!Array.isArray(input.roles) || !input.roles.every(isNonEmptyString)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_SCOPE_INVALID,
          "AnalyticsAccessScope.roles must be an array of non-empty strings",
          "accessScope.roles"
        )
      );
    }
    scope.roles = Object.freeze(input.roles.map((r) => String(r).trim()));
  }

  if (input.permissions !== undefined) {
    if (
      !Array.isArray(input.permissions) ||
      !input.permissions.every(isNonEmptyString)
    ) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_SCOPE_INVALID,
          "AnalyticsAccessScope.permissions must be an array of non-empty strings",
          "accessScope.permissions"
        )
      );
    }
    scope.permissions = Object.freeze(
      input.permissions.map((p) => String(p).trim())
    );
  }

  if (input.requireAuthenticated !== undefined) {
    if (typeof input.requireAuthenticated !== "boolean") {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_SCOPE_INVALID,
          "AnalyticsAccessScope.requireAuthenticated must be a boolean",
          "accessScope.requireAuthenticated"
        )
      );
    }
    scope.requireAuthenticated = input.requireAuthenticated;
  }

  if (input.notes !== undefined) {
    if (!isNonEmptyString(input.notes)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.ACCESS_SCOPE_INVALID,
          "AnalyticsAccessScope.notes must be a non-empty string when provided",
          "accessScope.notes"
        )
      );
    }
    scope.notes = String(input.notes).trim();
  }

  return ok(deepFreeze(scope));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsTenantApplicability(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        "AnalyticsTenantApplicability must be a plain object",
        "tenantApplicability"
      )
    );
  }

  if (
    !Array.isArray(input.supportedTenantScopeKinds) ||
    input.supportedTenantScopeKinds.length === 0
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
        "supportedTenantScopeKinds is required and must be a non-empty array",
        "tenantApplicability.supportedTenantScopeKinds"
      )
    );
  }

  const allowed = new Set(Object.values(ANALYTICS_TENANT_SCOPE_KIND));
  /** @type {string[]} */
  const kinds = [];
  for (const kind of input.supportedTenantScopeKinds) {
    if (!isNonEmptyString(kind) || !allowed.has(String(kind).trim())) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
          `Unsupported tenant scope kind: ${kind}`,
          "tenantApplicability.supportedTenantScopeKinds",
          { kind }
        )
      );
    }
    const normalized = String(kind).trim();
    if (!kinds.includes(normalized)) kinds.push(normalized);
  }

  /** @type {AnalyticsTenantApplicability} */
  const applicability = {
    supportedTenantScopeKinds: Object.freeze([...kinds]),
  };

  if (input.defaultTenantScope !== undefined) {
    const scopeResult = createAnalyticsTenantScope(input.defaultTenantScope);
    if (!scopeResult.ok) return scopeResult;
    if (!kinds.includes(scopeResult.value.kind)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_SCOPE_INVALID,
          "defaultTenantScope.kind must be listed in supportedTenantScopeKinds",
          "tenantApplicability.defaultTenantScope"
        )
      );
    }
    applicability.defaultTenantScope = scopeResult.value;
  }

  return ok(deepFreeze(applicability));
}
