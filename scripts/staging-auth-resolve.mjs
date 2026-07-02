/**
 * Resolve staging JWT creds from env (never logs passwords).
 * Set in .env.staging-qa.local (gitignored) or shell env:
 *   STAGING_OWNER_A_PASSWORD, STAGING_OWNER_B_PASSWORD, STAGING_PLAYER_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

function passwordForEmail(email) {
  const map = {
    "owner@staging.local": "STAGING_OWNER_A_PASSWORD",
    "owner-b@staging.local": "STAGING_OWNER_B_PASSWORD",
    "player@staging.local": "STAGING_PLAYER_PASSWORD",
  };
  const key = map[email];
  return key ? String(process.env[key] || "").trim() : "";
}

export async function signInStagingUser(email) {
  loadProjectEnv();
  const { url, anonKey } = getSupabaseEnv();
  const password = passwordForEmail(email);
  if (!password) {
    return { client: null, profile: null, error: "missing_credentials" };
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { client: null, profile: null, error: error.message };
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, email, role, venue_id, club_id, status")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { client, profile: null, error: profileError.message };
  }

  return { client, profile, userId: data.user.id, error: null };
}
