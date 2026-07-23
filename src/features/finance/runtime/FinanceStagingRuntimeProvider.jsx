/**
 * Finance Staging runtime provider for authenticated app shell (Phase 1J).
 *
 * Mounts composition only. Does not execute Finance commands/queries.
 * Does not resolve tenant at startup. Does not alter navigation/UI workflows.
 *
 * Flag default OFF → disabled runtime (no Supabase adapter, no client fetch).
 * Staging + flag ON → injects existing authenticated client (no new client factory).
 * Production → forced disabled regardless of flag.
 */

import { useMemo } from "react";
import { hasSupabaseConfig, getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { createAuthenticatedFinanceTenantResolver } from "./adapters/createAuthenticatedFinanceTenantResolver.js";
import { createFinanceAppComposition } from "./createFinanceAppComposition.js";
import { FinanceStagingRuntimeContext } from "./FinanceStagingRuntimeContext.jsx";
import {
  readFinanceStagingEnvFromImportMeta,
  resolveFinanceStagingActivation,
} from "./stagingFlags.js";

/**
 * @param {{
 *   children: import("react").ReactNode,
 *   env?: Record<string, unknown>,
 *   appEnvironment?: string,
 *   supabaseClient?: object|null,
 *   compositionFactory?: Function,
 *   getAuthClient?: () => object|null,
 * }} props
 */
export function FinanceStagingRuntimeProvider({
  children,
  env,
  appEnvironment,
  supabaseClient,
  compositionFactory,
  getAuthClient,
}) {
  const composition = useMemo(() => {
    const resolvedEnv = env ?? readFinanceStagingEnvFromImportMeta();
    const activation = resolveFinanceStagingActivation({
      env: resolvedEnv,
      appEnvironment,
    });

    /** @type {Parameters<typeof createFinanceAppComposition>[0]} */
    const options = {
      env: resolvedEnv,
      appEnvironment: activation.environment,
    };

    if (activation.activate) {
      const resolveClient =
        typeof getAuthClient === "function" ? getAuthClient : getSupabaseAuthClient;
      const injected =
        supabaseClient !== undefined
          ? supabaseClient
          : hasSupabaseConfig()
            ? resolveClient()
            : null;
      options.supabaseClient = injected;
      options.tenantResolver = createAuthenticatedFinanceTenantResolver();
    }

    const compose = compositionFactory || createFinanceAppComposition;
    try {
      return compose(options);
    } catch {
      // Fail closed for app-shell stability — never crash the shell.
      return createFinanceAppComposition({
        forceDisabled: true,
        appEnvironment: activation.environment,
        disableReason: "composition-failed-closed",
      });
    }
  }, [
    env,
    appEnvironment,
    supabaseClient,
    compositionFactory,
    getAuthClient,
  ]);

  return (
    <FinanceStagingRuntimeContext.Provider value={composition}>
      {children}
    </FinanceStagingRuntimeContext.Provider>
  );
}
