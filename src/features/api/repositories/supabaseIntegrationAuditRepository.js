import { createClient } from "@supabase/supabase-js";
import {
  ApiKeyStoreConfigError,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../config/auditStoreConfig.js";

let adminClient = null;

export function getSupabaseAuditAdminClient() {
  const url = getSupabaseServerUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    throw new ApiKeyStoreConfigError(
      "Supabase integration audit repository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function resetSupabaseAuditAdminClientForTests() {
  adminClient = null;
}

/** Insert one audit row — caller handles best-effort / timeout. */
export async function insertIntegrationAuditRow(row) {
  const admin = getSupabaseAuditAdminClient();
  const { error } = await admin.from("integration_audit_logs").insert(row);
  if (error) {
    throw new Error(`Supabase integration_audit_logs insert failed: ${error.message}`);
  }
}
