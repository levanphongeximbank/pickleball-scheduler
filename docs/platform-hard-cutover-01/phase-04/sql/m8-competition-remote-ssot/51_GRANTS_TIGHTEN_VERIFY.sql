-- M8 Competition Remote SSOT — 51 grants tighten VERIFY (read-only)
-- PASS when all result sets match expectations documented in comments.

-- A) anon table grants must be empty
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'competition_ssot_%'
  AND grantee = 'anon'
ORDER BY 1, 2;

-- B) anon EXECUTE on the three RPCs must be false
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
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

-- C) authenticated must NOT retain DELETE/TRUNCATE/REFERENCES/TRIGGER on any SSOT table
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'competition_ssot_%'
  AND grantee = 'authenticated'
  AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
ORDER BY 1, 2;

-- D) authenticated must retain package-50 required privileges (participants DELETE intentionally absent after 51)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'authenticated'
  AND (
    (table_name = 'competition_ssot_competitions' AND privilege_type IN ('SELECT','INSERT','UPDATE'))
    OR (table_name = 'competition_ssot_participants' AND privilege_type IN ('SELECT','INSERT','UPDATE'))
    OR (table_name = 'competition_ssot_matches' AND privilege_type IN ('SELECT','INSERT','UPDATE'))
    OR (table_name = 'competition_ssot_finalized_results' AND privilege_type = 'SELECT')
    OR (table_name = 'competition_ssot_standings_snapshots' AND privilege_type IN ('SELECT','INSERT'))
    OR (table_name = 'competition_ssot_command_log' AND privilege_type = 'SELECT')
    OR (table_name = 'competition_ssot_audit_events' AND privilege_type = 'SELECT')
    OR (table_name = 'competition_ssot_idempotency' AND privilege_type IN ('SELECT','INSERT'))
  )
ORDER BY 1, 2;

-- E) service_role must retain full table privileges (ALL equivalent set)
SELECT table_name, count(*) AS privilege_count
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'competition_ssot_%'
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
GROUP BY table_name
ORDER BY 1;

-- F) sequence USAGE+SELECT for authenticated + service_role
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

-- G) RPC signatures remain text-tenant SECURITY DEFINER
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

-- H) FAIL signal helper: required authenticated privileges missing
WITH required(table_name, privilege_type) AS (
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
)
SELECT r.table_name, r.privilege_type
FROM required r
LEFT JOIN information_schema.role_table_grants g
  ON g.table_schema = 'public'
 AND g.table_name = r.table_name
 AND g.grantee = 'authenticated'
 AND g.privilege_type = r.privilege_type
WHERE g.privilege_type IS NULL
ORDER BY 1, 2;
