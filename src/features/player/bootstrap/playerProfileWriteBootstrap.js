/**
 * Canonical Player Management write-repository bootstrap (authenticated web app).
 *
 * - When Supabase anon/session client is configured → durable profiles writer
 * - Otherwise → unconfigured (safe fail; no silent durable success)
 * - Never installs a privileged server key in browser/runtime
 * - Tests may still inject memory / unconfigured / custom doubles via options.writeRepository
 */
import { getSupabaseAuthClient, hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import {
  createSupabaseProfilesPlayerWriteRepository,
  createUnconfiguredPlayerProfileWriteRepository,
} from "../repositories/playerProfileWriteRepository.js";

/**
 * @param {object} [deps]
 * @param {() => boolean} [deps.hasConfig]
 * @param {() => object|null} [deps.getClient]
 * @param {object} [deps.supabase] — optional pre-built authenticated client
 * @param {Function} [deps.createDurableRepository]
 * @param {Function} [deps.createUnconfiguredRepository]
 */
export function createDefaultPlayerProfileWriteRepository(deps = {}) {
  const hasConfig = deps.hasConfig || hasSupabaseConfig;
  const getClient =
    deps.getClient ||
    (deps.supabase ? () => deps.supabase : null) ||
    getSupabaseAuthClient;
  const createDurable =
    deps.createDurableRepository || createSupabaseProfilesPlayerWriteRepository;
  const createUnconfigured =
    deps.createUnconfiguredRepository || createUnconfiguredPlayerProfileWriteRepository;

  if (!hasConfig()) {
    return createUnconfigured();
  }

  const client = typeof getClient === "function" ? getClient() : null;
  if (!client) {
    return createUnconfigured();
  }

  return createDurable({
    hasConfig,
    getClient: () => client,
    supabase: client,
  });
}

/**
 * Explicit runtime wiring helper for app bootstrap / Identity bridge.
 * Prefer this over constructing repositories ad hoc in screens.
 *
 * @param {object} [options]
 * @param {object} [options.supabase] — authenticated session/anon client
 */
export function createRuntimePlayerProfileWriteRepository(options = {}) {
  return createDefaultPlayerProfileWriteRepository({
    supabase: options.supabase,
    getClient: options.getClient,
    hasConfig: options.hasConfig,
  });
}
