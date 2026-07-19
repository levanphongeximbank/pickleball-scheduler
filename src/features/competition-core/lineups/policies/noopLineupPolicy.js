/**
 * Phase 3E — default no-op LineupPolicy (structural Core only).
 */

import { createLineupPolicyResult } from "../contracts/lineupPolicy.js";

export const NOOP_LINEUP_POLICY_ID = "NOOP_LINEUP_POLICY";

/**
 * @returns {import('../contracts/lineupPolicy.js').LineupPolicy}
 */
export function createNoopLineupPolicy() {
  return {
    id: NOOP_LINEUP_POLICY_ID,
    supports() {
      return true;
    },
    validateSlots() {
      return createLineupPolicyResult({ ok: true });
    },
    assertTransition() {
      return createLineupPolicyResult({ ok: true });
    },
    evaluateDeadline() {
      return createLineupPolicyResult({ ok: true });
    },
  };
}
