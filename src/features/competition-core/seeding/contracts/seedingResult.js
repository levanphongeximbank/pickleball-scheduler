/**
 * Phase 3G — SeedingResult envelopes.
 */

import { SEEDING_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} SeedingResolveFailure
 * @property {string} code
 * @property {string} message
 * @property {Record<string, unknown>} details
 */

/**
 * @typedef {Object} SeedingResolveResult
 * @property {boolean} ok
 * @property {import('./seedAssignment.js').SeedAssignment[]} assignments
 * @property {import('./seedingCandidate.js').SeedingCandidate[]} candidates
 * @property {import('./seedingCandidate.js').SeedingCandidate[]} unresolvedCandidates
 * @property {import('./seedingCandidate.js').SeedingCandidate[]} excludedCandidates
 * @property {import('./seedingIdentity.js').SeedingIdentity|null} identity
 * @property {string|null} adapterId
 * @property {string|null} sourceType
 * @property {SeedingResolveFailure|null} error
 * @property {string[]} warnings
 * @property {Record<string, unknown>} diagnostics
 * @property {Record<string, unknown>|null} [snapshot]
 */

/**
 * @param {Partial<SeedingResolveResult>|null|undefined} partial
 * @returns {SeedingResolveResult}
 */
export function createSeedingResolveResult(partial = {}) {
  const ok = partial?.ok === true;
  return {
    ok,
    assignments: ok && Array.isArray(partial?.assignments) ? partial.assignments : [],
    candidates: Array.isArray(partial?.candidates) ? partial.candidates : [],
    unresolvedCandidates: Array.isArray(partial?.unresolvedCandidates)
      ? partial.unresolvedCandidates
      : [],
    excludedCandidates: Array.isArray(partial?.excludedCandidates)
      ? partial.excludedCandidates
      : [],
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
              : SEEDING_RUNTIME_ERROR_CODE.SEEDING_INVALID_INPUT,
          message:
            typeof partial?.error?.message === "string"
              ? partial.error.message
              : "Seeding resolve failed",
          details:
            partial?.error?.details && typeof partial.error.details === "object"
              ? { ...partial.error.details }
              : {},
        },
    warnings: Array.isArray(partial?.warnings)
      ? partial.warnings.map((w) => String(w))
      : [],
    diagnostics:
      partial?.diagnostics && typeof partial.diagnostics === "object"
        ? { ...partial.diagnostics }
        : {},
    snapshot:
      partial?.snapshot && typeof partial.snapshot === "object"
        ? { ...partial.snapshot }
        : null,
  };
}

/**
 * @param {object} args
 * @returns {SeedingResolveResult}
 */
export function seedingResolveOk({
  assignments,
  candidates = [],
  unresolvedCandidates = [],
  excludedCandidates = [],
  identity,
  adapterId = null,
  sourceType = null,
  warnings = [],
  diagnostics = {},
  snapshot = null,
}) {
  return createSeedingResolveResult({
    ok: true,
    assignments,
    candidates,
    unresolvedCandidates,
    excludedCandidates,
    identity,
    adapterId,
    sourceType,
    warnings,
    diagnostics,
    snapshot,
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @param {Record<string, unknown>} [diagnostics]
 * @returns {SeedingResolveResult}
 */
export function seedingResolveFail(
  code,
  message,
  details = {},
  diagnostics = {}
) {
  return createSeedingResolveResult({
    ok: false,
    error: { code, message, details },
    diagnostics,
  });
}

/** Alias for docs / capability naming. */
export function createSeedingResult(partial) {
  return createSeedingResolveResult(partial);
}
