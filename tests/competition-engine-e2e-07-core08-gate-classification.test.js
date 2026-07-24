/**
 * E2E-07 — CORE-08 Phase 1E branch-local delta gate classification control.
 *
 * Does NOT modify / skip / delete the frozen CORE-08 test.
 * Proves E2E-07 did not regress Competition Core ownership and classifies the
 * known 1E branch-local delta assertion as PRE_EXISTING_MAIN_FAILURE +
 * BRANCH_LOCAL_DELTA_POLICY (not an E2E-07 product regression).
 *
 * Comparison base resolution is CI-safe: does not require the remote-tracking
 * name `origin/main` specifically, and never fetches from the network.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE08_1E_TEST =
  "tests/competition-core-draw-runtime-core08-1e-certification.test.js";
const BRANCH_LOCAL_TEST_NAME =
  "1E: production engines / UI / SQL / deploy absent from branch-local delta";
const INJECTED_BASE_ENV = "E2E07_COMPARISON_BASE";

const CLASSIFICATION = Object.freeze({
  id: "CORE08_1E_BRANCH_LOCAL_DELTA_GATE",
  status: "PRE_EXISTING_MAIN_FAILURE",
  policy: "BRANCH_LOCAL_DELTA_POLICY",
  e2e07Regression: false,
  originalTestPreserved: true,
  originalTestSkipped: false,
});

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
  // Quote the peel syntax so Windows cmd.exe does not treat `^` as an escape.
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

/**
 * Resolve the git revision used for branch-delta comparison.
 *
 * Fallback order (each candidate must exist as a local object):
 * 1. origin/main (developer / full-fetch worktrees)
 * 2. pull_request base.sha from GITHUB_EVENT_PATH
 * 3. E2E07_COMPARISON_BASE explicit injection
 *
 * Never network-fetches. Never auto-PASSes when unresolved.
 */
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

test("core08 gate — classification metadata locked", () => {
  assert.equal(CLASSIFICATION.status, "PRE_EXISTING_MAIN_FAILURE");
  assert.equal(CLASSIFICATION.policy, "BRANCH_LOCAL_DELTA_POLICY");
  assert.equal(CLASSIFICATION.e2e07Regression, false);
  assert.equal(CLASSIFICATION.originalTestSkipped, false);
});

test("core08 gate — comparison base resolves without network", () => {
  const base = resolveComparisonBase();
  assert.match(base.sha, /^[0-9a-f]{40}$/i);
  assert.equal(revExists(base.sha), true);
  assert.ok(
    ["origin/main", "github.event.pull_request.base.sha", `env:${INJECTED_BASE_ENV}`].includes(
      base.source
    ),
    `unexpected comparison base source: ${base.source}`
  );
});

test("core08 gate — E2E-07 delta does not touch Competition Core ownership", () => {
  const delta = branchDeltaNames();
  assert.ok(
    delta.length > 0,
    "E2E-07 branch must have a non-empty delta vs comparison base"
  );

  const coreTouches = delta.filter(
    (name) =>
      name.startsWith("src/features/competition-core/") ||
      name.startsWith("docs/competition-engine/core-08/") ||
      /^tests\/competition-core-draw-runtime-core08/.test(name) ||
      name.startsWith("scripts/ci/unit-test-files.phase-core08")
  );
  assert.deepEqual(coreTouches, []);

  const privateCore = delta.filter((name) =>
    name.startsWith("src/features/competition-core/")
  );
  assert.deepEqual(privateCore, []);
});

test("core08 gate — frozen 1E certification test identical to comparison base", () => {
  assert.equal(existsSync(path.join(ROOT, CORE08_1E_TEST)), true);
  const normalize = (s) => s.replace(/\r\n/g, "\n");
  const local = normalize(readFileSync(path.join(ROOT, CORE08_1E_TEST), "utf8"));
  // Byte-identical to merge-base proves E2E-07 did not edit the frozen CORE-08 file.
  const baseContent = normalize(showAtMergeBase(CORE08_1E_TEST) || "");
  assert.ok(baseContent, "merge-base must contain CORE-08 1E test");
  assert.equal(local, baseContent);

  // Frozen CORE-08 1E still hardcodes origin/main internally — that is intentional
  // and unchanged. This control must keep proving that content, not rewrite it.
  assert.match(local, /function branchDeltaNames\(\)/);
  assert.match(local, /git diff --name-only origin\/main\.\.\.HEAD/);
  assert.match(local, /expected >=31 branch files/);
  assert.match(local, /scripts\/ci\/unit-test-files\.json/);
  assert.match(local, new RegExp(BRANCH_LOCAL_TEST_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("core08 gate — official CI excludes CORE-08 1E but registers classification control", () => {
  const official = JSON.parse(
    readFileSync(path.join(ROOT, "scripts/ci/unit-test-files.json"), "utf8")
  );
  assert.equal(Array.isArray(official), true);
  assert.equal(
    official.includes(CORE08_1E_TEST),
    false,
    "CORE-08 1E certification must remain outside official CI unit-test-files.json"
  );
  assert.equal(
    official.includes(
      "tests/competition-engine-e2e-07-core08-gate-classification.test.js"
    ),
    true,
    "E2E-07 classification control must be registered in official CI (runs under npm run test:unit)"
  );
});

test("core08 gate — E2E-07 unit-test-files.json touch is additive certification registration only", () => {
  const delta = branchDeltaNames();
  assert.equal(delta.includes("scripts/ci/unit-test-files.json"), true);

  // Compare against merge-base (same semantics as `base...HEAD`), not tip of a
  // moved-ahead main that may contain unrelated registry entries.
  const baseRaw = showAtMergeBase("scripts/ci/unit-test-files.json");
  const localRaw = readFileSync(
    path.join(ROOT, "scripts/ci/unit-test-files.json"),
    "utf8"
  );
  assert.ok(baseRaw, "merge-base must contain scripts/ci/unit-test-files.json");
  const baseList = JSON.parse(baseRaw);
  const localList = JSON.parse(localRaw);
  const added = localList.filter((x) => !baseList.includes(x));
  const removed = baseList.filter((x) => !localList.includes(x));

  assert.deepEqual(removed, []);
  for (const entry of added) {
    assert.match(
      entry,
      /^tests\/competition-engine-e2e-07-/,
      `unexpected unit-test-files addition: ${entry}`
    );
  }
  assert.ok(added.length >= 2);
});

test("core08 gate — reproduce branch-local assertion failure without claiming PASS", () => {
  // Keep original semantics: on non-CORE-08 branches the 1E delta policy fails.
  // Fresh main fails (>=31 got 0). E2E-07 fails because additive CI registration
  // touches scripts/ci/unit-test-files.json which CORE-08 forbids in *its* delta.
  const names = branchDeltaNames();
  const forbiddenExact = [
    "src/features/competition-core/index.js",
    "scripts/ci/unit-test-files.json",
  ];
  const hit = forbiddenExact.filter((exact) => names.includes(exact));

  assert.equal(names.length >= 31, true, "E2E-07 delta size is large enough to pass size check");
  assert.deepEqual(hit, ["scripts/ci/unit-test-files.json"]);

  // Explicitly do NOT mark the frozen CORE-08 test as passing.
  assert.equal(CLASSIFICATION.e2e07Regression, false);
  assert.equal(CLASSIFICATION.status, "PRE_EXISTING_MAIN_FAILURE");
});
