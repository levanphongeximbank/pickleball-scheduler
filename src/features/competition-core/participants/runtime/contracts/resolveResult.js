/**
 * Phase 3B — resolve result envelope (success or typed failure).
 */

import { PARTICIPANT_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} ParticipantResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} ParticipantResolveResult
 * @property {boolean} ok
 * @property {import('../../contracts/competitionParticipant.js').CompetitionParticipant|null} participant
 * @property {import('../../contracts/identity.js').ParticipantIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {ParticipantResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @param {Partial<ParticipantResolveResult>|null|undefined} partial
 * @returns {ParticipantResolveResult}
 */
export function createParticipantResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    participant: ok && partial?.participant ? partial.participant : null,
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    sourceType: typeof partial?.sourceType === "string" ? partial.sourceType : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Participant resolve failed",
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
 * @param {import('../../contracts/competitionParticipant.js').CompetitionParticipant} args.participant
 * @param {import('../../contracts/identity.js').ParticipantIdentity} args.identity
 * @param {string} [args.adapterId]
 * @param {string} [args.sourceType]
 * @param {Record<string, unknown>} [args.diagnostics]
 * @returns {ParticipantResolveResult}
 */
export function resolveOk({
  participant,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createParticipantResolveResult({
    ok: true,
    participant,
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
 * @returns {ParticipantResolveResult}
 */
export function resolveFail(code, message, details = {}, diagnostics = {}) {
  return createParticipantResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}
