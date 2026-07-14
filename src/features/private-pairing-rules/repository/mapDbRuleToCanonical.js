import { normalizePrivatePairingRule } from "../contracts/normalizePrivatePairingRule.js";

/**
 * Map a DB rule row (+ optional rule-set context) to the PR-2 canonical contract.
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} [ruleSet]
 * @returns {import("../contracts/normalizePrivatePairingRule.js").PrivatePairingRule|null}
 */
export function mapDbRuleToCanonical(row, ruleSet = {}) {
  if (!row || typeof row !== "object") return null;

  const targetPlayerIds = Array.isArray(row.target_player_ids)
    ? row.target_player_ids
    : Array.isArray(row.targetPlayerIds)
      ? row.targetPlayerIds
      : [];

  return normalizePrivatePairingRule({
    id: row.id,
    ruleSetId: row.rule_set_id || row.ruleSetId || ruleSet.id,
    ruleSetVersion: String(ruleSet.version ?? row.rule_set_version ?? row.ruleSetVersion ?? "1"),
    constraintType: row.constraint_type || row.constraintType,
    severity: row.severity,
    weight: row.weight,
    priority: row.priority,
    primaryPlayerId: row.primary_player_id || row.primaryPlayerId,
    targetPlayerIds,
    relationMode: row.relation_mode || row.relationMode,
    scopeType: ruleSet.scope_type || ruleSet.scopeType || row.scope_type || row.scopeType,
    scopeId: ruleSet.scope_id ?? ruleSet.scopeId ?? row.scope_id ?? row.scopeId ?? null,
    startAt: row.start_at || row.startAt,
    endAt: row.end_at || row.endAt,
    visibility: row.visibility,
    reasonCategory: row.reason_category || row.reasonCategory,
    reasonText: row.reason_text || row.reasonText,
    active: row.active !== false && row.deleted_at == null,
    metadata: row.metadata,
  });
}

/**
 * @param {{ rule_set?: Record<string, unknown>, rules?: unknown[] }} payload
 * @returns {{ ruleSet: Record<string, unknown>|null, rules: import("../contracts/normalizePrivatePairingRule.js").PrivatePairingRule[] }}
 */
export function mapDbRuleSetPayload(payload) {
  const ruleSet = payload?.rule_set || payload?.ruleSet || null;
  const rawRules = Array.isArray(payload?.rules) ? payload.rules : [];
  const rules = rawRules
    .map((row) => mapDbRuleToCanonical(row, ruleSet || {}))
    .filter(Boolean);
  return { ruleSet, rules };
}

/**
 * Deterministic content hash matching SQL `private_pairing_compute_rule_set_hash`
 * for client-side preflight binding (activate must pass the DB-computed hash; this
 * helper is for tests / local mirrors only).
 * Prefer calling activate RPC with hash returned from get/list flows after server compute.
 *
 * @param {Array<Record<string, unknown>>} rules
 * @returns {string}
 */
export function buildLocalRuleSetContentFingerprint(rules = []) {
  const chunks = [...rules]
    .filter((r) => r && r.active !== false && !r.deleted_at)
    .map((r) => {
      const targets = (Array.isArray(r.target_player_ids) ? r.target_player_ids : [])
        .map(String)
        .sort()
        .join(",");
      return [
        String(r.id || ""),
        String(r.constraint_type || ""),
        String(r.severity || ""),
        String(r.primary_player_id || ""),
        String(r.relation_mode || ""),
        r.weight == null ? "" : String(r.weight),
        String(r.visibility || ""),
        targets,
      ].join(":");
    })
    .sort();
  return chunks.join("|");
}
