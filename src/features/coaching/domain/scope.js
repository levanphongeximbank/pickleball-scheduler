/**
 * Coaching tenant + club scope — mandatory on every aggregate and command.
 * venueId is optional but, when present, is part of protected scope matching.
 * No silent defaults. No demo-club fallback.
 */

import { COACHING_ERROR_CODES } from "../constants/errorCodes.js";
import { CoachingError, throwCoachingError } from "../errors/CoachingError.js";

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string}
 */
export function requireNonEmptyId(value, fieldName) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) {
    throw new CoachingError(
      COACHING_ERROR_CODES.INVALID_REFERENCE,
      `${fieldName} is required and must be a non-empty string.`,
      { field: fieldName }
    );
  }
  return id;
}

/**
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {string|null}
 */
export function optionalId(value, fieldName) {
  if (value == null || value === "") return null;
  return requireNonEmptyId(value, fieldName);
}

/**
 * @param {object} input
 * @returns {{ tenantId: string, clubId: string, venueId: string|null }}
 */
export function createCoachingScope(input = {}) {
  if (!input || typeof input !== "object") {
    throwCoachingError(
      COACHING_ERROR_CODES.MISSING_SCOPE,
      "tenantId and clubId are required."
    );
  }
  const tenantId =
    typeof input.tenantId === "string" ? input.tenantId.trim() : "";
  const clubId = typeof input.clubId === "string" ? input.clubId.trim() : "";
  if (!tenantId || !clubId) {
    throwCoachingError(
      COACHING_ERROR_CODES.MISSING_SCOPE,
      "tenantId and clubId are mandatory; no default scope is allowed.",
      { tenantId: Boolean(tenantId), clubId: Boolean(clubId) }
    );
  }
  const venueId = optionalId(input.venueId, "venueId");
  return Object.freeze({ tenantId, clubId, venueId });
}

/**
 * @param {{ tenantId?: string, clubId?: string, venueId?: string|null }|null|undefined} left
 * @param {{ tenantId?: string, clubId?: string, venueId?: string|null }|null|undefined} right
 * @param {{ requireVenue?: boolean }} [options]
 * @returns {boolean}
 */
export function scopesEqual(left, right, options = {}) {
  if (!left || !right) return false;
  if (left.tenantId !== right.tenantId || left.clubId !== right.clubId) {
    return false;
  }
  if (options.requireVenue) {
    return (left.venueId || null) === (right.venueId || null);
  }
  // When either side omits venueId, tenant+club match is sufficient for listing.
  if (left.venueId && right.venueId && left.venueId !== right.venueId) {
    return false;
  }
  return true;
}

/**
 * @param {{ tenantId: string, clubId: string, venueId?: string|null }} scope
 * @param {{ tenantId: string, clubId: string, venueId?: string|null }} resource
 */
export function assertSameScope(scope, resource) {
  if (
    scope.tenantId !== resource.tenantId ||
    scope.clubId !== resource.clubId
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-tenant or cross-club Coaching access is forbidden.",
      {
        scope: { tenantId: scope.tenantId, clubId: scope.clubId },
        resourceScope: {
          tenantId: resource.tenantId,
          clubId: resource.clubId,
        },
      }
    );
  }
  if (
    scope.venueId &&
    resource.venueId &&
    scope.venueId !== resource.venueId
  ) {
    throwCoachingError(
      COACHING_ERROR_CODES.FORBIDDEN_SCOPE,
      "Cross-venue Coaching access is forbidden.",
      {
        scopeVenueId: scope.venueId,
        resourceVenueId: resource.venueId,
      }
    );
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {number}
 */
export function requireVersion(value, field = "version") {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `${field} must be a positive integer.`,
      { field, value }
    );
  }
  return value;
}

/**
 * @param {object} entity
 * @param {number|null|undefined} expectedVersion
 * @param {string} entityLabel
 */
export function assertExpectedVersion(entity, expectedVersion, entityLabel) {
  if (expectedVersion == null) {
    throwCoachingError(
      COACHING_ERROR_CODES.INVALID_INPUT,
      `expectedVersion is required to update ${entityLabel}.`,
      { field: "expectedVersion", entity: entityLabel }
    );
  }
  const expected = Number(expectedVersion);
  if (!Number.isInteger(expected) || expected !== entity.version) {
    throwCoachingError(
      COACHING_ERROR_CODES.VERSION_CONFLICT,
      `${entityLabel} version conflict.`,
      {
        expectedVersion: expected,
        actualVersion: entity.version,
        entity: entityLabel,
      }
    );
  }
}
