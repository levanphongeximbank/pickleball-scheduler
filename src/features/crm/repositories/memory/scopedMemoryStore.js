/**
 * In-memory scoped store helpers (Phase 1B).
 * Instance-local Map — no global shared mutable state, no localStorage.
 */

import { CRM_ERROR_CODES, CrmError } from "../../constants/errorCodes.js";
import { createTenantVenueScope, scopesEqual } from "../../models/scope.js";

/**
 * @param {object} scopeInput
 * @returns {{ tenantId: string, venueId: string }}
 */
export function resolveScope(scopeInput) {
  return createTenantVenueScope(scopeInput);
}

/**
 * @param {{ tenantId: string, venueId: string }} scope
 * @param {{ tenantId: string, venueId: string }} row
 */
export function assertRowInScope(scope, row) {
  if (!scopesEqual(scope, row)) {
    throw new CrmError(
      CRM_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-tenant or cross-venue CRM repository access is forbidden."
    );
  }
}

/**
 * @template T
 */
export function createScopedMemoryStore() {
  /** @type {Map<string, T>} */
  const rows = new Map();

  function keyOf(scope, id) {
    return `${scope.tenantId}::${scope.venueId}::${id}`;
  }

  return {
    /**
     * @param {{ tenantId: string, venueId: string }} scope
     * @param {string} id
     * @param {T & { tenantId: string, venueId: string }} row
     */
    save(scope, id, row) {
      assertRowInScope(scope, row);
      const frozen = Object.freeze({ ...row });
      rows.set(keyOf(scope, id), frozen);
      return frozen;
    },
    /**
     * @param {{ tenantId: string, venueId: string }} scope
     * @param {string} id
     */
    getById(scope, id) {
      const row = rows.get(keyOf(scope, id));
      if (!row) return null;
      assertRowInScope(scope, row);
      return row;
    },
    /**
     * @param {{ tenantId: string, venueId: string }} scope
     * @param {(row: T) => boolean} [predicate]
     */
    list(scope, predicate) {
      const out = [];
      for (const row of rows.values()) {
        if (!scopesEqual(scope, row)) continue;
        if (predicate && !predicate(row)) continue;
        out.push(row);
      }
      out.sort((a, b) => {
        const left = String(
          a.id ??
            a.leadId ??
            a.contactRefId ??
            a.opportunityId ??
            a.pipelineId ??
            a.taskId ??
            a.interactionId ??
            ""
        );
        const right = String(
          b.id ??
            b.leadId ??
            b.contactRefId ??
            b.opportunityId ??
            b.pipelineId ??
            b.taskId ??
            b.interactionId ??
            ""
        );
        if (left < right) return -1;
        if (left > right) return 1;
        const leftAt = String(a.createdAt ?? "");
        const rightAt = String(b.createdAt ?? "");
        if (leftAt < rightAt) return -1;
        if (leftAt > rightAt) return 1;
        return 0;
      });
      return out;
    },
    /**
     * @param {{ tenantId: string, venueId: string }} scope
     * @param {string} id
     */
    delete(scope, id) {
      const existing = rows.get(keyOf(scope, id));
      if (!existing) return false;
      assertRowInScope(scope, existing);
      return rows.delete(keyOf(scope, id));
    },
    size() {
      return rows.size;
    },
  };
}
