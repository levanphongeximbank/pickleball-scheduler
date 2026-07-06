import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isAiEngineEnabled } from "../constants/aiConfig.js";

const TABLE = "ai_workflow_checklists";

export function isAiChecklistCloudEnabled() {
  return isAiEngineEnabled() && hasSupabaseConfig();
}

function rowKey(tenantId, tournamentId, itemKey) {
  return `${tenantId}::${tournamentId}::${itemKey}`;
}

/** @type {Map<string, boolean>} */
const memoryIndex = new Map();

export async function cloudHydrateChecklist(tournamentId, tenantId, client = null) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("item_key, completed")
    .eq("tenant_id", String(tenantId))
    .eq("tournament_id", String(tournamentId));

  if (error) {
    return { ok: false, error: error.message };
  }

  for (const row of data || []) {
    memoryIndex.set(rowKey(tenantId, tournamentId, row.item_key), Boolean(row.completed));
  }

  return { ok: true, count: data?.length || 0 };
}

export function cloudGetChecklistItem(tenantId, tournamentId, itemKey) {
  return memoryIndex.get(rowKey(tenantId, tournamentId, itemKey)) ?? false;
}

export async function cloudSetChecklistItem(
  tenantId,
  tournamentId,
  itemKey,
  completed,
  updatedBy = "",
  client = null
) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, error: "Supabase chưa sẵn sàng." };
  }

  memoryIndex.set(rowKey(tenantId, tournamentId, itemKey), Boolean(completed));

  const { error } = await supabase.from(TABLE).upsert(
    {
      tenant_id: String(tenantId),
      tournament_id: String(tournamentId),
      item_key: String(itemKey),
      completed: Boolean(completed),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || null,
    },
    { onConflict: "tenant_id,tournament_id,item_key" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export function clearChecklistMemory(tenantId, tournamentId) {
  const prefix = `${tenantId}::${tournamentId}::`;
  for (const key of memoryIndex.keys()) {
    if (key.startsWith(prefix)) {
      memoryIndex.delete(key);
    }
  }
}
