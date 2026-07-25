#!/usr/bin/env node
/**
 * PM-ID-01 — Remote Staging read-only preflight.
 *
 * Modes:
 *   (default)         offline static probe safety + local package checks
 *   --live-readonly   remote catalog probe BEGIN READ ONLY … ROLLBACK
 *
 * Refuses --execute / --apply. Never Production.
 * databaseWrites must stay 0. sqlApplied must stay false.
 * Does not create mapping rows. Does not grant roles.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  COACHING_03_STAGING_PROJECT_REF,
  COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST,
  assertCatalogQueryReadOnly,
  getCoaching03RepoRoot,
  inspectCoaching03EnvironmentIdentity,
  loadCoaching03StagingEnv,
  redactSecrets,
} from "../../src/features/coaching/staging/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = "docs/player-management/pm-id-01/evidence";
const PACK_DIR = "docs/player-management/pm-id-01";
const STAGING_REF = "qyewbxjsiiyufanzcjcq";

const VERDICTS = Object.freeze({
  OFFLINE_PASS: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_OFFLINE_PASS",
  LIVE_PASS: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_PASS",
  REMOTE_BLOCKED: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED",
  FAIL: "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_FAIL",
  APPLY_REFUSED: "PM_ID_01_APPLY_REFUSED",
});

function parseArgs(argv) {
  const args = {
    liveReadonly: false,
    environment: "staging",
    execute: false,
    apply: false,
  };
  for (const raw of argv) {
    if (raw === "--live-readonly") args.liveReadonly = true;
    else if (raw.startsWith("--environment=")) {
      args.environment = String(raw.slice("--environment=".length)).toLowerCase();
    } else if (raw === "--execute") args.execute = true;
    else if (raw === "--apply" || raw === "--apply-staging") args.apply = true;
  }
  return args;
}

/**
 * Catalog / aggregate probe only. No PII row content. No writes.
 */
export function buildPmId01ReadOnlyPreflightSql() {
  return `
BEGIN TRANSACTION READ ONLY;
SET search_path = public, pg_temp;

SELECT version() AS pg_version;

SELECT
  current_database() AS database_name,
  current_user AS current_user_name,
  current_setting('transaction_read_only', true) AS transaction_read_only;

SELECT
  to_regclass('public.profiles') IS NOT NULL AS profiles_present,
  to_regclass('public.club_members') IS NOT NULL AS club_members_present,
  to_regclass('public.clubs') IS NOT NULL AS clubs_present,
  to_regclass('public.venues') IS NOT NULL AS venues_present,
  to_regclass('public.athletes') IS NOT NULL AS athletes_present,
  to_regclass('public.player_identity_links') IS NOT NULL AS player_identity_links_present,
  to_regclass('public.permissions') IS NOT NULL AS permissions_present;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type,
  a.attnotnull AS not_null
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('id', 'player_id', 'status', 'venue_id', 'club_id')
ORDER BY a.attname;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'club_members'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('user_id', 'club_id', 'status', 'tenant_id')
ORDER BY a.attname;

SELECT
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS data_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'clubs'
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN ('id', 'tenant_id')
ORDER BY a.attname;

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'player_identity_%'
    OR p.proname IN (
      'team_tournament_user_player_id',
      'user_venue_id',
      'user_club_id',
      'user_has_permission',
      'is_super_admin',
      'coaching_04_mapped_player_id'
    )
  )
ORDER BY p.proname, identity_args;

SELECT
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (
    c.relname = 'player_identity_links'
    OR c.relname LIKE 'player_identity_%'
  )
ORDER BY c.relname;

SELECT
  CASE
    WHEN to_regclass('public.permissions') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.permissions
      WHERE id = 'player.identity_link.manage'
         OR id LIKE 'player.identity_link.%'
    )
  END AS player_identity_link_permission_count;

SELECT
  CASE
    WHEN to_regclass('public.profiles') IS NULL THEN -1
    ELSE (SELECT count(*)::int FROM public.profiles)
  END AS profiles_aggregate_count;

SELECT
  CASE
    WHEN to_regclass('public.club_members') IS NULL THEN -1
    ELSE (
      SELECT count(*)::int
      FROM public.club_members
      WHERE status = 'active'
    )
  END AS active_club_members_aggregate_count;

ROLLBACK;
`.trim();
}

function writeEvidence(repoRoot, filename, payload) {
  const dir = path.join(repoRoot, EVIDENCE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = path.join(dir, filename);
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return target;
}

function runOffline(repoRoot) {
  /** @type {string[]} */
  const errors = [];
  const probeSql = buildPmId01ReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(probeSql);
  if (!safety.ok) errors.push(...safety.errors);

  if (STAGING_REF !== COACHING_03_STAGING_PROJECT_REF) {
    errors.push("Staging project ref mismatch with verified constant");
  }

  const required = [
    "00_PM_ID_01_EXECUTIVE_SUMMARY.md",
    "10_PM_ID_01_MAPPING_TABLE.sql",
    "30_PM_ID_01_RESOLUTION_HELPERS.sql",
    "50_PM_ID_01_RLS_AND_GRANTS.sql",
    "90_PM_ID_01_ROLLBACK.sql",
    "99_PM_ID_01_VERIFICATION.sql",
  ];
  for (const name of required) {
    const p = path.join(repoRoot, PACK_DIR, name);
    if (!existsSync(p)) errors.push(`Missing package file: ${name}`);
  }

  const helpers = path.join(repoRoot, PACK_DIR, "30_PM_ID_01_RESOLUTION_HELPERS.sql");
  if (existsSync(helpers)) {
    const text = readFileSync(helpers, "utf8");
    if (!/auth\.uid\(\)/.test(text)) errors.push("Resolve helper missing auth.uid()");
    if (!/player_identity_is_mapped/.test(text)) {
      errors.push("RLS boolean helper missing");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    probeReadOnlyOk: safety.ok,
    stagingProjectRef: STAGING_REF,
    databaseWrites: 0,
    sqlApplied: false,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
  };
}

function interpretLiveBody(body) {
  const blob = JSON.stringify(body || {});
  return {
    resultRowCount: Array.isArray(body) ? body.length : null,
    playerIdentityLinksPresent: /player_identity_links/.test(blob),
    playerIdentityHelpersPresent: /player_identity_resolve_mapping|player_identity_is_mapped/.test(
      blob
    ),
    coachingMappedHelperPresent: /coaching_04_mapped_player_id/.test(blob),
    note: "Catalog probe only. Presence of authored objects expected false until Owner GO apply.",
  };
}

async function runLive(accessToken) {
  const sql = buildPmId01ReadOnlyPreflightSql();
  const safety = assertCatalogQueryReadOnly(sql);
  if (!safety.ok) {
    return {
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message: "Read-only enforcement failed before network.",
      errors: safety.errors,
      sqlApplied: false,
      databaseWrites: 0,
      mappingRowsCreated: 0,
      backfillExecuted: false,
      roleGrantsApplied: false,
      productionTouched: false,
      filesDeleted: false,
      CODEX_DELETE_ALLOWED: "NO",
    };
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      verdict: VERDICTS.FAIL,
      message: redactSecrets(body?.message || body?.error || `HTTP ${res.status}`),
      sqlApplied: false,
      databaseWrites: 0,
      mappingRowsCreated: 0,
      backfillExecuted: false,
      roleGrantsApplied: false,
      productionTouched: false,
      readOnlyTransaction: true,
      filesDeleted: false,
      CODEX_DELETE_ALLOWED: "NO",
      secretsPrinted: false,
    };
  }

  return {
    ok: true,
    verdict: VERDICTS.LIVE_PASS,
    stagingProjectRef: STAGING_REF,
    readOnlyTransaction: true,
    beginReadOnly: true,
    rollback: true,
    sqlApplied: false,
    databaseWrites: 0,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
    secretsPrinted: false,
    catalogInterpretation: interpretLiveBody(body),
  };
}

async function main() {
  const repoRoot = getCoaching03RepoRoot() || path.resolve(__dirname, "../..");
  const args = parseArgs(process.argv.slice(2));
  loadCoaching03StagingEnv({ repoRoot });

  const safetyBase = {
    phase: "PM-ID-01-REMOTE-READ-ONLY-PREFLIGHT",
    sqlApplied: false,
    databaseWrites: 0,
    mappingRowsCreated: 0,
    backfillExecuted: false,
    roleGrantsApplied: false,
    productionTouched: false,
    filesDeleted: false,
    CODEX_DELETE_ALLOWED: "NO",
  };

  if (args.execute || args.apply) {
    const refused = {
      ...safetyBase,
      ok: false,
      verdict: VERDICTS.APPLY_REFUSED,
      message: "PM-ID-01 preflight refuses --execute/--apply. Owner GO required separately.",
    };
    writeEvidence(repoRoot, "PM_ID_01_APPLY_REFUSED.json", refused);
    console.log(JSON.stringify(refused, null, 2));
    process.exitCode = 2;
    return;
  }

  if (args.environment !== "staging") {
    const blocked = {
      ...safetyBase,
      ok: false,
      verdict: VERDICTS.FAIL,
      message: `Environment must be staging; got ${args.environment}`,
    };
    writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const offline = runOffline(repoRoot);
  const identity = inspectCoaching03EnvironmentIdentity(process.env);
  if (
    identity?.resolvedProjectRef &&
    COACHING_03_PRODUCTION_PROJECT_REF_BLOCKLIST.includes(identity.resolvedProjectRef)
  ) {
    const blocked = {
      ...safetyBase,
      ...offline,
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message: "Production project ref detected — refusing remote connection.",
    };
    writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_OFFLINE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!args.liveReadonly) {
    const payload = {
      ...safetyBase,
      ...offline,
      ok: offline.ok,
      verdict: offline.ok ? VERDICTS.OFFLINE_PASS : VERDICTS.FAIL,
      mode: "offline",
    };
    writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_OFFLINE.json", payload);
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = offline.ok ? 0 : 1;
    return;
  }

  if (!offline.ok) {
    const blocked = {
      ...safetyBase,
      ...offline,
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message: "Offline read-only checks failed; not connecting.",
    };
    writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_LIVE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const token =
    process.env.SUPABASE_ACCESS_TOKEN ||
    process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN ||
    "";
  if (!token) {
    const blocked = {
      ...safetyBase,
      ...offline,
      ok: false,
      verdict: VERDICTS.REMOTE_BLOCKED,
      message:
        "PM_ID_01_REMOTE_READ_ONLY_PREFLIGHT_BLOCKED: no management access token for read-only Staging probe.",
    };
    writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_LIVE.json", blocked);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const live = await runLive(token);
  const payload = {
    ...safetyBase,
    offline,
    ...live,
  };
  writeEvidence(repoRoot, "PM_ID_01_PREFLIGHT_LIVE.json", payload);
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = live.ok ? 0 : 1;
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          verdict: VERDICTS.FAIL,
          message: String(error?.message || error),
          databaseWrites: 0,
          sqlApplied: false,
          mappingRowsCreated: 0,
          filesDeleted: false,
          CODEX_DELETE_ALLOWED: "NO",
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  });
}
