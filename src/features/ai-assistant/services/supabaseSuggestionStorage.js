import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  AI_SUGGESTION_STATUS,
  AI_SUGGESTION_TTL_HOURS,
} from "../constants/aiConfig.js";
import { isAiEngineEnabled } from "../constants/aiConfig.js";

const TABLE = "ai_suggestions";

export function isAiSuggestionCloudEnabled() {
  return isAiEngineEnabled() && hasSupabaseConfig();
}

function createUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function rowToRecord(row) {
  if (!row) {
    return null;
  }
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tournamentId: String(row.tournament_id),
    type: row.type,
    status: row.status,
    inputSnapshot: row.input_snapshot || {},
    outputPayload: row.output_payload || {},
    confidence: row.confidence || "medium",
    createdBy: row.created_by || "",
    createdAt: row.created_at,
    appliedBy: row.applied_by || null,
    appliedAt: row.applied_at || null,
    dismissedBy: row.dismissed_by || null,
    dismissedAt: row.dismissed_at || null,
    expiresAt: row.expires_at || null,
  };
}

function recordToRow(record) {
  return {
    id: record.id,
    tenant_id: record.tenantId,
    tournament_id: record.tournamentId,
    type: record.type,
    status: record.status,
    input_snapshot: record.inputSnapshot || {},
    output_payload: record.outputPayload || {},
    confidence: record.confidence || "medium",
    created_by: record.createdBy || null,
    created_at: record.createdAt,
    applied_by: record.appliedBy || null,
    applied_at: record.appliedAt || null,
    dismissed_by: record.dismissedBy || null,
    dismissed_at: record.dismissedAt || null,
    expires_at: record.expiresAt || null,
  };
}

export async function cloudInsertSuggestion(record, client = null) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  const row = recordToRow(record);
  const { data, error } = await supabase.from(TABLE).insert(row).select("*").maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, record: rowToRecord(data) };
}

export async function cloudUpdateSuggestion(suggestionId, tenantId, patch, client = null) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  const updatePayload = {};
  if (patch.status) updatePayload.status = patch.status;
  if (patch.appliedBy !== undefined) updatePayload.applied_by = patch.appliedBy;
  if (patch.appliedAt !== undefined) updatePayload.applied_at = patch.appliedAt;
  if (patch.dismissedBy !== undefined) updatePayload.dismissed_by = patch.dismissedBy;
  if (patch.dismissedAt !== undefined) updatePayload.dismissed_at = patch.dismissedAt;

  const { data, error } = await supabase
    .from(TABLE)
    .update(updatePayload)
    .eq("id", suggestionId)
    .eq("tenant_id", String(tenantId))
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, record: rowToRecord(data) };
}

export async function cloudListSuggestions(tournamentId, tenantId, filters = {}, client = null) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng.", suggestions: [] };
  }

  let query = supabase
    .from(TABLE)
    .select("*")
    .eq("tenant_id", String(tenantId))
    .eq("tournament_id", String(tournamentId))
    .order("created_at", { ascending: false });

  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: error.message, suggestions: [] };
  }

  const now = Date.now();
  const suggestions = (data || [])
    .map(rowToRecord)
    .filter((item) => {
      if (filters.status && item.status !== filters.status) {
        return false;
      }
      if (
        item.status === AI_SUGGESTION_STATUS.PENDING &&
        item.expiresAt &&
        new Date(item.expiresAt).getTime() < now
      ) {
        return false;
      }
      return true;
    });

  return { ok: true, suggestions };
}

export async function cloudGetSuggestionById(suggestionId, tenantId, client = null) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", suggestionId)
    .eq("tenant_id", String(tenantId))
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, record: rowToRecord(data) };
}

export function buildSuggestionRecord({
  tenantId,
  tournamentId,
  type,
  inputSnapshot,
  outputPayload,
  confidence,
  createdBy,
}) {
  const expiresAt = new Date(
    Date.now() + AI_SUGGESTION_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  return {
    id: createUuid(),
    tenantId: String(tenantId),
    tournamentId: String(tournamentId),
    type,
    status: AI_SUGGESTION_STATUS.PENDING,
    inputSnapshot: inputSnapshot || {},
    outputPayload: outputPayload || {},
    confidence: confidence || "medium",
    createdBy: createdBy || "",
    createdAt: new Date().toISOString(),
    appliedBy: null,
    appliedAt: null,
    dismissedBy: null,
    dismissedAt: null,
    expiresAt,
  };
}

export { TABLE };
