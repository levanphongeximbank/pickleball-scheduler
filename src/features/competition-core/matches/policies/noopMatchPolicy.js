/**
 * Phase 3F — default no-op MatchPolicy (structural Core only).
 */

import { createMatchPolicyResult } from "../contracts/matchPolicy.js";

export const NOOP_MATCH_POLICY_ID = "NOOP_MATCH_POLICY";

/**
 * @returns {import('../contracts/matchPolicy.js').MatchPolicy}
 */
export function createNoopMatchPolicy() {
  return {
    id: NOOP_MATCH_POLICY_ID,
    supports() {
      return true;
    },
    validateComposition() {
      return createMatchPolicyResult({ ok: true });
    },
    canStart() {
      return createMatchPolicyResult({ ok: true });
    },
    canComplete() {
      return createMatchPolicyResult({ ok: true });
    },
    authorizeOutcome() {
      return createMatchPolicyResult({ ok: true });
    },
    assertTransition() {
      return createMatchPolicyResult({ ok: true });
    },
  };
}
