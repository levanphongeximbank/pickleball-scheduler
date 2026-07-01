import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

/**
 * List venue/tenant rows from Supabase (SUPER_ADMIN sees all; owner sees own via RLS).
 */
export async function fetchSupabaseVenues(client) {
  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, venues: [], error: "NO_SUPABASE" };
  }

  const { data, error } = await supabase
    .from("venues")
    .select("id, name, status")
    .order("name");

  if (error) {
    return { ok: false, venues: [], error: error.message };
  }

  return { ok: true, venues: data || [] };
}
