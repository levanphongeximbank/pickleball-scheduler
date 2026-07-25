/**
 * Tenant and entity isolation guards (I&A-11).
 * Fail closed — never silently filter contamination into success.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isNonEmptyString, isPlainObject } from "../contracts/shared.js";
import { ANALYTICS_ENTITY_SCOPE_KIND } from "./enums.js";

/**
 * @param {unknown} accessContext
 * @returns {import("../contracts/result.js").Result}
 */
export function requireTrustedAccessContext(accessContext) {
  if (!isPlainObject(accessContext) || accessContext.trustedSource !== true) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_TRUSTED_SOURCE_REQUIRED,
        "Trusted access context is required (fail closed)",
        "accessContext",
        { reasonCode: "MISSING_TRUSTED_SOURCE" }
      )
    );
  }

  const tenantId = accessContext.tenantScope?.tenantId;
  if (!isNonEmptyString(tenantId)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
        "Explicit tenant context is required (fail closed)",
        "accessContext.tenantScope.tenantId",
        { reasonCode: "MISSING_TENANT" }
      )
    );
  }

  return ok(String(tenantId).trim());
}

/**
 * @param {unknown} accessContext
 * @param {unknown} facts
 * @param {{ surface?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function certifyTenantIsolation(accessContext, facts, options = {}) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;
  const expectedTenantId = tenantResult.value;

  if (!Array.isArray(facts)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "facts must be an array for tenant isolation certification",
        "facts"
      )
    );
  }

  /** @type {Set<string>} */
  const observedTenants = new Set();

  for (let i = 0; i < facts.length; i += 1) {
    const fact = facts[i];
    if (!isPlainObject(fact)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
          "Each fact must be a plain object",
          `facts[${i}]`
        )
      );
    }

    if (!isNonEmptyString(fact.tenantId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.TENANT_CONTEXT_REQUIRED,
          "Fact is missing tenantId (fail closed)",
          `facts[${i}].tenantId`,
          {
            reasonCode: "MISSING_TENANT",
            surface: options.surface ?? null,
            factIndex: i,
          }
        )
      );
    }

    const factTenantId = String(fact.tenantId).trim();
    observedTenants.add(factTenantId);

    if (factTenantId !== expectedTenantId) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_TENANT_MISMATCH,
          "Source tenant mismatch rejected (typed error; no silent filter)",
          `facts[${i}].tenantId`,
          {
            reasonCode: "TENANT_MISMATCH",
            surface: options.surface ?? null,
            expectedTenantId,
            // Opaque mismatch signal only — no fact contents.
            factIndex: i,
          }
        )
      );
    }
  }

  if (observedTenants.size > 1) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_TENANT_CONTAMINATION,
        "Mixed-tenant facts rejected (typed error; no silent filter)",
        "facts",
        {
          reasonCode: "TENANT_CONTAMINATION",
          surface: options.surface ?? null,
          distinctTenantCount: observedTenants.size,
        }
      )
    );
  }

  return ok(
    deepFreeze({
      certified: true,
      tenantId: expectedTenantId,
      factCount: facts.length,
      surface: options.surface ?? null,
    })
  );
}

const ENTITY_FIELD_BY_KIND = Object.freeze({
  [ANALYTICS_ENTITY_SCOPE_KIND.COMPETITION]: "competitionId",
  [ANALYTICS_ENTITY_SCOPE_KIND.VENUE]: "venueId",
  [ANALYTICS_ENTITY_SCOPE_KIND.COURT]: "courtId",
  [ANALYTICS_ENTITY_SCOPE_KIND.CLUB]: "clubId",
  [ANALYTICS_ENTITY_SCOPE_KIND.CUSTOMER]: "customerId",
  [ANALYTICS_ENTITY_SCOPE_KIND.PLAYER]: "playerId",
  [ANALYTICS_ENTITY_SCOPE_KIND.TEAM]: "teamId",
  [ANALYTICS_ENTITY_SCOPE_KIND.FINANCE]: "financeScopeId",
  [ANALYTICS_ENTITY_SCOPE_KIND.RANKING_SYSTEM]: "rankingSystemId",
  [ANALYTICS_ENTITY_SCOPE_KIND.RATING_SYSTEM]: "ratingSystemId",
});

/**
 * @param {unknown} accessContext
 * @param {unknown} requiredScope
 * @param {unknown} facts
 * @param {{ surface?: string, allowAggregate?: boolean }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function certifyEntityIsolation(
  accessContext,
  requiredScope,
  facts,
  options = {}
) {
  const tenantResult = requireTrustedAccessContext(accessContext);
  if (!tenantResult.ok) return tenantResult;

  if (!isPlainObject(requiredScope)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "requiredScope must be a plain object",
        "requiredScope",
        { reasonCode: "NO_ENTITY_FALLBACK" }
      )
    );
  }

  if (!Array.isArray(facts)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
        "facts must be an array",
        "facts"
      )
    );
  }

  // No first-entity fallback: required scope must be explicit for checked kinds.
  const activeKinds = Object.entries(ENTITY_FIELD_BY_KIND).filter(
    ([, field]) => requiredScope[field] !== undefined
  );

  if (activeKinds.length === 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.PRIVACY_ENTITY_MISMATCH,
        "No arbitrary entity selection; required entity scope must be explicit",
        "requiredScope",
        { reasonCode: "NO_ENTITY_FALLBACK" }
      )
    );
  }

  /** @type {Map<string, Set<string>>} */
  const observedByKind = new Map();

  for (let i = 0; i < facts.length; i += 1) {
    const fact = facts[i];
    if (!isPlainObject(fact)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.PRIVACY_CERTIFICATION_INVALID,
          "Each fact must be a plain object",
          `facts[${i}]`
        )
      );
    }

    for (const [kind, field] of activeKinds) {
      const expected = String(requiredScope[field]).trim();
      const actual = fact[field];

      if (!isNonEmptyString(actual)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_ENTITY_MISMATCH,
            `${kind} scope mismatch: fact missing ${field}`,
            `facts[${i}].${field}`,
            {
              reasonCode: "ENTITY_MISMATCH",
              entityKind: kind,
              factIndex: i,
              surface: options.surface ?? null,
            }
          )
        );
      }

      const actualId = String(actual).trim();
      if (!observedByKind.has(kind)) observedByKind.set(kind, new Set());
      observedByKind.get(kind).add(actualId);

      if (actualId !== expected) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_ENTITY_MISMATCH,
            `${kind} scope mismatch rejected`,
            `facts[${i}].${field}`,
            {
              reasonCode: "ENTITY_MISMATCH",
              entityKind: kind,
              factIndex: i,
              surface: options.surface ?? null,
            }
          )
        );
      }
    }

    // Parent-child: court must belong to required parent venue when both present.
    if (
      isNonEmptyString(requiredScope.courtId) &&
      isNonEmptyString(requiredScope.parentVenueId)
    ) {
      const factParent =
        fact.parentVenueId ?? fact.venueId ?? fact.courtVenueId;
      if (
        isNonEmptyString(factParent) &&
        String(factParent).trim() !== String(requiredScope.parentVenueId).trim()
      ) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_PARENT_CHILD_MISMATCH,
            "Parent-child entity mismatch rejected",
            `facts[${i}]`,
            {
              reasonCode: "PARENT_CHILD_MISMATCH",
              entityKind: ANALYTICS_ENTITY_SCOPE_KIND.COURT,
              factIndex: i,
              surface: options.surface ?? null,
            }
          )
        );
      }
    }
  }

  if (options.allowAggregate !== true) {
    for (const [kind, values] of observedByKind.entries()) {
      if (values.size > 1) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.PRIVACY_ENTITY_CONTAMINATION,
            `Mixed ${kind} entity scope rejected`,
            "facts",
            {
              reasonCode: "ENTITY_CONTAMINATION",
              entityKind: kind,
              distinctCount: values.size,
              surface: options.surface ?? null,
            }
          )
        );
      }
    }
  }

  return ok(
    deepFreeze({
      certified: true,
      entityKinds: Object.freeze(activeKinds.map(([kind]) => kind)),
      factCount: facts.length,
      surface: options.surface ?? null,
    })
  );
}
