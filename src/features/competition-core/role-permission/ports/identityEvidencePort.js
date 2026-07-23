import {
  createAuthorizationEvidence,
  isPlainObject,
} from "../contracts/index.js";

/**
 * @typedef {Object} IdentityEvidencePort
 * @property {(input: {
 *   subject: unknown,
 *   scope: unknown,
 *   action?: string,
 *   context?: Record<string, unknown>,
 * }) => Promise<import('../contracts/authorizationEvidence.js').AuthorizationEvidence|null>|import('../contracts/authorizationEvidence.js').AuthorizationEvidence|null} getEvidence
 */

/**
 * @param {unknown} port
 * @returns {boolean}
 */
export function matchesIdentityEvidencePort(port) {
  return Boolean(
    port && typeof port === "object" && typeof port.getEvidence === "function"
  );
}

/**
 * Fail-closed default — always returns null evidence.
 * @returns {IdentityEvidencePort}
 */
export function createUnavailableIdentityEvidencePort() {
  return {
    async getEvidence() {
      return null;
    },
  };
}

/**
 * Static grant evidence port for tests / dormancy doubles.
 * @param {Iterable<string>|string[]} [grantedPermissions]
 * @param {Record<string, unknown>} [defaults]
 * @returns {IdentityEvidencePort}
 */
export function createStaticIdentityEvidencePort(
  grantedPermissions = [],
  defaults = {}
) {
  const grants = [...grantedPermissions].map((p) => String(p)).filter(Boolean);
  return {
    async getEvidence(input) {
      const subject = isPlainObject(input?.subject) ? input.subject : {};
      const scope = isPlainObject(input?.scope) ? input.scope : {};
      return createAuthorizationEvidence({
        source: defaults.source || "STATIC",
        subjectId: subject.actorId ?? null,
        role: subject.role ?? null,
        grantedPermissions: grants,
        tenantId: scope.tenantId ?? defaults.tenantId ?? null,
        venueId: scope.venueId ?? defaults.venueId ?? null,
        competitionId: scope.competitionId ?? defaults.competitionId ?? null,
        evidenceVersion: defaults.evidenceVersion || "static-1.0.0",
        attributes: defaults.attributes || {},
      });
    },
  };
}
