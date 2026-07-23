import {
  createAuthorizationEvidence,
  isPlainObject,
  normalizeStringList,
  optionalNonEmptyString,
} from "../contracts/index.js";
import { matchesIdentityEvidencePort } from "../ports/identityEvidencePort.js";

/**
 * Dormant Identity → evidence projection adapter.
 * Does NOT use the client RBAC helper (fail-open when disabled).
 * Requires an injected permission resolver.
 *
 * @param {{
 *   resolveGrantedPermissions?: (input: {
 *     subject: unknown,
 *     scope: unknown,
 *     action?: string,
 *     context?: Record<string, unknown>,
 *   }) => string[]|Promise<string[]>,
 *   source?: string,
 *   evidenceVersion?: string,
 * }} [options]
 * @returns {import('../ports/identityEvidencePort.js').IdentityEvidencePort}
 */
export function createIdentityProjectionEvidencePort(options = {}) {
  const resolveGrantedPermissions = options.resolveGrantedPermissions;
  const source = options.source || "IDENTITY_PROJECTION";
  const evidenceVersion = options.evidenceVersion || "identity-projection-1.0.0";

  return {
    async getEvidence(input) {
      if (typeof resolveGrantedPermissions !== "function") {
        return null;
      }
      const subject = isPlainObject(input?.subject) ? input.subject : {};
      const scope = isPlainObject(input?.scope) ? input.scope : {};
      let granted;
      try {
        granted = await resolveGrantedPermissions({
          subject,
          scope,
          action: input?.action,
          context: isPlainObject(input?.context) ? input.context : {},
        });
      } catch {
        return null;
      }
      if (granted == null) return null;
      return createAuthorizationEvidence({
        source,
        subjectId: optionalNonEmptyString(subject.actorId),
        role: optionalNonEmptyString(subject.role),
        grantedPermissions: normalizeStringList(granted),
        tenantId: optionalNonEmptyString(scope.tenantId),
        venueId: optionalNonEmptyString(scope.venueId),
        competitionId: optionalNonEmptyString(scope.competitionId),
        evidenceVersion,
        attributes: {
          projected: true,
          dormant: true,
        },
      });
    },
  };
}

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function isIdentityProjectionEvidencePort(port) {
  return matchesIdentityEvidencePort(port);
}
