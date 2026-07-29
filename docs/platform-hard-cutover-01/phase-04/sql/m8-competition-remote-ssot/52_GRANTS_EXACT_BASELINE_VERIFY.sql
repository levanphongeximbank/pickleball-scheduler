-- M8 Competition Remote SSOT — 52 grants exact baseline VERIFY (read-only)
-- Expected authenticated matrix = 50_GRANTS minus intentional 51 participants DELETE harden.

-- A) Exact authenticated privilege matrix (unexpected rows = FAIL)
WITH expected(table_name, privilege_type) AS (
  VALUES
    ('competition_ssot_competitions','SELECT'),
    ('competition_ssot_competitions','INSERT'),
    ('competition_ssot_competitions','UPDATE'),
    ('competition_ssot_participants','SELECT'),
    ('competition_ssot_participants','INSERT'),
    ('competition_ssot_participants','UPDATE'),
    ('competition_ssot_matches','SELECT'),
    ('competition_ssot_matches','INSERT'),
    ('competition_ssot_matches','UPDATE'),
    ('competition_ssot_finalized_results','SELECT'),
    ('competition_ssot_standings_snapshots','SELECT'),
    ('competition_ssot_standings_snapshots','INSERT'),
    ('competition_ssot_command_log','SELECT'),
    ('competition_ssot_audit_events','SELECT'),
    ('competition_ssot_idempotency','SELECT'),
    ('competition_ssot_idempotency','INSERT')
),
actual AS (
  SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name LIKE 'competition_ssot_%'
    AND grantee = 'authenticated'
)
SELECT 'UNEXPECTED' AS kind, a.table_name, a.privilege_type
FROM actual a
LEFT JOIN expected e
  ON e.table_name = a.table_name AND e.privilege_type = a.privilege_type
WHERE e.privilege_type IS NULL
UNION ALL
SELECT 'MISSING' AS kind, e.table_name, e.privilege_type
FROM expected e
LEFT JOIN actual a
  ON a.table_name = e.table_name AND a.privilege_type = e.privilege_type
WHERE a.privilege_type IS NULL
ORDER BY 1, 2, 3;

-- B) anon table grants must be empty
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'competition_ssot_%'
  AND grantee = 'anon'
ORDER BY 1, 2;

-- C) anon EXECUTE on 3 RPCs must be false
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'competition_ssot_append_command',
    'competition_ssot_upsert_working_score',
    'competition_ssot_finalize_match_result'
  )
ORDER BY 1;

-- D) service_role ALL equivalent (7 core privileges per table)
SELECT table_name, count(*) AS privilege_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'competition_ssot_%'
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
GROUP BY table_name
ORDER BY 1;

-- E) sequence USAGE+SELECT
SELECT c.relname AS sequence_name,
       has_sequence_privilege('authenticated', c.oid, 'USAGE') AS auth_usage,
       has_sequence_privilege('authenticated', c.oid, 'SELECT') AS auth_select,
       has_sequence_privilege('service_role', c.oid, 'USAGE') AS svc_usage,
       has_sequence_privilege('service_role', c.oid, 'SELECT') AS svc_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND c.relname IN (
    'competition_ssot_command_log_id_seq',
    'competition_ssot_audit_events_id_seq'
  )
ORDER BY 1;

-- F) RPC text-tenant SECURITY DEFINER
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'competition_ssot_append_command',
    'competition_ssot_upsert_working_score',
    'competition_ssot_finalize_match_result'
  )
ORDER BY 1;

-- G) RLS enabled + FORCE on all 8
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'competition_ssot_%'
ORDER BY 1;
