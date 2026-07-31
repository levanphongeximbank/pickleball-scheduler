-- Phase 5D post-apply verify — SELECT/DO checks only. Covers all 13 functions.
-- Author-only companion to 10_TT5D_CONTROLLED_RECONCILIATION.sql.

DO $verify$
BEGIN
  IF (
    SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'referee_v5_assignment_effective_status',
        'referee_v5_mark_assignment_expired_if_needed',
        'team_tournament_create_referee_assignment',
        'team_tournament_revoke_referee_assignment',
        'team_tournament_list_referee_assignments',
        'referee_v5_apply_admin_result_revision',
        'team_tournament_reopen_referee_match',
        'team_tournament_request_referee_correction',
        'team_tournament_review_referee_correction',
        'team_tournament_list_referee_corrections',
        'referee_v5_current_user_has_assignment',
        'referee_v5_assert_assignment_write',
        'team_tournament_referee_match_access_ops'
      )
  ) <> 13 THEN
    RAISE EXCEPTION 'VERIFY expected exactly 13 TT5D functions';
  END IF;


  -- referee_v5_apply_admin_result_revision
  IF to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'referee_v5_apply_admin_result_revision';
  END IF;

  -- referee_v5_assert_assignment_write
  IF to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'referee_v5_assert_assignment_write';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'referee_v5_assert_assignment_write';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'referee_v5_assert_assignment_write';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'referee_v5_assert_assignment_write';
  END IF;

  -- referee_v5_assignment_effective_status
  IF to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'referee_v5_assignment_effective_status';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'referee_v5_assignment_effective_status';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
  ) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'referee_v5_assignment_effective_status';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'referee_v5_assignment_effective_status';
  END IF;

  -- referee_v5_current_user_has_assignment
  IF to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'referee_v5_current_user_has_assignment';
  END IF;

  -- referee_v5_mark_assignment_expired_if_needed
  IF to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;

  -- team_tournament_create_referee_assignment
  IF to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_create_referee_assignment';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_create_referee_assignment';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_create_referee_assignment';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_create_referee_assignment';
  END IF;

  -- team_tournament_list_referee_assignments
  IF to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_list_referee_assignments';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_list_referee_assignments';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_list_referee_assignments';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_list_referee_assignments';
  END IF;

  -- team_tournament_list_referee_corrections
  IF to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_list_referee_corrections';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_list_referee_corrections';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_list_referee_corrections';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_list_referee_corrections';
  END IF;

  -- team_tournament_referee_match_access_ops
  IF to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_referee_match_access_ops';
  END IF;

  -- team_tournament_reopen_referee_match
  IF to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_reopen_referee_match';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_reopen_referee_match';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_reopen_referee_match';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_reopen_referee_match';
  END IF;

  -- team_tournament_request_referee_correction
  IF to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_request_referee_correction';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_request_referee_correction';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_request_referee_correction';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_request_referee_correction';
  END IF;

  -- team_tournament_review_referee_correction
  IF to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_review_referee_correction';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_review_referee_correction';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_review_referee_correction';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_review_referee_correction';
  END IF;

  -- team_tournament_revoke_referee_assignment
  IF to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NULL THEN
    RAISE EXCEPTION 'VERIFY missing %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF (
    SELECT p.prosecdef FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
  ) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF (
    SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.oid = to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon must be denied %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated grant %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role grant %', 'team_tournament_revoke_referee_assignment';
  END IF;

  -- Columns
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referee_assignments'
      AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
  ) <> 6 THEN
    RAISE EXCEPTION 'VERIFY missing TT5D columns';
  END IF;

  -- Status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'referee_assignments'
      AND c.conname = 'referee_assignments_status_check'
      AND pg_get_constraintdef(c.oid) LIKE '%pending%'
      AND pg_get_constraintdef(c.oid) LIKE '%completed%'
  ) THEN
    RAISE EXCEPTION 'VERIFY status_check';
  END IF;

  -- Indexes
  IF to_regclass('public.referee_assignments_sub_match_idx') IS NULL
     OR to_regclass('public.tt5d_correction_pending_idx') IS NULL THEN
    RAISE EXCEPTION 'VERIFY indexes';
  END IF;

  -- RLS + policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests'
      AND c.relrowsecurity IS TRUE
  ) THEN
    RAISE EXCEPTION 'VERIFY correction RLS';
  END IF;

  IF (
    SELECT count(*) FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public'
      AND pol.polname IN ('tt5d_correction_referee_select','tt5d_correction_no_client_write')
  ) <> 2 THEN
    RAISE EXCEPTION 'VERIFY policies';
  END IF;

  -- Table ACL: authenticated SELECT (not ALL write bits required absent ideally)
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFY authenticated SELECT';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'DELETE') THEN
    RAISE EXCEPTION 'VERIFY authenticated must not have write privileges';
  END IF;
  IF has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'SELECT') THEN
    RAISE EXCEPTION 'VERIFY anon table denied';
  END IF;

  -- Provenance
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '20260731150000' AND name = 'phase5d_tt5d_controlled_reconciliation'
  ) THEN
    RAISE EXCEPTION 'VERIFY migration provenance missing';
  END IF;

  RAISE NOTICE 'PHASE5D_POST_APPLY_VERIFY_PASS';
END
$verify$;
