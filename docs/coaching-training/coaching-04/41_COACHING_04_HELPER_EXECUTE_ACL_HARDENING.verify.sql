-- =============================================================================
-- COACHING-04 — Helper ACL hardening verification (READ ONLY)
-- Companion to 41_COACHING_04_HELPER_EXECUTE_ACL_HARDENING.sql
-- Status: AUTHORED ONLY — run after Owner-authorized patch apply.
-- No writes. No apply. No secrets.
-- =============================================================================

SET search_path = public, pg_temp;

-- Expect: anon_execute_count = 0, service_role_execute_count = 0,
--         authenticated_execute_count = 12 for the exact helper set.
SELECT
  count(*) FILTER (
    WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
  )::int AS anon_execute_count,
  count(*) FILTER (
    WHERE has_function_privilege('service_role', p.oid, 'EXECUTE')
  )::int AS service_role_execute_count,
  count(*) FILTER (
    WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )::int AS authenticated_execute_count,
  count(*)::int AS helper_count
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    (p.proname = 'coaching_04_actor_uid' AND pg_get_function_identity_arguments(p.oid) = '')
    OR (p.proname = 'coaching_04_active_coach_reference_id' AND pg_get_function_identity_arguments(p.oid) = '')
    OR (p.proname = 'coaching_04_coach_assigned_to_player' AND pg_get_function_identity_arguments(p.oid) = 'text, text')
    OR (p.proname = 'coaching_04_coach_owns_session' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_coach_can_access_enrollment' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_coach_can_access_program' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_has_assigned_action' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_mapped_player_id' AND pg_get_function_identity_arguments(p.oid) = '')
    OR (p.proname = 'coaching_04_player_is_self' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_player_identity_is_mapped' AND pg_get_function_identity_arguments(p.oid) = '')
    OR (p.proname = 'coaching_04_has_self_action' AND pg_get_function_identity_arguments(p.oid) = 'text')
    OR (p.proname = 'coaching_04_player_can_access_enrollment' AND pg_get_function_identity_arguments(p.oid) = 'text')
  );

-- Mutation RPCs must remain authenticated-only (no anon / service_role drift).
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'coaching_04_record_assigned_attendance',
    'coaching_04_submit_assigned_evaluation',
    'coaching_04_consume_assigned_entitlement'
  )
ORDER BY p.proname;

-- Expect zero rows: no coaching_04_* policy USING/CHECK true.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'coaching_04_%'
  AND (
    lower(coalesce(qual, '')) IN ('true', '(true)')
    OR lower(coalesce(with_check, '')) IN ('true', '(true)')
  )
ORDER BY tablename, policyname;

-- Policy inventory must remain present (no drift / drop).
SELECT count(*)::int AS coaching_04_policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'coaching_04_%';
