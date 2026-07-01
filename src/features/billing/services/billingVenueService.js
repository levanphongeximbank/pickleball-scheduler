import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  formatBillingTenantError,
  sanitizeBillingTenantId,
} from "./billingTenantResolver.js";

/**
 * Confirm profiles.venue_id / billing tenant_id exists in public.venues.
 */
export async function validateBillingTenantOnSupabase(client, tenantId) {
  const resolvedId = sanitizeBillingTenantId(tenantId);
  if (!resolvedId) {
    return {
      ok: false,
      code: "TENANT_MISSING",
      error: formatBillingTenantError({ code: "TENANT_MISSING" }),
    };
  }

  const supabase = client || getSupabaseAuthClient();
  if (!supabase) {
    return { ok: true, tenantId: resolvedId, venue: null };
  }

  const { data, error } = await supabase
    .from("venues")
    .select("id, name, status")
    .eq("id", resolvedId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "VENUE_LOOKUP_FAILED",
      error: error.message || "Không thể kiểm tra venue trên Supabase.",
    };
  }

  if (!data) {
    return {
      ok: false,
      code: "TENANT_NOT_FOUND",
      error: formatBillingTenantError({ message: "tenant_not_found" }),
    };
  }

  return { ok: true, tenantId: resolvedId, venue: data };
}

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
