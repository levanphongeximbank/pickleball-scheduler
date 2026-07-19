/**
 * Phase 3H — default no-op DrawPolicy (structural Core only).
 */

import { createDrawPolicyResult } from "../contracts/drawPolicy.js";

export const NOOP_DRAW_POLICY_ID = "NOOP_DRAW_POLICY";

/**
 * @returns {import('../contracts/drawPolicy.js').DrawPolicy}
 */
export function createNoopDrawPolicy() {
  return {
    id: NOOP_DRAW_POLICY_ID,
    supports() {
      return true;
    },
    validateCandidates() {
      return createDrawPolicyResult({ ok: true });
    },
    isEligible(candidate) {
      return candidate?.eligible !== false;
    },
    allowNonPowerOfTwo() {
      return false;
    },
    allowPartialManual() {
      return true;
    },
    allowEmptyGroups() {
      return false;
    },
  };
}
