/**
 * CORE-13 Staging acceptance gate semantics.
 * Local only. Does not execute the live Staging harness.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CASE_CATALOG,
  evaluateAcceptanceGate,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function validStagingEnv(extra = {}) {
  return {
    CORE13_STAGING_ACCEPTANCE_GO: "YES",
    STAGING_MUTATION_GO: "YES",
    SQL_ALREADY_APPLIED_PREREQUISITE: "YES",
    EDGE_ALREADY_DEPLOYED_PREREQUISITE: "YES",
    PICK_VN_ENV: "staging",
    STAGING_SUPABASE_URL: "https://qyewbxjsiiyufanzcjcq.supabase.co",
    ...extra,
  };
}

test("A. SQL_EXECUTION_GO=YES is not required", () => {
  const without = validStagingEnv();
  delete without.SQL_EXECUTION_GO;
  assert.equal(evaluateAcceptanceGate(without).ok, true);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ SQL_EXECUTION_GO: "YES" })).ok, true);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ SQL_EXECUTION_GO: "NO" })).ok, true);
});

test("B. EDGE_FUNCTION_DEPLOY_GO=YES is not required", () => {
  const without = validStagingEnv();
  delete without.EDGE_FUNCTION_DEPLOY_GO;
  assert.equal(evaluateAcceptanceGate(without).ok, true);
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ EDGE_FUNCTION_DEPLOY_GO: "YES" })).ok,
    true
  );
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ EDGE_FUNCTION_DEPLOY_GO: "NO" })).ok,
    true
  );
});

test("C. SQL_ALREADY_APPLIED_PREREQUISITE missing/NO refuses", () => {
  const missing = validStagingEnv();
  delete missing.SQL_ALREADY_APPLIED_PREREQUISITE;
  assert.equal(evaluateAcceptanceGate(missing).ok, false);
  assert.match(evaluateAcceptanceGate(missing).detail, /SQL_ALREADY_APPLIED_PREREQUISITE/);
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ SQL_ALREADY_APPLIED_PREREQUISITE: "NO" })).ok,
    false
  );
});

test("D. EDGE_ALREADY_DEPLOYED_PREREQUISITE missing/NO refuses", () => {
  const missing = validStagingEnv();
  delete missing.EDGE_ALREADY_DEPLOYED_PREREQUISITE;
  assert.equal(evaluateAcceptanceGate(missing).ok, false);
  assert.match(evaluateAcceptanceGate(missing).detail, /EDGE_ALREADY_DEPLOYED_PREREQUISITE/);
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ EDGE_ALREADY_DEPLOYED_PREREQUISITE: "NO" })).ok,
    false
  );
});

test("E. STAGING_MUTATION_GO missing/NO refuses", () => {
  const missing = validStagingEnv();
  delete missing.STAGING_MUTATION_GO;
  assert.equal(evaluateAcceptanceGate(missing).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ STAGING_MUTATION_GO: "NO" })).ok, false);
});

test("F. CORE13_STAGING_ACCEPTANCE_GO missing/NO refuses", () => {
  const missing = validStagingEnv();
  delete missing.CORE13_STAGING_ACCEPTANCE_GO;
  assert.equal(evaluateAcceptanceGate(missing).ok, false);
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ CORE13_STAGING_ACCEPTANCE_GO: "NO" })).ok,
    false
  );
});

test("G. PICK_VN_ENV != staging refuses", () => {
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ PICK_VN_ENV: "production" })).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ PICK_VN_ENV: "prod" })).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ PICK_VN_ENV: "" })).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ PICK_VN_ENV: "staging" })).ok, true);
});

test("H. no gate combination can authorize Production", () => {
  const attempts = [
    validStagingEnv({ PICK_VN_ENV: "production" }),
    validStagingEnv({ PICK_VN_ENV: "PRODUCTION" }),
    validStagingEnv({
      STAGING_SUPABASE_URL: "https://expuvcohlcjzvrrauvud.supabase.co",
    }),
    {
      CORE13_STAGING_ACCEPTANCE_GO: "YES",
      STAGING_MUTATION_GO: "YES",
      SQL_ALREADY_APPLIED_PREREQUISITE: "YES",
      EDGE_ALREADY_DEPLOYED_PREREQUISITE: "YES",
      SQL_EXECUTION_GO: "YES",
      EDGE_FUNCTION_DEPLOY_GO: "YES",
      PICK_VN_ENV: "production",
      STAGING_SUPABASE_URL: "https://example.supabase.co",
    },
  ];
  for (const env of attempts) {
    assert.equal(evaluateAcceptanceGate(env).ok, false, JSON.stringify(env));
  }
});

test("optional negative guards refuse when present and not NO; absence does not grant", () => {
  assert.equal(evaluateAcceptanceGate(validStagingEnv()).ok, true);
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ SQL_COMMAND_EXECUTION_THIS_PHASE: "NO" })).ok,
    true
  );
  assert.equal(
    evaluateAcceptanceGate(validStagingEnv({ SQL_COMMAND_EXECUTION_THIS_PHASE: "YES" })).ok,
    false
  );
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ SQL_REAPPLY_GO: "YES" })).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ EDGE_REDEPLOY_GO: "YES" })).ok, false);
  assert.equal(evaluateAcceptanceGate(validStagingEnv({ SQL_REAPPLY_GO: "NO" })).ok, true);
});

test("I. harness contains no SQL execution command", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.doesNotMatch(harness, /\bpsql\b/);
  assert.doesNotMatch(harness, /supabase\s+db\b/);
  assert.doesNotMatch(harness, /db\s+push/);
  assert.doesNotMatch(harness, /apply_migration/);
  assert.doesNotMatch(harness, /02_APPLY\.sql/);
  assert.doesNotMatch(harness, /SQL_EXECUTION_GO must be YES/);
});

test("J. harness contains no Edge deployment command", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.doesNotMatch(harness, /functions\s+deploy/);
  assert.doesNotMatch(harness, /supabase\s+functions\s+deploy/);
  assert.doesNotMatch(harness, /--no-verify-jwt/);
  assert.doesNotMatch(harness, /EDGE_FUNCTION_DEPLOY_GO must be YES/);
  assert.match(harness, /does not deploy Edge Functions/);
});

test("harness wires evaluateAcceptanceGate and keeps 29 catalog cases", () => {
  const harness = read("scripts/core13/core13-trusted-server-staging-acceptance.mjs");
  assert.match(harness, /evaluateAcceptanceGate\(process\.env\)/);
  assert.equal(CASE_CATALOG.length, 29);
  for (const name of CASE_CATALOG) {
    assert.match(harness, new RegExp(name.replace(/\./g, "\\.")));
  }
});
