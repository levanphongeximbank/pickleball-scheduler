/**
 * Resolve staging JWT creds from env (never logs passwords or tokens).
 * Set in .env.staging-qa.local (gitignored) or shell env.
 */
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function passwordForEmail(email) {
  const map = {
    "owner@staging.local": "STAGING_OWNER_A_PASSWORD",
    "owner-b@staging.local": "STAGING_OWNER_B_PASSWORD",
    "player@staging.local": "STAGING_CAPTAIN_A_PASSWORD",
    "manager@staging.local": "STAGING_MANAGER_PASSWORD",
    "club@staging.local": "STAGING_CLUB_PASSWORD",
  };
  const envKey = map[email];
  const fromEnv = envKey ? String(process.env[envKey] || "").trim() : "";
  return fromEnv || QA_PASSWORD;
}

export async function signInStagingUser(email, options = {}) {
  loadProjectEnv();
  const { url, anonKey, serviceKey } = getStagingSupabaseEnv();
  const apiKey = anonKey?.length > 20 ? anonKey : serviceKey;
  if (!apiKey) {
    return { client: null, profile: null, error: "missing_supabase_api_key" };
  }

  const password = passwordForEmail(email);
  if (!password) {
    return { client: null, profile: null, error: "missing_credentials" };
  }

  const client = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, role, venue_id, club_id, player_id, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { client, profile: null, userId: data.user.id, error: profileError.message };
  }

  return { client, profile, userId: data.user.id, error: null };
}
