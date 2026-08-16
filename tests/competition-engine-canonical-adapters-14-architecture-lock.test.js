/**
 * Architecture lock for Canonical Competition Adapter Contracts 14.
 */

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { COMPETITION_COURT_ADAPTER_CONTRACT_VERSION } from "../src/features/competition-core/contracts/competitionCourtAdapterContract.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
} from "../src/features/competition-engine/integration/referee/constants.js";
import {
  COMPETITION_ADAPTER_CONTRACT_VERSION_V1,
  COURT_CONTRACT_PROTECTED_PATHS,
  FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS,
  REFEREE_CONTRACT_PROTECTED_PATHS,
  WORKSTREAM_CONTRACT_DEFINITIONS,
  WORKSTREAM_OWNED_CONTRACT_IDS,
  collectAlternateContractDefinitions,
  collectPrivatePersistenceImports,
  isProtectedCourtOrRefereePath,
} from "../src/features/competition-engine/integration/contracts/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function gitNames(cmd) {
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(path.sep).join("/"));
  } catch {
    return [];
  }
}

function changedPaths() {
  const names = new Set([
    ...gitNames("git diff --name-only origin/main"),
    ...gitNames("git diff --name-only --cached"),
    ...gitNames("git diff --name-only origin/main...HEAD"),
  ]);
  return [...names];
}

test("the 14 contract IDs remain locked at v1", () => {
  assert.equal(WORKSTREAM_OWNED_CONTRACT_IDS.length, 14);
  assert.equal(new Set(WORKSTREAM_OWNED_CONTRACT_IDS).size, 14);
  for (const def of WORKSTREAM_CONTRACT_DEFINITIONS) {
    assert.equal(def.contractVersion, COMPETITION_ADAPTER_CONTRACT_VERSION_V1);
    assert.equal(def.locked, true);
    assert.ok(WORKSTREAM_OWNED_CONTRACT_IDS.includes(def.contractId));
  }
});

test("adapters forbid Competition Core engine authority keys", () => {
  assert.ok(FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS.includes("seedingEngine"));
  assert.ok(FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS.includes("scoringEngine"));
  assert.ok(
    FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS.includes("competitionLifecycleEngine")
  );
  for (const def of WORKSTREAM_CONTRACT_DEFINITIONS) {
    for (const key of FORBIDDEN_COMPETITION_CORE_AUTHORITY_KEYS) {
      assert.ok(def.forbiddenAuthorityKeys.includes(key), `${def.contractId} ${key}`);
    }
  }
});

test("competition modes do not define alternate owned contract IDs", () => {
  const hits = collectAlternateContractDefinitions(ROOT);
  assert.deepEqual(hits, []);
});

test("new contract files do not import private persistence", () => {
  const hits = collectPrivatePersistenceImports(ROOT);
  assert.deepEqual(hits, []);
});

test("this workstream does not modify Court or Referee contract files", () => {
  const changed = changedPaths();
  const protectedHits = changed.filter((file) => isProtectedCourtOrRefereePath(file));
  // Frozen V1 contract remains immutable. Court Resource may update the binding
  // implementation and its tests without changing V1 semantics/file bytes.
  const courtResourceBindingAllowlist = new Set([
    "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js",
    "tests/competition-core-court-adapter-contract.test.js",
    "tests/competition-core-court-adapter-architecture.test.js",
  ]);
  const v1ContractPath =
    "src/features/competition-core/contracts/competitionCourtAdapterContract.js";
  const blocked = protectedHits.filter((file) => {
    if (file === v1ContractPath) return true;
    if (courtResourceBindingAllowlist.has(file)) {
      return changed.includes(v1ContractPath);
    }
    return true;
  });
  assert.deepEqual(blocked, []);
  for (const file of [
    ...COURT_CONTRACT_PROTECTED_PATHS,
    ...REFEREE_CONTRACT_PROTECTED_PATHS,
  ]) {
    const content = readFileSync(path.join(ROOT, file), "utf8");
    assert.ok(content.length > 0, file);
  }
  assert.equal(COMPETITION_COURT_ADAPTER_CONTRACT_VERSION, 1);
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_ID, "competition.referee.adapter.v1");
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
});
