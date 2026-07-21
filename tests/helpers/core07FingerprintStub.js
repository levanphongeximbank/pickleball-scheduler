/**
 * TEST-ONLY deterministic fingerprint stub for CORE-07 Phase 1D tests.
 * Not part of the capability production barrel. Do not import from runtime.
 */

import { CORE07_FINGERPRINT_PORT_VERSION } from "../../src/features/competition-core/seeding/domain/constants.js";

/**
 * @returns {{ contractVersion: string, fingerprint: (canonicalPayload: string) => string }}
 */
export function createCore07TestFingerprintStub() {
  return {
    contractVersion: CORE07_FINGERPRINT_PORT_VERSION,
    fingerprint(canonicalPayload) {
      const text = String(canonicalPayload);
      let hash = 0x811c9dc5;
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
    },
  };
}
