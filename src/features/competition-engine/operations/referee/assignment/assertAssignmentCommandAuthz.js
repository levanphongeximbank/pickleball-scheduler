/**
 * Multi-tenant / authz asserts for Competition assignment commands.
 * Fail-closed. Client-granted permission claims are never trusted.
 */

import { ASSIGNMENT_COMMAND_ERROR_CODE } from "./constants.js";
import { failAssignmentCommand } from "./errors.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;

/**
 * Canonical refereeId is mandatory. Reject display-name / email / phone authority.
 * @param {unknown} refereeId
 * @param {{ email?: unknown, phone?: unknown, displayName?: unknown, name?: unknown }} [extras]
 */
export function assertCanonicalRefereeId(refereeId, extras = {}) {
  if (extras.email != null && String(extras.email).trim()) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED,
      "Email must not be used as referee assignment authority",
      {}
    );
  }
  if (extras.phone != null && String(extras.phone).trim()) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PHONE_AS_AUTHORITY_DENIED,
      "Phone must not be used as referee assignment authority",
      {}
    );
  }
  if (
    (extras.displayName != null && String(extras.displayName).trim()) ||
    (extras.name != null && String(extras.name).trim())
  ) {
    // Display fields may exist as projection metadata only when refereeId is also present;
    // they are never accepted as the sole identity. If caller passed them as refereeId, catch below.
  }

  const id = String(refereeId || "").trim();
  if (!id) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_ID_REQUIRED,
      "Canonical refereeId is required",
      {}
    );
  }
  if (EMAIL_RE.test(id)) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.EMAIL_AS_AUTHORITY_DENIED,
      "Email must not be used as refereeId",
      { refereeId: id }
    );
  }
  if (PHONE_RE.test(id) && !/[a-zA-Z_]/.test(id)) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.PHONE_AS_AUTHORITY_DENIED,
      "Phone must not be used as refereeId",
      { refereeId: id }
    );
  }
  // Reject obvious display-name tokens (spaces / no stable id shape) as authority
  if (/\s/.test(id) || id.includes("@")) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.DISPLAY_NAME_IDENTITY_DENIED,
      "Display name must not be used as refereeId",
      { refereeId: id }
    );
  }
  return id;
}

/**
 * @param {object} command
 * @param {{
 *   authorizedTenantId?: string|null,
 *   authorizedTournamentId?: string|null,
 *   authorizedClubId?: string|null,
 *   actorAuthorized?: boolean,
 *   allowClientGrantedPermissions?: boolean,
 * }} [ctx]
 */
export function assertAssignmentCommandAuthz(command = {}, ctx = {}) {
  if (command.clientGrantedPermissions != null) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
      "Client-granted permission claims are denied",
      {}
    );
  }
  if (ctx.allowClientGrantedPermissions === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
      "allowClientGrantedPermissions is forbidden",
      {}
    );
  }

  const tenantId = String(command.tenantId || "").trim();
  const tournamentId = String(
    command.tournamentId || command.competitionId || ""
  ).trim();
  if (!tenantId || !tournamentId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.INVALID_INPUT,
      "tenantId and tournamentId/competitionId are required",
      {}
    );
  }

  const authorizedTenantId =
    ctx.authorizedTenantId != null
      ? String(ctx.authorizedTenantId).trim()
      : null;
  if (
    authorizedTenantId &&
    authorizedTenantId !== tenantId
  ) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED,
      "Cross-tenant assignment mutation denied",
      { tenantId, authorizedTenantId }
    );
  }

  const authorizedTournamentId =
    ctx.authorizedTournamentId != null
      ? String(ctx.authorizedTournamentId).trim()
      : null;
  if (
    authorizedTournamentId &&
    authorizedTournamentId !== tournamentId
  ) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED,
      "Cross-tournament assignment mutation denied",
      { tournamentId, authorizedTournamentId }
    );
  }

  if (command.staleTenantContext === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_TENANT_CONTEXT,
      "Stale tenant context denied",
      {}
    );
  }
  if (command.staleClubContext === true) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_CLUB_CONTEXT,
      "Stale club context denied",
      {}
    );
  }

  const clubId = command.clubId != null ? String(command.clubId).trim() : "";
  const authorizedClubId =
    ctx.authorizedClubId != null ? String(ctx.authorizedClubId).trim() : null;
  if (authorizedClubId && clubId && authorizedClubId !== clubId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.STALE_CLUB_CONTEXT,
      "Club context mismatch denied",
      { clubId, authorizedClubId }
    );
  }

  if (ctx.actorAuthorized === false) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "Unauthorized actor",
      {}
    );
  }

  const actorId = String(
    command.actorId || command.actor?.id || command.actorRef || ""
  ).trim();
  if (!actorId) {
    failAssignmentCommand(
      ASSIGNMENT_COMMAND_ERROR_CODE.UNAUTHORIZED_ACTOR,
      "Actor identity required",
      {}
    );
  }

  return Object.freeze({
    tenantId,
    tournamentId,
    actorId,
    clubId: clubId || null,
  });
}
