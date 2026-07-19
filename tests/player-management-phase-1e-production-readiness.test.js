/**
 * Phase 1E — Production rollout readiness package (static contracts).
 * Does not connect to Production or Staging databases.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyPhase1eProductionPreflight,
  PHASE_1E_PREFLIGHT_CLASSIFICATIONS,
  PHASE_1E_REQUIRED_COLUMNS,
  PHASE_1E_REQUIRED_CONSTRAINTS,
  PHASE_1E_REQUIRED_INDEX,
  PHASE_1E_GUARD_FN,
  PHASE_1E_GUARD_TRIGGER,
} from "../src/features/player/phase1e/phase1eProductionPreflight.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const PATHS = {
  preflightSql: "docs/v5/PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT.sql",
  forwardSql: "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql",
  verifySql: "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql",
  rollbackSql: "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql",
  script: "scripts/verify-phase-1e-player-profile-production-preflight.mjs",
  summary: "docs/player-management/phase-1e/00_PHASE_1E_PRODUCTION_READINESS_SUMMARY.md",
  audit: "docs/player-management/phase-1e/01_PHASE_1D_PACKAGE_AUDIT.md",
  runbook: "docs/player-management/phase-1e/02_PRODUCTION_ROLLOUT_RUNBOOK.md",
  evidence: "docs/player-management/phase-1e/03_PRODUCTION_EVIDENCE_TEMPLATE.md",
  safeguards: "docs/player-management/phase-1e/04_ENVIRONMENT_SAFEGUARDS.md",
};

test("1E package files exist and are separated (preflight / forward / verify / rollback)", () => {
  for (const rel of Object.values(PATHS)) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  }
  assert.notEqual(PATHS.preflightSql, PATHS.forwardSql);
  assert.notEqual(PATHS.verifySql, PATHS.rollbackSql);
  assert.notEqual(PATHS.forwardSql, PATHS.rollbackSql);
});

test("1E preflight SQL is read-only (no mutating DDL/DML)", () => {
  const sql = read(PATHS.preflightSql);
  assert.match(sql, /READ-ONLY/i);
  assert.match(sql, /expuvcohlcjzvrrauvud/);
  // Strip line comments, then reject mutating statement keywords at line start / after ;
  const stripped = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(
    stripped,
    /(^|[\s;])(insert|update|delete|alter|drop|create|truncate|grant|revoke)\s+/i
  );
  assert.match(stripped, /\bselect\b/i);
});

test("1E preflight script requires Production confirmation and refuses Staging", () => {
  const src = read(PATHS.script);
  assert.match(src, /CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT/);
  assert.match(src, /PRODUCTION_SUPABASE_PROJECT_REF/);
  assert.match(src, /expuvcohlcjzvrrauvud/);
  assert.match(src, /qyewbxjsiiyufanzcjcq/);
  assert.match(src, /appliedSql:\s*false/);
  assert.match(src, /mutatedProduction:\s*false/);
  assert.match(src, /classifyPhase1eProductionPreflight/);
  assert.match(src, /buildProfileCountsSelectSql/);
  assert.doesNotMatch(src, /PHASE_1D_PLAYER_PROFILE_MIGRATION\.sql[\s\S]{0,80}client\.query/);
  assert.doesNotMatch(src, /\.query\(\s*[`'"]\s*(alter|update|insert|delete|drop)/i);
});

test("1E rollback is not part of normal execution path in runbook", () => {
  const runbook = read(PATHS.runbook);
  assert.match(runbook, /Gate I — Rollback decision/i);
  assert.match(runbook, /NOT part of normal execution/i);
  assert.match(runbook, /data loss/i);
  assert.match(runbook, /Never rollback without Owner approval/i);
  assert.match(runbook, /Gate E — Production SQL apply/i);
  assert.match(runbook, /PHASE_1D_PLAYER_PROFILE_MIGRATION\.sql/);
  assert.match(runbook, /PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT\.sql/);
});

test("1E documentation references correct file paths and no Staging/Production ambiguity", () => {
  const summary = read(PATHS.summary);
  const safeguards = read(PATHS.safeguards);
  const evidence = read(PATHS.evidence);
  assert.match(summary, /PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT\.sql/);
  assert.match(summary, /PHASE_1D_PLAYER_PROFILE_MIGRATION\.sql/);
  assert.match(summary, /READINESS ONLY/i);
  assert.match(safeguards, /expuvcohlcjzvrrauvud/);
  assert.match(safeguards, /qyewbxjsiiyufanzcjcq/);
  assert.match(safeguards, /fail-closed/i);
  assert.match(evidence, /Classification/);
  assert.match(evidence, /Rollback required/);
  assert.doesNotMatch(summary, /apply Production SQL automatically/i);
});

test("1E expected Phase 1D schema objects are represented in classifier", () => {
  assert.deepEqual(
    [...PHASE_1E_REQUIRED_COLUMNS].sort(),
    [
      "activity_region",
      "birth_date",
      "birth_year",
      "handedness",
      "identity_verification_status",
      "privacy_settings",
    ].sort()
  );
  assert.equal(PHASE_1E_REQUIRED_CONSTRAINTS.length, 6);
  assert.equal(PHASE_1E_REQUIRED_INDEX, "profiles_identity_verification_status_partial_idx");
  assert.equal(PHASE_1E_GUARD_FN, "profiles_guard_privileged_update");
  assert.equal(PHASE_1E_GUARD_TRIGGER, "profiles_guard_privileged_update_trg");
});

test("1E preflight classifications are covered", () => {
  assert.deepEqual(
    [...PHASE_1E_PREFLIGHT_CLASSIFICATIONS].sort(),
    ["ALREADY_READY", "BLOCKED_UNSAFE", "NOT_APPLIED", "PARTIALLY_APPLIED"].sort()
  );

  const notApplied = classifyPhase1eProductionPreflight({
    columns: ["birth_year"],
    constraints: [],
    indexes: [],
    triggers: [],
    guardFunctionExists: false,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: false,
    privacyNullCount: 0,
    verificationNullCount: 0,
  });
  assert.equal(notApplied.classification, "NOT_APPLIED");

  const partial = classifyPhase1eProductionPreflight({
    columns: ["birth_date", "handedness", "birth_year"],
    constraints: ["profiles_handedness_check"],
    indexes: [],
    triggers: [],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    privacyNullCount: 0,
    verificationNullCount: 0,
  });
  assert.equal(partial.classification, "PARTIALLY_APPLIED");

  const ready = classifyPhase1eProductionPreflight({
    columns: [...PHASE_1E_REQUIRED_COLUMNS],
    constraints: [...PHASE_1E_REQUIRED_CONSTRAINTS],
    indexes: [PHASE_1E_REQUIRED_INDEX],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    privacyNullCount: 0,
    verificationNullCount: 0,
    invalidHandednessCount: 0,
    invalidVerificationCount: 0,
    duplicateConstraintCount: 0,
    conflictingTriggerCount: 0,
    rlsPoliciesMatchBaseline: true,
    grantsMatchBaseline: true,
  });
  assert.equal(ready.classification, "ALREADY_READY");

  const blocked = classifyPhase1eProductionPreflight({
    columns: [...PHASE_1E_REQUIRED_COLUMNS],
    constraints: [...PHASE_1E_REQUIRED_CONSTRAINTS],
    indexes: [PHASE_1E_REQUIRED_INDEX],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: true,
    guardHasSelfVerificationBlock: true,
  });
  assert.equal(blocked.classification, "BLOCKED_UNSAFE");
});

test("1E package does not introduce browser service_role leakage", () => {
  const files = [
    PATHS.script,
    "src/features/player/phase1e/phase1eProductionPreflight.js",
    "src/features/player/bootstrap/playerProfileWriteBootstrap.js",
    "src/features/player/services/updateAuthenticatedSelfPlayerProfile.js",
    "src/features/identity/services/selfProfileService.js",
  ];
  for (const rel of files) {
    const text = read(rel);
    assert.doesNotMatch(
      text,
      /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|sb_secret_/i,
      `${rel} must not embed service-role secrets`
    );
  }
});

test("1E Phase 1D forward SQL remains additive and hotfixed for Production source", () => {
  const sql = read(PATHS.forwardSql);
  assert.match(sql, /add column if not exists birth_date/i);
  assert.doesNotMatch(sql, /drop column/i);
  assert.doesNotMatch(sql, /truncate\s+table/i);
  const body = sql.match(/as\s*\$\$([\s\S]*?)\$\$;/i)?.[1] || "";
  assert.doesNotMatch(body.replace(/--[^\n]*/g, ""), /current_user\s*=\s*'postgres'/i);
  assert.match(body, /Cannot self-modify identity_verification_status/);
});
