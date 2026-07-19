/**
 * Phase 3H — DrawResult envelopes.
 */

import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} DrawResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} DrawResolveResult
 * @property {boolean} ok
 * @property {import('./drawPlacement.js').DrawPlacement[]} placements
 * @property {import('./drawGroup.js').DrawGroup[]} groups
 * @property {import('./drawGroup.js').DrawBracket[]} brackets
 * @property {import('./drawGroup.js').DrawBye[]} byes
 * @property {import('./drawCandidate.js').DrawCandidate[]} candidates
 * @property {import('./drawCandidate.js').DrawCandidate[]} unresolvedCandidates
 * @property {import('./drawCandidate.js').DrawCandidate[]} excludedCandidates
 * @property {import('./drawIdentity.js').DrawIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} drawMode
 * @property {DrawResolveFailure|null} error
 * @property {string[]} warnings
 * @property {string[]} decisionTrace
 * @property {Record<string, unknown>} diagnostics
 * @property {import('./drawGroup.js').DrawSnapshot|null} [snapshot]
 */

/**
 * @param {Partial<DrawResolveResult>|null|undefined} partial
 * @returns {DrawResolveResult}
 */
export function createDrawResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    placements: ok && Array.isArray(partial?.placements) ? partial.placements : [],
    groups: ok && Array.isArray(partial?.groups) ? partial.groups : [],
    brackets: ok && Array.isArray(partial?.brackets) ? partial.brackets : [],
    byes: ok && Array.isArray(partial?.byes) ? partial.byes : [],
    candidates: Array.isArray(partial?.candidates) ? partial.candidates : [],
    unresolvedCandidates: Array.isArray(partial?.unresolvedCandidates)
      ? partial.unresolvedCandidates
      : [],
    excludedCandidates: Array.isArray(partial?.excludedCandidates)
      ? partial.excludedCandidates
      : [],
    identity: ok && partial?.identity ? partial.identity : null,
    adapterId: typeof partial?.adapterId === "string" ? partial.adapterId : null,
    drawMode: typeof partial?.drawMode === "string" ? partial.drawMode : null,
    error: ok
      ? null
      : {
          code:
            typeof partial?.error?.code === "string" && partial.error.code
              ? partial.error.code
              : DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Draw resolve failed",
          details:
            partial?.error?.details && typeof partial.error.details === "object"
              ? { ...partial.error.details }
              : {},
        },
    warnings: Array.isArray(partial?.warnings)
      ? partial.warnings.map((w) => String(w))
      : [],
    decisionTrace: Array.isArray(partial?.decisionTrace)
      ? partial.decisionTrace.map((s) => String(s))
      : [],
    diagnostics:
      partial?.diagnostics && typeof partial.diagnostics === "object"
        ? { ...partial.diagnostics }
        : {},
    snapshot:
      partial?.snapshot && typeof partial.snapshot === "object"
        ? /** @type {import('./drawGroup.js').DrawSnapshot} */ (partial.snapshot)
        : null,
  };
}

/**
 * @param {object} args
 * @returns {DrawResolveResult}
 */
export function drawResolveOk({
  placements = [],
  groups = [],
  brackets = [],
  byes = [],
  candidates = [],
  unresolvedCandidates = [],
  excludedCandidates = [],
  identity,
  adapterId = null,
  drawMode = null,
  warnings = [],
  decisionTrace = [],
  diagnostics = {},
  snapshot = null,
}) {
  return createDrawResolveResult({
    ok: true,
    placements,
    groups,
    brackets,
    byes,
    candidates,
    unresolvedCandidates,
    excludedCandidates,
    identity,
    adapterId,
    drawMode,
    warnings,
    decisionTrace,
    diagnostics,
    snapshot,
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @param {Record<string, unknown>} [diagnostics]
 * @returns {DrawResolveResult}
 */
export function drawResolveFail(code, message, details = {}, diagnostics = {}) {
  return createDrawResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}

/** Alias for docs / capability naming. */
export function createDrawResult(partial) {
  return createDrawResolveResult(partial);
}
