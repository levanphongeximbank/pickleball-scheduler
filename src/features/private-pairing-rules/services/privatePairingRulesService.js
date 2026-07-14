import { detectPrivatePairingConflicts } from "../conflicts/detectPrivatePairingConflicts.js";
import { validatePrivatePairingRules } from "../validation/validatePrivatePairingRule.js";
import { isPrivatePairingRulesEnabled } from "../constants/codes.js";
import { PRIVATE_PAIRING_DB_CODE } from "../constants/dbCodes.js";
import {
  activatePrivatePairingRuleSet,
  getActivePrivatePairingRulesForScope,
  getPrivatePairingRuleSet,
} from "../repository/privatePairingRulesRepository.js";

/**
 * Build the SQL-compatible content payload string used for hashing.
 * Must stay aligned with `private_pairing_compute_rule_set_hash`.
 * @param {Array<Record<string, unknown>>} dbRules
 */
export function buildRuleSetHashPayload(dbRules = []) {
  const chunks = [...dbRules]
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

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SHA-256 hex of rule-set content (browser SubtleCrypto or Node crypto).
 * @param {Array<Record<string, unknown>>} dbRules
 * @returns {Promise<string>}
 */
export async function computeRuleSetContentHashFromDbRules(dbRules = []) {
  const payload = buildRuleSetHashPayload(dbRules);
  if (globalThis.crypto?.subtle?.digest) {
    const data = new TextEncoder().encode(payload);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(digest));
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Trusted activate path (Architecture A):
 * 1. Load draft rule set
 * 2. Validate + detect conflicts (PR-2)
 * 3. Compute content hash matching SQL
 * 4. Call activate RPC with preflightOk + hash
 */
export async function activatePrivatePairingRuleSetWithPreflight(
  { ruleSetId, reason, requestId = null, context = {} },
  envSource
) {
  const loaded = await getPrivatePairingRuleSet(ruleSetId, envSource);
  if (!loaded.ok) return loaded;

  const hashInput = Array.isArray(loaded.dbRules)
    ? loaded.dbRules.map((r) => ({
        id: r.id,
        constraint_type: r.constraint_type,
        severity: r.severity,
        primary_player_id: r.primary_player_id,
        relation_mode: r.relation_mode,
        weight: r.weight,
        visibility: r.visibility,
        target_player_ids: r.target_player_ids || [],
        active: r.active !== false,
        deleted_at: r.deleted_at || null,
      }))
    : [];

  const contentHash = await computeRuleSetContentHashFromDbRules(hashInput);
  const canonicalRules = Array.isArray(loaded.rules) ? loaded.rules : [];
  const validation = validatePrivatePairingRules(canonicalRules, context);
  const conflicts = detectPrivatePairingConflicts(canonicalRules, context);
  const fatalCount =
    (conflicts.fatalConflicts || []).length + (validation.errors || []).length;

  if (fatalCount > 0) {
    return {
      ok: false,
      code: PRIVATE_PAIRING_DB_CODE.RULE_SET_CONFLICT,
      message: "Fatal validation or conflict — activate blocked",
      validation,
      conflicts,
    };
  }

  return activatePrivatePairingRuleSet(
    {
      ruleSetId,
      reason,
      preflightOk: true,
      contentHash,
      validationReport: {
        fatalCount: 0,
        warningCount: (conflicts.warnings || []).length,
        source: "pr2-preflight",
      },
      requestId,
    },
    envSource
  );
}

/**
 * Load active scope rules for repository consumers.
 * Feature flag OFF → empty rules and no RPC.
 */
export async function loadActivePrivatePairingRulesForRuntime(
  { scopeType, scopeId = null, tenantId = null } = {},
  envSource
) {
  if (!isPrivatePairingRulesEnabled(envSource)) {
    return { ok: true, rules: [], skipped: true };
  }

  const result = await getActivePrivatePairingRulesForScope(
    { scopeType, scopeId, tenantId },
    envSource
  );
  if (result.skipped) {
    return { ok: true, rules: [], skipped: true };
  }
  if (!result.ok) return result;
  return {
    ok: true,
    ruleSet: result.ruleSet,
    rules: result.rules || [],
  };
}
