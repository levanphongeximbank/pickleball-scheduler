/**
 * Fail-closed integration context guards (GOV-09 / GOV-10 foundation).
 * Never invents tenant, venue, club, actor, or role defaults.
 */

import { INTEGRATION_ERROR_CODE } from "../constants.js";
import { throwIntegrationError } from "../errors.js";

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function optionalNonEmptyString(value) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {unknown} value
 * @param {string} code
 * @param {string} label
 * @returns {string}
 */
export function requireNonEmptyString(value, code, label) {
  const trimmed = optionalNonEmptyString(value);
  if (!trimmed) {
    throwIntegrationError(code, `${label} is required`, {
      failClosed: true,
      details: { label, provided: value == null ? null : typeof value },
    });
  }
  return trimmed;
}

/**
 * @param {unknown} scope
 * @returns {{ tenantId: string|null, venueId: string|null, clubId: string|null, competitionId: string|null }}
 */
export function readScopeIds(scope) {
  const raw = scope && typeof scope === "object" ? /** @type {Record<string, unknown>} */ (scope) : {};
  return {
    tenantId: optionalNonEmptyString(raw.tenantId),
    venueId: optionalNonEmptyString(raw.venueId),
    clubId: optionalNonEmptyString(raw.clubId),
    competitionId: optionalNonEmptyString(raw.competitionId),
  };
}

/**
 * @param {unknown} subject
 * @returns {{ actorId: string|null, role: string|null }}
 */
export function readSubjectIds(subject) {
  const raw =
    subject && typeof subject === "object"
      ? /** @type {Record<string, unknown>} */ (subject)
      : {};
  return {
    actorId: optionalNonEmptyString(raw.actorId ?? raw.userId ?? raw.id),
    role: optionalNonEmptyString(raw.role ?? raw.actorRole),
  };
}

/**
 * Require authenticated actor identity.
 * @param {unknown} subject
 * @returns {{ actorId: string, role: string|null }}
 */
export function requireActorIdentity(subject) {
  const { actorId, role } = readSubjectIds(subject);
  if (!actorId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_IDENTITY,
      "Authenticated actor identity is required",
      { failClosed: true, details: { field: "actorId" } }
    );
  }
  return { actorId, role };
}

/**
 * Require tenant scope — no ambient/first-tenant fallback.
 * @param {unknown} scope
 * @returns {string}
 */
export function requireTenantId(scope) {
  const { tenantId } = readScopeIds(scope);
  if (!tenantId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_TENANT,
      "Tenant scope is required",
      { failClosed: true, details: { field: "tenantId" } }
    );
  }
  return tenantId;
}

/**
 * Require venue when action depends on venue inventory / assignment.
 * @param {unknown} scope
 * @returns {string}
 */
export function requireVenueId(scope) {
  const { venueId } = readScopeIds(scope);
  if (!venueId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_VENUE,
      "Venue scope is required",
      { failClosed: true, details: { field: "venueId" } }
    );
  }
  return venueId;
}

/**
 * Require club when eligibility / court inventory is club-scoped.
 * @param {unknown} scope
 * @returns {string}
 */
export function requireClubId(scope) {
  const { clubId } = readScopeIds(scope);
  if (!clubId) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_CLUB,
      "Club scope is required",
      { failClosed: true, details: { field: "clubId" } }
    );
  }
  return clubId;
}

/**
 * Reject cross-tenant evidence vs request scope.
 * @param {string|null|undefined} evidenceTenantId
 * @param {string|null|undefined} scopeTenantId
 */
export function assertTenantIsolation(evidenceTenantId, scopeTenantId) {
  const evidence = optionalNonEmptyString(evidenceTenantId);
  const scope = optionalNonEmptyString(scopeTenantId);
  if (!evidence || !scope) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_TENANT,
      "Tenant isolation requires both evidence and scope tenantId",
      { failClosed: true, details: { evidenceTenantId: evidence, scopeTenantId: scope } }
    );
  }
  if (evidence !== scope) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.CROSS_TENANT_REJECTED,
      "Cross-tenant access rejected",
      {
        failClosed: true,
        details: { evidenceTenantId: evidence, scopeTenantId: scope },
      }
    );
  }
}

/**
 * Full fail-closed context for protected integration commands.
 * @param {{ subject?: unknown, scope?: unknown, requireVenue?: boolean, requireClub?: boolean, requireRole?: boolean }} input
 */
export function requireIntegrationContext(input = {}) {
  const subject = requireActorIdentity(input.subject);
  if (input.requireRole !== false && !subject.role) {
    throwIntegrationError(
      INTEGRATION_ERROR_CODE.MISSING_IDENTITY,
      "Actor role is required for competition authorization",
      { failClosed: true, details: { field: "role" } }
    );
  }
  const tenantId = requireTenantId(input.scope);
  const scopeIds = readScopeIds(input.scope);
  const venueId = input.requireVenue ? requireVenueId(input.scope) : scopeIds.venueId;
  const clubId = input.requireClub ? requireClubId(input.scope) : scopeIds.clubId;
  return Object.freeze({
    actorId: subject.actorId,
    role: subject.role,
    tenantId,
    venueId,
    clubId,
    competitionId: scopeIds.competitionId,
  });
}
