/**
 * COACHING-04 — Guarded Runtime Cutover package lock.
 * Defaults remain inactive. Production refused. mappingRows=0 → PLAYER UNMAPPED gate.
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
  buildRetirementPlan,
  assertRetirementNotActivated,
  resolveCoachingStagingDurableActivation,
  COACHING_STAGING_DURABLE_RUNTIME_FLAG,
  COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING,
  COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT,
  COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
  COACHING_STAGING_DURABLE_ACTIVATION_REASON,
} from "../src/features/coaching/runtime/index.js";
import { PLAYER_IDENTITY_MAPPING_STATUS } from "../src/features/player/constants/identityMapping.js";
import {
  evaluateCoaching04RuntimeCutoverGates,
  COACHING_04_RUNTIME_CUTOVER_VERDICTS,
  COACHING_04_PR292_CERTIFICATION_COMMIT,
  COACHING_04_PR292_MERGE_COMMIT,
  COACHING_04_STAGING_PROJECT_REF,
  COACHING_04_RUNTIME_CUTOVER_DIR,
  COACHING_04_RUNTIME_CUTOVER_APPROVAL_PACKAGE,
} from "../scripts/coaching/coaching-04-runtime-cutover-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readPack(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readPack(rel));
}

test("runtime state: defaults inactive; classification A with PLAYER UNMAPPED gate", () => {
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
  assert.equal(
    COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION,
    "COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE"
  );
  resetDefaultCoachingRuntime();
  const runtime = createDefaultCoachingRuntime();
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
  assert.equal(runtime.isDurable, false);
});

test("Staging-only gate: Production refused; flag-off default; GO required", () => {
  const prod = resolveCoachingStagingDurableActivation({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_APP_ENV: "production",
      VITE_SUPABASE_URL: `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
    },
    ownerGoGranted: true,
  });
  assert.equal(prod.activate, false);
  assert.equal(
    prod.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
  );

  const off = resolveCoachingStagingDurableActivation({
    env: { VITE_APP_ENV: "staging" },
    ownerGoGranted: true,
  });
  assert.equal(off.activate, false);
  assert.equal(off.reason, COACHING_STAGING_DURABLE_ACTIVATION_REASON.FLAG_OFF);

  const noGo = resolveCoachingStagingDurableActivation({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
    },
    ownerGoGranted: false,
  });
  assert.equal(noGo.activate, false);
  assert.equal(
    noGo.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.OWNER_GO_NOT_GRANTED
  );

  const stagingOk = resolveCoachingStagingDurableActivation({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
    },
    ownerGoGranted: true,
  });
  assert.equal(stagingOk.activate, true);
  assert.equal(
    stagingOk.ownerGoToken,
    COACHING_04_OWNER_GO_RUNTIME_CUTOVER_STAGING
  );
});

test("default composition does not activate Staging durable without Owner GO", () => {
  resetDefaultCoachingRuntime();
  const runtime = createDefaultCoachingRuntime({
    env: {
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`,
    },
    ownerGoGranted: false,
  });
  assert.equal(runtime.mode, COACHING_RUNTIME_MODE.LEGACY);
});

test("no silent fallback: durable failure stays durable + telemetry", async () => {
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
});

test("PLAYER unmapped fail-closed; COACH durable scope skips mapping", async () => {
  const coachRuntime = createCoachingRuntime({
    mode: COACHING_RUNTIME_MODE.DURABLE,
    resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
    resolveActor: () => ({ actorId: "coach-1" }),
    requirePlayerSelfScope: false,
  });
  // Missing durable deps → ERROR, not UNMAPPED (COACH path independent of mapping).
  const coachResult = await coachRuntime.listCollection("schedule", "c");
  assert.equal(coachResult.ok, false);
  assert.notEqual(
    coachResult.code,
    COACHING_RUNTIME_ERROR_CODES.PLAYER_SELF_SCOPE_BLOCKED
  );

  const playerRuntime = createCoachingRuntime({
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
  const playerResult = await playerRuntime.listCollection("packages", "c");
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

test("localStorage retirement deferred; rollback adapter retained", () => {
  assert.equal(assertRetirementNotActivated(), true);
  const plan = buildRetirementPlan({ clubId: "club-x", confirmed: true });
  assert.equal(plan.activated, false);
  assert.equal(plan.localStorageRetired, false);
  assert.equal(plan.silentUpload, false);

  const legacy = createCoachingRuntime({ mode: COACHING_RUNTIME_MODE.LEGACY });
  assert.equal(legacy.isLegacy, true);
  assert.equal(
    COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT,
    "COACHING_04_OWNER_GO_LOCALSTORAGE_RETIREMENT"
  );
});

test("preflight gates refuse without Owner GO; Production refused", () => {
  const refused = evaluateCoaching04RuntimeCutoverGates({
    ownerGoGranted: false,
    durableRuntimeDefault: false,
    localStorageRetired: false,
    mappingRowCount: 0,
  });
  assert.equal(refused.ok, false);
  assert.equal(refused.canActivate, false);
  assert.equal(refused.runtimeActivated, false);
  assert.equal(
    refused.verdict,
    COACHING_04_RUNTIME_CUTOVER_VERDICTS.REFUSED_OWNER_GO_NOT_GRANTED
  );
  assert.equal(
    refused.mappingReadinessClassification,
    COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION
  );

  const prod = evaluateCoaching04RuntimeCutoverGates({
    ownerGoGranted: true,
    productionTarget: true,
  });
  assert.equal(
    prod.verdict,
    COACHING_04_RUNTIME_CUTOVER_VERDICTS.PRODUCTION_REFUSED
  );
});

test("cutover package artifacts + PR #292 pins present", () => {
  const docs = [
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/00_COACHING_04_RUNTIME_CUTOVER_RUNBOOK.md`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/01_COACHING_04_STAGING_ONLY_ACTIVATION.md`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/02_COACHING_04_PROVENANCE_AND_NO_SILENT_FALLBACK.md`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/03_COACHING_04_LOCALSTORAGE_RETIREMENT_AND_ROLLBACK.md`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/04_COACHING_04_MAPPING_READINESS_GATE.md`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/05_COACHING_04_FAILURE_CLASSIFICATION.md`,
    COACHING_04_RUNTIME_CUTOVER_APPROVAL_PACKAGE,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/OWNER_RUNTIME_CUTOVER_APPROVAL.template.json`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/evidence/RUNTIME_CUTOVER_REFUSED_NO_GO.json`,
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/evidence/POST_MERGE_PR292_VERIFICATION.json`,
  ];
  for (const rel of docs) {
    assert.ok(existsSync(path.join(ROOT, rel)), rel);
  }

  const approval = readJson(COACHING_04_RUNTIME_CUTOVER_APPROVAL_PACKAGE);
  assert.equal(approval.approved, false);
  assert.equal(approval.ownerGoGranted, false);
  assert.equal(approval.runtimeActivated, false);
  assert.equal(approval.localStorageRetired, false);
  assert.equal(approval.mappingRowCount, 0);
  assert.equal(approval.pr292CertificationCommit, COACHING_04_PR292_CERTIFICATION_COMMIT);
  assert.equal(approval.pr292MergeCommit, COACHING_04_PR292_MERGE_COMMIT);
  assert.equal(
    approval.mappingReadinessClassification,
    COACHING_04_RUNTIME_CUTOVER_CLASSIFICATION
  );

  const refused = readJson(
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/evidence/RUNTIME_CUTOVER_REFUSED_NO_GO.json`
  );
  assert.equal(
    refused.verdict,
    "COACHING_04_RUNTIME_CUTOVER_REFUSED_OWNER_GO_NOT_GRANTED"
  );
  assert.equal(refused.canActivate, false);

  const postMerge = readJson(
    `${COACHING_04_RUNTIME_CUTOVER_DIR}/evidence/POST_MERGE_PR292_VERIFICATION.json`
  );
  assert.equal(postMerge.prState, "MERGED");
  assert.equal(postMerge.certificationCommitIsAncestorOfOriginMain, true);
  assert.equal(postMerge.mergeCommitIsAncestorOfOriginMain, true);

  assert.match(
    readPack(
      `${COACHING_04_RUNTIME_CUTOVER_DIR}/00_COACHING_04_RUNTIME_CUTOVER_RUNBOOK.md`
    ),
    /COACHING_04_RUNTIME_CUTOVER_READY_WITH_PLAYER_UNMAPPED_GATE/
  );
});

test("durable adapter never imports coachingService (source lock)", () => {
  const durableSrc = readPack(
    "src/features/coaching/runtime/createDurableCoachingAdapter.js"
  );
  assert.doesNotMatch(durableSrc, /from\s+['"].*coachingService/);
  assert.doesNotMatch(durableSrc, /localStorage\.(getItem|setItem|removeItem)/);
  const constants = readPack("src/features/coaching/runtime/constants.js");
  assert.match(constants, /COACHING_DURABLE_RUNTIME_DEFAULT\s*=\s*false/);
  assert.match(constants, /LOCALSTORAGE_RETIRED\s*=\s*false/);
});
