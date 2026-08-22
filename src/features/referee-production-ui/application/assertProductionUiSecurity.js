/**
 * Browser production UI security — no service-role, no privileged RPC, no fixtures.
 */

import {
  REFEREE_ADAPTER_ERROR_CODE,
} from "../../competition-engine/integration/referee/constants.js";
import { failRefereeAdapter } from "../../competition-engine/integration/referee/errors.js";
import {
  assertNoClientServiceRoleEnv,
  isBrowserRuntime,
} from "../../competition-engine/integration/referee/privilegedCompositionBoundary.js";
import { REFEREE_UI_ERROR_CODE } from "../constants.js";

const CLIENT_SERVICE_ROLE_ENV_RE =
  /^(VITE_.*SERVICE_ROLE|.*SERVICE_ROLE_KEY)$/i;

/**
 * @param {Record<string, unknown>|null|undefined} env
 */
export function assertRefereeUiSecurity(env) {
  assertNoClientServiceRoleEnv(env);
  if (!env || typeof env !== "object") return;
  for (const key of Object.keys(env)) {
    if (!CLIENT_SERVICE_ROLE_ENV_RE.test(key)) continue;
    if (env[key] == null || env[key] === "") continue;
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
      "Service-role credentials must not be resolved from Referee UI env",
      { envKeyPresent: true }
    );
  }
}

export function assertNotPrivilegedBrowserComposition(runtime) {
  if (!runtime) return;
  if (runtime.driverKind === "live-rpc-canonical-referee-durable-driver") {
    if (isBrowserRuntime()) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.DURABLE_DEPENDENCY_REQUIRED,
        "Privileged live RPC driver must not be composed in the browser",
        { boundary: "browser-ui" }
      );
    }
  }
}

export function rejectLocationStateAuthority(locationState) {
  if (locationState && locationState.required === true) {
    const err = new Error("Referee match deep-link must not require location.state");
    err.code = REFEREE_UI_ERROR_CODE.LOCATION_STATE_FORBIDDEN;
    throw err;
  }
}

export function rejectProductionFixtureFallback(options = {}) {
  if (options.allowFixtureFallback === true) {
    const err = new Error("Production Referee UI must not use fixture fallback");
    err.code = REFEREE_UI_ERROR_CODE.FIXTURE_FALLBACK_FORBIDDEN;
    throw err;
  }
}
