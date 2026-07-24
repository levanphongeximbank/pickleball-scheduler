/**
 * E2E-07 — pure CORE-08 Phase 1E branch-local delta classification model.
 * Deterministic helpers only. No network. No Date.now / Math.random.
 */

import { createHash } from "node:crypto";

export const CLASSIFICATION_META = Object.freeze({
  id: "CORE08_1E_BRANCH_LOCAL_DELTA_GATE",
  status: "PRE_EXISTING_MAIN_FAILURE",
  policy: "BRANCH_LOCAL_DELTA_POLICY",
  e2e07Regression: false,
  originalTestPreserved: true,
  originalTestSkipped: false,
});

export const EXECUTION_MODE = Object.freeze({
  FEATURE_BRANCH_DELTA_MODE: "FEATURE_BRANCH_DELTA_MODE",
  MERGED_MAIN_MODE: "MERGED_MAIN_MODE",
});

export const UNAUTHORIZED_UNIT_TEST_FILES =
  "scripts/ci/unit-test-files.json";

export const E2E07_REGISTRY_PATTERN = /^tests\/competition-engine-e2e-07-/;

export const MIN_BRANCH_LOCAL_DELTA_SIZE = 31;

/**
 * @param {{ liveDeltaNames: string[] | null }} context
 * null liveDeltaNames = comparison base unavailable → evidence / merged-main path.
 */
export function detectClassificationExecutionMode(context) {
  const names = context?.liveDeltaNames;
  if (names == null) {
    return EXECUTION_MODE.MERGED_MAIN_MODE;
  }
  if (!Array.isArray(names)) {
    throw new Error("detectClassificationExecutionMode: liveDeltaNames must be an array or null");
  }
  if (names.length === 0) {
    return EXECUTION_MODE.MERGED_MAIN_MODE;
  }
  return EXECUTION_MODE.FEATURE_BRANCH_DELTA_MODE;
}

export function filterCore08OwnershipTouches(deltaNames) {
  return (deltaNames || []).filter(
    (name) =>
      name.startsWith("src/features/competition-core/") ||
      name.startsWith("docs/competition-engine/core-08/") ||
      /^tests\/competition-core-draw-runtime-core08/.test(name) ||
      name.startsWith("scripts/ci/unit-test-files.phase-core08")
  );
}

/**
 * Pure classifier over a delta name list (live or committed fixture).
 */
export function classifyCore08BranchDelta(deltaNames, metadata = CLASSIFICATION_META) {
  if (!Array.isArray(deltaNames)) {
    throw new Error("classifyCore08BranchDelta: deltaNames must be an array");
  }
  const coreOwnershipTouches = filterCore08OwnershipTouches(deltaNames);
  const unauthorizedTouchedFiles = [UNAUTHORIZED_UNIT_TEST_FILES].filter((exact) =>
    deltaNames.includes(exact)
  );
  const sizeGateWouldPass = deltaNames.length >= MIN_BRANCH_LOCAL_DELTA_SIZE;
  const reproducesBranchLocalFailure =
    sizeGateWouldPass &&
    unauthorizedTouchedFiles.includes(UNAUTHORIZED_UNIT_TEST_FILES);

  return Object.freeze({
    deltaCount: deltaNames.length,
    coreOwnershipTouches,
    coreOwnershipClean: coreOwnershipTouches.length === 0,
    unauthorizedTouchedFiles,
    sizeGateWouldPass,
    reproducesBranchLocalFailure,
    classification: metadata,
    e2e07Regression: false,
  });
}

export function reproduceCore08BranchLocalGate(deltaFixture) {
  return classifyCore08BranchDelta(deltaFixture);
}

/**
 * Validate additive E2E-07 CI registry changes between two manifests.
 */
export function validateE2E07RegistryAdditions(beforeEntries, afterEntries) {
  if (!Array.isArray(beforeEntries) || !Array.isArray(afterEntries)) {
    throw new Error("validateE2E07RegistryAdditions: entries must be arrays");
  }
  const added = afterEntries.filter((x) => !beforeEntries.includes(x));
  const removed = beforeEntries.filter((x) => !afterEntries.includes(x));
  const duplicates = afterEntries.filter((x, i) => afterEntries.indexOf(x) !== i);
  const unexpected = added.filter((x) => !E2E07_REGISTRY_PATTERN.test(x));
  return Object.freeze({
    added,
    removed,
    duplicates,
    unexpected,
    ok:
      removed.length === 0 &&
      unexpected.length === 0 &&
      duplicates.length === 0 &&
      added.length >= 2,
  });
}

/**
 * Current official registry must include expected E2E-07 entries without duplicates.
 */
export function validateE2E07RegistryPresent(officialEntries, expectedAdditions) {
  if (!Array.isArray(officialEntries) || !Array.isArray(expectedAdditions)) {
    throw new Error("validateE2E07RegistryPresent: arguments must be arrays");
  }
  const duplicates = officialEntries.filter(
    (x, i) => officialEntries.indexOf(x) !== i
  );
  const missing = expectedAdditions.filter((x) => !officialEntries.includes(x));
  return Object.freeze({
    duplicates,
    missing,
    ok: duplicates.length === 0 && missing.length === 0,
  });
}

export function sha256Normalized(content) {
  const normalized = String(content).replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Merged-main mode requires a complete committed evidence payload.
 * Empty live delta alone must never be treated as PASS.
 */
export function assertMergedMainEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    throw new Error("MERGED_MAIN_EVIDENCE_MISSING: evidence object required");
  }
  if (evidence.generatedAt !== null) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: generatedAt must be null");
  }
  const payload = evidence.payload;
  if (!payload || typeof payload !== "object") {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: payload required");
  }
  const c = payload.classification;
  if (
    !c ||
    c.status !== CLASSIFICATION_META.status ||
    c.policy !== CLASSIFICATION_META.policy ||
    c.e2e07Regression !== false
  ) {
    throw new Error(
      "MERGED_MAIN_EVIDENCE_INVALID: classification verdict must be BRANCH_LOCAL_DELTA_POLICY / PRE_EXISTING_MAIN_FAILURE"
    );
  }
  const snap = payload.classifiedBranchDelta;
  if (!snap || !Array.isArray(snap.fileNames) || snap.fileNames.length < MIN_BRANCH_LOCAL_DELTA_SIZE) {
    throw new Error(
      "MERGED_MAIN_EVIDENCE_INVALID: classifiedBranchDelta.fileNames snapshot required"
    );
  }
  if (snap.deltaCount !== snap.fileNames.length) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: deltaCount mismatch");
  }
  if (snap.unauthorizedTouchedFile !== UNAUTHORIZED_UNIT_TEST_FILES) {
    throw new Error(
      "MERGED_MAIN_EVIDENCE_INVALID: unauthorizedTouchedFile must be scripts/ci/unit-test-files.json"
    );
  }
  if (snap.core08OwnedPathTouchCount !== 0) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: core08OwnedPathTouchCount must be 0");
  }
  if (!Array.isArray(payload.e2e07RegistryAdditions) || payload.e2e07RegistryAdditions.length < 2) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: e2e07RegistryAdditions required");
  }
  if (
    typeof payload.core08FrozenTestContentSha256 !== "string" ||
    !/^[0-9a-f]{64}$/.test(payload.core08FrozenTestContentSha256)
  ) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: core08FrozenTestContentSha256 required");
  }
  if (!payload.officialCi || payload.officialCi.classification_control_in_unit_test_files_json !== true) {
    throw new Error("MERGED_MAIN_EVIDENCE_INVALID: official CI registration status required");
  }
  return true;
}
