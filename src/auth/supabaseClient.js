import { createClient } from "@supabase/supabase-js";

let authClient = null;

export const SUPABASE_CONFIG_ERROR =
  "Thiếu cấu hình Supabase. Đặt VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong .env.local (không để trống trong .env.development).";

function readSupabaseEnv() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  return {
    url: String(env.VITE_SUPABASE_URL || nodeEnv.VITE_SUPABASE_URL || "").trim(),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY || nodeEnv.VITE_SUPABASE_ANON_KEY || "").trim(),
    mode: env.MODE || nodeEnv.NODE_ENV || "unknown",
  };
}

/** @param {string} key */
export function getSupabaseAnonKeyPrefix(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) {
    return "(empty)";
  }
  if (trimmed.startsWith("sb_publishable_")) {
    return "sb_publishable";
  }
  if (trimmed.startsWith("eyJ")) {
    return "eyJ";
  }
  return "(other)";
}

/** Accept legacy JWT anon keys and Supabase publishable keys (`sb_publishable_...`). */
export function isValidSupabaseAnonKey(key) {
  const trimmed = String(key || "").trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("eyJ")) {
    return true;
  }
  if (trimmed.startsWith("sb_publishable_")) {
    return true;
  }
  return trimmed.length >= 20;
}

export function getSupabaseConfigDiagnostics() {
  const { url, anonKey, mode } = readSupabaseEnv();
  return {
    hasUrl: url !== "",
    hasAnonKey: anonKey !== "" && isValidSupabaseAnonKey(anonKey),
    keyPrefix: getSupabaseAnonKeyPrefix(anonKey),
    mode,
  };
}

export function logSupabaseConfigDebug() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const shouldLog = env.DEV || env.VITE_ENABLE_AUTH_DEBUG === "true";
  if (!shouldLog) {
    return;
  }
  console.info("[supabase] config", getSupabaseConfigDiagnostics());
}

export function getSupabaseConfigError() {
  const { url, anonKey } = readSupabaseEnv();

  if (url === "") {
    return SUPABASE_CONFIG_ERROR;
  }

  if (anonKey === "") {
    return SUPABASE_CONFIG_ERROR;
  }

  if (!isValidSupabaseAnonKey(anonKey)) {
    return "VITE_SUPABASE_ANON_KEY không hợp lệ. Dùng anon key (eyJ...) hoặc publishable key (sb_publishable_...).";
  }

  return null;
}

export function hasSupabaseConfig() {
  return getSupabaseConfigError() === null;
}

/** Client dùng Supabase Auth (session persist). Tách khỏi matchLiveSync. */
export function getSupabaseAuthClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const { url, anonKey } = readSupabaseEnv();

  if (!authClient) {
    authClient = createClient(url, anonKey, {
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

logSupabaseConfigDebug();
