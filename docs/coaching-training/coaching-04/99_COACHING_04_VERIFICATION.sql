-- =============================================================================
-- COACHING-04 — Verification (READ-ONLY style)
-- Purpose: Re-runnable checks after an Owner-authorized apply of COACHING-04.
-- Status: AUTHORED ONLY — do not execute against any database in authoring step.
-- No writes. No apply. No secrets.
--
-- Assertions (human-verified from query results):
--   A1 helpers coaching_04_* exist and are SECURITY DEFINER
--   A2 coaching_04_* policies exist on expected tables
--   A3 no coaching_04 policy qual/with_check is bare TRUE
--   A4 no PUBLIC/anon EXECUTE on coaching_04 RPCs/helpers
--   A5 no PLAYER role_permissions for coaching.*
--   A6 coaching.records.read is NOT granted to COACH
--   A7 COACHING-02 policies still present (not dropped by COACHING-04)
-- =============================================================================

SET search_path = public, pg_temp;

-- A1: helpers + RPCs exist / security definer / search_path config
-- Expect: all listed rows present; prosecdef = true; proconfig includes search_path
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'coaching_04_actor_uid',
    'coaching_04_active_coach_reference_id',
    'coaching_04_coach_assigned_to_player',
    'coaching_04_coach_owns_session',
    'coaching_04_coach_can_access_enrollment',
    'coaching_04_coach_can_access_program',
    'coaching_04_has_assigned_action',
    'coaching_04_record_assigned_attendance',
    'coaching_04_submit_assigned_evaluation',
    'coaching_04_consume_assigned_entitlement'
  )
ORDER BY p.proname;

-- A2: coaching_04_* policies present
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'coaching_04_%'
ORDER BY tablename, policyname;

-- A3: flag any coaching_04 policy with USING/CHECK true (must return zero rows)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'coaching_04_%'
  AND (
    lower(coalesce(qual, '')) IN ('true', '(true)')
    OR lower(coalesce(with_check, '')) IN ('true', '(true)')
  )
ORDER BY tablename, policyname;

-- A4: EXECUTE grants — PUBLIC/anon must be absent; authenticated expected for RPCs
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'coaching_04_actor_uid',
    'coaching_04_active_coach_reference_id',
    'coaching_04_coach_assigned_to_player',
    'coaching_04_coach_owns_session',
    'coaching_04_coach_can_access_enrollment',
    'coaching_04_coach_can_access_program',
    'coaching_04_has_assigned_action',
    'coaching_04_record_assigned_attendance',
    'coaching_04_submit_assigned_evaluation',
    'coaching_04_consume_assigned_entitlement'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY routine_name, grantee;

-- Expect: no rows for PUBLIC/anon/service_role EXECUTE on the three mutation RPCs
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'coaching_04_record_assigned_attendance',
    'coaching_04_submit_assigned_evaluation',
    'coaching_04_consume_assigned_entitlement'
  )
  AND grantee IN ('PUBLIC', 'anon', 'service_role')
ORDER BY routine_name, grantee;

-- A5: no PLAYER grants for coaching.*
-- Expect: zero rows
SELECT rp.role_id, rp.permission_id
FROM public.role_permissions rp
WHERE rp.role_id = 'PLAYER'
  AND (
    rp.permission_id LIKE 'coaching.%'
    OR EXISTS (
      SELECT 1 FROM public.permissions p
      WHERE p.id = rp.permission_id AND p.module = 'coaching'
    )
  )
ORDER BY rp.permission_id;

-- A6: coaching.records.read must NOT be granted to COACH
-- Expect: zero rows
SELECT rp.role_id, rp.permission_id
FROM public.role_permissions rp
WHERE rp.role_id = 'COACH'
  AND rp.permission_id = 'coaching.records.read';

-- COACH should only have the five assigned.* permissions (among coaching.*)
SELECT rp.permission_id
FROM public.role_permissions rp
WHERE rp.role_id = 'COACH'
  AND rp.permission_id LIKE 'coaching.%'
ORDER BY rp.permission_id;

-- A7: sample COACHING-02 policies still present (admin path not dropped)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'coaching_programs'
  AND policyname IN (
    'coaching_programs_select',
    'coaching_04_programs_select'
  )
ORDER BY policyname;

-- Permission catalog: five assigned seeds present
SELECT id, module, action
FROM public.permissions
WHERE id IN (
  'coaching.assigned.read',
  'coaching.assigned.session.schedule',
  'coaching.assigned.attendance.record',
  'coaching.assigned.evaluation.submit',
  'coaching.assigned.entitlement.consume'
)
ORDER BY id;

-- Confirm PLAYER mapping helpers were NOT created
-- Expect: zero rows
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'coaching_04_mapped_player_id',
    'coaching_04_actor_is_player',
    'coaching_04_player_self_id'
  )
ORDER BY p.proname;
