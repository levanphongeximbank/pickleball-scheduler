/**
 * Scope ownership validation (NEWS-01). Fail-closed; no first-tenant fallbacks.
 */

import { CONTENT_SCOPE } from "../constants/contentScopes.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract, isNonEmptyString } from "../contracts/shared.js";

/**
 * @param {string} contentScope
 * @param {{
 *   tenantId?: unknown,
 *   venueId?: unknown,
 *   clubId?: unknown,
 *   competitionId?: unknown,
 * }} owners
 */
export function validateScopeOwnership(contentScope, owners = {}) {
  const tenantId = normalizeOptionalId(owners.tenantId);
  const venueId = normalizeOptionalId(owners.venueId);
  const clubId = normalizeOptionalId(owners.clubId);
  const competitionId = normalizeOptionalId(owners.competitionId);

  switch (contentScope) {
    case CONTENT_SCOPE.PLATFORM:
      return Object.freeze({
        contentScope,
        tenantId: null,
        venueId: null,
        clubId: null,
        competitionId: null,
      });

    case CONTENT_SCOPE.TENANT:
      if (!tenantId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "TENANT scope requires tenantId",
          { contentScope, field: "tenantId" }
        );
      }
      return Object.freeze({
        contentScope,
        tenantId,
        venueId: null,
        clubId: null,
        competitionId: null,
      });

    case CONTENT_SCOPE.VENUE:
      if (!venueId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "VENUE scope requires venueId",
          { contentScope, field: "venueId" }
        );
      }
      if (!tenantId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "VENUE scope requires tenantId context",
          { contentScope, field: "tenantId" }
        );
      }
      return Object.freeze({
        contentScope,
        tenantId,
        venueId,
        clubId: null,
        competitionId: null,
      });

    case CONTENT_SCOPE.CLUB:
      if (!clubId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "CLUB scope requires clubId",
          { contentScope, field: "clubId" }
        );
      }
      if (!tenantId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "CLUB scope requires tenantId context",
          { contentScope, field: "tenantId" }
        );
      }
      return Object.freeze({
        contentScope,
        tenantId,
        venueId: null,
        clubId,
        competitionId: null,
      });

    case CONTENT_SCOPE.COMPETITION:
      if (!competitionId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "COMPETITION scope requires competitionId",
          { contentScope, field: "competitionId" }
        );
      }
      if (!tenantId) {
        failContract(
          NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
          "COMPETITION scope requires tenantId context",
          { contentScope, field: "tenantId" }
        );
      }
      return Object.freeze({
        contentScope,
        tenantId,
        venueId: null,
        clubId: null,
        competitionId,
      });

    default:
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.UNSUPPORTED_CONTENT_SCOPE,
        "Unsupported content scope",
        { contentScope }
      );
  }
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function normalizeOptionalId(value) {
  if (value == null || value === "") return null;
  if (!isNonEmptyString(value)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.MISSING_SCOPE_OWNER,
      "Scope owner identity must be a non-empty string when provided",
      { value }
    );
  }
  return String(value).trim();
}
