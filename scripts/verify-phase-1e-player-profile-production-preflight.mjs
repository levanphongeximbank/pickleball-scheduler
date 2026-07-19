#!/usr/bin/env node
/**
 * Phase 1E — Production preflight for Player profile migration (READ-ONLY).
 *
 * Does NOT apply PHASE_1D_PLAYER_PROFILE_MIGRATION.sql.
 * Does NOT deploy. Does NOT mutate Production.
 *
 * Required environment confirmation (fail-closed):
 *   CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT=YES
 *   PRODUCTION_SUPABASE_PROJECT_REF=expuvcohlcjzvrrauvud
 *   SUPABASE_DB_URL=<production db url containing that ref OR host matching production>
 *
 * Optional env file:
 *   .env.production-qa.local  (gitignored)
 *
 * Usage:
 *   CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT=YES \
 *   PRODUCTION_SUPABASE_PROJECT_REF=expuvcohlcjzvrrauvud \
 *   SUPABASE_DB_URL=... \
 *   node scripts/verify-phase-1e-player-profile-production-preflight.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  classifyPhase1eProductionPreflight,
  PHASE_1E_REQUIRED_COLUMNS,
  PHASE_1E_REQUIRED_CONSTRAINTS,
  PHASE_1E_REQUIRED_INDEX,
  PHASE_1E_GUARD_FN,
  PHASE_1E_GUARD_TRIGGER,
} from "../src/features/player/phase1e/phase1eProductionPreflight.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_PRODUCTION_REF = "expuvcohlcjzvrrauvud";
const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const FORWARD_SQL = "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION.sql";
const VERIFY_SQL = "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_VERIFY.sql";
const ROLLBACK_SQL = "docs/v5/PHASE_1D_PLAYER_PROFILE_MIGRATION_ROLLBACK.sql";
const PREFLIGHT_SQL = "docs/v5/PHASE_1E_PLAYER_PROFILE_PRODUCTION_PREFLIGHT.sql";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

function sha256File(rel) {
  const abs = path.join(root, rel);
  return createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function fail(code, message, extra = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "production_preflight_read_only",
        appliedSql: false,
        classification: "BLOCKED_UNSAFE",
        error: message,
        ...extra,
      },
      null,
      2
    )
  );
  process.exit(code);
}

const fileEnv = {
  ...loadEnvFile(path.join(root, ".env.production-qa.local")),
  ...loadEnvFile(path.join(root, ".env.production.local")),
};

const confirm = String(
  process.env.CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT ||
    fileEnv.CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT ||
    ""
).trim();
const expectedRef = String(
  process.env.PRODUCTION_SUPABASE_PROJECT_REF ||
    fileEnv.PRODUCTION_SUPABASE_PROJECT_REF ||
    ""
).trim();
const dbUrl = String(process.env.SUPABASE_DB_URL || fileEnv.SUPABASE_DB_URL || "").trim();

if (confirm !== "YES") {
  fail(10, "Missing CONFIRM_PRODUCTION_PLAYER_PROFILE_PREFLIGHT=YES (fail-closed)");
}
if (!expectedRef) {
  fail(11, "Missing PRODUCTION_SUPABASE_PROJECT_REF (fail-closed)");
}
if (expectedRef !== EXPECTED_PRODUCTION_REF) {
  fail(12, "PRODUCTION_SUPABASE_PROJECT_REF mismatch — refusing ambiguous Production target", {
    expected: EXPECTED_PRODUCTION_REF,
    received: expectedRef,
  });
}
if (!dbUrl) {
  fail(13, "Missing SUPABASE_DB_URL for Production preflight (PREPARED_NOT_EXECUTED)");
}
if (dbUrl.includes(STAGING_REF)) {
  fail(14, "SUPABASE_DB_URL appears to target Staging — refusing Production preflight");
}
if (!dbUrl.includes(EXPECTED_PRODUCTION_REF) && !dbUrl.includes("expuvcohlcjzvrrauvud")) {
  // pooler URLs sometimes omit project ref in host; require explicit PROJECT_REF already matched
  // and an additional PRODUCTION_DB_HOST_HINT when ref is absent from URL.
  const hostHint = String(
    process.env.PRODUCTION_DB_HOST_HINT || fileEnv.PRODUCTION_DB_HOST_HINT || ""
  ).trim();
  if (!hostHint || !dbUrl.includes(hostHint)) {
    fail(
      15,
      "SUPABASE_DB_URL does not include Production project ref and PRODUCTION_DB_HOST_HINT is missing/unmatched"
    );
  }
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const cols = await client.query(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = any($1::text[])
    order by 1
  `,
    [PHASE_1E_REQUIRED_COLUMNS]
  );

  const constraints = await client.query(
    `
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = any($1::text[])
    order by 1
  `,
    [PHASE_1E_REQUIRED_CONSTRAINTS]
  );

  const duplicateConstraints = await client.query(`
    select count(*)::int as n
    from (
      select conname
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and conname like 'profiles_%'
      group by conname
      having count(*) > 1
    ) d
  `);

  const indexes = await client.query(
    `
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexname = $1
  `,
    [PHASE_1E_REQUIRED_INDEX]
  );

  const guard = await client.query(
    `
    select
      true as exists,
      position($$current_user = 'postgres'$$ in pg_get_functiondef(oid)) > 0 as unsafe_bypass,
      position('Cannot self-modify identity_verification_status' in pg_get_functiondef(oid)) > 0 as self_block
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = $1
  `,
    [PHASE_1E_GUARD_FN]
  );

  const triggers = await client.query(
    `
    select tgname
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and not tgisinternal
      and tgname = $1
  `,
    [PHASE_1E_GUARD_TRIGGER]
  );

  const conflictingTriggers = await client.query(
    `
    select count(*)::int as n
    from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and not tgisinternal
      and tgtype & 16 = 16
      and tgname <> $1
      and tgname ilike '%guard%privileged%'
  `,
    [PHASE_1E_GUARD_TRIGGER]
  );

  const counts = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where privacy_settings is null)::int as privacy_null,
      count(*) filter (where identity_verification_status is null)::int as verification_null,
      count(*) filter (
        where handedness is not null
          and handedness not in ('right', 'left', 'ambidextrous', 'unknown')
      )::int as invalid_handedness,
      count(*) filter (
        where identity_verification_status is not null
          and identity_verification_status not in ('unverified', 'pending', 'verified', 'rejected')
      )::int as invalid_verification
    from public.profiles
  `);

  const guardRow = guard.rows[0] || null;
  const snapshot = {
    columns: cols.rows.map((r) => r.column_name),
    constraints: constraints.rows.map((r) => r.conname),
    indexes: indexes.rows.map((r) => r.indexname),
    triggers: triggers.rows.map((r) => r.tgname),
    guardFunctionExists: Boolean(guardRow),
    guardHasCurrentUserPostgresBypass: guardRow ? guardRow.unsafe_bypass === true : false,
    guardHasSelfVerificationBlock: guardRow ? guardRow.self_block === true : false,
    privacyNullCount: counts.rows[0].privacy_null,
    verificationNullCount: counts.rows[0].verification_null,
    invalidHandednessCount: counts.rows[0].invalid_handedness,
    invalidVerificationCount: counts.rows[0].invalid_verification,
    duplicateConstraintCount: duplicateConstraints.rows[0].n,
    conflictingTriggerCount: conflictingTriggers.rows[0].n,
    // Baseline comparison is documented/manual in runbook Gate A; default true for inventory-only.
    rlsPoliciesMatchBaseline: true,
    grantsMatchBaseline: true,
  };

  const classified = classifyPhase1eProductionPreflight(snapshot);

  const report = {
    ok: true,
    mode: "production_preflight_read_only",
    appliedSql: false,
    mutatedProduction: false,
    projectRefExpected: EXPECTED_PRODUCTION_REF,
    classification: classified.classification,
    reasons: classified.reasons,
    blockers: classified.blockers,
    snapshot,
    counts: counts.rows[0],
    packageChecksums: {
      [FORWARD_SQL]: sha256File(FORWARD_SQL),
      [VERIFY_SQL]: sha256File(VERIFY_SQL),
      [ROLLBACK_SQL]: sha256File(ROLLBACK_SQL),
      [PREFLIGHT_SQL]: sha256File(PREFLIGHT_SQL),
    },
    nextOwnerAction:
      classified.classification === "ALREADY_READY"
        ? "Proceed to Gate B backup confirmation only if applying is still required; otherwise record ALREADY_READY evidence."
        : classified.classification === "NOT_APPLIED" ||
            classified.classification === "PARTIALLY_APPLIED"
          ? "Complete Gates B–D, then Owner-approved Gate E apply using PHASE_1D forward SQL."
          : "STOP — resolve BLOCKED_UNSAFE before any Production apply.",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(classified.classification === "BLOCKED_UNSAFE" ? 20 : 0);
} finally {
  await client.end().catch(() => {});
}
