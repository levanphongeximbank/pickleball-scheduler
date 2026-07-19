/**
 * Phase 1E remediation — column-aware Production preflight (no DB connection).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  NOT_APPLICABLE_COLUMN_MISSING,
  PHASE_1E_GUARD_TRIGGER,
  PHASE_1E_REQUIRED_COLUMNS,
  PHASE_1E_REQUIRED_CONSTRAINTS,
  PHASE_1E_REQUIRED_INDEX,
  buildConditionalProfileCounts,
  buildProfileCountsSelectSql,
  classifyKnownProductionPreMigrationShape,
  classifyPhase1eProductionPreflight,
} from "../src/features/player/phase1e/phase1eProductionPreflight.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = fs.readFileSync(
  path.join(root, "scripts/verify-phase-1e-player-profile-production-preflight.mjs"),
  "utf8"
);
const preflightSql = fs.readFileSync(
  path.join(root, "docs/v5/PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT.sql"),
  "utf8"
);
const runbook = fs.readFileSync(
  path.join(root, "docs/player-management/phase-1e/02_PRODUCTION_ROLLOUT_RUNBOOK.md"),
  "utf8"
);

test("remediation: script inventories columns before conditional counts", () => {
  assert.match(script, /information_schema\.columns/);
  assert.match(script, /buildProfileCountsSelectSql/);
  assert.match(script, /buildConditionalProfileCounts/);
  assert.match(script, /Column-aware/);
  assert.doesNotMatch(
    script,
    /const counts = await client\.query\(`\s*select[\s\S]*privacy_settings is null/
  );
});

test("remediation: SQL preflight does not filter on Phase 1D columns by name", () => {
  const stripped = preflightSql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(stripped, /where\s+privacy_settings\s+is\s+null/i);
  assert.doesNotMatch(stripped, /where\s+identity_verification_status\s+is\s+null/i);
  assert.doesNotMatch(stripped, /handedness\s+not\s+in/i);
  assert.match(preflightSql, /COLUMN-AWARE/i);
  assert.match(preflightSql, /verify-phase-1e-player-profile-production-preflight\.mjs/);
});

test("remediation: runbook requires official preflight only (no manual workaround)", () => {
  assert.match(runbook, /official.*Gate A/i);
  assert.match(runbook, /Do \*\*not\*\* use manual workarounds/i);
  assert.match(runbook, /NOT_APPLICABLE_COLUMN_MISSING/);
  assert.match(runbook, /column-aware/i);
});

test("remediation: all Phase 1D foundation columns missing → NOT_APPLIED when no guard", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: [],
    constraints: [],
    indexes: [],
    triggers: [],
    guardFunctionExists: false,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: false,
    counts: buildConditionalProfileCounts([], { total: 10 }),
  });
  assert.equal(r.classification, "NOT_APPLIED");
});

test("remediation: only birth_year present + safe no-guard → NOT_APPLIED", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: ["birth_year"],
    constraints: [],
    indexes: [],
    triggers: [],
    guardFunctionExists: false,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: false,
    counts: buildConditionalProfileCounts(["birth_year"], { total: 10 }),
  });
  assert.equal(r.classification, "NOT_APPLIED");
});

test("remediation: only birth_year + unsafe legacy guard → BLOCKED_UNSAFE (Production shape)", () => {
  const r = classifyKnownProductionPreMigrationShape();
  assert.equal(r.classification, "BLOCKED_UNSAFE");
  assert.ok(r.blockers.some((b) => /current_user=postgres/i.test(b)));
  assert.ok(r.blockers.some((b) => /self identity_verification_status/i.test(b)));
});

test("remediation: privacy_settings missing is NOT_APPLICABLE and does not invent nulls", () => {
  const counts = buildConditionalProfileCounts(["birth_year", "handedness"], {
    total: 5,
    invalid_handedness: 0,
  });
  assert.equal(counts.privacy_null.status, NOT_APPLICABLE_COLUMN_MISSING);
  assert.equal(counts.privacy_null.value, null);
  assert.equal(counts.verification_null.status, NOT_APPLICABLE_COLUMN_MISSING);
  assert.equal(counts.invalid_handedness.status, "OK");
  assert.equal(counts.invalid_handedness.value, 0);
});

test("remediation: identity_verification_status missing → conditional SELECT omits it", () => {
  const { selectSql } = buildProfileCountsSelectSql(["birth_date", "handedness"]);
  assert.match(selectSql, /birth_date|count\(\*\)/);
  assert.doesNotMatch(selectSql, /identity_verification_status/);
  assert.doesNotMatch(selectSql, /privacy_settings/);
  assert.match(selectSql, /handedness/);
});

test("remediation: partially applied schema classifies PARTIALLY_APPLIED", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: ["birth_year", "birth_date", "handedness"],
    constraints: ["profiles_handedness_check"],
    indexes: [],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    counts: buildConditionalProfileCounts(["birth_year", "birth_date", "handedness"], {
      total: 3,
      invalid_handedness: 0,
    }),
  });
  assert.equal(r.classification, "PARTIALLY_APPLIED");
});

test("remediation: safe migrated guard + full schema → ALREADY_READY", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: [...PHASE_1E_REQUIRED_COLUMNS],
    constraints: [...PHASE_1E_REQUIRED_CONSTRAINTS],
    indexes: [PHASE_1E_REQUIRED_INDEX],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    counts: buildConditionalProfileCounts(PHASE_1E_REQUIRED_COLUMNS, {
      total: 10,
      privacy_null: 0,
      verification_null: 0,
      invalid_handedness: 0,
      invalid_verification: 0,
    }),
    duplicateConstraintCount: 0,
    conflictingTriggerCount: 0,
    rlsPoliciesMatchBaseline: true,
    grantsMatchBaseline: true,
  });
  assert.equal(r.classification, "ALREADY_READY");
});

test("remediation: conflicting trigger → BLOCKED_UNSAFE", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: [...PHASE_1E_REQUIRED_COLUMNS],
    constraints: [...PHASE_1E_REQUIRED_CONSTRAINTS],
    indexes: [PHASE_1E_REQUIRED_INDEX],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    counts: buildConditionalProfileCounts(PHASE_1E_REQUIRED_COLUMNS, {
      total: 1,
      privacy_null: 0,
      verification_null: 0,
      invalid_handedness: 0,
      invalid_verification: 0,
    }),
    conflictingTriggerCount: 1,
  });
  assert.equal(r.classification, "BLOCKED_UNSAFE");
});

test("remediation: conflicting constraint → BLOCKED_UNSAFE", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: [...PHASE_1E_REQUIRED_COLUMNS],
    constraints: [...PHASE_1E_REQUIRED_CONSTRAINTS],
    indexes: [PHASE_1E_REQUIRED_INDEX],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: false,
    guardHasSelfVerificationBlock: true,
    counts: buildConditionalProfileCounts(PHASE_1E_REQUIRED_COLUMNS, {
      total: 1,
      privacy_null: 0,
      verification_null: 0,
      invalid_handedness: 0,
      invalid_verification: 0,
    }),
    duplicateConstraintCount: 2,
  });
  assert.equal(r.classification, "BLOCKED_UNSAFE");
});

test("remediation: null-count checks only when columns exist (SQL builder)", () => {
  const empty = buildProfileCountsSelectSql(["birth_year"]);
  assert.equal(empty.keys.join(","), "total");
  assert.doesNotMatch(empty.selectSql, /privacy_settings|handedness|identity_verification/);

  const full = buildProfileCountsSelectSql(PHASE_1E_REQUIRED_COLUMNS);
  assert.ok(full.keys.includes("privacy_null"));
  assert.ok(full.keys.includes("verification_null"));
  assert.ok(full.keys.includes("invalid_handedness"));
  assert.match(full.selectSql, /privacy_settings is null/);
});

test("remediation: BLOCKED_UNSAFE takes precedence over missing-column PARTIAL shape", () => {
  const r = classifyPhase1eProductionPreflight({
    columns: ["birth_year", "birth_date"],
    constraints: [],
    indexes: [],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: true,
    guardHasSelfVerificationBlock: false,
    counts: buildConditionalProfileCounts(["birth_year", "birth_date"], { total: 2 }),
  });
  assert.equal(r.classification, "BLOCKED_UNSAFE");
});
