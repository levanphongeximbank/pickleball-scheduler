import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { isPrivatePairingRulesEnabled } from "../constants/codes.js";
import { PRIVATE_PAIRING_DB_CODE, PRIVATE_PAIRING_RPC } from "../constants/dbCodes.js";
import { mapDbRuleSetPayload } from "./mapDbRuleToCanonical.js";

let testClientOverride = null;

export function setPrivatePairingRpcClientForTests(client) {
  testClientOverride = client;
}

function getClient() {
  return testClientOverride || getSupabaseAuthClient();
}

function featureDisabledResult() {
  return {
    ok: false,
    code: PRIVATE_PAIRING_DB_CODE.FEATURE_DISABLED,
    message: "Private pairing rules feature flag is OFF",
  };
}

function normalizeRpcResult(data, error) {
  if (error) {
    const message = String(error.message || error || "");
    if (message.toLowerCase().includes("not found") || error.code === "PGRST202") {
      return {
        ok: false,
        code: PRIVATE_PAIRING_DB_CODE.RPC_UNAVAILABLE,
        message,
      };
    }
    return {
      ok: false,
      code: error.code || PRIVATE_PAIRING_DB_CODE.PERMISSION_DENIED,
      message,
    };
  }
  if (data == null) {
    return { ok: false, code: PRIVATE_PAIRING_DB_CODE.RPC_UNAVAILABLE, message: "empty rpc result" };
  }
  if (data.ok === false) {
    return {
      ok: false,
      code: data.code || PRIVATE_PAIRING_DB_CODE.PERMISSION_DENIED,
      message: data.message || data.code,
      ...data,
    };
  }
  return { ok: true, ...data };
}

async function callRpc(rpcName, args, envSource) {
  if (!isPrivatePairingRulesEnabled(envSource)) {
    return featureDisabledResult();
  }
  const client = getClient();
  if (!client || typeof client.rpc !== "function") {
    return {
      ok: false,
      code: PRIVATE_PAIRING_DB_CODE.RPC_UNAVAILABLE,
      message: "Supabase client unavailable",
    };
  }
  const { data, error } = await client.rpc(rpcName, args);
  return normalizeRpcResult(data, error);
}

function withMappedRuleSet(result) {
  if (!result.ok) return result;
  const mapped = mapDbRuleSetPayload(result);
  return {
    ...result,
    dbRules: Array.isArray(result.rules) ? result.rules : [],
    ...mapped,
  };
}

export async function listPrivatePairingRuleSets(
  { scopeType = null, scopeId = null, status = null } = {},
  envSource
) {
  return callRpc(
    PRIVATE_PAIRING_RPC.LIST_RULE_SETS,
    {
      p_scope_type: scopeType,
      p_scope_id: scopeId,
      p_status: status,
    },
    envSource
  );
}

export async function getPrivatePairingRuleSet(ruleSetId, envSource) {
  const result = await callRpc(
    PRIVATE_PAIRING_RPC.GET_RULE_SET,
    { p_rule_set_id: ruleSetId },
    envSource
  );
  return withMappedRuleSet(result);
}

export async function getActivePrivatePairingRulesForScope(
  { scopeType, scopeId = null, tenantId = null } = {},
  envSource
) {
  if (!isPrivatePairingRulesEnabled(envSource)) {
    return {
      ok: true,
      ruleSet: null,
      rules: [],
      dbRules: [],
      skipped: true,
      code: PRIVATE_PAIRING_DB_CODE.FEATURE_DISABLED,
    };
  }
  const result = await callRpc(
    PRIVATE_PAIRING_RPC.GET_ACTIVE_FOR_SCOPE,
    {
      p_scope_type: scopeType,
      p_scope_id: scopeId,
      p_tenant_id: tenantId,
    },
    envSource
  );
  return withMappedRuleSet(result);
}

export async function createPrivatePairingRuleSet(input, envSource) {
  return callRpc(
    PRIVATE_PAIRING_RPC.CREATE_RULE_SET,
    {
      p_name: input.name,
      p_description: input.description ?? null,
      p_scope_type: input.scopeType,
      p_scope_id: input.scopeId ?? null,
      p_tenant_id: input.tenantId ?? null,
      p_metadata: input.metadata ?? {},
      p_reason: input.reason ?? null,
      p_request_id: input.requestId ?? null,
    },
    envSource
  );
}

export async function createPrivatePairingRule(input, envSource) {
  return callRpc(
    PRIVATE_PAIRING_RPC.CREATE_RULE,
    {
      p_rule_set_id: input.ruleSetId,
      p_primary_player_id: input.primaryPlayerId,
      p_constraint_type: input.constraintType,
      p_severity: input.severity,
      p_weight: input.weight ?? null,
      p_priority: input.priority ?? "medium",
      p_relation_mode: input.relationMode ?? "ANY_OF",
      p_target_player_ids: input.targetPlayerIds ?? [],
      p_reason_category: input.reasonCategory ?? "OTHER",
      p_reason_text: input.reasonText ?? null,
      p_visibility: input.visibility ?? "private",
      p_start_at: input.startAt ?? null,
      p_end_at: input.endAt ?? null,
      p_metadata: input.metadata ?? {},
      p_reason: input.reason ?? null,
      p_request_id: input.requestId ?? null,
    },
    envSource
  );
}

export async function updatePrivatePairingRule(input, envSource) {
  return callRpc(
    PRIVATE_PAIRING_RPC.UPDATE_RULE,
    {
      p_rule_id: input.ruleId,
      p_reason: input.reason,
      p_primary_player_id: input.primaryPlayerId ?? null,
      p_constraint_type: input.constraintType ?? null,
      p_severity: input.severity ?? null,
      p_weight: input.weight ?? null,
      p_priority: input.priority ?? null,
      p_relation_mode: input.relationMode ?? null,
      p_target_player_ids: input.targetPlayerIds ?? null,
      p_reason_category: input.reasonCategory ?? null,
      p_reason_text: input.reasonText ?? null,
      p_visibility: input.visibility ?? null,
      p_start_at: input.startAt ?? null,
      p_end_at: input.endAt ?? null,
      p_clear_time_range: input.clearTimeRange === true,
      p_metadata: input.metadata ?? null,
      p_request_id: input.requestId ?? null,
    },
    envSource
  );
}

export async function disablePrivatePairingRule({ ruleId, reason, requestId = null }, envSource) {
  return callRpc(
    PRIVATE_PAIRING_RPC.DISABLE_RULE,
    {
      p_rule_id: ruleId,
      p_reason: reason,
      p_request_id: requestId,
    },
    envSource
  );
}

export async function clonePrivatePairingRuleSetVersion(
  { sourceRuleSetId, reason = null, requestId = null },
  envSource
) {
  return callRpc(
    PRIVATE_PAIRING_RPC.CLONE_RULE_SET,
    {
      p_source_rule_set_id: sourceRuleSetId,
      p_reason: reason,
      p_request_id: requestId,
    },
    envSource
  );
}

/**
 * Activate requires trusted app preflight (PR-2 detector) + content hash from DB.
 * Prefer `activatePrivatePairingRuleSetWithPreflight` in the service layer.
 */
export async function activatePrivatePairingRuleSet(
  {
    ruleSetId,
    reason,
    preflightOk,
    contentHash,
    validationReport = {},
    requestId = null,
  },
  envSource
) {
  return callRpc(
    PRIVATE_PAIRING_RPC.ACTIVATE_RULE_SET,
    {
      p_rule_set_id: ruleSetId,
      p_reason: reason,
      p_preflight_ok: preflightOk === true,
      p_content_hash: contentHash,
      p_validation_report: validationReport,
      p_request_id: requestId,
    },
    envSource
  );
}

export async function archivePrivatePairingRuleSet(
  { ruleSetId, reason, requestId = null },
  envSource
) {
  return callRpc(
    PRIVATE_PAIRING_RPC.ARCHIVE_RULE_SET,
    {
      p_rule_set_id: ruleSetId,
      p_reason: reason,
      p_request_id: requestId,
    },
    envSource
  );
}

export async function rollbackPrivatePairingRuleSet(
  { sourceRuleSetId, reason, requestId = null },
  envSource
) {
  return callRpc(
    PRIVATE_PAIRING_RPC.ROLLBACK_RULE_SET,
    {
      p_source_rule_set_id: sourceRuleSetId,
      p_reason: reason,
      p_request_id: requestId,
    },
    envSource
  );
}

export async function listPrivatePairingAuditLogs(filters = {}, envSource) {
  return callRpc(
    PRIVATE_PAIRING_RPC.LIST_AUDIT_LOGS,
    {
      p_rule_set_id: filters.ruleSetId ?? null,
      p_rule_id: filters.ruleId ?? null,
      p_action: filters.action ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
    },
    envSource
  );
}
