import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";

export const INTEGRATION_STORE_MODES = Object.freeze({
  MEMORY: "memory",
  LOCAL: "local",
  SUPABASE: "supabase",
});

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[name];
  }
  return globalThis.process?.env?.[name];
}

export function resolveIntegrationStoreMode() {
  const forced = readEnvFlag("VITE_INTEGRATIONS_STORE_MODE");
  if (forced && Object.values(INTEGRATION_STORE_MODES).includes(forced)) {
    return forced;
  }

  if (readEnvFlag("NODE_ENV") === "test" || readEnvFlag("VITEST") === "true") {
    return INTEGRATION_STORE_MODES.MEMORY;
  }

  if (hasSupabaseConfig() && readEnvFlag("VITE_INTEGRATIONS_SUPABASE") !== "false") {
    return INTEGRATION_STORE_MODES.SUPABASE;
  }

  return INTEGRATION_STORE_MODES.LOCAL;
}
