/**
 * Scope + authorization helpers for Court runtime writer.
 */

import { guardAnyClubAction } from "../../../auth/guardAction.js";
import { PERMISSIONS } from "../../../auth/permissions.js";
import { COURT_ENGINE_PERMISSIONS } from "../guards/courtEngineGuard.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "./errors.js";

/**
 * @param {{
 *   tenantId?: string,
 *   clubId?: string,
 *   venueId?: string|null,
 *   requireVenue?: boolean,
 * }} input
 */
export function validateCourtRuntimeScope(input = {}) {
  const tenantId = String(input.tenantId || "").trim();
  const clubId = String(input.clubId || "").trim();
  const venueId =
    input.venueId == null || input.venueId === ""
      ? null
      : String(input.venueId).trim();

  if (!tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required for Court runtime commands.",
      { field: "tenantId" }
    );
  }
  if (!clubId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "clubId is required for Court runtime commands.",
      { field: "clubId" }
    );
  }
  if (input.requireVenue && !venueId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "venueId is required for this Court runtime command.",
      { field: "venueId" }
    );
  }

  if (input.expectedTenantId && String(input.expectedTenantId).trim() !== tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_MISMATCH,
      "tenantId mismatch for Court runtime command.",
      { tenantId, expectedTenantId: input.expectedTenantId }
    );
  }
  if (input.expectedClubId && String(input.expectedClubId).trim() !== clubId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_MISMATCH,
      "clubId mismatch for Court runtime command.",
      { clubId, expectedClubId: input.expectedClubId }
    );
  }
  if (
    input.expectedVenueId &&
    venueId &&
    String(input.expectedVenueId).trim() !== venueId
  ) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_MISMATCH,
      "venueId mismatch for Court runtime command.",
      { venueId, expectedVenueId: input.expectedVenueId }
    );
  }

  return { ok: true, tenantId, clubId, venueId };
}

/**
 * Service-level authorization before mutation.
 * @param {string} clubId
 * @param {object} [options]
 */
export function authorizeCourtRuntimeMutation(clubId, options = {}) {
  if (options.skipAuthorization === true) {
    return { ok: true, skipped: true };
  }

  const access = guardAnyClubAction(
    clubId,
    [
      PERMISSIONS.SCHEDULING_RUN,
      PERMISSIONS.DIRECTOR_USE,
      COURT_ENGINE_PERMISSIONS.USE,
      COURT_ENGINE_PERMISSIONS.MANAGE,
    ],
    {},
    options
  );

  if (!access.ok) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_UNAUTHORIZED,
      access.error || "Unauthorized Court runtime mutation.",
      { clubId, reason: access.code || access.error }
    );
  }
  return { ok: true };
}
