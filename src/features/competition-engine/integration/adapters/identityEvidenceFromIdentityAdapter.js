/**
 * INT-01 / BG-01 — Identity → CORE-02 IdentityEvidencePort adapter.
 *
 * Translation only. Identity domain remains the authority.
 * Uses Identity role matrix as permission SoT. Never trusts client-sent grants.
 * Fail-closed when actor, role, or tenant is missing.
 *
 * resolveSubjectIdentity is a point lookup by canonical subjectId only.
 * It does not search, list, or infer identity from display/email/phone.
 */

import {
  createIdentityProjectionEvidencePort,
  matchesIdentityEvidencePort,
} from "../../../competition-core/role-permission/index.js";
import { getPermissionsForRole } from "../../../identity/matrix/rolePermissions.js";
import { normalizeRole } from "../../../identity/constants/roles.js";
import { resolveSubjectIdentityRecord } from "../../../identity/services/subjectIdentityLookupService.js";
import { INTEGRATION_ERROR_CODE, INTEGRATION_SOURCE } from "../constants.js";
import {
  optionalNonEmptyString,
  readScopeIds,
  readSubjectIds,
  requireActorIdentity,
  requireTenantId,
  assertTenantIsolation,
} from "../context/requireIntegrationContext.js";

/**
 * Resolve granted permissions from Identity matrix only.
 * @param {{
 *   getPermissionsForRole?: (role: string) => string[],
 *   normalizeRole?: (role: unknown) => string,
 *   requireVenueWhenPresent?: boolean,
 * }} [options]
 */
export function createIdentityPermissionResolver(options = {}) {
  const resolvePermissions =
    typeof options.getPermissionsForRole === "function"
      ? options.getPermissionsForRole
      : getPermissionsForRole;
  const normalize =
    typeof options.normalizeRole === "function"
      ? options.normalizeRole
      : normalizeRole;

  /**
   * @param {{
   *   subject: unknown,
   *   scope: unknown,
   *   action?: string,
   *   context?: Record<string, unknown>,
   * }} input
   * @returns {string[]}
   */
  return function resolveGrantedPermissions(input) {
    const subject = requireActorIdentity(input?.subject);
    if (!subject.role) {
      const err = new Error("Actor role is required");
      /** @type {{ code?: string }} */ (err).code =
        INTEGRATION_ERROR_CODE.MISSING_IDENTITY;
      throw err;
    }

    const tenantId = requireTenantId(input?.scope);
    const scopeIds = readScopeIds(input?.scope);

    // Optional venue check when caller marks venue-dependent action.
    const context =
      input?.context && typeof input.context === "object" ? input.context : {};
    const requiresVenue =
      context.requireVenue === true ||
      context.venueRequired === true ||
      options.requireVenueWhenPresent === true;
    if (requiresVenue && !scopeIds.venueId) {
      const err = new Error("Venue scope is required for this action");
      /** @type {{ code?: string }} */ (err).code =
        INTEGRATION_ERROR_CODE.MISSING_VENUE;
      throw err;
    }

    // Defense: if evidence attributes carry a foreign tenant, reject.
    const claimedTenant = optionalNonEmptyString(context.claimedTenantId);
    if (claimedTenant) {
      assertTenantIsolation(claimedTenant, tenantId);
    }

    const canonicalRole = normalize(subject.role);
    const grants = resolvePermissions(canonicalRole);
    if (!Array.isArray(grants)) {
      const err = new Error("Identity permission matrix returned invalid grants");
      /** @type {{ code?: string }} */ (err).code =
        INTEGRATION_ERROR_CODE.ADAPTER_FAILURE;
      throw err;
    }

    // Never accept client-supplied grantedPermissions — ignore if present.
    return [...grants].map((p) => String(p)).filter(Boolean).sort();
  };
}

/**
 * Production-oriented IdentityEvidencePort for Competition composition root.
 *
 * @param {{
 *   getPermissionsForRole?: (role: string) => string[],
 *   normalizeRole?: (role: unknown) => string,
 *   requireVenueWhenPresent?: boolean,
 *   source?: string,
 *   evidenceVersion?: string,
 *   loadIdentitySubjectById?: (subjectId: string) => Promise<object|null>|object|null,
 *   resolveSubjectIdentityRecord?: Function,
 * }} [options]
 * @returns {import('../../../competition-core/role-permission/ports/identityEvidencePort.js').IdentityEvidencePort & {
 *   resolveSubjectIdentity: Function,
 * }}
 */
export function createIdentityEvidenceFromIdentityAdapter(options = {}) {
  const resolveGrantedPermissions = createIdentityPermissionResolver(options);
  const lookup =
    typeof options.resolveSubjectIdentityRecord === "function"
      ? options.resolveSubjectIdentityRecord
      : resolveSubjectIdentityRecord;

  const projection = createIdentityProjectionEvidencePort({
    resolveGrantedPermissions: async (input) => resolveGrantedPermissions(input),
    source: options.source || INTEGRATION_SOURCE.IDENTITY,
    evidenceVersion: options.evidenceVersion || "e2e-01-identity-evidence-v1",
  });

  return {
    async getEvidence(input) {
      const subject = readSubjectIds(input?.subject);
      const scope = readScopeIds(input?.scope);

      if (!subject.actorId || !subject.role) {
        return null;
      }
      if (!scope.tenantId) {
        return null;
      }

      const evidence = await projection.getEvidence(input);
      if (evidence == null) return null;

      // Strip dormant flag — this adapter is the production wiring path.
      return Object.freeze({
        ...evidence,
        attributes: Object.freeze({
          ...(evidence.attributes || {}),
          projected: true,
          dormant: false,
          integrationAdapter: "identityEvidenceFromIdentityAdapter",
          clientGrantsIgnored: true,
        }),
      });
    },
    /**
     * Point lookup by canonical subjectId. Translation only.
     * @param {{
     *   subjectId?: unknown,
     *   requestedTenantId?: unknown,
     *   tenantId?: unknown,
     *   correlationId?: unknown,
     * }} input
     */
    async resolveSubjectIdentity(input = {}) {
      return lookup(
        {
          subjectId: input.subjectId,
          requestedTenantId: input.requestedTenantId || input.tenantId,
          tenantId: input.tenantId,
          correlationId: input.correlationId,
        },
        {
          loadIdentitySubjectById: options.loadIdentitySubjectById,
        }
      );
    },
  };
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isIdentityEvidenceFromIdentityAdapter(port) {
  return matchesIdentityEvidencePort(port);
}
