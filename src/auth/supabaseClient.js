import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_URL || ""
    : "";

const SUPABASE_KEY =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_SUPABASE_ANON_KEY || ""
    : "";

let authClient = null;

export function hasSupabaseConfig() {
  return SUPABASE_URL.trim() !== "" && SUPABASE_KEY.trim() !== "";
}

/** Client dùng Supabase Auth (session persist). Tách khỏi matchLiveSync. */
export function getSupabaseAuthClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!authClient) {
    authClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return authClient;
}

export const PROFILES_TABLE = "profiles";
