/**
 * Phase 1.4 — Notification runtime bootstrap.
 *
 * Single entry for repository + identity directory initialization.
 * Never prints secrets. Never uses service_role in the browser.
 */
import { hasSupabaseConfig, getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import {
  createNotificationRepository,
  getNotificationRepository,
  resetNotificationRepository,
  resolveNotificationStoreMode,
  setNotificationRepository,
  NOTIFICATION_STORE_MODES,
} from "../repositories/notificationRepository.js";
import { ensureIdentityRecipientDirectory } from "../recipients/recipientBootstrap.js";
import { createCompetitionEntryResolver } from "../recipients/competitionEntryResolver.js";

function readEnvFlag(name) {
  if (typeof import.meta !== "undefined" && import.meta.env?.[name] !== undefined) {
    return import.meta.env[name];
  }
  const nodeEnv = globalThis.process?.env;
  if (nodeEnv?.[name] !== undefined) return nodeEnv[name];
  return undefined;
}

function isRequireSupabase() {
  return (
    String(readEnvFlag("VITE_NOTIFICATION_REQUIRE_SUPABASE") || "").toLowerCase() ===
      "true" ||
    String(readEnvFlag("VITE_NOTIFICATION_STORE_MODE") || "") ===
      NOTIFICATION_STORE_MODES.SUPABASE
  );
}

const runtimeState = {
  mode: null,
  initialized: false,
  authenticated: false,
  lastError: null,
  requireSupabase: false,
};

/** Safe runtime status (no secrets). */
export function getNotificationRuntimeStatus() {
  return {
    mode: runtimeState.mode,
    initialized: runtimeState.initialized,
    authenticated: runtimeState.authenticated,
    lastError: runtimeState.lastError,
    requireSupabase: runtimeState.requireSupabase,
  };
}

export function resetNotificationRuntime() {
  resetNotificationRepository();
  runtimeState.mode = null;
  runtimeState.initialized = false;
  runtimeState.authenticated = false;
  runtimeState.lastError = null;
  runtimeState.requireSupabase = false;
}

/**
 * Bootstrap notification repository + identity directory.
 */
export async function bootstrapNotificationRuntime(options = {}) {
  runtimeState.requireSupabase = isRequireSupabase();
  runtimeState.lastError = null;

  const mode = options.mode || resolveNotificationStoreMode();
  runtimeState.mode = mode;

  try {
    if (mode === NOTIFICATION_STORE_MODES.SUPABASE) {
      const client = options.client || getSupabaseAuthClient();
      if (!client) {
        const err =
          "Notification Supabase repository required but client is unavailable. Refusing silent local fallback.";
        if (runtimeState.requireSupabase) {
          runtimeState.initialized = false;
          runtimeState.lastError = err;
          throw new Error(err);
        }
        // Explicit local only when REQUIRE_SUPABASE is false.
        setNotificationRepository(
          createNotificationRepository({ mode: NOTIFICATION_STORE_MODES.LOCAL })
        );
        runtimeState.mode = NOTIFICATION_STORE_MODES.LOCAL;
        runtimeState.initialized = true;
        runtimeState.authenticated = Boolean(options.authenticated);
        runtimeState.lastError =
          "Supabase client unavailable; using explicit local mode (REQUIRE_SUPABASE=false).";
      } else {
        setNotificationRepository(
          createNotificationRepository({
            mode: NOTIFICATION_STORE_MODES.SUPABASE,
            client,
          })
        );
        runtimeState.initialized = true;
        runtimeState.authenticated = Boolean(options.authenticated);
      }
    } else {
      setNotificationRepository(
        createNotificationRepository({
          mode,
          client: options.client,
          seed: options.seed,
        })
      );
      runtimeState.initialized = true;
      runtimeState.authenticated = Boolean(options.authenticated);
    }

    const entryResolver =
      typeof options.entryResolver === "function"
        ? options.entryResolver
        : createCompetitionEntryResolver({
            tournament: options.tournament,
            clubId: options.clubId,
            entryIndex: options.entryIndex,
            loadTournament: options.loadTournament,
          });

    const directory = ensureIdentityRecipientDirectory({
      entryResolver,
      allowUnverifiedUserIds: options.allowUnverifiedUserIds === true,
      client: options.client || null,
      profiles: options.profiles || undefined,
      force: true,
    });

    if (options.tenantId && typeof directory.hydrate === "function") {
      await directory.hydrate({ tenantId: options.tenantId });
    }

    return {
      ok: true,
      status: getNotificationRuntimeStatus(),
      repository: getNotificationRepository(),
      directory,
      hasSupabaseConfig: hasSupabaseConfig(),
    };
  } catch (error) {
    runtimeState.initialized = false;
    runtimeState.lastError = error?.message || String(error);
    return {
      ok: false,
      error: runtimeState.lastError,
      status: getNotificationRuntimeStatus(),
    };
  }
}

export function setNotificationRuntimeAuthenticated(authenticated) {
  runtimeState.authenticated = Boolean(authenticated);
  return getNotificationRuntimeStatus();
}
