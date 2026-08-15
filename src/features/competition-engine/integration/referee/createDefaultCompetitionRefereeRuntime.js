/**
 * Canonical default application/backend composition for E2E-04.
 *
 * One shared boundary: always constructs createCompetitionRefereeProductionRuntime.
 * Production missing durableDriver/rpcClient → fail closed.
 * In-memory is never a production default (TEST_DOUBLE_ONLY, explicit test DI only).
 * Privileged rpcClient execution remains server/Edge injected — never from Vite env.
 */

import {
  REFEREE_ADAPTER_ERROR_CODE,
} from "./constants.js";
import { failRefereeAdapter } from "./errors.js";
import { createCompetitionRefereeProductionRuntime } from "./createCompetitionRefereeProductionRuntime.js";
import { createLiveRpcCanonicalRefereeDurableDriver } from "./createLiveRpcCanonicalRefereeDurableDriver.js";
import {
  assertNoClientServiceRoleEnv,
  assertServerOnlyPrivilegedRefereeComposition,
} from "./privilegedCompositionBoundary.js";

/**
 * @param {{
 *   durableDriver?: object,
 *   rpcClient?: { rpc: Function, from?: Function },
 *   allowTestDoubleDriver?: boolean,
 *   runtimePorts?: object,
 *   clockIso?: string,
 *   env?: Record<string, unknown>,
 * }} [options]
 */
export function createDefaultCompetitionRefereeRuntime(options = {}) {
  assertNoClientServiceRoleEnv(options.env);

  const rpcClient = options.rpcClient || null;
  if (rpcClient) {
    assertServerOnlyPrivilegedRefereeComposition();
  }

  const durableDriver =
    options.durableDriver ||
    (rpcClient
      ? createLiveRpcCanonicalRefereeDurableDriver({
          rpcClient,
          clockIso: options.clockIso,
        })
      : null);

  if (!durableDriver) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Default referee application composition requires durableDriver or rpcClient; in-memory is TEST_DOUBLE_ONLY",
      {}
    );
  }

  return createCompetitionRefereeProductionRuntime({
    durableDriver,
    allowTestDoubleDriver: options.allowTestDoubleDriver === true,
    runtimePorts: options.runtimePorts,
    clockIso: options.clockIso,
  });
}
