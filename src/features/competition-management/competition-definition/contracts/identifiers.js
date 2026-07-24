/**
 * Opaque identifiers for Competition Definition (CM-01).
 * Tenant / venue / club / organizer ids are referenced, not owned.
 */

import { COMPETITION_DEFINITION_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract, isNonEmptyString } from "./shared.js";

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
export function requireOpaqueId(value, field) {
  if (!isNonEmptyString(value)) {
    failContract(
      COMPETITION_DEFINITION_ERROR_CODE.INVALID_IDENTIFIER,
      `Missing or invalid identifier: ${field}`,
      { field }
    );
  }
  return String(value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function createCompetitionDefinitionId(value) {
  return requireOpaqueId(value, "competitionId");
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function createTenantId(value) {
  return requireOpaqueId(value, "tenantId");
}

/**
 * @param {unknown} value
 * @param {string} [field]
 * @returns {string}
 */
export function normalizeIdentifier(value, field = "id") {
  return requireOpaqueId(value, field);
}
