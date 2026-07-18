/**
 * Phase 3C — resolve result envelope (success or typed failure).
 */

import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} RegistrationResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} RegistrationResolveResult
 * @property {boolean} ok
 * @property {import('../../participants/contracts/entryRegistration.js').CompetitionRegistration|null} registration
 * @property {import('./registrationIdentity.js').RegistrationIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {RegistrationResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @param {Partial<RegistrationResolveResult>|null|undefined} partial
 * @returns {RegistrationResolveResult}
 */
export function createRegistrationResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    registration: ok && partial?.registration ? partial.registration : null,
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    sourceType: typeof partial?.sourceType === "string" ? partial.sourceType : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : REGISTRATION_RUNTIME_ERROR_CODE.INVALID_REGISTRATION,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Registration resolve failed",
          details:
            partial?.error?.details && typeof partial.error.details === "object"
              ? { ...partial.error.details }
              : {},
        },
    diagnostics:
      partial?.diagnostics && typeof partial.diagnostics === "object"
        ? { ...partial.diagnostics }
        : {},
  };
}

/**
 * @param {object} args
 * @returns {RegistrationResolveResult}
 */
export function resolveOk({
  registration,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createRegistrationResolveResult({
    ok: true,
    registration,
    identity,
    adapterId,
    sourceType,
    diagnostics,
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @param {Record<string, unknown>} [diagnostics]
 * @returns {RegistrationResolveResult}
 */
export function resolveFail(code, message, details = {}, diagnostics = {}) {
  return createRegistrationResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}
