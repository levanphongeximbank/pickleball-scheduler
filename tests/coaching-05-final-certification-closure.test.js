/**
 * COACHING-05 — Final certification & Business Module 2.12 closure lock.
 * Read-only package assertions. No SQL. No env mutation. No deletions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  COACHING_DURABLE_RUNTIME_DEFAULT,
  LOCALSTORAGE_RETIRED,
  COACHING_RUNTIME_MODE,
  COACHING_RUNTIME_ERROR_CODES,
  COACHING_PLAYER_SCOPE_STATE,
  COACHING_LEGACY_STORAGE_KEY_PREFIX,
  createCoachingRuntime,
  createDefaultCoachingRuntime,
  resetDefaultCoachingRuntime,
  getCoachingLegacyIsolationContract,
  assertRetirementNotActivated,
  buildRetirementPlan,
  resolveCoachingStagingDurableActivation,
  COACHING_STAGING_DURABLE_RUNTIME_FLAG,
  COACHING_STAGING_OWNER_GO_GRANTED_FLAG,
  COACHING_STAGING_DURABLE_ACTIVATION_REASON,
  COACHING_04_STAGING_PROJECT_REF,
} from "../src/features/coaching/runtime/index.js";
import { PLAYER_IDENTITY_MAPPING_STATUS } from "../src/features/player/constants/identityMapping.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING_URL = `https://${COACHING_04_STAGING_PROJECT_REF}.supabase.co`;
const PKG_SHA =
  "D9F756CC931E32B03E48DA0C70729F4D68D30022A8D1C1E4189E4D4962E7326B";
const LOCK_SHA =
  "D40DB46D2356A87F589DF86C8F9CC369A7F97A332DFCF3AEC8CA335EE07F2516";

function readPack(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(readPack(rel));
}

function sha256File(rel) {
  const text = readFileSync(path.join(ROOT, rel), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex").toUpperCase();
}

const CLOSURE_FILES = [
  "docs/coaching-training/coaching-04/runtime-activation/evidence/POST_MERGE_PR298_VERIFICATION.json",
  "docs/coaching-training/coaching-04/localstorage-retirement/00_COACHING_04_LOCALSTORAGE_RETIREMENT_CERTIFICATION.md",
  "docs/coaching-training/coaching-04/localstorage-retirement/evidence/LOCALSTORAGE_RETIREMENT_CERTIFICATION.json",
  "docs/coaching-training/coaching-04/00_COACHING_04_FINAL_CLOSURE.md",
  "docs/coaching-training/coaching-04/evidence/COACHING_04_FINAL_CLOSURE.json",
  "docs/coaching-training/coaching-05/00_COACHING_05_FINAL_INTEGRATION_CERTIFICATION.md",
  "docs/coaching-training/coaching-05/evidence/FINAL_INTEGRATION_CERTIFICATION.json",
  "docs/coaching-training/coaching-05/certification-manifest.json",
  "docs/coaching-training/module-closure/00_BUSINESS_MODULE_2_12_CLOSURE.md",
  "docs/coaching-training/module-closure/evidence/MODULE_2_12_CLOSURE.json",
];

test("PR #298 post-merge verification evidence is present and consistent", () => {
  const v = readJson(
    "docs/coaching-training/coaching-04/runtime-activation/evidence/POST_MERGE_PR298_VERIFICATION.json"
  );
  assert.equal(v.prNumber, 298);
  assert.equal(v.prState, "MERGED");
  assert.equal(v.headCommit, "361d61cb6ed8cecdb50ee9f94f7240d5bb47ff23");
  assert.equal(v.mergeCommit, "8e98a302169150bd7a15677ce25a1ec1661e5ac5");
  assert.equal(v.headCommitIsAncestorOfOriginMain, true);
  assert.equal(v.mergeCommitIsAncestorOfOriginMain, true);
  assert.equal(v.smokeVerdict, "COACHING_04_STAGING_RUNTIME_ACTIVATED_SMOKE_PASS");
  assert.equal(v.runtimeGateActiveOnCertifiedPreview, true);
  assert.equal(v.verdict, "COACHING_04_PR298_POST_MERGE_VERIFIED");
});

test("localStorage retirement certification semantics (path only; code constant false)", () => {
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
  assert.equal(assertRetirementNotActivated(), true);

  const cert = readJson(
    "docs/coaching-training/coaching-04/localstorage-retirement/evidence/LOCALSTORAGE_RETIREMENT_CERTIFICATION.json"
  );
  assert.equal(cert.localStorageRetired, true);
  assert.equal(
    cert.localStorageRetiredSemantics,
    "ACTIVE_STAGING_DURABLE_PATH_NO_LOCALSTORAGE_USE"
  );
  assert.equal(cert.localStorageRetiredMeansAdapterDeleted, false);
  assert.equal(cert.localStorageRetiredMeansBrowserDataDeleted, false);
  assert.equal(cert.codeConstantLOCALSTORAGE_RETIRED, false);
  assert.equal(cert.legacyAdapterRetained, true);
  assert.equal(cert.silentFallbackAllowed, false);
  assert.equal(cert.durablePathTouchesLocalStorage, false);
  assert.equal(cert.rollback.databaseRollbackRequired, false);

  const plan = buildRetirementPlan({ clubId: "club-x", confirmed: true });
  assert.equal(plan.activated, false);
  assert.equal(plan.localStorageRetired, false);

  const legacy = createCoachingRuntime({ mode: COACHING_RUNTIME_MODE.LEGACY });
  assert.equal(legacy.isLegacy, true);
  assert.equal(COACHING_LEGACY_STORAGE_KEY_PREFIX, "pickleball-coaching-v1");

  const durableSrc = readPack(
    "src/features/coaching/runtime/createDurableCoachingAdapter.js"
  );
  assert.doesNotMatch(durableSrc, /localStorage\.(getItem|setItem|removeItem)/);
  assert.doesNotMatch(durableSrc, /from\s+['"].*coachingService/);
});

test("COACHING-04 final closure verdict and markers", () => {
  const closure = readJson(
    "docs/coaching-training/coaching-04/evidence/COACHING_04_FINAL_CLOSURE.json"
  );
  assert.equal(
    closure.verdict,
    "COACHING_04_STAGING_RUNTIME_AND_LOCALSTORAGE_CUTOVER_CERTIFIED_CLOSED"
  );
  assert.equal(closure.productionRuntimeRollout, false);
  assert.equal(closure.mappingRowCount, 0);
  assert.equal(closure.playerExpectedState, "UNMAPPED");
  assert.equal(closure.legacyAdapterRetained, true);
  assert.equal(closure.filesDeleted, 0);
  assert.match(
    readPack("docs/coaching-training/coaching-04/00_COACHING_04_FINAL_CLOSURE.md"),
    /COACHING_04_STAGING_RUNTIME_AND_LOCALSTORAGE_CUTOVER_CERTIFIED_CLOSED/
  );
});

test("COACHING-05 final integration certification package", () => {
  for (const rel of CLOSURE_FILES) {
    assert.ok(existsSync(path.join(ROOT, rel)), rel);
  }
  const c05 = readJson(
    "docs/coaching-training/coaching-05/evidence/FINAL_INTEGRATION_CERTIFICATION.json"
  );
  assert.equal(c05.verdict, "COACHING_05_FINAL_INTEGRATION_CERTIFIED");
  assert.equal(c05.structuralImplementation, "COMPLETE");
  assert.equal(c05.stagingActivation, "CERTIFIED");
  assert.equal(c05.productionRollout, "NOT_PERFORMED");
  assert.equal(c05.checklist.databaseWritesDuringFinalCertification, 0);
  assert.equal(c05.databaseWritesDuringFinalCertification, 0);
  assert.equal(c05.productionTouched, false);
  assert.equal(c05.mappingRowCount, 0);
  assert.equal(c05.playerExpectedState, "UNMAPPED");
  assert.deepEqual(c05.runtimeStates, [
    "LOADING",
    "LIVE",
    "EMPTY",
    "UNMAPPED",
    "FORBIDDEN",
    "ERROR",
  ]);
  assert.ok(
    c05.markers.includes("BUSINESS_MODULE_2_12_COACHING_TRAINING_IMPLEMENTATION_COMPLETE")
  );
  assert.doesNotMatch(
    JSON.stringify(c05),
    /100_PERCENT_CLOSED(?!_NOT_USED)/
  );

  const module = readJson(
    "docs/coaching-training/module-closure/evidence/MODULE_2_12_CLOSURE.json"
  );
  assert.equal(module.ok, true);
  assert.equal(module.mergeDoesNotPerformProductionRollout, true);
  assert.equal(module.forbiddenMarkerBeforePostMerge, "100_PERCENT_CLOSED");
  assert.equal(module.packageLockUnchanged, true);
});

test("Staging gate still requires three flags; Production refused; defaults false", () => {
  resetDefaultCoachingRuntime();
  const armed = createDefaultCoachingRuntime({
    env: {
      VITE_APP_ENV: "staging",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(armed.mode, COACHING_RUNTIME_MODE.DURABLE);

  const prod = resolveCoachingStagingDurableActivation({
    env: {
      VITE_APP_ENV: "production",
      [COACHING_STAGING_DURABLE_RUNTIME_FLAG]: "true",
      [COACHING_STAGING_OWNER_GO_GRANTED_FLAG]: "true",
      VITE_SUPABASE_URL: STAGING_URL,
    },
  });
  assert.equal(prod.activate, false);
  assert.equal(
    prod.reason,
    COACHING_STAGING_DURABLE_ACTIVATION_REASON.PRODUCTION_NOT_AUTHORIZED
  );
  assert.equal(COACHING_DURABLE_RUNTIME_DEFAULT, false);
  assert.equal(LOCALSTORAGE_RETIRED, false);
});

test("PLAYER UNMAPPED + COACH fail closed + no silent fallback", async () => {
  globalThis.__COACHING_LEGACY_TELEMETRY__ = [];
  const contract = getCoachingLegacyIsolationContract();
  assert.equal(contract.silentSuccessOnDurableFailure, false);

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
    playerResult.details?.playerScopeState,
    COACHING_PLAYER_SCOPE_STATE.UNMAPPED
  );

  const runtime = createCoachingRuntime({
    mode: COACHING_RUNTIME_MODE.DURABLE,
    resolveTenantClub: () => ({ tenantId: "t", clubId: "c" }),
    resolveActor: () => ({ actorId: "a1" }),
  });
  await runtime.listCollection("coaches", "c");
  assert.ok(
    globalThis.__COACHING_LEGACY_TELEMETRY__.some(
      (e) => e.event === "silent_fallback_blocked"
    )
  );
  delete globalThis.__COACHING_LEGACY_TELEMETRY__;
});

test("package/lock hashes unchanged from certified pins (sha256-lf-normalized)", () => {
  assert.equal(sha256File("package.json"), PKG_SHA);
  assert.equal(sha256File("package-lock.json"), LOCK_SHA);
  const module = readJson(
    "docs/coaching-training/module-closure/evidence/MODULE_2_12_CLOSURE.json"
  );
  assert.equal(module.hashAlgorithm, "sha256-lf-normalized");
  assert.equal(module.packageJsonSha256, PKG_SHA);
  assert.equal(module.packageLockSha256, LOCK_SHA);
});
