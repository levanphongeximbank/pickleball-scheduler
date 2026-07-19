/**
 * Resolve staging JWT creds from env (never logs passwords or tokens).
 * Set in .env.staging-qa.local (gitignored) or shell env.
 */
import { createClient } from "@supabase/supabase-js";
import { getStagingSupabaseEnv, loadProjectEnv } from "./load-env.mjs";

const QA_PASSWORD = String(process.env.PHASE42L_QA_PASSWORD || "PickleStaging!358").trim();

function passwordForEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const ownerA = String(process.env.STAGING_OWNER_A_EMAIL || "").trim().toLowerCase();
  const ownerB = String(process.env.STAGING_OWNER_B_EMAIL || "").trim().toLowerCase();

  // Prefer env-configured QA Owner emails (Phase 1.3S+) over hard-coded staging.local.
  if (ownerA && normalized === ownerA) {
    return String(process.env.STAGING_OWNER_A_PASSWORD || "").trim() || QA_PASSWORD;
  }
  if (ownerB && normalized === ownerB) {
    return String(process.env.STAGING_OWNER_B_PASSWORD || "").trim() || QA_PASSWORD;
  }

  const map = {
    "owner@staging.local": "STAGING_OWNER_A_PASSWORD",
    "owner-b@staging.local": "STAGING_OWNER_B_PASSWORD",
    "player@staging.local": "STAGING_CAPTAIN_A_PASSWORD",
    "manager@staging.local": "STAGING_MANAGER_PASSWORD",
    "club@staging.local": "STAGING_CLUB_PASSWORD",
  };
  const envKey = map[normalized];
  const fromEnv = envKey ? String(process.env[envKey] || "").trim() : "";
  return fromEnv || QA_PASSWORD;
}

/** Resolve QA Owner A/B emails from env (required for Notification Phase 1.3S). */
export function getStagingOwnerEmails() {
  loadProjectEnv();
  const ownerA = String(process.env.STAGING_OWNER_A_EMAIL || "").trim();
  const ownerB = String(process.env.STAGING_OWNER_B_EMAIL || "").trim();
  return { ownerA, ownerB };
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
