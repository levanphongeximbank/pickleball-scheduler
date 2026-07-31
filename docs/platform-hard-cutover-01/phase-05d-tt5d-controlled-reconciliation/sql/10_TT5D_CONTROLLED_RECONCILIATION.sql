-- Phase 5D-A authored reconciliation — DO NOT EXECUTE in Phase 5D-A.
-- Atomic, fail-closed. Target Staging ONLY (qyewbxjsiiyufanzcjcq).
-- Forbidden Production ref: expuvcohlcjzvrrauvud.
-- Catalog/ACL/volatility reconciliation only. No table drops, truncates, or business-row deletes. No secrets.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Phase 5D-specific advisory lock
SELECT pg_advisory_xact_lock(hashtextextended('phase5d_tt5d_controlled_reconciliation', 0));

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
  ) THEN
    RAISE EXCEPTION 'PHASE5D_PROVENANCE_ALREADY_PRESENT';
  END IF;

  IF to_regclass('public.club_ai_data') IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE5D_TARGET_GUARD_FAILED club_ai_data present (not Staging fingerprint)';
  END IF;

  IF to_regclass('public.referee_assignments') IS NULL
     OR to_regclass('public.team_tournament_referee_correction_requests') IS NULL THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH required TT5D tables absent';
  END IF;

  -- Volatility baseline for effective_status
  IF (
    SELECT CASE p.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'referee_v5_assignment_effective_status'
      AND pg_get_function_identity_arguments(p.oid) =
          'p_status text, p_expires_at timestamp with time zone, p_revoked_at timestamp with time zone'
  ) IS DISTINCT FROM 'IMMUTABLE' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH expected IMMUTABLE effective_status before mutate';
  END IF;

  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) <> '11b7d3121eb0efd7c05cf2fd8a92da19' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'referee_v5_apply_admin_result_revision';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) <> 'e7854c03e3ffebf81a7928d6b8740ad5' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'referee_v5_assert_assignment_write';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) <> 'c91ffb1ec3faa1e6fa2b3ea9395c4058' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'referee_v5_assignment_effective_status';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) <> '2223a22afbef0ccccc0d0df04ae873f1' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'referee_v5_current_user_has_assignment';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) <> '0f2e5ea3915cf34cdb0297ac3a844d4d' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) <> '08f6d53845ba88c750caef815543fa46' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_create_referee_assignment';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) <> '9ec273071d309641425a3d30d704a14b' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_list_referee_assignments';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) <> '513f41aabc74d5864a879d714796b53a' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_list_referee_corrections';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) <> '4229dd7686b6eaae990e9353e764f927' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_referee_match_access_ops';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) <> '81f3b086288dc8da26700349bbbab3b2' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_reopen_referee_match';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) <> '42b96c5091086edfc822392ed49999d2' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_request_referee_correction';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) <> '175c9ee13eeefaccdbb67160cd0a5a16' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_review_referee_correction';
  END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) <> 'f3280a760c9f4449aee6916d16c5026d' THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH function def_md5 %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH anon execute %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH authenticated execute %', 'team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH service_role execute %', 'team_tournament_revoke_referee_assignment';
  END IF;

  -- Table ACL baseline (authenticated ALL)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'team_tournament_referee_correction_requests'
      AND c.relacl::text = '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'
  ) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH correction table ACL';
  END IF;

  -- Policy presence
  IF (
    SELECT count(*) FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND pol.polname IN ('tt5d_correction_referee_select', 'tt5d_correction_no_client_write')
  ) <> 2 THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH TT5D policies';
  END IF;
END
$guard$;

-- 1) Volatility correction (body unchanged)
ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) STABLE;

-- 2) Function ACL reconciliation to package allowlist + explicit PUBLIC/anon revoke
-- referee_v5_apply_admin_result_revision
REVOKE ALL ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) TO service_role;

-- referee_v5_assert_assignment_write
REVOKE ALL ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) TO authenticated, service_role;

-- referee_v5_assignment_effective_status
REVOKE ALL ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) TO authenticated, service_role;

-- referee_v5_current_user_has_assignment
REVOKE ALL ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) TO authenticated;

-- referee_v5_mark_assignment_expired_if_needed
REVOKE ALL ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) TO authenticated, service_role;

-- team_tournament_create_referee_assignment
REVOKE ALL ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) TO authenticated;

-- team_tournament_list_referee_assignments
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_assignments(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_assignments(text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_assignments(text, text) TO authenticated;

-- team_tournament_list_referee_corrections
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_corrections(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_list_referee_corrections(text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_corrections(text, text) TO authenticated;

-- team_tournament_referee_match_access_ops
REVOKE ALL ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) TO authenticated;

-- team_tournament_reopen_referee_match
REVOKE ALL ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) TO authenticated;

-- team_tournament_request_referee_correction
REVOKE ALL ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) TO authenticated;

-- team_tournament_review_referee_correction
REVOKE ALL ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) TO authenticated;

-- team_tournament_revoke_referee_assignment
REVOKE ALL ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) TO authenticated;

-- 3) Table ACL: authenticated SELECT only (package intent)
REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM authenticated;
GRANT SELECT ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
-- service_role ALL retained (package intent); ensure present
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

-- 4) Controlled migration provenance (only after mutations above succeed)
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260731150000',
  'phase5d_tt5d_controlled_reconciliation',
  ARRAY['phase5d_tt5d_controlled_reconciliation_volatility_and_acl']
);

COMMIT;
