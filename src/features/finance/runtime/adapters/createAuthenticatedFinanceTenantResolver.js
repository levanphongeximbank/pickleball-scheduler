/**
 * Finance-facing authenticated tenant resolver adapter (Phase 1J).
 *
 * Wraps authoritative profile-backed tenant resolution. Does not own tenant rules.
 * No first-venue fallback. No localStorage. No global current tenant.
 * No raw client-provided tenant trust. No resolution during runtime construction.
 */

import { FINANCE_ERROR_CODES } from "../../errors/codes.js";
import { throwFinanceRuntimeError } from "../errors.js";

/**
 * Default authoritative resolver — profile/user tenantId → venueId → explicit club tenant.
 * Injected in tests to avoid ambient app state.
 *
 * @param {object|null|undefined} user
 * @returns {string|null}
 */
function defaultResolveEffectiveTenantId(user) {
  if (!user || typeof user !== "object") return null;
  const tenantId = String(user.tenantId || "").trim();
  if (tenantId) return tenantId;
  const venueId = String(user.venueId || "").trim();
  if (venueId) return venueId;
  return null;
}

/**
 * @param {{
 *   resolveEffectiveTenantId?: (user: object|null|undefined) => string|null,
 * }} [options]
 * @returns {{ resolveTenantId: (input?: object) => string }}
 */
export function createAuthenticatedFinanceTenantResolver(options = {}) {
  const resolveEffective =
    typeof options.resolveEffectiveTenantId === "function"
      ? options.resolveEffectiveTenantId
      : defaultResolveEffectiveTenantId;

  return Object.freeze({
    strategy: "injected-trusted-resolver",
    /**
     * Resolve tenant only when explicitly invoked for a command/query.
     * Ignores client-supplied tenantId / overrideTenantId (not trusted).
     *
     * @param {object} [input]
     * @returns {string}
     */
    resolveTenantId(input = {}) {
      if (input == null || typeof input !== "object") {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance authenticated tenant resolver requires a trusted user input object.",
          { field: "input" }
        );
      }

      // Explicitly reject raw client tenant claims — caller must not pass trusted overrides here.
      if (
        Object.prototype.hasOwnProperty.call(input, "tenantId") ||
        Object.prototype.hasOwnProperty.call(input, "overrideTenantId")
      ) {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance refuses raw client-provided tenantId; use authenticated user profile only.",
          { field: "tenantId" }
        );
      }

      const user = input.user;
      if (!user || typeof user !== "object") {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance authenticated tenant resolution requires an authenticated user.",
          { field: "user" }
        );
      }

      const profileTenant = String(user.tenantId || "").trim();
      const profileVenue = String(user.venueId || "").trim();
      if (profileTenant && profileVenue && profileTenant !== profileVenue) {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance authenticated tenant resolution failed: ambiguous tenant identity.",
          { field: "user", reason: "ambiguous-tenant" }
        );
      }

      const resolved = resolveEffective(user);
      const tenantId = resolved == null ? "" : String(resolved).trim();
      if (!tenantId) {
        throwFinanceRuntimeError(
          FINANCE_ERROR_CODES.TENANT_RESOLUTION_UNAVAILABLE,
          "Finance authenticated tenant resolution failed: no authoritative tenant on user.",
          { field: "user", reason: "missing-tenant" }
        );
      }

      return tenantId;
    },
  });
}
