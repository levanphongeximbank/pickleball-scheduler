/**
 * COACHING-04 — Runtime gate wiring remediation.
 * Build-time Owner GO flag + default composition fail-closed rules.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_RUNTIME_MODE,
  COACHING_RUNTIME_ERROR_CODES,
  COACHING_PLAYER_SCOPE_STATE,
  createCoachingRuntime,
  createDefaultCoachingRuntime,
  resetDefaultCoachingRuntime,
  getCoachingLegacyIsolationContract,
  resolveCoachingStagingDurableActivation,
  COACHING_STAGING_DURABLE_RUNTIME_FLAG,
  COACHING_STAGING_OWNER_GO_GRANTED_FLAG,
  COACHING_STAGING_DURABLE_ACTIVATION_REASON,
  COACHING_04_STAGING_PROJECT_REF,
} from "../src/features/coaching/runtime/index.js";
import { PLAYER_IDENTITY_MAPPING_STATUS } from "../src/features/player/constants/identityMapping.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_URL = `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`;

function stagingEnv(extra = {}) {
  return {
    VITE_APP_ENV: "staging",
    [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
    [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
    VITE_SUPABASE_URL: STAGING_URL,
    ...extra,
  };
}

test("missing app env → LEGACY / refused (unknown-environment)", () => {
  resetDefaultCoachingRuntime();
  const gate = resolveCoachingStagingDurableActivation({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(gate.activate, false);
  assert.equal(
    gate.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT
  );

  const runtime = createDefaultCoachingRuntime({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
});

test("missing durable flag → refused (flag-off)", () => {
  resetDefaultCoachingRuntime();
  const gate = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(gate.activate, false);
  assert.equal(gate.reason, COACHING_STAGING_DURABLE_ACTIVATION_REASON.FLAG_OFF);

  const runtime = createDefaultCoachingRuntime({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
});

test("missing Owner GO flag → OWNER_GO_NOT_GRANTED", () => {
  resetDefaultCoachingRuntime();
  const gate = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(gate.activate, false);
  assert.equal(
    gate.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.OWNER_GO_NOT_GRANTED
  );

  const runtime = createDefaultCoachingRuntime({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
});

test("all three Staging flags → durable active (no ownerGoGranted override)", () => {
  resetDefaultCoachingRuntime();
  const gate = resolveCoachingStagingDurableActivation({
    env: stagingEnv(),
  });
  assert.equal(gate.activate, true);
  assert.equal(
    gate.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.STAGING_ENABLED
  );
  assert.equal(gate.ownerGoGranted, true);

  const runtime = createDefaultCoachingRuntime({ env: stagingEnv() });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.DURABLE);
  assert.equal(runtime.isDurable, true);
});

test("Production + all three flags → still refused", () => {
  resetDefaultCoachingRuntime();
  const gate = resolveCoachingStagingDurableActivation({
    env: stagingEnv({ VITE_APP_ENV: "production" }),
  });
  assert.equal(gate.activate, false);
  assert.equal(
    gate.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
  );
  assert.equal(gate.ownerGoGranted, false);
  assert.equal(gate.productionAuthorized, false);

  const runtime = createDefaultCoachingRuntime({
    env: stagingEnv({ VITE_APP_ENV: "production" }),
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
});

test("PLAYER unmapped → UNMAPPED; COACH assignment scope fail closed", async () => {
  const coach = createCoachingRuntime({
    mode: COACHING_RUNTIME_MODE.DURABLE,
    resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
    resolveActor: () => ({ actorId: "coach-1" }),
    requirePlayerSelfScope: false,
  });
  const coachResult = await coach.listCollection("schedule", "c");
  assert.equal(coachResult.ok, false);
  assert.notEqual(
    coachResult.code,
    COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED
  );

  const player = createCoachingRuntime({
    mode: COACHING_RUNTIME_MODE.DURABLE,
    resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
    resolveActor: () => ({ actorId: "player-1" }),
    requirePlayerSelfScope: true,
    resolvePlayerSelfScope: async () => ({
      ok: false,
      state: COACHING_PLAYER_SCOPE_STATE.UNMAPPED,
      status: PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
      playerId: null,
      error: {
        ok: false,
        code: COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED,
        error: "UNMAPPED",
      },
    }),
  });
  const playerResult = await player.listCollection("packages", "c");
  assert.equal(playerResult.ok, false);
  assert.equal(
    playerResult.code,
    COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED
  );
  assert.equal(
    playerResult.details?.playerScopeState,
    COACHING_PLAYER_SCOPE_STATE.UNMAPPED
  );
});

test("no silent localStorage fallback; defaults remain false", async () => {
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);

  globalThis.__COACHING_LEGACY_TELEMETRY__ = [];
  const contract = getCoachingLegacyIsolationContract();
  assert.equal(contract.silentSuccessOnDurableFailure, false);
  assert.equal(contract.retired, false);

  const runtime = createCoachingRuntime({
    mode: COACHING_RUNTIME_MODE.DURABLE,
    resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
    resolveActor: () => ({ actorId: "a1" }),
  });
  const result = await runtime.listCollection("coaches", "c");
  assert.equal(result.ok, false);
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.DURABLE);
  assert.ok(
    globalThis.__COACHING_LEGACY_TELEMETRY__.some(
      (e) => e.event === "silent_fallback_blocked" && e.silentFallback === false
    )
  );
  delete globalThis.__COACHING_LEGACY_TELEMETRY__;

  const durableSrc = readFileSync(
    path.join(ROOT, "src/features/coaching/runtime/createDurableCoachingAdapter.js"),
    "utf8"
  );
  assert.doesNotMatch(durableSrc, /from\s+['"].*coachingService/);
  assert.doesNotMatch(durableSrc, /localStorage\.(getItem|setItem|removeItem)/);

  const compositionSrc = readFileSync(
    path.join(ROOT, "src/features/coaching/runtime/createDefaultCoachingRuntime.js"),
    "utf8"
  );
  assert.match(compositionSrc, /VITE_COACHING_STAGING_OWNER_GO_GRANTED/);
  assert.doesNotMatch(
    compositionSrc,
    /ownerGoGranted:\s*false/
  );
});
