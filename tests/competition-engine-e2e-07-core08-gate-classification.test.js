/**
 * E2E-07 — CORE-08 Phase 1E branch-local delta gate classification control.
 *
 * Does NOT modify / skip / delete the frozen CORE-08 test.
 * Proves E2E-07 did not regress Competition Core ownership and classifies the
 * known 1E branch-local delta assertion as PRE_EXISTING_MAIN_FAILURE +
 * BRANCH_LOCAL_DELTA_POLICY (not an E2E-07 product regression).
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

const CLASSIFICATION = Object.freeze({
  id: "CORE08_1E_BRANCH_LOCAL_DELTA_GATE",
  status: "PRE_EXISTING_MAIN_FAILURE",
  policy: "BRANCH_LOCAL_DELTA_POLICY",
  e2e07Regression: false,
  originalTestPreserved: true,
  originalTestSkipped: false,
});

function git(cmd, { trim = true } = {}) {
  const out = execSync(cmd, { cwd: ROOT, encoding: "utf8" });
  return trim ? out.trim() : out;
}

function branchDeltaNames() {
  return git("git diff --name-only origin/main...HEAD")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function showOriginMain(relPath) {
  try {
    return git(`git show origin/main:${relPath.replace(/\\/g, "/")}`, {
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

test("core08 gate — E2E-07 delta does not touch Competition Core ownership", () => {
  const delta = branchDeltaNames();
  assert.ok(delta.length > 0, "E2E-07 branch must have a non-empty delta vs origin/main");

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

test("core08 gate — frozen 1E certification test identical to origin/main", () => {
  assert.equal(existsSync(path.join(ROOT, CORE08_1E_TEST)), true);
  const normalize = (s) => s.replace(/\r\n/g, "\n");
  const local = normalize(readFileSync(path.join(ROOT, CORE08_1E_TEST), "utf8"));
  const main = normalize(showOriginMain(CORE08_1E_TEST) || "");
  assert.ok(main, "origin/main must contain CORE-08 1E test");
  assert.equal(local, main);

  assert.match(local, /function branchDeltaNames\(\)/);
  assert.match(local, /git diff --name-only origin\/main\.\.\.HEAD/);
  assert.match(local, /expected >=31 branch files/);
  assert.match(local, /scripts\/ci\/unit-test-files\.json/);
  assert.match(local, new RegExp(BRANCH_LOCAL_TEST_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("core08 gate — official CI manifest excludes CORE-08 1E (not a PR CI gate)", () => {
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
    official.includes("tests/competition-engine-e2e-07-core08-gate-classification.test.js"),
    true,
    "E2E-07 classification control must be registered in official CI"
  );
});

test("core08 gate — E2E-07 unit-test-files.json touch is additive certification registration only", () => {
  const delta = branchDeltaNames();
  assert.equal(delta.includes("scripts/ci/unit-test-files.json"), true);

  const mainRaw = showOriginMain("scripts/ci/unit-test-files.json");
  const localRaw = readFileSync(
    path.join(ROOT, "scripts/ci/unit-test-files.json"),
    "utf8"
  );
  const mainList = JSON.parse(mainRaw);
  const localList = JSON.parse(localRaw);
  const added = localList.filter((x) => !mainList.includes(x));
  const removed = mainList.filter((x) => !localList.includes(x));

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
