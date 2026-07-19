/**
 * Phase 1D — Player profile migration SQL package (static contracts).
 * Does not connect to Staging/Production databases.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardPath = path.join(root, "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql");
const verifyPath = path.join(root, "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql");
const rollbackPath = path.join(root, "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql");
const summaryPath = path.join(
  root,
  "docs/player-management/phase-1d/00_PHASE_1D_MIGRATION_SUMMARY.md"
);
const runbookPath = path.join(
  root,
  "docs/player-management/phase-1d/02_STAGING_APPLY_RUNBOOK.md"
);
const holdPath = path.join(
  root,
  "docs/player-management/phase-1d/03_PRODUCTION_HOLD_GATE.md"
);

function read(p) {
  return fs.readFileSync(p, "utf8");
}

function guardBody(sql) {
  const bodyMatch = sql.match(/as\s*\$\$([\s\S]*?)\$\$;/i);
  assert.ok(bodyMatch, "guard function body must exist");
  return bodyMatch[1].replace(/--[^\n]*/g, "");
}

test("1D forward SQL is additive and idempotent-aware", () => {
  const sql = read(forwardPath);
  assert.match(sql, /add column if not exists birth_date/i);
  assert.match(sql, /add column if not exists handedness/i);
  assert.match(sql, /add column if not exists activity_region/i);
  assert.match(sql, /add column if not exists privacy_settings/i);
  assert.match(sql, /add column if not exists identity_verification_status/i);
  assert.match(sql, /birth_year already exists/i);
  assert.match(sql, /create index if not exists profiles_identity_verification_status_partial_idx/i);
  assert.doesNotMatch(sql, /drop column/i);
  assert.doesNotMatch(sql, /truncate\s+table/i);
  assert.doesNotMatch(sql, /drop table/i);
  assert.match(sql, /Never invent from birth_year/i);
});

test("1D forward SQL embeds hotfixed guard (no current_user=postgres bypass)", () => {
  const sql = read(forwardPath);
  const body = guardBody(sql);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path\s*=\s*public/i);
  assert.doesNotMatch(body, /current_user\s*=\s*'postgres'/i);
  assert.match(body, /v_auth_role\s*=\s*'service_role'/);
  assert.match(body, /Cannot self-modify identity_verification_status/);
  assert.match(body, /user_has_permission\('user\.manage'\)/);
  assert.match(sql, /profiles_guard_privileged_update_trg/);
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /alter policy/i);
});

test("1D defaults and constraints cover Phase 1C field contract", () => {
  const sql = read(forwardPath);
  assert.match(sql, /profiles_birth_date_not_future_check/);
  assert.match(sql, /profiles_handedness_check/);
  assert.match(sql, /profiles_identity_verification_status_check/);
  assert.match(sql, /profiles_privacy_settings_object_check/);
  assert.match(sql, /profiles_privacy_settings_booleans_check/);
  assert.match(sql, /profiles_activity_region_object_check/);
  assert.match(sql, /default 'unverified'/i);
  assert.match(sql, /publicProfileEnabled',\s*false/);
  assert.match(sql, /where privacy_settings is null/i);
});

test("1D verify SQL checks columns, guard bypass, and backfill sanity", () => {
  const sql = read(verifyPath);
  for (const col of [
    "birth_date",
    "handedness",
    "activity_region",
    "privacy_settings",
    "identity_verification_status",
    "birth_year",
  ]) {
    assert.match(sql, new RegExp(col));
  }
  assert.match(sql, /no_current_user_postgres_bypass/);
  assert.match(sql, /has_self_verification_block/);
  assert.match(sql, /privacy_null/);
  assert.match(sql, /verification_null/);
});

test("1D rollback does not reintroduce current_user=postgres bypass", () => {
  const sql = read(rollbackPath);
  const body = guardBody(sql);
  assert.doesNotMatch(body, /current_user\s*=\s*'postgres'/i);
  assert.match(body, /v_auth_role\s*=\s*'service_role'/);
  assert.match(sql, /drop column if exists birth_date/i);
  assert.match(sql, /drop column if exists identity_verification_status/i);
  assert.doesNotMatch(sql, /drop column if exists birth_year/i);
  assert.doesNotMatch(sql, /drop column if exists gender/i);
  assert.doesNotMatch(sql, /drop column if exists player_id/i);
});

test("1D docs require Staging-only apply and Production hold", () => {
  const summary = read(summaryPath);
  const runbook = read(runbookPath);
  const hold = read(holdPath);
  assert.match(summary, /PR #69/);
  assert.match(runbook, /Staging only/i);
  assert.match(runbook, /never.*Production/i);
  assert.match(hold, /FORBIDDEN/i);
  assert.match(hold, /Phase 1E/);
});

test("1D package must not introduce browser service_role usage", () => {
  const srcRoots = [
    "src/features/player",
    "src/features/identity/services/selfProfileService.js",
  ].map((p) => path.join(root, p));

  const files = [];
  for (const entry of srcRoots) {
    const st = fs.statSync(entry);
    if (st.isFile()) {
      files.push(entry);
      continue;
    }
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(js|jsx|ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(entry);
  }

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      text,
      /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|sb_secret_/i,
      `${path.relative(root, file)} must not reference service-role secrets`
    );
  }
});

test("1D protected verification fields remain forbidden in app writable contract", () => {
  const writable = read(
    path.join(root, "src/features/player/constants/writableFields.js")
  );
  assert.match(writable, /PLAYER_PRIVILEGED_WRITE_FIELDS/);
  assert.match(writable, /verificationStatus/);
  assert.match(writable, /identityVerificationStatus/);
  assert.match(writable, /\.\.\.PLAYER_PRIVILEGED_WRITE_FIELDS/);
});
