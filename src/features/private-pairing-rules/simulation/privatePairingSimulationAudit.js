/**
 * PR-4.5 — optional audit payload for SIMULATE_PRIVATE_PAIRING.
 * Read-only simulation; audit must never become apply.
 */

export const SIMULATE_PRIVATE_PAIRING_ACTION = "SIMULATE_PRIVATE_PAIRING";

/**
 * Build a redacted audit record (no full names).
 * @param {object} params
 */
export function buildSimulatePrivatePairingAudit(params = {}) {
  return {
    action: SIMULATE_PRIVATE_PAIRING_ACTION,
    actor_id: params.actorId || null,
    tenant_id: params.tenantId || null,
    scope_type: params.scopeType || null,
    scope_id: params.scopeId || null,
    rule_set_id: params.ruleSetId || null,
    rule_set_version: params.ruleSetVersion || null,
    seed: params.seed ?? null,
    players_count: Number(params.playersCount) || 0,
    top_n: Number(params.topN) || 0,
    execution_time_ms: Number(params.executionTimeMs) || 0,
    created_at: params.createdAt || new Date().toISOString(),
  };
}

/**
 * Optional write via injected auditWriter. Never throws into simulation outcome.
 */
export async function maybeWriteSimulationAudit(auditWriter, payload) {
  if (typeof auditWriter !== "function" || !payload) return null;
  try {
    return await auditWriter(payload);
  } catch {
    return null;
  }
}
