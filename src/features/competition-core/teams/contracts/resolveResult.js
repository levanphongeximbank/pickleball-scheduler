/**
 * Phase 3D — resolve result envelopes (team + roster).
 */

import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} TeamResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} TeamResolveResult
 * @property {boolean} ok
 * @property {import('../../participants/contracts/teamRosterLineup.js').CompetitionTeam|null} team
 * @property {import('./teamIdentity.js').TeamIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {TeamResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @typedef {Object} RosterResolveResult
 * @property {boolean} ok
 * @property {import('../../participants/contracts/teamRosterLineup.js').CompetitionRoster|null} roster
 * @property {import('./rosterIdentity.js').RosterIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {TeamResolveFailure|null} error
 * @property {Record<string, unknown>} diagnostics
 */

/**
 * @param {Partial<TeamResolveResult>|null|undefined} partial
 * @returns {TeamResolveResult}
 */
export function createTeamResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    team: ok && partial?.team ? partial.team : null,
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    sourceType: typeof partial?.sourceType === "string" ? partial.sourceType : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : TEAM_RUNTIME_ERROR_CODE.INVALID_TEAM,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Team resolve failed",
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
 * @param {Partial<RosterResolveResult>|null|undefined} partial
 * @returns {RosterResolveResult}
 */
export function createRosterResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    roster: ok && partial?.roster ? partial.roster : null,
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    sourceType: typeof partial?.sourceType === "string" ? partial.sourceType : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : TEAM_RUNTIME_ERROR_CODE.INVALID_ROSTER,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Roster resolve failed",
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
 * @returns {TeamResolveResult}
 */
export function teamResolveOk({
  team,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createTeamResolveResult({
    ok: true,
    team,
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
 * @returns {TeamResolveResult}
 */
export function teamResolveFail(code, message, details = {}, diagnostics = {}) {
  return createTeamResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}

/**
 * @param {object} args
 * @returns {RosterResolveResult}
 */
export function rosterResolveOk({
  roster,
  identity,
  adapterId = null,
  sourceType = null,
  diagnostics = {},
}) {
  return createRosterResolveResult({
    ok: true,
    roster,
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
 * @returns {RosterResolveResult}
 */
export function rosterResolveFail(code, message, details = {}, diagnostics = {}) {
  return createRosterResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}
