/**
 * Phase 3F — resolve result envelopes.
 */

import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} MatchResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} MatchResolveResult
 * @property {boolean} ok
 * @property {import('./competitionMatch.js').CompetitionMatch|null} match
 * @property {import('./matchIdentity.js').MatchIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {MatchResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @param {Partial<MatchResolveResult>|null|undefined} partial
 * @returns {MatchResolveResult}
 */
export function createMatchResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    match: ok && partial?.match ? partial.match : null,
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    sourceType:
      typeof partial?.sourceType === "string" ? partial.sourceType : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Match resolve failed",
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
 * @returns {MatchResolveResult}
 */
export function matchResolveOk({
  match,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createMatchResolveResult({
    ok: true,
    match,
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
 * @returns {MatchResolveResult}
 */
export function matchResolveFail(code, message, details = {}, diagnostics = {}) {
  return createMatchResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}
