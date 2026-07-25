/**
 * COMMS-ACT-06 — shared Production ref gate for api/communication hosts.
 * Fail-closed: Production URL blocked unless exact Owner GO enable token.
 */

import { evaluateCommunicationProductionRefGate } from "../../src/features/communication/activation/productionTarget.js";

/**
 * @param {string} url
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertCommunicationProductionTargetAllowed(url) {
  const gate = evaluateCommunicationProductionRefGate(url);
  if (gate.ok) return { ok: true };
  return {
    ok: false,
    code: gate.code || "PRODUCTION_REF_BLOCKED",
    error:
      gate.error ||
      "Production project ref is blocked for Communication until Owner GO.",
  };
}
