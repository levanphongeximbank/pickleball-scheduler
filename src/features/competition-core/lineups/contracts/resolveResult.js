/**
 * Phase 3E — resolve result envelopes.
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} LineupResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} LineupResolveResult
 * @property {boolean} ok
 * @property {import('../../participants/contracts/teamRosterLineup.js').CompetitionLineup|null} lineup
 * @property {import('./lineupIdentity.js').LineupIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {LineupResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @param {Partial<LineupResolveResult>|null|undefined} partial
 * @returns {LineupResolveResult}
 */
export function createLineupResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    lineup: ok && partial?.lineup ? partial.lineup : null,
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
              : LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Lineup resolve failed",
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
 * @returns {LineupResolveResult}
 */
export function lineupResolveOk({
  lineup,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createLineupResolveResult({
    ok: true,
    lineup,
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
 * @returns {LineupResolveResult}
 */
export function lineupResolveFail(code, message, details = {}, diagnostics = {}) {
  return createLineupResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}
