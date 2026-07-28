import { useMemo, useState } from "react";

import {
  HARD_CUTOVER_FLAG,
  isPlatformHardCutoverEnabled,
} from "../../platform-hard-cutover/runtimeAuthorityMatrix.js";
import { resolveFinanceLedgerRuntime } from "./resolveFinanceLedgerRuntime.js";

/**
 * Page hook — resolves Finance ledger runtime from club + hard cutover flag.
 * @param {string|null|undefined} activeClubId
 * @param {{ env?: Record<string, unknown> }} [options]
 */
export function useFinanceLedgerRuntime(activeClubId, options = {}) {
  const [retryToken, setRetryToken] = useState(0);

  const runtime = useMemo(() => {
    const env =
      options.env && typeof options.env === "object"
        ? options.env
        : typeof import.meta !== "undefined" && import.meta.env
          ? import.meta.env
          : {};
    return resolveFinanceLedgerRuntime({
      env,
      clubId: activeClubId,
    });
    // retryToken forces re-resolve after retry click (flag/env rarely changes mid-session)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional retry bump
  }, [activeClubId, options.env, retryToken]);

  return {
    runtime,
    hardCutoverEnabled: isPlatformHardCutoverEnabled(
      options.env && typeof options.env === "object"
        ? options.env
        : typeof import.meta !== "undefined" && import.meta.env
          ? import.meta.env
          : {}
    ),
    retry: () => setRetryToken((value) => value + 1),
    HARD_CUTOVER_FLAG,
  };
}
