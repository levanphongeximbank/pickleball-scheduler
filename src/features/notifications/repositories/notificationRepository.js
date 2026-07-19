import { hasSupabaseConfig, getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { createMemoryNotificationRepository } from "./memoryNotificationRepository.js";
import { createLocalNotificationRepository } from "./localNotificationRepository.js";
import { createSupabaseNotificationRepository } from "./supabaseNotificationRepository.js";

export const NOTIFICATION_STORE_MODES = Object.freeze({
  MEMORY: "memory",
  LOCAL: "local",
  SUPABASE: "supabase",
});

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env?.[name] !== undefined) {
    return import.meta.env[name];
  }
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[name] !== undefined) return nodeEnv[name];
  return undefined;
}

/**
 * Resolve persistence mode.
 * - memory: tests / forced
 * - supabase: when configured (canonical SoT)
 * - local: localStorage fallback (dev without Supabase)
 */
export function resolveNotificationStoreMode() {
  const forced = readEnvFlag("VITE_NOTIFICATION_STORE_MODE");
  if (forced && Object.values(NOTIFICATION_STORE_MODES).includes(forced)) {
    return forced;
  }
  if (
    readEnvFlag("NODE_ENV") === "test" ||
    readEnvFlag("VITEST") === "true" ||
    readEnvFlag("VITE_NOTIFICATION_STORE_MODE") === "memory"
  ) {
    // Prefer explicit memory only when forced; node:test often has NODE_ENV unset.
  }
  if (forced === NOTIFICATION_STORE_MODES.MEMORY) {
    return NOTIFICATION_STORE_MODES.MEMORY;
  }
  if (hasSupabaseConfig() && readEnvFlag("VITE_NOTIFICATION_SUPABASE") !== "false") {
    return NOTIFICATION_STORE_MODES.SUPABASE;
  }
  return NOTIFICATION_STORE_MODES.LOCAL;
}

function requireSupabaseOrThrow(client) {
  const required =
    String(readEnvFlag("VITE_NOTIFICATION_REQUIRE_SUPABASE") || "").toLowerCase() ===
      "true" ||
    String(readEnvFlag("VITE_NOTIFICATION_STORE_MODE") || "") ===
      NOTIFICATION_STORE_MODES.SUPABASE;
  if (!client && required) {
    throw new Error(
      "Notification Supabase repository required but client is unavailable. Refusing silent local fallback."
    );
  }
}

let sharedRepository = null;

export function createNotificationRepository({ mode, client, seed } = {}) {
  const resolved = mode || resolveNotificationStoreMode();
  switch (resolved) {
    case NOTIFICATION_STORE_MODES.MEMORY:
      return createMemoryNotificationRepository(seed);
    case NOTIFICATION_STORE_MODES.SUPABASE: {
      const supabaseClient = client || getSupabaseAuthClient();
      requireSupabaseOrThrow(supabaseClient);
      if (!supabaseClient) {
        return createLocalNotificationRepository();
      }
      return createSupabaseNotificationRepository(supabaseClient);
    }
    case NOTIFICATION_STORE_MODES.LOCAL:
    default:
      return createLocalNotificationRepository();
  }
}

export function getNotificationRepository(options = {}) {
  if (!sharedRepository || options.forceNew) {
    sharedRepository = createNotificationRepository(options);
  }
  return sharedRepository;
}

export function setNotificationRepository(repository) {
  sharedRepository = repository || null;
}

export function resetNotificationRepository() {
  if (sharedRepository && typeof sharedRepository.clear === "function") {
    sharedRepository.clear();
  }
  sharedRepository = null;
}
