/**
 * E2E-07 — CORE-08 Phase 1E branch-local delta gate classification control.
 *
 * Dual execution modes:
 * - FEATURE_BRANCH_DELTA_MODE: live delta vs comparison base is non-empty
 * - MERGED_MAIN_MODE: live delta empty (or comparison base unavailable) —
 *   replay committed classifiedBranchDelta evidence (never auto-PASS on empty)
 *
 * Does NOT modify / skip / delete the frozen CORE-08 test.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLASSIFICATION_META,
  EXECUTION_MODE,
  UNAUTHORIZED_UNIT_TEST_FILES,
  E2E07_REGISTRY_PATTERN,
  detectClassificationExecutionMode,
  classifyCore08BranchDelta,
  reproduceCore08BranchLocalGate,
  validateE2E07RegistryAdditions,
  validateE2E07RegistryPresent,
  sha256Normalized,
  assertMergedMainEvidence,
} from "../src/features/competition-engine/certification/core08GateClassification.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE08_1E_TEST =
  "tests/competition-core-draw-runtime-core08-1e-certification.test.js";
const BRANCH_LOCAL_TEST_NAME =
  "1E: production engines / UI / SQL / deploy absent from branch-local delta";
const INJECTED_BASE_ENV = "E2E07_COMPARISON_BASE";
const EVIDENCE_PATH =
  "docs/competition-engine/e2e-07/evidence/core08-gate-classification.json";

/**
 * Canonical E2E-07 owned paths (docs/competition-engine/e2e-07/00_FILE_OWNERSHIP.md).
 * Shared unit-test registry alone is NOT an E2E-07 scope trigger.
 */
function isE2E07ScopedPath(name) {
  return (
    name.startsWith("tests/competition-engine-e2e-07-") ||
    name.startsWith("src/features/competition-engine/certification/") ||
    name.startsWith("src/features/competition-engine/presentation/certification/") ||
    name === "src/features/competition-engine/operations/certification/index.js" ||
    name.startsWith("docs/competition-engine/e2e-07/")
  );
}

function liveDeltaTouchesE2E07Scope(deltaNames) {
  return (deltaNames || []).some(isE2E07ScopedPath);
}

/**
 * Apply E2E-07 registry-addition validation only when the live delta includes
 * both the shared unit-test registry and at least one E2E-07-owned path.
 */
function shouldValidateE2E07RegistryAdditions(deltaNames) {
  return (
    Array.isArray(deltaNames) &&
    deltaNames.includes(UNAUTHORIZED_UNIT_TEST_FILES) &&
    liveDeltaTouchesE2E07Scope(deltaNames)
  );
}

class ComparisonBaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ComparisonBaseError";
    this.code = code;
  }
}

function git(cmd, { trim = true } = {}) {
  const out = execSync(cmd, { cwd: ROOT, encoding: "utf8" });
  return trim ? out.trim() : out;
}

function revExists(rev) {
  try {
    execSync(`git cat-file -e "${rev}^{commit}"`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

function resolveSha(rev) {
  return git(`git rev-parse --verify "${rev}^{commit}"`);
}

function readPullRequestBaseSha() {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return null;

  let event;
  try {
    event = JSON.parse(readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }

  const isPullRequest =
    eventName === "pull_request" ||
    (eventName == null && event?.pull_request != null);
  if (!isPullRequest) return null;

  const sha = event?.pull_request?.base?.sha;
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/i.test(sha)) return null;
  return sha.toLowerCase();
}

function resolveComparisonBase() {
  if (revExists("origin/main")) {
    return { sha: resolveSha("origin/main"), source: "origin/main" };
  }

  const prBase = readPullRequestBaseSha();
  if (prBase) {
    if (revExists(prBase)) {
      return {
        sha: resolveSha(prBase),
        source: "github.event.pull_request.base.sha",
      };
    }
    throw new ComparisonBaseError(
      "PR_BASE_OBJECT_MISSING",
      `PR base SHA ${prBase} is listed in GITHUB_EVENT_PATH but is not a local git object. Configure actions/checkout to fetch the PR base (fetch-depth: 0). Unit tests must not git-fetch.`
    );
  }

  const injected = String(process.env[INJECTED_BASE_ENV] || "").trim();
  if (injected) {
    if (revExists(injected)) {
      return {
        sha: resolveSha(injected),
        source: `env:${INJECTED_BASE_ENV}`,
      };
    }
    throw new ComparisonBaseError(
      "INJECTED_BASE_MISSING",
      `Injected ${INJECTED_BASE_ENV}=${injected} does not resolve to a local git object.`
    );
  }

  throw new ComparisonBaseError(
    "COMPARISON_BASE_UNRESOLVED",
    "Unable to resolve comparison base: origin/main unavailable, no usable GITHUB_EVENT_PATH pull_request.base.sha object, and E2E07_COMPARISON_BASE unset."
  );
}

function branchDeltaNames() {
  const { sha } = resolveComparisonBase();
  return git(`git diff --name-only ${sha}...HEAD`)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @returns {string[] | null} null when comparison base cannot be resolved
 */
function tryLiveBranchDeltaNames() {
  try {
    return branchDeltaNames();
  } catch (err) {
    if (err instanceof ComparisonBaseError) return null;
    throw err;
  }
}

function showAtMergeBase(relPath) {
  const { sha } = resolveComparisonBase();
  const mergeBase = git(`git merge-base "${sha}" HEAD`);
  try {
    return git(`git show ${mergeBase}:${relPath.replace(/\\/g, "/")}`, {
      trim: false,
    });
  } catch {
    return null;
  }
}

function loadEvidence() {
  const abs = path.join(ROOT, EVIDENCE_PATH);
  assert.equal(existsSync(abs), true, "classification evidence file must exist");
  return JSON.parse(readFileSync(abs, "utf8"));
}

function readCore08LocalNormalized() {
  return readFileSync(path.join(ROOT, CORE08_1E_TEST), "utf8").replace(
    /\r\n/g,
    "\n"
  );
}

function readOfficialRegistry() {
  return JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
}

// --- Shared / pure model ---

test("core08 gate — classification metadata locked", () => {
  assert.equal(CLASSIFICATION_META.status, "PRE_EXISTING_MAIN_FAILURE");
  assert.equal(CLASSIFICATION_META.policy, "BRANCH_LOCAL_DELTA_POLICY");
  assert.equal(CLASSIFICATION_META.e2e07Regression, false);
  assert.equal(CLASSIFICATION_META.originalTestSkipped, false);
});

test("core08 gate — empty delta does not auto-PASS classification model", () => {
  const empty = classifyCore08BranchDelta([]);
  assert.equal(empty.deltaCount, 0);
  assert.equal(empty.reproducesBranchLocalFailure, false);
  assert.equal(empty.sizeGateWouldPass, false);
  assert.deepEqual(empty.unauthorizedTouchedFiles, []);
  // Empty delta alone is never a successful classified branch-local reproduction.
  assert.equal(empty.e2e07Regression, false);
});

test("core08 gate — evidence missing/invalid must fail merged-main validator", () => {
  assert.throws(() => assertMergedMainEvidence(null), /MERGED_MAIN_EVIDENCE_MISSING/);
  assert.throws(
    () => assertMergedMainEvidence({ generatedAt: "now", payload: {} }),
    /MERGED_MAIN_EVIDENCE_INVALID/
  );
  assert.throws(
    () =>
      assertMergedMainEvidence({
        generatedAt: null,
        payload: {
          classification: CLASSIFICATION_META,
          classifiedBranchDelta: { fileNames: [], deltaCount: 0 },
        },
      }),
    /MERGED_MAIN_EVIDENCE_INVALID/
  );
});

test("core08 gate — registry duplicate must fail validator", () => {
  const dup = validateE2E07RegistryPresent(
    [
      "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
      "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
    ],
    ["tests/competition-engine-e2e-07-end-to-end-certification.test.js"]
  );
  assert.equal(dup.ok, false);
  assert.ok(dup.duplicates.length >= 1);
});

test("core08 gate — CORE-08 content hash mismatch must fail", () => {
  const evidence = loadEvidence();
  assertMergedMainEvidence(evidence);
  const localHash = sha256Normalized(readCore08LocalNormalized());
  assert.equal(localHash, evidence.payload.core08FrozenTestContentSha256);
  assert.notEqual(
    sha256Normalized("tampered-core08-content"),
    evidence.payload.core08FrozenTestContentSha256
  );
});

test("core08 gate — deterministic replay of branch-local policy from evidence fixture", () => {
  const evidence = loadEvidence();
  assertMergedMainEvidence(evidence);
  const replay = reproduceCore08BranchLocalGate(
    evidence.payload.classifiedBranchDelta.fileNames
  );
  assert.equal(replay.coreOwnershipClean, true);
  assert.equal(replay.coreOwnershipTouches.length, 0);
  assert.equal(replay.sizeGateWouldPass, true);
  assert.deepEqual(replay.unauthorizedTouchedFiles, [
    UNAUTHORIZED_UNIT_TEST_FILES,
  ]);
  assert.equal(replay.reproducesBranchLocalFailure, true);
  assert.equal(replay.classification.policy, "BRANCH_LOCAL_DELTA_POLICY");
  assert.equal(replay.e2e07Regression, false);
});

test("core08 gate — execution mode detection (feature-branch vs merged-main)", () => {
  assert.equal(
    detectClassificationExecutionMode({ liveDeltaNames: [] }),
    EXECUTION_MODE.MERGED_MAIN_MODE
  );
  assert.equal(
    detectClassificationExecutionMode({ liveDeltaNames: null }),
    EXECUTION_MODE.MERGED_MAIN_MODE
  );
  assert.equal(
    detectClassificationExecutionMode({
      liveDeltaNames: ["docs/competition-engine/e2e-07/README.md"],
    }),
    EXECUTION_MODE.FEATURE_BRANCH_DELTA_MODE
  );
});

test("core08 gate — comparison base resolves or evidence path remains usable", () => {
  const live = tryLiveBranchDeltaNames();
  const mode = detectClassificationExecutionMode({ liveDeltaNames: live });
  if (live != null) {
    const base = resolveComparisonBase();
    assert.match(base.sha, /^[0-9a-f]{40}$/i);
    assert.equal(revExists(base.sha), true);
  } else {
    assert.equal(mode, EXECUTION_MODE.MERGED_MAIN_MODE);
    assertMergedMainEvidence(loadEvidence());
  }
});

test("core08 gate — official CI excludes CORE-08 1E but registers classification control", () => {
  const official = readOfficialRegistry();
  assert.equal(Array.isArray(official), true);
  assert.equal(official.includes(CORE08_1E_TEST), false);
  assert.equal(
    official.includes(
      "tests/competition-engine-e2e-07-core08-gate-classification.test.js"
    ),
    true
  );
});

test("core08 gate — frozen 1E certification content matches evidence hash", () => {
  assert.equal(existsSync(path.join(ROOT, CORE08_1E_TEST)), true);
  const local = readCore08LocalNormalized();
  const evidence = loadEvidence();
  assert.equal(
    sha256Normalized(local),
    evidence.payload.core08FrozenTestContentSha256
  );

  assert.match(local, /function branchDeltaNames\(\)/);
  assert.match(local, /git diff --name-only origin\/main\.\.\.HEAD/);
  assert.match(local, /expected >=31 branch files/);
  assert.match(local, /scripts\/ci\/unit-test-files\.json/);
  assert.match(
    local,
    new RegExp(BRANCH_LOCAL_TEST_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );

  // When comparison base is available, also prove byte-identical to merge-base.
  const live = tryLiveBranchDeltaNames();
  if (live != null) {
    const baseContent = (showAtMergeBase(CORE08_1E_TEST) || "").replace(
      /\r\n/g,
      "\n"
    );
    assert.ok(baseContent, "merge-base must contain CORE-08 1E test");
    assert.equal(local, baseContent);
  }
});

// --- Mode-aware live / merged checks ---

test("core08 gate — feature-branch mode: live delta ownership stays CORE-08 clean", () => {
  const live = tryLiveBranchDeltaNames();
  const mode = detectClassificationExecutionMode({ liveDeltaNames: live });
  if (mode !== EXECUTION_MODE.FEATURE_BRANCH_DELTA_MODE) {
    assert.equal(mode, EXECUTION_MODE.MERGED_MAIN_MODE);
    // Ownership proven via committed snapshot in merged-main tests.
    const evidence = loadEvidence();
    assert.equal(
      evidence.payload.classifiedBranchDelta.core08OwnedPathTouchCount,
      0
    );
    return;
  }

  assert.ok(live.length > 0, "FEATURE_BRANCH_DELTA_MODE requires non-empty live delta");
  const classified = classifyCore08BranchDelta(live);
  assert.equal(classified.coreOwnershipClean, true);
  assert.deepEqual(classified.coreOwnershipTouches, []);

  if (shouldValidateE2E07RegistryAdditions(live)) {
    const baseRaw = showAtMergeBase("scripts/ci/unit-test-files.json");
    const localRaw = readFileSync(
      path.join(ROOT, "scripts/ci/unit-test-files.json"),
      "utf8"
    );
    assert.ok(baseRaw, "merge-base must contain scripts/ci/unit-test-files.json");
    const registry = validateE2E07RegistryAdditions(
      JSON.parse(baseRaw),
      JSON.parse(localRaw)
    );
    const e2e07Additions = registry.added.filter((x) => E2E07_REGISTRY_PATTERN.test(x));
    // Touching classification metadata while adding non-E2E-07 tests is not E2E-07 registry work.
    if (e2e07Additions.length === 0) {
      assert.equal(
        registry.unexpected.every((x) => !E2E07_REGISTRY_PATTERN.test(x)),
        true
      );
      return;
    }
    assert.equal(registry.ok, true, `registry validation failed: ${JSON.stringify(registry)}`);
    assert.ok(registry.added.length >= 2);

    const reproduced = classifyCore08BranchDelta(live);
    assert.equal(reproduced.reproducesBranchLocalFailure, true);
  }
});

test("core08 gate — Competition Core non-draw-runtime files are not CORE-08 ownership", () => {
  const live = [
    "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
    "src/features/competition-core/contracts/competitionCourtAdapterContract.js",
    "src/features/competition-core/index.js",
    "docs/competition-core/COMPETITION_COURT_ADAPTER_CONTRACT.md",
    "src/features/court-resource/services/courtResourceGateway.js",
  ];
  const classified = classifyCore08BranchDelta(live);
  assert.equal(classified.coreOwnershipClean, true);
  assert.deepEqual(classified.coreOwnershipTouches, []);
});

test("core08 gate — draw-runtime and CORE-08 docs/tests remain ownership touches", () => {
  const live = [
    "src/features/competition-core/draw-runtime/DrawResolver.js",
    "docs/competition-engine/core-08/01_PHASE_1B_ADAPTER_CERTIFICATION.md",
    "tests/competition-core-draw-runtime-core08-1e-certification.test.js",
    "scripts/ci/unit-test-files.phase-core08-1e.json",
    "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
  ];
  const classified = classifyCore08BranchDelta(live);
  assert.equal(classified.coreOwnershipClean, false);
  assert.deepEqual(classified.coreOwnershipTouches, [
    "src/features/competition-core/draw-runtime/DrawResolver.js",
    "docs/competition-engine/core-08/01_PHASE_1B_ADAPTER_CERTIFICATION.md",
    "tests/competition-core-draw-runtime-core08-1e-certification.test.js",
    "scripts/ci/unit-test-files.phase-core08-1e.json",
  ]);
});

test("core08 gate — unrelated registry addition without E2E-07 delta is not rejected", () => {
  const live = [
    UNAUTHORIZED_UNIT_TEST_FILES,
    "tests/unrelated-feature-registry-addition.test.js",
    "src/features/unrelated-feature/index.js",
  ];
  assert.equal(liveDeltaTouchesE2E07Scope(live), false);
  assert.equal(shouldValidateE2E07RegistryAdditions(live), false);

  // Raw validator would reject non-E2E-07 additions — scope guard must skip it.
  const raw = validateE2E07RegistryAdditions(
    ["tests/competition-engine-e2e-07-end-to-end-certification.test.js"],
    [
      "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
      "tests/unrelated-feature-registry-addition.test.js",
    ]
  );
  assert.equal(raw.ok, false);
  assert.deepEqual(raw.unexpected, [
    "tests/unrelated-feature-registry-addition.test.js",
  ]);
});

test("core08 gate — E2E-07 delta with allowed registry additions passes validation", () => {
  const live = [
    UNAUTHORIZED_UNIT_TEST_FILES,
    "tests/competition-engine-e2e-07-core08-gate-classification.test.js",
    "docs/competition-engine/e2e-07/13_CORE08_GATE_CLASSIFICATION.md",
    "src/features/competition-engine/certification/core08GateClassification.js",
  ];
  assert.equal(shouldValidateE2E07RegistryAdditions(live), true);

  const before = [
    "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
  ];
  const after = [
    "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
    "tests/competition-engine-e2e-07-gov08-benchmark.test.js",
    "tests/competition-engine-e2e-07-core08-gate-classification.test.js",
  ];
  const registry = validateE2E07RegistryAdditions(before, after);
  assert.equal(registry.ok, true);
  assert.equal(registry.unexpected.length, 0);
  assert.ok(registry.added.length >= 2);
});

test("core08 gate — E2E-07 delta still rejects unexpected registry additions", () => {
  const live = [
    UNAUTHORIZED_UNIT_TEST_FILES,
    "tests/competition-engine-e2e-07-new-certification.test.js",
  ];
  assert.equal(shouldValidateE2E07RegistryAdditions(live), true);

  const registry = validateE2E07RegistryAdditions(
    ["tests/competition-engine-e2e-07-end-to-end-certification.test.js"],
    [
      "tests/competition-engine-e2e-07-end-to-end-certification.test.js",
      "tests/competition-engine-e2e-07-new-certification.test.js",
      "tests/unrelated-feature-registry-addition.test.js",
    ]
  );
  assert.equal(registry.ok, false);
  assert.deepEqual(registry.unexpected, [
    "tests/unrelated-feature-registry-addition.test.js",
  ]);
});

test("core08 gate — merged-main mode: evidence + registry + hash (empty delta not auto-PASS)", () => {
  const live = tryLiveBranchDeltaNames();
  const mode = detectClassificationExecutionMode({ liveDeltaNames: live });
  const evidence = loadEvidence();
  assertMergedMainEvidence(evidence);

  // Always verify committed classification model (shared with feature-branch mode).
  const replay = classifyCore08BranchDelta(
    evidence.payload.classifiedBranchDelta.fileNames
  );
  assert.equal(replay.reproducesBranchLocalFailure, true);
  assert.equal(replay.coreOwnershipClean, true);
  assert.equal(
    evidence.payload.classifiedBranchDelta.unauthorizedTouchedFile,
    UNAUTHORIZED_UNIT_TEST_FILES
  );

  const official = readOfficialRegistry();
  const present = validateE2E07RegistryPresent(
    official,
    evidence.payload.e2e07RegistryAdditions
  );
  assert.equal(present.ok, true, `registry present failed: ${JSON.stringify(present)}`);

  assert.equal(
    sha256Normalized(readCore08LocalNormalized()),
    evidence.payload.core08FrozenTestContentSha256
  );

  if (mode === EXECUTION_MODE.MERGED_MAIN_MODE) {
    // Empty (or unavailable) live delta must not be treated as success by itself:
    // evidence validation above is mandatory.
    if (live != null) {
      assert.equal(live.length, 0);
    }
    assert.equal(evidence.payload.classification.e2e07Regression, false);
    assert.equal(
      evidence.payload.classification.policy,
      "BRANCH_LOCAL_DELTA_POLICY"
    );
  }
});

test("core08 gate — reproduce branch-local assertion failure without claiming PASS", () => {
  const evidence = loadEvidence();
  assertMergedMainEvidence(evidence);
  const names = evidence.payload.classifiedBranchDelta.fileNames;
  const hit = names.filter((exact) => exact === UNAUTHORIZED_UNIT_TEST_FILES);

  assert.equal(names.length >= 31, true);
  assert.deepEqual(hit, [UNAUTHORIZED_UNIT_TEST_FILES]);

  const live = tryLiveBranchDeltaNames();
  if (
    live &&
    live.length > 0 &&
    live.includes(UNAUTHORIZED_UNIT_TEST_FILES)
  ) {
    const liveHit = live.filter((exact) => exact === UNAUTHORIZED_UNIT_TEST_FILES);
    assert.deepEqual(liveHit, [UNAUTHORIZED_UNIT_TEST_FILES]);
  }

  assert.equal(CLASSIFICATION_META.e2e07Regression, false);
  assert.equal(CLASSIFICATION_META.status, "PRE_EXISTING_MAIN_FAILURE");
});
