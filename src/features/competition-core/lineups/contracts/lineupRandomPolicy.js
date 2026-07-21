/**
 * CORE-06 Phase 1D — format-agnostic random / missing-lineup policy injection.
 * Core must not hard-code gender, MLP, discipline, rating, or reuse rules.
 */

import { createLineupPolicyResult } from "./lineupPolicy.js";
import { MISSING_LINEUP_POLICY } from "./missingLineupResolution.js";

/**
 * @typedef {Object} LineupRandomPolicyContext
 * @property {string|null} [tenantId]
 * @property {string|null} [competitionId]
 * @property {string|null} [teamId]
 * @property {string|null} [rosterId]
 * @property {string|number|null} [rosterVersion]
 * @property {string|null} [contextId]
 * @property {string|null} [lineupIdentityKey]
 * @property {unknown} [rosterSnapshot]
 * @property {unknown} [slotTemplate]
 * @property {unknown} [scope]
 * @property {unknown} [actor]
 * @property {string|null} [source]
 * @property {Record<string, unknown>} [extras]
 */

/**
 * @typedef {Object} LineupRandomCandidate
 * @property {string} identityToken
 * @property {import('../../participants/contracts/identity.js').ParticipantReference} person
 * @property {Record<string, unknown>} [attrs]
 */

/**
 * @typedef {Object} LineupSlotAssignment
 * @property {string} disciplineOrSideKey
 * @property {number} index
 * @property {LineupRandomCandidate} candidate
 * @property {LineupRandomCandidate[]} [selectedSoFar]
 */

/**
 * @typedef {Object} LineupRandomPolicy
 * @property {string} id
 * @property {(ctx?: LineupRandomPolicyContext) => string} decideMissingStrategy
 * @property {(candidate: LineupRandomCandidate, ctx?: LineupRandomPolicyContext) => boolean} [filterEligible]
 * @property {(candidate: LineupRandomCandidate, ctx?: LineupRandomPolicyContext) => import('./lineupPolicy.js').LineupPolicyResult} [validateCandidateUse]
 * @property {(assignment: LineupSlotAssignment, ctx?: LineupRandomPolicyContext) => import('./lineupPolicy.js').LineupPolicyResult} [validateSlotAssignment]
 * @property {(ctx?: LineupRandomPolicyContext) => boolean} [allowsDuplicateParticipants]
 */

/**
 * @param {unknown} policy
 * @returns {policy is LineupRandomPolicy}
 */
export function isLineupRandomPolicy(policy) {
  return Boolean(
    policy &&
      typeof policy === "object" &&
      typeof /** @type {{ id?: unknown }} */ (policy).id === "string" &&
      typeof /** @type {{ decideMissingStrategy?: unknown }} */ (policy)
        .decideMissingStrategy === "function"
  );
}

/**
 * Permissive default for isolated domain tests.
 * Strategy: random. All candidates eligible. Duplicates disallowed.
 * @returns {LineupRandomPolicy}
 */
export function createPermissiveLineupRandomPolicy() {
  return {
    id: "PERMISSIVE_LINEUP_RANDOM_POLICY",
    decideMissingStrategy() {
      return MISSING_LINEUP_POLICY.RANDOM;
    },
    filterEligible() {
      return true;
    },
    validateCandidateUse() {
      return createLineupPolicyResult({ ok: true });
    },
    validateSlotAssignment() {
      return createLineupPolicyResult({ ok: true });
    },
    allowsDuplicateParticipants() {
      return false;
    },
  };
}

/**
 * @param {string} strategy
 * @param {{ id?: string, reasonCode?: string, message?: string }} [options]
 * @returns {LineupRandomPolicy}
 */
export function createFixedStrategyLineupRandomPolicy(strategy, options = {}) {
  const id = options.id || `FIXED_STRATEGY_${String(strategy || "blocked")}`;
  const reasonCode = options.reasonCode || null;
  const message = options.message || null;
  return {
    id,
    decideMissingStrategy() {
      return String(strategy || MISSING_LINEUP_POLICY.BLOCKED);
    },
    filterEligible() {
      return true;
    },
    validateCandidateUse() {
      return createLineupPolicyResult({ ok: true });
    },
    validateSlotAssignment() {
      if (reasonCode) {
        return createLineupPolicyResult({
          ok: false,
          code: reasonCode,
          message: message || reasonCode,
        });
      }
      return createLineupPolicyResult({ ok: true });
    },
    allowsDuplicateParticipants() {
      return false;
    },
  };
}
