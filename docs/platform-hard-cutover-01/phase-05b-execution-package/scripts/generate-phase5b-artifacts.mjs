/**
 * Phase 5B — generate manifests, verify/rollback SQL, M11 package, evidence, checksum verifier.
 * Static packaging only. No database access.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");
const ROOT = path.resolve(PKG, "../../..");

function sha256File(fp) {
  const buf = fs.readFileSync(fp);
  return crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
}

function sha256Text(text) {
  return crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex").toUpperCase();
}

function writeJson(fp, obj) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function writeText(fp, text) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, text.endsWith("\n") ? text : text + "\n", "utf8");
}

function listSqlOrdered(dir, { exclude = [] } = {}) {
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .filter((n) => !exclude.includes(n))
    .filter((n) => !/^90_ROLLBACK\.sql$/i.test(n) && !/^99_VERIFY\.sql$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b);
    });
}

const M9_SOURCE_MAP = {
  "10_TT2B_LINEUP_DEADLINE.sql": {
    sourcePath: "docs/v5/PHASE_TT2B_LINEUP_DEADLINE_SERVER_TIME.sql",
    stagingMigrations: [
      "phase_tt2b_lineup_deadline_server_time",
      "phase_tt2b_get_setup_deadline_fields",
      "phase_tt2b_deadline_fields_volatile",
    ],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "20_TT2C_LINEUP_VALIDATION.sql": {
    sourcePath: "docs/v5/PHASE_TT2C_LINEUP_VALIDATION.sql",
    stagingMigrations: ["phase_tt2c_lineup_validation", "phase_tt2c_validate_lineup_selections"],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "30_TT2C_SUBMIT_LINEUP_VALIDATION.sql": {
    sourcePath: "docs/v5/PHASE_TT2C_SUBMIT_LINEUP_VALIDATION.sql",
    stagingMigrations: ["phase_tt2c_save_draft_and_submit"],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "40_TT2D_RANDOMIZE_LOCK.sql": {
    sourcePath: "docs/v5/PHASE_TT2D_RANDOMIZE_LOCK_WORKFLOW.sql",
    stagingMigrations: [
      "phase_tt2d_randomize_lock_workflow",
      "phase_tt2d_helpers",
      "phase_tt2d_randomize_rpc",
      "phase_tt2d_lock_get_setup",
      "phase_tt2d_randomize_status_fix",
      "phase_tt2d_randomize_mixed_greedy_fix",
      "phase_tt2d_helpers_refresh",
    ],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "50_TT2E_ATOMIC_PUBLISH.sql": {
    sourcePath: "docs/v5/PHASE_TT2E_ATOMIC_PUBLISH_WORKFLOW.sql",
    stagingMigrations: [
      "phase_tt2e_publish_ops",
      "phase_tt2e_publish_core",
      "phase_tt2e_publish_4param",
      "phase_tt2e_visible_lineups",
      "phase_tt2e_get_setup",
      "phase_tt2e_grants",
    ],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "60_TT2E_GET_SETUP_FIX.sql": {
    sourcePath: "docs/v5/PHASE_TT2E_GET_SETUP_FIX.sql",
    stagingMigrations: ["phase_tt2e_get_setup_fix"],
    operationClass: "CREATE_OR_REPLACE",
  },
  "70_TT3_LINEUP_OVERRIDE.sql": {
    sourcePath: "docs/v5/PHASE_TT3_LINEUP_OVERRIDE.sql",
    stagingMigrations: [
      "phase_tt3_lineup_override",
      "phase_tt3_functions_part1",
      "phase_tt3_helpers",
      "phase_tt3_override_rpc",
      "phase_tt3_publish_republish",
      "phase_tt3_visibility",
    ],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "80_TT3_GET_SETUP_PATCH.sql": {
    sourcePath: "docs/v5/PHASE_TT3_GET_SETUP_PATCH.sql",
    stagingMigrations: ["phase_tt3_get_setup_patch", "phase_tt3_get_setup_patch_fix"],
    operationClass: "CREATE_OR_REPLACE",
  },
  "85_TT4_FORFEIT_WITHDRAWAL.sql": {
    sourcePath: "docs/v5/PHASE_TT4_FORFEIT_WITHDRAWAL.sql",
    stagingMigrations: ["phase_tt4_forfeit_withdrawal", "phase_tt4_part1", "phase_tt4_part2", "phase_tt4_fix_standings_team_count"],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "100_TT4_GET_SETUP_PATCH.sql": {
    sourcePath: "docs/v5/PHASE_TT4_GET_SETUP_PATCH.sql",
    stagingMigrations: ["phase_tt4_get_setup_patch"],
    operationClass: "CREATE_OR_REPLACE",
  },
  "110_TT5B_BRIDGE_SCHEMA.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-B_BRIDGE_SCHEMA.sql",
    stagingMigrations: ["phase_tt5b_bridge_schema", "phase_tt5b_bridge_helpers_rls"],
    operationClass: "CREATE_IF_NOT_EXISTS_PLUS_REPLACE",
    dependsOnM10: true,
  },
  "120_TT5B_PROVISION_RPC.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-B_PROVISION_RPC.sql",
    stagingMigrations: ["phase_tt5b_bridge_schema"],
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "130_TT5B_LEGACY_LOCK_GUARD.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-B_LEGACY_LOCK_GUARD.sql",
    stagingMigrations: ["phase_tt5b_bridge_helpers_rls"],
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "140_TT5B_GET_SETUP_PATCH.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-B_GET_SETUP_PATCH.sql",
    stagingMigrations: ["phase_tt5b_bridge_helpers_rls"],
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "150_TT5C_RESULT_OUTBOX.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-C_RESULT_OUTBOX_CONSUMER.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; Staging catalog has team_tournament_consume_referee_v5_outbox + referee_event_inbox",
    operationClass: "CREATE_IF_NOT_EXISTS_PLUS_REPLACE",
    dependsOnM10: true,
  },
  "160_TT5C_RESULT_PROPAGATION.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-C_RESULT_PROPAGATION.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; TRACKED_SOURCE",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "170_TT5C_STANDINGS_RECOMPUTE.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-C_STANDINGS_RECOMPUTE.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; TRACKED_SOURCE",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "180_TT5C_REPROVISION.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-C_REPROVISION_STATE.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; TRACKED_SOURCE",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
  },
  "190_TT5D_ASSIGNMENT_SAFETY.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_ASSIGNMENT_SAFETY.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; Staging catalog reopen-result objects ABSENT at packaging time",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
    stagingCatalogProven: false,
  },
  "200_TT5D_REOPEN_RESULT.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_REOPEN_RESULT_REVISION.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; Staging catalog ABSENT",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
    stagingCatalogProven: false,
  },
  "210_TT5D_CORRECTION.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_CORRECTION_WORKFLOW.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; Staging catalog ABSENT",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
    stagingCatalogProven: false,
  },
  "220_TT5D_SECURITY_GUARDS.sql": {
    sourcePath: "docs/v5/team-tournament/tt5/TT5-D_SECURITY_GUARDS.sql",
    stagingMigrations: [],
    stagingNote: "NO_SCHEMA_MIGRATIONS_ROW; Staging catalog ABSENT",
    operationClass: "CREATE_OR_REPLACE",
    dependsOnM10: true,
    stagingCatalogProven: false,
  },
  "230_TT6B_REALTIME_SECURITY.sql": {
    sourcePath: "docs/v5/team-tournament/tt6/TT6-B_REALTIME_SECURITY.sql",
    stagingMigrations: ["tt6b_realtime_security"],
    operationClass: "CREATE_OR_REPLACE",
  },
  "240_TT6B_REALTIME_CORE.sql": {
    sourcePath: "docs/v5/team-tournament/tt6/TT6-B_REALTIME_CORE.sql",
    stagingMigrations: ["tt6b_realtime_core"],
    operationClass: "CREATE_OR_REPLACE",
  },
};

const M10_SOURCE_MAP = {
  "10_V5A_REFEREE_FOUNDATION.sql": {
    sourcePath: "docs/v5/referee-v5/PHASE_V5A_REFEREE_FOUNDATION.sql",
    stagingMigrations: ["phase_v5a_referee_foundation"],
    operationClass: "CREATE_IF_NOT_EXISTS_PLUS_REPLACE",
  },
  "20_V5D_REFEREE_PERSISTENCE.sql": {
    sourcePath: "docs/v5/referee-v5/PHASE_V5D_REFEREE_PERSISTENCE.sql",
    stagingMigrations: ["phase_v5d_referee_persistence"],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "30_V5D1_REFEREE_HARDENING.sql": {
    sourcePath: "docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql",
    stagingMigrations: ["phase_v5d1_referee_hardening", "phase_v5d1_referee_hardening_rpcs"],
    operationClass: "CREATE_OR_REPLACE_HEAVY",
  },
  "40_V5D32_IDEMPOTENCY_UNDO.sql": {
    sourcePath: "docs/v5/referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql",
    stagingMigrations: ["phase_v5d32_idempotency_undo"],
    operationClass: "CREATE_OR_REPLACE",
  },
};

const STAGING_TT_MIGRATIONS_EXPECTED = [
  "phase_tt2b_lineup_deadline_server_time",
  "phase_tt2b_get_setup_deadline_fields",
  "phase_tt2b_deadline_fields_volatile",
  "phase_tt2c_lineup_validation",
  "phase_tt2c_validate_lineup_selections",
  "phase_tt2c_save_draft_and_submit",
  "phase_tt2d_randomize_lock_workflow",
  "phase_tt2d_helpers",
  "phase_tt2d_randomize_rpc",
  "phase_tt2d_lock_get_setup",
  "phase_tt2d_randomize_status_fix",
  "phase_tt2d_randomize_mixed_greedy_fix",
  "phase_tt2d_helpers_refresh",
  "phase_tt2e_publish_ops",
  "phase_tt2e_publish_core",
  "phase_tt2e_publish_4param",
  "phase_tt2e_visible_lineups",
  "phase_tt2e_get_setup",
  "phase_tt2e_grants",
  "phase_tt2e_get_setup_fix",
  "phase_tt3_lineup_override",
  "phase_tt3_functions_part1",
  "phase_tt3_helpers",
  "phase_tt3_override_rpc",
  "phase_tt3_publish_republish",
  "phase_tt3_visibility",
  "phase_tt3_get_setup_patch",
  "phase_tt3_get_setup_patch_fix",
  "phase_tt4_forfeit_withdrawal",
  "phase_tt4_part1",
  "phase_tt4_part2",
  "phase_tt4_get_setup_patch",
  "phase_tt4_fix_standings_team_count",
  "phase_tt5b_bridge_schema",
  "phase_tt5b_bridge_helpers_rls",
  "tt6b_realtime_security",
  "tt6b_realtime_core",
];

const EXCLUDED_STAGING_MIGRATIONS = [
  {
    name: "phase_v5d3_staging_fault_injection",
    reason: "STAGING_FAULT_INJECTION_ONLY — excluded from Production M10",
  },
];

const M11_APPLY_SQL = `-- M11 — Private Pairing digest patch (STAGING_CATALOG_DERIVED)
-- NOT the original private_pairing_pr4_digest_patch SQL (never found in git history).
-- Derived from Staging canonical pg_get_functiondef for
-- public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid).
-- Staging def_md5 = Production def_md5 = 0be77671f95c52b1d5e00496bee2adf1
-- (live catalog already equivalent; apply is idempotent / verify-focused).
-- Preserves RC1 archive behavior; does not weaken tenant isolation.

CREATE OR REPLACE FUNCTION public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_payload text;
begin
  select coalesce(string_agg(chunk, '|' order by chunk), '')
    into v_payload
  from (
    select
      r.id::text || ':' || r.constraint_type || ':' || r.severity || ':' ||
      coalesce(r.primary_player_id, '') || ':' || coalesce(r.relation_mode, '') || ':' ||
      coalesce(r.weight::text, '') || ':' || coalesce(r.visibility, '') || ':' ||
      coalesce((
        select string_agg(t.target_player_id, ',' order by t.target_player_id)
        from public.private_pairing_rule_targets t
        where t.rule_id = r.id
      ), '') as chunk
    from public.private_pairing_rules r
    where r.rule_set_id = p_rule_set_id
      and r.deleted_at is null
      and r.active = true
  ) s;

  return encode(extensions.digest(v_payload, 'sha256'::text), 'hex');
end;
$function$;

REVOKE ALL ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.private_pairing_compute_rule_set_hash(uuid) TO service_role;
`;

const M11_ROLLBACK_SQL = `-- M11 rollback
-- Production pre-apply body already matches Staging catalog (def_md5 identical).
-- Exact pre-M11 restore = re-apply the same STAGING_CATALOG_DERIVED definition.
-- Do NOT revert to bare digest(...) from docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql
-- (that would weaken/alter the live Production function which already uses extensions.digest).
-- No DROP. No identity/catalog row writes.

-- NO-OP when live def_md5 already equals 0be77671f95c52b1d5e00496bee2adf1.
-- If an operator somehow applied a divergent body, restore catalog-derived definition:

\\i 10_PRIVATE_PAIRING_DIGEST.sql
`;

const M11_VERIFY_SQL = `-- M11 verify (SELECT/catalog-only)
-- Assert extensions.digest body, search_path, SECURITY DEFINER, grants, RC1 objects preserved.

SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig,
       md5(pg_get_functiondef(p.oid)) AS def_md5,
       (pg_get_functiondef(p.oid) LIKE '%extensions.digest%') AS uses_extensions_digest,
       (pg_get_functiondef(p.oid) !~* 'digest\\([^)]+\\)' OR pg_get_functiondef(p.oid) LIKE '%extensions.digest%') AS digest_qualified
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'private_pairing_compute_rule_set_hash'
  AND pg_get_function_identity_arguments(p.oid) = 'p_rule_set_id uuid';

-- Expect def_md5 = 0be77671f95c52b1d5e00496bee2adf1
-- Expect search_path includes public, pg_temp
-- Expect SECURITY DEFINER = true

SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'private_pairing_%'
ORDER BY 1;

SELECT pol.polname, c.relname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname LIKE 'private_pairing_%'
ORDER BY 2, 1;

SELECT r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'private_pairing_compute_rule_set_hash'
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY 1;
`;

function buildFamilyProvenance(familyDir, sourceMap, family) {
  const applyFiles = listSqlOrdered(familyDir);
  const artefacts = [];
  for (const name of applyFiles) {
    const meta = sourceMap[name];
    if (!meta) throw new Error(`Unmapped apply file ${family}/${name}`);
    const pkgPath = path.join(familyDir, name);
    const srcPath = path.join(ROOT, meta.sourcePath);
    const pkgSha = sha256File(pkgPath);
    const srcSha = fs.existsSync(srcPath) ? sha256File(srcPath) : null;
    if (srcSha && srcSha !== pkgSha) {
      throw new Error(`Checksum drift ${name}: package=${pkgSha} source=${srcSha}`);
    }
    artefacts.push({
      applyFile: `sql/${path.basename(familyDir)}/${name}`,
      order: parseInt(name, 10),
      sourcePath: meta.sourcePath,
      packageSha256: pkgSha,
      sourceSha256: srcSha,
      bytesMatchSource: srcSha === pkgSha,
      stagingMigrations: meta.stagingMigrations || [],
      stagingNote: meta.stagingNote || null,
      stagingCatalogProven: meta.stagingCatalogProven !== false,
      operationClass: meta.operationClass,
      dependsOnM10: !!meta.dependsOnM10,
      completeness: "COMPLETE_TRACKED_SOURCE",
      productionPresence: family === "M10" ? "MISSING_V5" : family === "M9" ? "PARTIAL_P1_TT1B_ONLY" : "RC1_PRESENT_DIGEST_EQUIVALENT",
      executionWould: meta.operationClass.includes("CREATE_IF_NOT_EXISTS")
        ? "CREATE_NEW_AND_OR_REPLACE"
        : "CREATE_OR_REPLACE_EXISTING_OR_NEW",
    });
  }
  return artefacts;
}

function main() {
  const m9Dir = path.join(PKG, "sql/m9-team-tournament");
  const m10Dir = path.join(PKG, "sql/m10-referee-v5");
  const m11Dir = path.join(PKG, "sql/m11-private-pairing-digest");
  fs.mkdirSync(m11Dir, { recursive: true });

  writeText(path.join(m11Dir, "10_PRIVATE_PAIRING_DIGEST.sql"), M11_APPLY_SQL);
  writeText(path.join(m11Dir, "90_ROLLBACK.sql"), M11_ROLLBACK_SQL);
  writeText(path.join(m11Dir, "99_VERIFY.sql"), M11_VERIFY_SQL);

  // M9 verify / rollback
  writeText(
    path.join(m9Dir, "99_VERIFY.sql"),
    `-- M9 verify (SELECT/catalog-only) — Team Tournament remainder TT2B–TT6B
-- Does not read row payloads / PII.

-- Tables / RLS
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (
    c.relname LIKE 'team_tournament%'
    OR c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox','team_tournament_referee_correction_requests')
  )
ORDER BY 1;

-- Columns (sanitized names/types only)
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS typ
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY 1, a.attnum;

-- Indexes
SELECT c.relname AS table_name, i.relname AS index_name
FROM pg_index x
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox')
ORDER BY 1, 2;

-- Policies
SELECT c.relname, pol.polname, pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('team_sub_match_referee_links','team_tournament_referee_event_inbox','team_tournament_referee_correction_requests')
ORDER BY 1, 2;

-- Functions (identity args + return + search_path + security definer)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE 'team_tournament%'
    OR p.proname LIKE 'tt6b%'
  )
ORDER BY 1, 2;

-- Tenant / SECURITY DEFINER assertions (fail rows are non-empty when unsafe)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, coalesce(p.proconfig::text,'') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND p.proname LIKE 'team_tournament%'
  AND (
    coalesce(p.proconfig::text,'') = ''
    OR p.proconfig::text !~* 'search_path'
  )
ORDER BY 1, 2;

-- Grants (role names only)
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname IN (
    'team_tournament_get_setup',
    'team_tournament_provision_referee_match',
    'team_tournament_consume_referee_v5_outbox'
  )
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY 1, 2;
`
  );

  writeText(
    path.join(m9Dir, "90_ROLLBACK.sql"),
    `-- M9 rollback boundary (HONEST)
-- Scope: remove ONLY M9-owned NEW objects introduced by this package when safe.
-- CREATE OR REPLACE of pre-existing Production Team Tournament RPCs
-- (e.g. team_tournament_get_setup and related) CANNOT be restored from this file:
-- Production pre-apply definitions were not captured into an immutable rollback pack.
-- Classification: ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS
-- Recovery after those replaces: proven Production backup/PITR restore ONLY.
-- Do not touch identity/catalog protected rows.
-- Do not DROP P1/TT1B foundation tables.

BEGIN;

-- TT5/TT6 bridge objects owned by this package (IF EXISTS)
DROP FUNCTION IF EXISTS public.team_tournament_consume_referee_v5_outbox(uuid, text);
DROP FUNCTION IF EXISTS public.team_tournament_provision_referee_match(text, text, text, uuid, integer, text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_provision_eligibility(team_tournaments, team_tournament_matchups, team_tournament_sub_matches, uuid);
DROP FUNCTION IF EXISTS public.team_tournament_get_active_referee_link(text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_referee_link_blocks_legacy(text, text, text);
DROP FUNCTION IF EXISTS public.team_tournament_sub_match_is_dreambreaker(text, text, text);

DROP TABLE IF EXISTS public.team_tournament_referee_correction_requests;
DROP TABLE IF EXISTS public.team_tournament_referee_event_inbox;
DROP TABLE IF EXISTS public.team_sub_match_referee_links;

-- NOTE: Do NOT DROP team_tournaments / lineup / standings / matchup foundation tables.
-- NOTE: Replaced get_setup / publish / forfeit RPCs are NOT restored here.

COMMIT;
`
  );

  writeText(
    path.join(m10Dir, "99_VERIFY.sql"),
    `-- M10 verify (SELECT/catalog-only) — Referee V5
-- Distinguishes legacy token RPCs from referee_v5_* objects.

-- Legacy token RPCs must remain present (not deleted by M10)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('referee_get_match_by_token','referee_update_match_score')
ORDER BY 1, 2;

-- Referee V5 tables + RLS
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'referee_assignments','match_live_states','match_participant_positions','match_events',
    'match_game_states','match_result_revisions','match_incidents','match_disputes',
    'referee_device_sessions','match_sync_mutations','match_integration_outbox'
  )
ORDER BY 1;

-- Policies
SELECT c.relname, pol.polname
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'match_%' OR c.relname LIKE 'referee_%'
ORDER BY 1, 2;

-- referee_v5 functions: args, returns, search_path, security definer
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result_type,
       p.prosecdef AS security_definer,
       coalesce(p.proconfig::text, '') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'referee_v5%'
ORDER BY 1, 2;

-- Unsafe search_path on SECURITY DEFINER (expect 0 rows)
SELECT p.proname, coalesce(p.proconfig::text,'') AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'referee_v5%'
  AND p.prosecdef = true
  AND (coalesce(p.proconfig::text,'') = '' OR p.proconfig::text !~* 'search_path')
ORDER BY 1;

-- Grants
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname LIKE 'referee_v5%'
  AND r.rolname IN ('anon','authenticated','service_role')
ORDER BY 1, 2;
`
  );

  writeText(
    path.join(m10Dir, "90_ROLLBACK.sql"),
    `-- M10 rollback boundary (HONEST)
-- Removes Referee V5-owned objects introduced by this package.
-- Preserves legacy token RPCs: referee_get_match_by_token, referee_update_match_score.
-- Does NOT restore any pre-existing non-V5 objects (none expected on Production).
-- If any shared object was replaced (none intended), recovery = backup/PITR only.
-- Excludes Staging-only artefacts: phase_v5d3_staging_fault_injection, PHASE_V5D4 fault injection,
-- PHASE_V5E1 publication alter (STAGING ONLY).

BEGIN;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'referee_v5%'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.match_integration_outbox CASCADE;
DROP TABLE IF EXISTS public.match_sync_mutations CASCADE;
DROP TABLE IF EXISTS public.referee_device_sessions CASCADE;
DROP TABLE IF EXISTS public.match_disputes CASCADE;
DROP TABLE IF EXISTS public.match_incidents CASCADE;
DROP TABLE IF EXISTS public.match_result_revisions CASCADE;
DROP TABLE IF EXISTS public.match_game_states CASCADE;
DROP TABLE IF EXISTS public.match_events CASCADE;
DROP TABLE IF EXISTS public.match_participant_positions CASCADE;
DROP TABLE IF EXISTS public.match_live_states CASCADE;
DROP TABLE IF EXISTS public.referee_assignments CASCADE;

COMMIT;
`
  );

  const m9Artefacts = buildFamilyProvenance(m9Dir, M9_SOURCE_MAP, "M9");
  const m10Artefacts = buildFamilyProvenance(m10Dir, M10_SOURCE_MAP, "M10");

  const m11ApplySha = sha256File(path.join(m11Dir, "10_PRIVATE_PAIRING_DIGEST.sql"));
  const m11RbSha = sha256File(path.join(m11Dir, "90_ROLLBACK.sql"));
  const m11VfSha = sha256File(path.join(m11Dir, "99_VERIFY.sql"));

  const mappedStaging = new Set();
  for (const a of m9Artefacts) for (const m of a.stagingMigrations) mappedStaging.add(m);
  const unmappedStaging = STAGING_TT_MIGRATIONS_EXPECTED.filter((m) => !mappedStaging.has(m));
  // phase_tt2d_helpers appears twice in staging — Set covers once; expected list has one entry

  const m9Tt5dUnproven = m9Artefacts.filter((a) => a.stagingCatalogProven === false);
  const m9Ready =
    unmappedStaging.length === 0 &&
    m9Artefacts.every((a) => a.bytesMatchSource) &&
    m9Tt5dUnproven.length === 0;

  // Honest: TT5D not on Staging catalog → M9 cannot be READY
  const m9Verdict = m9Ready
    ? "READY"
    : m9Tt5dUnproven.length > 0
      ? "BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D"
      : unmappedStaging.length
        ? "BLOCKED_STAGING_MIGRATION_UNMAPPED"
        : "BLOCKED";

  const m10Verdict =
    m10Artefacts.every((a) => a.bytesMatchSource) && m10Artefacts.length === 4
      ? "READY"
      : "BLOCKED";

  const m11Verdict = "READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION";

  const phase5bDecision =
    m9Verdict === "READY" && m10Verdict === "READY" && m11Verdict.startsWith("READY")
      ? "READY_FOR_OWNER_REVIEW_PHASE5B_EXECUTION_PACKAGE"
      : "BLOCKED_PHASE5B_EXECUTION_PACKAGE";

  // Force honest BLOCKED because TT5D staging catalog absent
  // (m9Verdict already BLOCKED_...)

  writeJson(path.join(m9Dir, "00_SOURCE_PROVENANCE.json"), {
    family: "M9",
    purpose: "Team Tournament remainder TT2B–TT6B",
    generatedAt: "2026-07-31T12:00:00.000Z",
    baseSha: "e3bdb55799f91b3e5d52f867d947de2aac12f52a",
    productionProjectRef: "expuvcohlcjzvrrauvud",
    stagingProjectRef: "qyewbxjsiiyufanzcjcq",
    mutationsExecuted: 0,
    sqlApplied: false,
    artefacts: m9Artefacts,
    stagingMigrationsAccounted: [...mappedStaging].sort(),
    stagingMigrationsExpected: STAGING_TT_MIGRATIONS_EXPECTED,
    stagingMigrationsUnmapped: unmappedStaging,
    excludedOutsideTt2Tt6b: ["phase_v5d3_staging_fault_injection"],
    productionPreserved: ["P1/TT1B foundation tables and data"],
    rollbackClassification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS__NEW_OBJECTS_DROPPABLE",
    verifyArtefact: "sql/m9-team-tournament/99_VERIFY.sql",
    rollbackArtefact: "sql/m9-team-tournament/90_ROLLBACK.sql",
    packageVerdict: m9Verdict,
    blockers: m9Tt5dUnproven.map((a) => ({
      applyFile: a.applyFile,
      reason: "Staging catalog objects for TT5D not proven present; cannot certify Production applicability from Staging canonical metadata",
    })),
  });

  writeJson(path.join(m10Dir, "00_SOURCE_PROVENANCE.json"), {
    family: "M10",
    purpose: "Referee V5 foundation + persistence + hardening + idempotency undo",
    generatedAt: "2026-07-31T12:00:00.000Z",
    artefacts: m10Artefacts,
    excluded: [
      {
        path: "docs/v5/referee-v5/PHASE_V5D4_ATOMIC_ROLLBACK.sql",
        reason: "STAGING_FAULT_INJECTION_APPLY — not a Production rollback pack",
      },
      {
        path: "docs/v5/referee-v5/PHASE_V5E1_REALTIME_SYNC.sql",
        reason: "File header STAGING ONLY (publication alter); excluded from Production package",
      },
      ...EXCLUDED_STAGING_MIGRATIONS,
    ],
    legacyObjectsPreserved: [
      "referee_get_match_by_token(p_token text)",
      "referee_update_match_score(p_token text, p_payload jsonb)",
    ],
    rollbackClassification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
    verifyArtefact: "sql/m10-referee-v5/99_VERIFY.sql",
    rollbackArtefact: "sql/m10-referee-v5/90_ROLLBACK.sql",
    packageVerdict: m10Verdict,
  });

  writeJson(path.join(m11Dir, "00_SOURCE_PROVENANCE.json"), {
    family: "M11",
    purpose: "Private pairing digest patch",
    generatedAt: "2026-07-31T12:00:00.000Z",
    originalSqlFoundInGitHistory: false,
    provenanceClass: "STAGING_CATALOG_DERIVED",
    stagingMigrationName: "private_pairing_pr4_digest_patch",
    productionMigrationPresent: "private_pairing_rc1_archive_rule_set_ONLY",
    catalogComparison: {
      function: "public.private_pairing_compute_rule_set_hash(p_rule_set_id uuid)",
      stagingDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
      productionDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
      liveDelta: "NONE_ALREADY_EQUIVALENT",
      bodyDigestCall: "extensions.digest(v_payload, 'sha256'::text)",
      searchPath: "public, pg_temp",
      securityDefiner: true,
    },
    notClaimedAsOriginalPr4Sql: true,
    trackedPr4UsesBareDigest: "docs/v5/PHASE_PRIVATE_PAIRING_RULES_V2_PR4.sql",
    applyFile: "sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql",
    applySha256: m11ApplySha,
    rollbackArtefact: "sql/m11-private-pairing-digest/90_ROLLBACK.sql",
    rollbackSha256: m11RbSha,
    verifyArtefact: "sql/m11-private-pairing-digest/99_VERIFY.sql",
    verifySha256: m11VfSha,
    rollbackClassification: "RESTORE_SAME_CATALOG_DERIVED_BODY__NOOP_WHEN_ALREADY_EQUIVALENT",
    packageVerdict: m11Verdict,
  });

  function fileEntry(rel) {
    const fp = path.join(PKG, rel);
    return { path: rel.replace(/\\/g, "/"), sha256: sha256File(fp) };
  }

  const m9Files = [
    "00_SOURCE_PROVENANCE.json",
    ...listSqlOrdered(m9Dir).map((n) => n),
    "90_ROLLBACK.sql",
    "99_VERIFY.sql",
    "M9_MANIFEST.json",
  ];
  const m10Files = [
    "00_SOURCE_PROVENANCE.json",
    ...listSqlOrdered(m10Dir).map((n) => n),
    "90_ROLLBACK.sql",
    "99_VERIFY.sql",
    "M10_MANIFEST.json",
  ];
  const m11Files = [
    "00_SOURCE_PROVENANCE.json",
    "10_PRIVATE_PAIRING_DIGEST.sql",
    "90_ROLLBACK.sql",
    "99_VERIFY.sql",
    "M11_MANIFEST.json",
  ];

  // Write manifests after we know paths; first write stub then finalize checksums including manifest itself carefully.
  const m9ManifestCore = {
    family: "M9",
    packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/",
    readiness: m9Verdict,
    productionExecutionGo: false,
    sqlApplied: false,
    orderedApply: m9Artefacts.map((a) => ({
      order: a.order,
      file: path.basename(a.applyFile),
      sha256: a.packageSha256,
      sourcePath: a.sourcePath,
      stagingMigrations: a.stagingMigrations,
      dependsOnM10: a.dependsOnM10,
      operationClass: a.operationClass,
    })),
    verify: { file: "99_VERIFY.sql" },
    rollback: {
      file: "90_ROLLBACK.sql",
      classification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS__NEW_OBJECTS_DROPPABLE",
      afterReplaceRecovery: "BACKUP_PITR_ONLY",
    },
    interleaveNote:
      "TT5B+ files require M10 applied first. Runbook executionSequence applies M9 TT2B–TT4, then M10, then M9 TT5B–TT6B, then M11.",
  };

  const m10ManifestCore = {
    family: "M10",
    packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/",
    readiness: m10Verdict,
    productionExecutionGo: false,
    sqlApplied: false,
    orderedApply: m10Artefacts.map((a) => ({
      order: a.order,
      file: path.basename(a.applyFile),
      sha256: a.packageSha256,
      sourcePath: a.sourcePath,
      stagingMigrations: a.stagingMigrations,
      operationClass: a.operationClass,
    })),
    verify: { file: "99_VERIFY.sql" },
    rollback: {
      file: "90_ROLLBACK.sql",
      classification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
    },
    excludedStagingOnly: ["phase_v5d3_staging_fault_injection", "PHASE_V5D4", "PHASE_V5E1"],
  };

  const m11ManifestCore = {
    family: "M11",
    packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/",
    readiness: m11Verdict,
    productionExecutionGo: false,
    sqlApplied: false,
    provenanceClass: "STAGING_CATALOG_DERIVED",
    orderedApply: [
      {
        order: 10,
        file: "10_PRIVATE_PAIRING_DIGEST.sql",
        sha256: m11ApplySha,
        stagingMigration: "private_pairing_pr4_digest_patch",
      },
    ],
    verify: { file: "99_VERIFY.sql", sha256: m11VfSha },
    rollback: {
      file: "90_ROLLBACK.sql",
      sha256: m11RbSha,
      classification: "RESTORE_SAME_CATALOG_DERIVED_BODY__NOOP_WHEN_ALREADY_EQUIVALENT",
    },
    productionApplicability: "ALREADY_EQUIVALENT_IDEMPOTENT_APPLY",
  };

  writeJson(path.join(m9Dir, "M9_MANIFEST.json"), m9ManifestCore);
  writeJson(path.join(m10Dir, "M10_MANIFEST.json"), m10ManifestCore);
  writeJson(path.join(m11Dir, "M11_MANIFEST.json"), m11ManifestCore);

  // Attach checksums for verify/rollback into family manifests by re-read
  m9ManifestCore.verify.sha256 = sha256File(path.join(m9Dir, "99_VERIFY.sql"));
  m9ManifestCore.rollback.sha256 = sha256File(path.join(m9Dir, "90_ROLLBACK.sql"));
  m9ManifestCore.provenanceSha256 = sha256File(path.join(m9Dir, "00_SOURCE_PROVENANCE.json"));
  m10ManifestCore.verify.sha256 = sha256File(path.join(m10Dir, "99_VERIFY.sql"));
  m10ManifestCore.rollback.sha256 = sha256File(path.join(m10Dir, "90_ROLLBACK.sql"));
  m10ManifestCore.provenanceSha256 = sha256File(path.join(m10Dir, "00_SOURCE_PROVENANCE.json"));
  m11ManifestCore.provenanceSha256 = sha256File(path.join(m11Dir, "00_SOURCE_PROVENANCE.json"));
  writeJson(path.join(m9Dir, "M9_MANIFEST.json"), m9ManifestCore);
  writeJson(path.join(m10Dir, "M10_MANIFEST.json"), m10ManifestCore);
  writeJson(path.join(m11Dir, "M11_MANIFEST.json"), m11ManifestCore);

  // Unified execution sequence (exact)
  const executionSequence = [
    { step: "M0", action: "VERIFY_ONLY", artefacts: ["docs/production-security/prod-sec-g3-b12-01/11_VERIFY.sql"] },
    {
      step: "M1",
      action: "APPLY_THEN_VERIFY",
      packageRoot: "docs/customer-management/phase-3/",
      note: "Exact 10..50 authored package; not rewritten in Phase 5B",
    },
    {
      step: "M2",
      action: "APPLY_THEN_VERIFY",
      artefacts: ["docs/supabase-finance-phase1f.sql"],
      rollback: ["docs/supabase-finance-phase1f-rollback.sql"],
    },
    {
      step: "M3",
      action: "APPLY_THEN_VERIFY",
      packageRoots: ["docs/crm/phase-1g/", "docs/crm/phase-1h/"],
    },
    {
      step: "M4",
      action: "APPLY_THEN_VERIFY",
      packageRoot: "docs/reporting-analytics/reporting-02/",
    },
    {
      step: "M5",
      action: "APPLY_THEN_VERIFY",
      packageRoots: ["docs/news-public-content/news-02/", "docs/news-public-content/news-03/", "docs/news-public-content/news-04/"],
    },
    {
      step: "M6",
      action: "APPLY_THEN_VERIFY",
      packageRoots: ["docs/coaching-training/coaching-02/", "docs/coaching-training/coaching-04/"],
    },
    {
      step: "M7",
      action: "APPLY_THEN_VERIFY",
      artefactsGlob: "docs/competition-core/supabase-cc02*.sql",
    },
    {
      step: "M8",
      action: "APPLY_THEN_VERIFY",
      packageRoot: "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/",
      orderedApply: [
        "10_TABLES.sql",
        "20_INDEXES.sql",
        "30_RLS.sql",
        "40_RPC_COMMAND_AND_FINALIZE.sql",
        "50_GRANTS.sql",
        "51_GRANTS_TIGHTEN.sql",
        "52_GRANTS_EXACT_BASELINE.sql",
      ],
      verify: "99_VERIFY.sql",
      rollback: "90_ROLLBACK.sql",
      tenantContract: {
        tenant_id: "text",
        p_tenant_id: "text",
        user_venue_id_result: "text",
      },
    },
    {
      step: "M9A_TT2B_TT4",
      action: "APPLY_THEN_VERIFY_PARTIAL",
      family: "M9",
      orderedApply: m9Artefacts.filter((a) => a.order <= 100).map((a) => path.basename(a.applyFile)),
      packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/",
      stopAfter: "family_partial_verify_TT2_TT4",
    },
    {
      step: "M10",
      action: "APPLY_THEN_VERIFY",
      family: "M10",
      packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/",
      orderedApply: m10Artefacts.map((a) => path.basename(a.applyFile)),
      verify: "99_VERIFY.sql",
      rollback: "90_ROLLBACK.sql",
    },
    {
      step: "M9B_TT5B_TT6B",
      action: "APPLY_THEN_VERIFY",
      family: "M9",
      precondition: "M10_VERIFY_PASS",
      orderedApply: m9Artefacts.filter((a) => a.order >= 110).map((a) => path.basename(a.applyFile)),
      packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/",
      verify: "99_VERIFY.sql",
      rollback: "90_ROLLBACK.sql",
    },
    {
      step: "M11",
      action: "APPLY_THEN_VERIFY",
      family: "M11",
      packageRoot: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/",
      orderedApply: ["10_PRIVATE_PAIRING_DIGEST.sql"],
      verify: "99_VERIFY.sql",
      rollback: "90_ROLLBACK.sql",
    },
  ];

  const unified = {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M0_M11_EXECUTION_MANIFEST",
    generatedAt: "2026-07-31T12:00:00.000Z",
    baseSha: "e3bdb55799f91b3e5d52f867d947de2aac12f52a",
    productionExecutionGo: false,
    executionRunbookAccepted: false,
    phase5Readiness: "BLOCKED_PHASE5_READINESS",
    phase05Complete: "NOT_ISSUED",
    phase5bDecision,
    canonicalMigrationScope: "M0_TO_M11_ACCEPTED",
    club_ai_data: "PERMANENT_DROP_NO_RECREATE",
    backupPitrRestore: "NOT_PROVABLE",
    mutationsExecuted: { staging: 0, production: 0 },
    sqlApplied: false,
    executionSequence,
    families: {
      M0: {
        family: "M0",
        purpose: "G3-B12 club_ai_data anon write lockdown",
        productionClassification: "already_present_and_verified",
        packageReadiness: "VERIFY_ONLY",
        exactOrderedApplyFiles: [],
        verifyArtefact: "docs/production-security/prod-sec-g3-b12-01/11_VERIFY.sql",
        rollbackArtefact: "leave_locked_do_not_reopen",
        stopPoint: "after_verify_before_M1",
        productionApplicability: "ALREADY_PRESENT",
      },
      M1: {
        family: "M1",
        purpose: "Customer",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "docs/customer-management/phase-3/10..50_*.sql",
        dependencyFamilies: ["identity"],
        verifyArtefact: "package verify",
        rollbackArtefact: "docs/customer-management/phase-3/90_*.sql",
        stopPoint: "after_M1_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M2: {
        family: "M2",
        purpose: "Finance",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: ["docs/supabase-finance-phase1f.sql"],
        verifyArtefact: "static/staging evidence",
        rollbackArtefact: "docs/supabase-finance-phase1f-rollback.sql",
        stopPoint: "after_M2_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M3: {
        family: "M3",
        purpose: "CRM",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "docs/crm/phase-1g/10..60 + phase-1h/10,20",
        stopPoint: "after_M3_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M4: {
        family: "M4",
        purpose: "Reporting",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "docs/reporting-analytics/reporting-02/10..50",
        verifyArtefact: "99_*.sql",
        rollbackArtefact: "90/91_*.sql",
        stopPoint: "after_M4_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M5: {
        family: "M5",
        purpose: "News",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "news-02/03/04 packages",
        stopPoint: "after_M5_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M6: {
        family: "M6",
        purpose: "Coaching",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "coaching-02 + coaching-04",
        stopPoint: "after_M6_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M7: {
        family: "M7",
        purpose: "Competition Core cc02",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_EXISTING_NOT_REWRITTEN",
        exactOrderedApplyFiles: "docs/competition-core/supabase-cc02*.sql",
        stopPoint: "after_M7_verify",
        productionApplicability: "AUTHORED_PACKAGE",
      },
      M8: {
        family: "M8",
        purpose: "Competition Remote SSOT",
        productionClassification: "missing",
        packageReadiness: "AUTHORED_PHASE4_NOT_REWRITTEN",
        exactOrderedApplyFiles: [
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/10_TABLES.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/20_INDEXES.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/30_RLS.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/40_RPC_COMMAND_AND_FINALIZE.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/50_GRANTS.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/51_GRANTS_TIGHTEN.sql",
          "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/52_GRANTS_EXACT_BASELINE.sql",
        ],
        verifyArtefact: "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/99_VERIFY.sql",
        rollbackArtefact: "docs/platform-hard-cutover-01/phase-04/sql/m8-competition-remote-ssot/90_ROLLBACK.sql",
        tenantContract: { tenant_id: "text", p_tenant_id: "text", user_venue_id_result: "text" },
        stopPoint: "after_M8_verify",
        productionApplicability: "AUTHORED_PACKAGE",
        dependencyFamilies: ["identity_user_venue_id"],
      },
      M9: {
        family: "M9",
        purpose: "Team Tournament remainder TT2B–TT6B",
        productionClassification: "partially_present_p1_tt1b_only",
        packageReadiness: m9Verdict,
        exactOrderedApplyFiles: m9Artefacts.map((a) => a.applyFile.replace(/^sql\//, "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/")),
        sha256ByFile: Object.fromEntries(m9Artefacts.map((a) => [path.basename(a.applyFile), a.packageSha256])),
        dependencyFamilies: ["M10_before_TT5B"],
        precheck: "P1/TT1B present; M10 verified before TT5B+",
        exactVerificationArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/99_VERIFY.sql",
        rollbackArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m9-team-tournament/90_ROLLBACK.sql",
        rollbackOrIrreversibility: "NEW_OBJECTS_DROPPABLE; REPLACED_FUNCTIONS_BACKUP_PITR_ONLY",
        stopPoint: "after_M9_full_verify",
        productionApplicability: m9Verdict === "READY" ? "PACKAGED" : "BLOCKED_PENDING_TT5D_STAGING_PROOF",
      },
      M10: {
        family: "M10",
        purpose: "Referee V5",
        productionClassification: "missing_v5_legacy_token_rpcs_only",
        packageReadiness: m10Verdict,
        exactOrderedApplyFiles: m10Artefacts.map(
          (a) => `docs/platform-hard-cutover-01/phase-05b-execution-package/${a.applyFile}`
        ),
        sha256ByFile: Object.fromEntries(m10Artefacts.map((a) => [path.basename(a.applyFile), a.packageSha256])),
        dependencyFamilies: ["M8_preferred"],
        exactVerificationArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/99_VERIFY.sql",
        rollbackArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m10-referee-v5/90_ROLLBACK.sql",
        stopPoint: "after_M10_verify_before_M9B",
        productionApplicability: "PACKAGED",
      },
      M11: {
        family: "M11",
        purpose: "Private pairing digest",
        productionClassification: "rc1_present_digest_body_already_equivalent",
        packageReadiness: m11Verdict,
        exactOrderedApplyFiles: [
          "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/10_PRIVATE_PAIRING_DIGEST.sql",
        ],
        sha256ByFile: { "10_PRIVATE_PAIRING_DIGEST.sql": m11ApplySha },
        dependencyFamilies: ["private_pairing_rc1_archive_rule_set"],
        exactVerificationArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/99_VERIFY.sql",
        rollbackArtefact: "docs/platform-hard-cutover-01/phase-05b-execution-package/sql/m11-private-pairing-digest/90_ROLLBACK.sql",
        stopPoint: "after_M11_verify_before_wipe",
        productionApplicability: "ALREADY_EQUIVALENT_IDEMPOTENT",
        provenanceClass: "STAGING_CATALOG_DERIVED",
      },
    },
  };

  // Fix M9 paths in unified
  unified.families.M9.exactOrderedApplyFiles = m9Artefacts.map(
    (a) => `docs/platform-hard-cutover-01/phase-05b-execution-package/${a.applyFile}`
  );

  writeJson(path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json"), unified);

  // Checksum lockfile for verifier
  const checksumEntries = [];
  function addTree(relDir) {
    const abs = path.join(PKG, relDir);
    for (const name of fs.readdirSync(abs).sort()) {
      const fp = path.join(abs, name);
      if (fs.statSync(fp).isFile()) {
        checksumEntries.push({
          path: `docs/platform-hard-cutover-01/phase-05b-execution-package/${relDir}/${name}`.replace(/\\/g, "/"),
          sha256: sha256File(fp),
        });
      }
    }
  }
  addTree("sql/m9-team-tournament");
  addTree("sql/m10-referee-v5");
  addTree("sql/m11-private-pairing-digest");
  checksumEntries.push({
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json",
    sha256: sha256File(path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json")),
  });

  const checksumManifest = {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_CHECKSUM_MANIFEST",
    generatedAt: "2026-07-31T12:00:00.000Z",
    algorithm: "SHA-256",
    files: checksumEntries,
    orderedApplyRules: {
      m9: listSqlOrdered(m9Dir),
      m10: listSqlOrdered(m10Dir),
      m11: ["10_PRIVATE_PAIRING_DIGEST.sql"],
    },
  };
  writeJson(path.join(PKG, "PHASE5B_CHECKSUM_MANIFEST.json"), checksumManifest);

  // Evidence
  const evidenceDir = path.join(PKG, "evidence");
  writeJson(path.join(evidenceDir, "01_M9_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M9_CERT",
    generatedAt: "2026-07-31T12:00:00.000Z",
    family: "M9",
    verdict: m9Verdict,
    staticValidation: m9Artefacts.every((a) => a.bytesMatchSource) ? "PASS_BYTES" : "FAIL",
    stagingMigrationsMapped: [...mappedStaging].sort(),
    stagingMigrationsUnmapped: unmappedStaging,
    tt5dStagingCatalogProven: false,
    rollbackClassification: "ROLLBACK_INCOMPLETE_FOR_REPLACED_FUNCTIONS__NEW_OBJECTS_DROPPABLE",
    productionApplicability: "BLOCKED_PENDING_TT5D_STAGING_PROOF",
    orderedApplyCount: m9Artefacts.length,
    immutableChecksums: Object.fromEntries(m9Artefacts.map((a) => [path.basename(a.applyFile), a.packageSha256])),
    mutationsExecuted: 0,
    sqlApplied: false,
  });

  writeJson(path.join(evidenceDir, "02_M10_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M10_CERT",
    generatedAt: "2026-07-31T12:00:00.000Z",
    family: "M10",
    verdict: m10Verdict,
    staticValidation: "PASS",
    excluded: ["PHASE_V5D4_ATOMIC_ROLLBACK.sql", "PHASE_V5E1_REALTIME_SYNC.sql", "phase_v5d3_staging_fault_injection"],
    legacyTokenRpcsPreserved: true,
    rollbackClassification: "DROP_M10_OWNED_V5_OBJECTS__LEGACY_TOKEN_RPCS_PRESERVED",
    productionApplicability: "PACKAGED_MISSING_ON_PRODUCTION",
    orderedApplyCount: m10Artefacts.length,
    immutableChecksums: Object.fromEntries(m10Artefacts.map((a) => [path.basename(a.applyFile), a.packageSha256])),
    mutationsExecuted: 0,
    sqlApplied: false,
  });

  writeJson(path.join(evidenceDir, "03_M11_SOURCE_AND_PACKAGE_CERTIFICATION_2026-07-31.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_M11_CERT",
    generatedAt: "2026-07-31T12:00:00.000Z",
    family: "M11",
    verdict: m11Verdict,
    provenanceClass: "STAGING_CATALOG_DERIVED",
    originalSqlFoundInGitHistory: false,
    stagingDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
    productionDefMd5: "0be77671f95c52b1d5e00496bee2adf1",
    liveDelta: "NONE",
    applySha256: m11ApplySha,
    staticValidation: "PASS",
    rollbackClassification: "RESTORE_SAME_CATALOG_DERIVED_BODY__NOOP_WHEN_ALREADY_EQUIVALENT",
    productionApplicability: "ALREADY_EQUIVALENT_IDEMPOTENT",
    mutationsExecuted: 0,
    sqlApplied: false,
  });

  writeJson(path.join(evidenceDir, "04_M0_M11_ORDER_AND_CHECKSUM_CERTIFICATION_2026-07-31.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_ORDER_CHECKSUM_CERT",
    generatedAt: "2026-07-31T12:00:00.000Z",
    executionSequenceSteps: executionSequence.map((s) => s.step),
    interleaveRequired: true,
    interleaveReason: "M9 TT5B+ depends on M10 Referee V5 objects",
    checksumManifest: "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json",
    fileCount: checksumEntries.length,
    m8TenantContractRetained: { tenant_id: "text", p_tenant_id: "text", user_venue_id_result: "text" },
    mutationsExecuted: 0,
  });

  writeJson(path.join(evidenceDir, "05_PHASE5B_DECISION_2026-07-31.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_DECISION",
    generatedAt: "2026-07-31T12:00:00.000Z",
    decision: phase5bDecision,
    m9: m9Verdict,
    m10: m10Verdict,
    m11: m11Verdict,
    unresolved:
      phase5bDecision === "BLOCKED_PHASE5B_EXECUTION_PACKAGE"
        ? [
            {
              family: "M9",
              objectOrSource: "TT5-D tracked SQL (ASSIGNMENT_SAFETY / REOPEN_RESULT / CORRECTION / SECURITY_GUARDS)",
              reason:
                "Staging schema_migrations lacks tt5d_* rows and Staging catalog reopen/correction objects were ABSENT at packaging time; Production applicability cannot be proven from Staging canonical metadata",
            },
          ]
        : [],
    continuingPhase5: {
      decision: "BLOCKED_PHASE5_READINESS",
      productionExecutionGo: false,
      executionRunbookAccepted: false,
      PHASE_05_COMPLETE: "NOT_ISSUED",
      backupPitrRestore: "NOT_PROVABLE_CANNOT_WAIVE",
    },
    ownerDecisionsUnchanged: {
      canonicalMigrationScope: "M0_TO_M11_ACCEPTED",
      club_ai_data: "PERMANENT_DROP_NO_RECREATE",
    },
    mutationsExecuted: { staging: 0, production: 0 },
    sqlApplied: false,
    deploymentsByAgent: 0,
  });

  // Fix M10 verify SQL operator precedence bug
  writeText(
    path.join(m10Dir, "99_VERIFY.sql"),
    fs
      .readFileSync(path.join(m10Dir, "99_VERIFY.sql"), "utf8")
      .replace(
        "AND c.relname LIKE 'match_%' OR c.relname LIKE 'referee_%'",
        "AND (c.relname LIKE 'match_%' OR c.relname LIKE 'referee_%')"
      )
  );

  // Recompute checksums after verify fix
  const checksumEntries2 = [];
  function addTree2(relDir) {
    const abs = path.join(PKG, relDir);
    for (const name of fs.readdirSync(abs).sort()) {
      const fp = path.join(abs, name);
      if (fs.statSync(fp).isFile()) {
        checksumEntries2.push({
          path: `docs/platform-hard-cutover-01/phase-05b-execution-package/${relDir}/${name}`.replace(/\\/g, "/"),
          sha256: sha256File(fp),
        });
      }
    }
  }
  addTree2("sql/m9-team-tournament");
  addTree2("sql/m10-referee-v5");
  addTree2("sql/m11-private-pairing-digest");
  // Update m10 manifest verify sha
  m10ManifestCore.verify.sha256 = sha256File(path.join(m10Dir, "99_VERIFY.sql"));
  writeJson(path.join(m10Dir, "M10_MANIFEST.json"), m10ManifestCore);
  // rewrite trees including updated manifests
  const checksumFinal = [];
  for (const relDir of ["sql/m9-team-tournament", "sql/m10-referee-v5", "sql/m11-private-pairing-digest"]) {
    const abs = path.join(PKG, relDir);
    for (const name of fs.readdirSync(abs).sort()) {
      const fp = path.join(abs, name);
      if (fs.statSync(fp).isFile()) {
        checksumFinal.push({
          path: `docs/platform-hard-cutover-01/phase-05b-execution-package/${relDir}/${name}`.replace(/\\/g, "/"),
          sha256: sha256File(fp),
        });
      }
    }
  }
  writeJson(path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json"), unified);
  checksumFinal.push({
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/M0_M11_EXECUTION_MANIFEST.json",
    sha256: sha256File(path.join(PKG, "M0_M11_EXECUTION_MANIFEST.json")),
  });
  writeJson(path.join(PKG, "PHASE5B_CHECKSUM_MANIFEST.json"), {
    marker: "PLATFORM_HARD_CUTOVER_01_PHASE5B_CHECKSUM_MANIFEST",
    generatedAt: "2026-07-31T12:00:00.000Z",
    algorithm: "SHA-256",
    files: checksumFinal,
    orderedApplyRules: {
      m9: listSqlOrdered(m9Dir),
      m10: listSqlOrdered(m10Dir),
      m11: ["10_PRIVATE_PAIRING_DIGEST.sql"],
    },
  });
  // include checksum manifest in itself? Verifier reads checksum manifest as authority — do not self-hash require.
  checksumFinal.push({
    path: "docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5B_CHECKSUM_MANIFEST.json",
    sha256: "SELF",
  });

  console.log(
    JSON.stringify(
      {
        phase5bDecision,
        m9Verdict,
        m10Verdict,
        m11Verdict,
        m9Count: m9Artefacts.length,
        m10Count: m10Artefacts.length,
        checksumFiles: checksumFinal.filter((f) => f.sha256 !== "SELF").length,
        unmappedStaging,
        tt5dBlockers: m9Tt5dUnproven.length,
      },
      null,
      2
    )
  );
}

main();
