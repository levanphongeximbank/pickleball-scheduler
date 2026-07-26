/**
 * COACHING-04 — Staging runtime activation pin lock.
 * Defaults remain inactive. Owner GO not granted. No deployment mutation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
  COACHING_STAGING_DURABLE_ACTIVATION_REASON,
  COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
} from "../src/features/coaching/runtime/index.js";
import { PLAYER_IDENTITY_MAPPING_STATUS } from "../src/features/player/constants/identityMapping.js";
import {
  evaluateCoaching04RuntimeActivationPreflight,
  computeActivationManifestHash,
  COACHING_04_RUNTIME_ACTIVATION_VERDICTS,
  COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION,
  COACHING_04_PR295_MERGE_COMMIT,
  COACHING_04_PR295_HEAD_OID,
  COACHING_04_FRESH_ORIGIN_MAIN,
  COACHING_04_RUNTIME_PACKAGE_COMMIT,
  COACHING_04_STAGING_PROJECT_REF,
  COACHING_04_RUNTIME_ACTIVATION_DIR,
  COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE,
  COACHING_04_STAGING_RUNTIME_EXPECTED_ENV,
  COACHING_04_STAGING_RUNTIME_CURRENT_ENV,
  COACHING_04_RUNTIME_ACTIVATION_MANIFEST_FILES,
} from "../scripts/coaching/coaching-04-runtime-activation-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readPack(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readPack(rel));
}

test("Staging durable gate requires env + flag + Owner GO together", () => {
  const stagingRefUrl = `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`;

  const missingFlag = resolveCoachingStagingDurableActivation({
    env: { VITE_APP_ENV: "staging", VITE_SUPABASE_URL: stagingRefUrl },
    ownerGoGranted: true,
  });
  assert.equal(missingFlag.activate, false);
  assert.equal(
    missingFlag.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.FLAG_OFF
  );

  const missingGo = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: stagingRefUrl,
    },
    ownerGoGranted: false,
  });
  assert.equal(missingGo.activate, false);
  assert.equal(
    missingGo.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.OWNER_GO_NOT_GRANTED
  );

  const missingEnv = resolveCoachingStagingDurableActivation({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: stagingRefUrl,
    },
    ownerGoGranted: true,
  });
  assert.equal(missingEnv.activate, false);
  assert.equal(
    missingEnv.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.UNKNOWN_ENVIRONMENT
  );

  const all = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: stagingRefUrl,
    },
    ownerGoGranted: true,
  });
  assert.equal(all.activate, true);
  assert.equal(all.ownerGoToken, COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING);
});

test("Production refusal even when Staging flag is true", () => {
  const prod = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "production",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
    },
    ownerGoGranted: true,
  });
  assert.equal(prod.activate, false);
  assert.equal(
    prod.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
  );

  const wrongRef = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co",
    },
    ownerGoGranted: true,
  });
  assert.equal(wrongRef.activate, false);
  assert.equal(
    wrongRef.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.STAGING_REF_MISMATCH
  );

  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
});

test("PLAYER UNMAPPED fail-closed at mappingRows=0; COACH independent", async () => {
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

test("no silent localStorage fallback; durable never imports coachingService", async () => {
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
      (e) => e.event === "silent_fallback_blocked"
    )
  );
  delete globalThis.__COACHING_LEGACY_TELEMETRY__;

  const durableSrc = readPack(
    "src/features/coaching/runtime/createDurableCoachingAdapter.js"
  );
  assert.doesNotMatch(durableSrc, /from\s+['"].*coachingService/);
  assert.doesNotMatch(durableSrc, /localStorage\.(getItem|setItem|removeItem)/);
});

test("rollback switch: disable Staging gate returns legacy without flipping defaults", () => {
  resetDefaultCoachingRuntime();
  const stagingRefUrl = `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`;

  const armed = createDefaultCoachingRuntime({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_SUPABASE_URL: stagingRefUrl,
    },
    ownerGoGranted: true,
  });
  assert.equal(armed.mode, COACHING_RUNTIME_MODE.DURABLE);

  resetDefaultCoachingRuntime();
  const rolledBack = createDefaultCoachingRuntime({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "false",
      VITE_SUPABASE_URL: stagingRefUrl,
    },
    ownerGoGranted: true,
  });
  assert.equal(rolledBack.mode, COACHING_RUNTIME_MODE.LEGACY);
  assert.equal(rolledBack.isLegacy, true);
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
});

test("activation pin artifacts + PR #295 pins + refuse preflight", () => {
  for (const rel of COACHING_04_RUNTIME_ACTIVATION_MANIFEST_FILES) {
    assert.ok(existsSync(path.join(ROOT, rel)), rel);
  }
  assert.ok(
    existsSync(
      path.join(
        ROOT,
        `${COACHING_04_RUNTIME_ACTIVATION_DIR}/evidence/POST_MERGE_PR295_VERIFICATION.json`
      )
    )
  );
  assert.ok(
    existsSync(
      path.join(
        ROOT,
        `${COACHING_04_RUNTIME_ACTIVATION_DIR}/evidence/ACTIVATION_PREFLIGHT_OFFLINE.json`
      )
    )
  );

  const pin = readJson(COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE);
  assert.equal(pin.executionStatus, "AWAITING_OWNER_GO");
  assert.equal(pin.classification, COACHING_04_RUNTIME_ACTIVATION_CLASSIFICATION);
  assert.equal(pin.pr295MergeCommit, COACHING_04_PR295_MERGE_COMMIT);
  assert.equal(pin.pr295HeadOid, COACHING_04_PR295_HEAD_OID);
  assert.equal(pin.runtimePackageCommit, COACHING_04_RUNTIME_PACKAGE_COMMIT);
  assert.equal(pin.freshOriginMain, COACHING_04_FRESH_ORIGIN_MAIN);
  assert.equal(pin.mappingRowCount, 0);
  assert.equal(pin.playerExpectedState, "UNMAPPED");
  assert.equal(pin.runtimeActivated, false);
  assert.equal(pin.localStorageRetired, false);
  assert.equal(pin.durableRuntimeDefault, false);
  assert.equal(pin.ownerGoGranted, false);
  assert.equal(pin.deploymentMutation, false);
  assert.deepEqual(
    pin.expectedEnvValuesAfterOwnerGo,
    { ...COACHING_04_STAGING_RUNTIME_EXPECTED_ENV }
  );
  assert.deepEqual(
    pin.currentEnvValuesPreOwnerGo,
    { ...COACHING_04_STAGING_RUNTIME_CURRENT_ENV }
  );
  assert.equal(pin.rollbackSwitch.databaseRollbackRequired, false);
  assert.equal(pin.rollbackSwitch.legacyAdapterRetained, true);

  const preflight = evaluateCoaching04RuntimeActivationPreflight({
    ownerGoGranted: false,
    mappingRowCount: 0,
  });
  assert.equal(preflight.canActivate, false);
  assert.equal(
    preflight.verdict,
    COACHING_04_RUNTIME_ACTIVATION_VERDICTS.PREFLIGHT_REFUSED_OWNER_GO_NOT_GRANTED
  );

  const evidence = readJson(
    `${COACHING_04_RUNTIME_ACTIVATION_DIR}/evidence/ACTIVATION_PREFLIGHT_OFFLINE.json`
  );
  assert.equal(evidence.canActivate, false);
  assert.equal(evidence.runtimeActivated, false);

  const postMerge = readJson(
    `${COACHING_04_RUNTIME_ACTIVATION_DIR}/evidence/POST_MERGE_PR295_VERIFICATION.json`
  );
  assert.equal(postMerge.prState, "MERGED");
  assert.equal(postMerge.mergeCommitIsAncestorOfOriginMain, true);

  const hash = computeActivationManifestHash(ROOT);
  assert.match(hash, /^[0-9a-f]{64}$/);

  assert.match(
    readPack(
      `${COACHING_04_RUNTIME_ACTIVATION_DIR}/00_COACHING_04_STAGING_RUNTIME_ACTIVATION_PIN.md`
    ),
    /COACHING_04_STAGING_RUNTIME_ACTIVATION_READY_AWAITING_OWNER_GO/
  );
});

test("runtime states contract documented and player states exported", () => {
  const pin = readJson(COACHING_04_RUNTIME_ACTIVATION_PIN_RELATIVE);
  assert.deepEqual(pin.runtimeStates, [
    "LOADING",
    "LIVE",
    "EMPTY",
    "UNMAPPED",
    "FORBIDDEN",
    "ERROR",
  ]);
  for (const state of pin.runtimeStates) {
    assert.equal(COACHING_PLAYER_SCOPE_STATE[state], state);
  }
});
