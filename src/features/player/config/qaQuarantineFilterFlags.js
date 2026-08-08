/**
 * OPERATION_B1B WP3 — single rollback boundary for quarantine authority filtering.
 *
 * Flag ON  → dual-read (canonical qa_quarantine_list_active + legacy signals)
 * Flag OFF → prior QA filtering behavior only (no authority RPC / no canonical signal)
 *
 * Default ON with bounded RPC absence/error fallback so environments without WP1/WP2
 * SQL keep legacy visibility. Set to false/0 to restore prior filter behavior.
 *
 * LEGACY FALLBACK REMOVAL POINT (scheduled, not a second SSOT):
 * After WP5 real DB constraint/RPC proofs and WP6 Staging rehearsal accept the
 * canonical qa_identity_quarantines authority, remove transitional dual-read of
 * profiles.status==='quarantined' / meta.qaQuarantined / quarantined boolean.
 * Certified QA email defense-in-depth may remain until Owner decides.
 * Canonical authority remains qa_quarantine_list_active (same table SSOT).
 */

export const QA_QUARANTINE_AUTHORITY_FILTER_FLAG =
  "VITE_QA_QUARANTINE_AUTHORITY_FILTER_ENABLED";

/**
 * @param {Record<string, unknown>|undefined|null} [envSource]
 * @returns {boolean}
 */
export function isQaQuarantineAuthorityFilterEnabled(envSource) {
  const source =
    envSource ||
    (typeof import.meta !== "undefined" ? import.meta.env : {}) ||
    {};
  const nodeEnv =
    typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  const raw =
    source?.[QA_QUARANTINE_AUTHORITY_FILTER_FLAG] ??
    nodeEnv?.[QA_QUARANTINE_AUTHORITY_FILTER_FLAG];

  if (raw === false || raw === "false" || raw === "0" || raw === 0) {
    return false;
  }
  // Default ON (unset / true / "true" / "1") — rollback is explicit OFF.
  return true;
}
