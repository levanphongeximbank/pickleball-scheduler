/**
 * Phase 3G — default no-op SeedingPolicy (structural Core only).
 */

import { createSeedingPolicyResult } from "../contracts/seedingPolicy.js";

export const NOOP_SEEDING_POLICY_ID = "NOOP_SEEDING_POLICY";

/**
 * @returns {import('../contracts/seedingPolicy.js').SeedingPolicy}
 */
export function createNoopSeedingPolicy() {
  return {
    id: NOOP_SEEDING_POLICY_ID,
    supports() {
      return true;
    },
    validateCandidates() {
      return createSeedingPolicyResult({ ok: true });
    },
    isEligible(candidate) {
      return candidate?.eligible !== false;
    },
    compareCandidates() {
      return null;
    },
    allowRandom() {
      return true;
    },
    allowPartialManual() {
      return true;
    },
  };
}
