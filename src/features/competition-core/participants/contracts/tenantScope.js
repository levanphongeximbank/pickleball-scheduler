import { isNonEmptyString } from "./shared.js";

/**
 * Ownership / tenant scope for a CompetitionEntry.
 * Does not authorize, decide eligibility, or select a default tenant.
 *
 * @typedef {Object} EntryTenantScope
 * @property {string|null} [tenantId]
 * @property {string|null} [clubId]
 * @property {string|null} [organizationId]
 */

/**
 * @param {Partial<EntryTenantScope>|null|undefined} partial
 * @returns {EntryTenantScope|null}
 */
export function createEntryTenantScope(partial) {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) {
    return null;
  }
  const tenantId =
    partial.tenantId != null && String(partial.tenantId).trim() !== ""
      ? String(partial.tenantId).trim()
      : null;
  const clubId =
    partial.clubId != null && String(partial.clubId).trim() !== ""
      ? String(partial.clubId).trim()
      : null;
  const organizationId =
    partial.organizationId != null && String(partial.organizationId).trim() !== ""
      ? String(partial.organizationId).trim()
      : null;

  if (!tenantId && !clubId && !organizationId) {
    return null;
  }

  return {
    tenantId,
    clubId,
    organizationId,
  };
}

/**
 * @param {EntryTenantScope|null|undefined} scope
 * @returns {boolean}
 */
export function hasEntryTenantScope(scope) {
  return Boolean(
    scope &&
      (isNonEmptyString(scope.tenantId) ||
        isNonEmptyString(scope.clubId) ||
        isNonEmptyString(scope.organizationId))
  );
}

/**
 * Compare two scopes for conflict. Missing dimensions are not defaults.
 * A conflict exists only when both sides declare the same dimension with different values.
 *
 * @param {EntryTenantScope|null|undefined} left
 * @param {EntryTenantScope|null|undefined} right
 * @returns {{ conflict: boolean, field?: string, left?: string, right?: string }}
 */
export function compareEntryTenantScopes(left, right) {
  if (!left || !right) {
    return { conflict: false };
  }
  for (const field of /** @type {const} */ (["tenantId", "clubId", "organizationId"])) {
    const a = left[field];
    const b = right[field];
    if (isNonEmptyString(a) && isNonEmptyString(b) && String(a) !== String(b)) {
      return { conflict: true, field, left: String(a), right: String(b) };
    }
  }
  return { conflict: false };
}
