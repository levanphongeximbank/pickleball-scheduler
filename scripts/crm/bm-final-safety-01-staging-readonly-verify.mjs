#!/usr/bin/env node
/**
 * BM-FINAL-SAFETY-01 — catalog/data fingerprint verification.
 *
 * This script is intentionally Staging-only and executes one explicit
 * READ ONLY transaction. It never calls application RPCs and never emits
 * credentials or row contents.
 */
import { loadProjectEnv } from "../load-env.mjs";

const STAGING_REF = "qyewbxjsiiyufanzcjcq";
const PRODUCTION_REF = "expuvcohlcjzvrrauvud";

const SQL = String.raw`
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH
target_tables(name) AS (
  VALUES
    ('crm_tags'),
    ('crm_tag_assignments'),
    ('crm_consent_records'),
    ('crm_pending_events')
),
target_functions(name) AS (
  VALUES
    ('crm_phase1g_scope_allows'),
    ('crm_claim_pending_events'),
    ('crm_release_expired_pending_event_claims'),
    ('crm_consent_records_immutable_guard')
),
table_state AS (
  SELECT
    t.name,
    c.relkind,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced,
    obj_description(c.oid, 'pg_class') IS NOT NULL AS comment_present
  FROM target_tables t
  LEFT JOIN pg_class c
    ON c.relname = t.name
   AND c.relnamespace = 'public'::regnamespace
),
column_state AS (
  SELECT md5(coalesce(string_agg(
    concat_ws('|', table_name, ordinal_position, column_name, data_type,
      is_nullable, coalesce(column_default, '')),
    E'\n' ORDER BY table_name, ordinal_position
  ), '')) AS fingerprint
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN (SELECT name FROM target_tables)
),
function_state AS (
  SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS security_definer,
    coalesce(array_to_string(p.proconfig, ','), '') AS config,
    md5(pg_get_functiondef(p.oid)) AS definition_sha256_surrogate
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN (SELECT name FROM target_functions)
),
policy_state AS (
  SELECT
    c.relname AS table_name,
    p.polname AS policy_name,
    p.polcmd AS command,
    pg_get_userbyid(p.polroles[1]) AS first_role,
    md5(concat_ws('|',
      coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
      coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
    )) AS expression_fingerprint
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (SELECT name FROM target_tables)
),
constraint_state AS (
  SELECT
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    md5(pg_get_constraintdef(con.oid, true)) AS definition_fingerprint
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (SELECT name FROM target_tables)
),
index_state AS (
  SELECT
    tablename AS table_name,
    indexname AS index_name,
    md5(indexdef) AS definition_fingerprint
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN (SELECT name FROM target_tables)
),
trigger_state AS (
  SELECT
    c.relname AS table_name,
    t.tgname AS trigger_name,
    md5(pg_get_triggerdef(t.oid, true)) AS definition_fingerprint
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (SELECT name FROM target_tables)
    AND NOT t.tgisinternal
),
table_grant_state AS (
  SELECT table_name, grantor, grantee, privilege_type, is_grantable
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN (SELECT name FROM target_tables)
    AND grantee IN ('PUBLIC', 'anon', 'authenticated')
),
routine_grant_state AS (
  SELECT routine_name, grantor, grantee, privilege_type, is_grantable
  FROM information_schema.routine_privileges
  WHERE specific_schema = 'public'
    AND routine_name IN (SELECT name FROM target_functions)
    AND grantee IN ('PUBLIC', 'anon', 'authenticated')
),
default_acl_state AS (
  SELECT
    owner_role.rolname AS owner_role,
    coalesce(n.nspname, '*') AS schema_name,
    d.defaclobjtype AS object_type,
    grantee_role.rolname AS grantee,
    x.privilege_type
  FROM pg_default_acl d
  CROSS JOIN LATERAL aclexplode(d.defaclacl) x
  JOIN pg_roles owner_role ON owner_role.oid = d.defaclrole
  LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  LEFT JOIN pg_roles grantee_role ON grantee_role.oid = x.grantee
  WHERE coalesce(n.nspname, 'public') = 'public'
    AND grantee_role.rolname IN ('anon', 'authenticated')
),
migration_state AS (
  SELECT
    count(*)::int AS total_rows,
    count(*) FILTER (WHERE to_jsonb(m)::text ILIKE '%crm%')::int AS crm_named_rows
  FROM supabase_migrations.schema_migrations m
)
SELECT jsonb_build_object(
  'transactionReadOnly', current_setting('transaction_read_only'),
  'databaseNameFingerprint', md5(current_database()),
  'tables', (SELECT jsonb_agg(to_jsonb(s) ORDER BY name) FROM table_state s),
  'columnFingerprint', (SELECT fingerprint FROM column_state),
  'viewsWithCrmPrefix', (
    SELECT count(*)::int FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname LIKE 'crm_%'
      AND relkind IN ('v', 'm')
  ),
  'functions', (SELECT jsonb_agg(to_jsonb(s) ORDER BY proname, arguments) FROM function_state s),
  'policies', (SELECT jsonb_agg(to_jsonb(s) ORDER BY table_name, policy_name) FROM policy_state s),
  'constraints', (SELECT jsonb_agg(to_jsonb(s) ORDER BY table_name, constraint_name) FROM constraint_state s),
  'indexes', (SELECT jsonb_agg(to_jsonb(s) ORDER BY table_name, index_name) FROM index_state s),
  'triggers', (SELECT jsonb_agg(to_jsonb(s) ORDER BY table_name, trigger_name) FROM trigger_state s),
  'tableGrants', (SELECT jsonb_agg(to_jsonb(s) ORDER BY table_name, grantee, privilege_type) FROM table_grant_state s),
  'routineGrants', (SELECT jsonb_agg(to_jsonb(s) ORDER BY routine_name, grantee, privilege_type) FROM routine_grant_state s),
  'defaultAcls', (SELECT jsonb_agg(to_jsonb(s) ORDER BY owner_role, schema_name, object_type, grantee, privilege_type) FROM default_acl_state s),
  'rowCounts', jsonb_build_object(
    'crm_tags', (SELECT count(*)::int FROM public.crm_tags),
    'crm_tag_assignments', (SELECT count(*)::int FROM public.crm_tag_assignments),
    'crm_consent_records', (SELECT count(*)::int FROM public.crm_consent_records),
    'crm_pending_events', (SELECT count(*)::int FROM public.crm_pending_events)
  ),
  'dataFingerprints', jsonb_build_object(
    'crm_tags', (SELECT md5(coalesce(string_agg(tag_id, E'\n' ORDER BY tag_id), '')) FROM public.crm_tags),
    'crm_tag_assignments', (SELECT md5(coalesce(string_agg(assignment_id, E'\n' ORDER BY assignment_id), '')) FROM public.crm_tag_assignments),
    'crm_consent_records', (SELECT md5(coalesce(string_agg(consent_id, E'\n' ORDER BY consent_id), '')) FROM public.crm_consent_records),
    'crm_pending_events', (SELECT md5(coalesce(string_agg(pending_event_id, E'\n' ORDER BY pending_event_id), '')) FROM public.crm_pending_events)
  ),
  'permissionRows', (
    SELECT count(*)::int FROM public.permissions
    WHERE module = 'crm' OR id LIKE 'crm.%'
  ),
  'permissionDuplicateIds', (
    SELECT count(*)::int
    FROM (
      SELECT id FROM public.permissions
      WHERE module = 'crm' OR id LIKE 'crm.%'
      GROUP BY id HAVING count(*) > 1
    ) d
  ),
  'permissionFingerprint', (
    SELECT md5(coalesce(string_agg(
      concat_ws('|', id, module, action, coalesce(description, '')),
      E'\n' ORDER BY id
    ), ''))
    FROM public.permissions
    WHERE module = 'crm' OR id LIKE 'crm.%'
  ),
  'roleMatrixRows', (
    SELECT count(*)::int FROM public.role_permissions
    WHERE permission_id LIKE 'crm.%'
  ),
  'duplicatePublicCrmRelations', (
    SELECT count(*)::int
    FROM (
      SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname LIKE 'crm_%'
      GROUP BY relname HAVING count(*) > 1
    ) d
  ),
  'migrationHistory', (SELECT to_jsonb(s) FROM migration_state s)
) AS verification;
ROLLBACK;
`;

function assertReadOnlySql(sql) {
  const normalized = sql.replace(/--.*$/gm, " ").replace(/\s+/g, " ").trim();
  if (!/^BEGIN TRANSACTION READ ONLY;/i.test(normalized) || !/ROLLBACK;$/i.test(normalized)) {
    throw new Error("Verifier must use an explicit READ ONLY transaction ending in ROLLBACK.");
  }
  if (/\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO)\b/i.test(normalized)) {
    throw new Error("Mutating SQL token detected; verification refused.");
  }
}

function rows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

async function main() {
  if (STAGING_REF === PRODUCTION_REF) throw new Error("Project identity collision.");
  assertReadOnlySql(SQL);
  loadProjectEnv();
  const accessToken = String(process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN is required but will not be printed.");

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: SQL }),
    }
  );
  if (!response.ok) {
    throw new Error(`Read-only catalog query failed with HTTP ${response.status}.`);
  }
  const body = await response.json();
  const result = rows(body).find((row) => row?.verification)?.verification;
  if (!result || result.transactionReadOnly !== "on") {
    throw new Error("Database did not attest transaction_read_only=on.");
  }
  console.log(JSON.stringify({
    artifact: "BM_FINAL_SAFETY_01_STAGING_READONLY_VERIFICATION",
    ok: true,
    mode: "read-only",
    stagingProjectRef: STAGING_REF,
    productionProjectRefBlocked: PRODUCTION_REF,
    productionTouched: false,
    databaseWrites: 0,
    applicationRpcCalls: 0,
    sqlApplied: false,
    rollbackIssued: true,
    secretsPrinted: false,
    verifiedAt: new Date().toISOString(),
    result,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    artifact: "BM_FINAL_SAFETY_01_STAGING_READONLY_VERIFICATION",
    ok: false,
    databaseWrites: 0,
    sqlApplied: false,
    secretsPrinted: false,
    error: String(error?.message || error).slice(0, 180),
  }, null, 2));
  process.exitCode = 1;
});
