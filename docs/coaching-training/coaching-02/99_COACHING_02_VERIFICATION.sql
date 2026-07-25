-- =============================================================================
-- COACHING-02 — Verification / readiness (READ-ONLY)
-- Purpose: Re-runnable checks after an Owner-authorized apply.
-- Status: AUTHORED ONLY — do not execute against any database in COACHING-02.
-- No writes. No apply. No secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- Expected tables
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'coaching_programs',
    'coaching_coach_references',
    'coaching_coach_player_relationships',
    'coaching_enrollments',
    'coaching_curricula',
    'coaching_lessons',
    'coaching_training_sessions',
    'coaching_attendance_records',
    'coaching_attendance_corrections',
    'coaching_packages',
    'coaching_package_entitlements',
    'coaching_package_usage_events',
    'coaching_evaluations'
  )
ORDER BY c.relname;

-- RLS enabled + forced
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname LIKE 'coaching_%'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Policies (expect no USING (true) / WITH CHECK (true) — inspect manually)
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'coaching_%'
ORDER BY tablename, policyname;

-- Version / lifecycle constraints presence (sample)
SELECT conname, conrelid::regclass AS table_name
FROM pg_constraint
WHERE conname LIKE 'coaching_%'
  AND (conname LIKE '%version%' OR conname LIKE '%status%')
ORDER BY conname;

-- Indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'coaching_%'
ORDER BY tablename, indexname;

-- RPC signatures
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'coaching_apply_attendance_correction',
    'coaching_consume_entitlement',
    'coaching_02_scope_allows',
    'coaching_02_has_action',
    'coaching_attendance_corrections_immutable_guard',
    'coaching_package_usage_events_immutable_guard',
    'coaching_evaluations_submitted_immutable_guard'
  )
ORDER BY p.proname;

-- search_path fixed on SECURITY DEFINER coaching functions
SELECT p.proname, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'coaching_%'
ORDER BY p.proname;

-- No PUBLIC execute on atomic RPCs
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'coaching_apply_attendance_correction',
    'coaching_consume_entitlement'
  )
ORDER BY routine_name, grantee;

-- No anon table write grants
SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name LIKE 'coaching_%'
  AND grantee IN ('anon', 'PUBLIC')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
ORDER BY table_name, grantee, privilege_type;

-- Append-only triggers present
SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND tgname IN (
    'coaching_attendance_corrections_immutable_trg',
    'coaching_package_usage_events_immutable_trg',
    'coaching_evaluations_submitted_immutable_trg'
  )
ORDER BY tgname;

-- Canonical action permission ids (catalog presence — optional until seed applied)
SELECT id
FROM public.permissions
WHERE id LIKE 'coaching.%'
ORDER BY id;

-- Phase 28 prototype tables (should NOT be treated as COACHING-02 readiness)
SELECT c.relname AS phase28_legacy_table
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'coaching_coaches',
    'coaching_students',
    'coaching_classes',
    'coaching_schedule'
  )
ORDER BY c.relname;
