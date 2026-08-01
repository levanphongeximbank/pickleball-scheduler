-- Phase 5D post-apply verify — exact fingerprints/ACL/policy/provenance (WS_COLLAPSE_V1 for select policy).
DO $verify$
BEGIN

  IF (
    SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
    WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
  ) <> 13 THEN
    RAISE EXCEPTION 'VERIFY expected exactly 13 TT5D functions';
  END IF;

  IF (SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY referee_assignments owner';
  END IF;
  IF (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'VERIFY referee_assignments rls';
  END IF;
  IF (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'VERIFY referee_assignments rls_forced';
  END IF;

  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referee_assignments'
      AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
  ) <> 6 THEN RAISE EXCEPTION 'VERIFY tt5d columns count'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='referee_assignments' AND column_name='version'
      AND data_type='integer' AND is_nullable='NO' AND column_default='1'
  ) THEN RAISE EXCEPTION 'VERIFY version column'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
    WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
      AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
  ) THEN RAISE EXCEPTION 'VERIFY matchup_id fkey'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
    WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
      AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
  ) THEN RAISE EXCEPTION 'VERIFY sub_match_id fkey'; END IF;

  IF (
    SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='referee_assignments' AND c.conname='referee_assignments_status_check'
  ) IS DISTINCT FROM 'CHECK ((status = ANY (ARRAY[''pending''::text, ''active''::text, ''expired''::text, ''revoked''::text, ''completed''::text])))' THEN
    RAISE EXCEPTION 'VERIFY status_check';
  END IF;

  IF (
    SELECT pg_get_indexdef(i.oid) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='referee_assignments_sub_match_idx'
  ) IS DISTINCT FROM 'CREATE INDEX referee_assignments_sub_match_idx ON public.referee_assignments USING btree (sub_match_id, status) WHERE (sub_match_id IS NOT NULL)' THEN
    RAISE EXCEPTION 'VERIFY sub_match index def';
  END IF;
  IF (
    SELECT pg_get_userbyid(i.relowner) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='referee_assignments_sub_match_idx'
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY sub_match index owner';
  END IF;

  IF (
    SELECT pg_get_indexdef(i.oid) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='tt5d_correction_pending_idx'
  ) IS DISTINCT FROM 'CREATE INDEX tt5d_correction_pending_idx ON public.team_tournament_referee_correction_requests USING btree (tenant_id, tournament_id, status) WHERE (status = ''pending''::text)' THEN
    RAISE EXCEPTION 'VERIFY correction index def';
  END IF;
  IF (
    SELECT pg_get_userbyid(i.relowner) FROM pg_class i JOIN pg_namespace n ON n.oid=i.relnamespace
    WHERE n.nspname='public' AND i.relname='tt5d_correction_pending_idx'
  ) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY correction index owner';
  END IF;

  IF (SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY correction owner';
  END IF;
  IF (SELECT c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM '{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=arwdDxtm/postgres}' THEN
    RAISE EXCEPTION 'VERIFY correction acl';
  END IF;
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
  ) <> 25 THEN RAISE EXCEPTION 'VERIFY correction column count'; END IF;
  IF (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'VERIFY correction rls';
  END IF;
  IF (SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'VERIFY correction rls_forced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
      AND pol.polcmd='r'
      AND btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
      AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
      AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
  ) THEN RAISE EXCEPTION 'VERIFY policy select'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
      AND pol.polcmd='*'
      AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
      AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
      AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
  ) THEN RAISE EXCEPTION 'VERIFY policy no_client_write'; END IF;


  IF to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing referee_v5_apply_admin_result_revision'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) IS DISTINCT FROM '11b7d3121eb0efd7c05cf2fd8a92da19' THEN
    RAISE EXCEPTION 'VERIFY def_md5 referee_v5_apply_admin_result_revision';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility referee_v5_apply_admin_result_revision';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language referee_v5_apply_admin_result_revision';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer referee_v5_apply_admin_result_revision';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')), '{}') IS DISTINCT FROM '{search_path=pg_catalog, public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig referee_v5_apply_admin_result_revision';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner referee_v5_apply_admin_result_revision';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS DISTINCT FROM '{postgres=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY authenticated referee_v5_apply_admin_result_revision';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role referee_v5_apply_admin_result_revision';
  END IF;

  IF to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing referee_v5_assert_assignment_write'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5' THEN
    RAISE EXCEPTION 'VERIFY def_md5 referee_v5_assert_assignment_write';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility referee_v5_assert_assignment_write';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language referee_v5_assert_assignment_write';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer referee_v5_assert_assignment_write';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig referee_v5_assert_assignment_write';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner referee_v5_assert_assignment_write';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated referee_v5_assert_assignment_write';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role referee_v5_assert_assignment_write';
  END IF;

  IF to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing referee_v5_assignment_effective_status'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS DISTINCT FROM 'ed3cf88b96355d92d5483eb0f4e1a6aa' THEN
    RAISE EXCEPTION 'VERIFY def_md5 referee_v5_assignment_effective_status';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility referee_v5_assignment_effective_status';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
  ) IS DISTINCT FROM 'sql' THEN
    RAISE EXCEPTION 'VERIFY language referee_v5_assignment_effective_status';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY security_definer referee_v5_assignment_effective_status';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')), '{}') IS DISTINCT FROM '{}' THEN
    RAISE EXCEPTION 'VERIFY proconfig referee_v5_assignment_effective_status';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner referee_v5_assignment_effective_status';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated referee_v5_assignment_effective_status';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role referee_v5_assignment_effective_status';
  END IF;

  IF to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NULL THEN RAISE EXCEPTION 'VERIFY missing referee_v5_current_user_has_assignment'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) IS DISTINCT FROM '2223a22afbef0ccccc0d0df04ae873f1' THEN
    RAISE EXCEPTION 'VERIFY def_md5 referee_v5_current_user_has_assignment';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility referee_v5_current_user_has_assignment';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
  ) IS DISTINCT FROM 'sql' THEN
    RAISE EXCEPTION 'VERIFY language referee_v5_current_user_has_assignment';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer referee_v5_current_user_has_assignment';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig referee_v5_current_user_has_assignment';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner referee_v5_current_user_has_assignment';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated referee_v5_current_user_has_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role referee_v5_current_user_has_assignment';
  END IF;

  IF to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing referee_v5_mark_assignment_expired_if_needed'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) IS DISTINCT FROM '0f2e5ea3915cf34cdb0297ac3a844d4d' THEN
    RAISE EXCEPTION 'VERIFY def_md5 referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated referee_v5_mark_assignment_expired_if_needed';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY service_role referee_v5_mark_assignment_expired_if_needed';
  END IF;

  IF to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_create_referee_assignment'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) IS DISTINCT FROM '08f6d53845ba88c750caef815543fa46' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_create_referee_assignment';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_create_referee_assignment';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_create_referee_assignment';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_create_referee_assignment';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_create_referee_assignment';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_create_referee_assignment';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_create_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_create_referee_assignment';
  END IF;

  IF to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_list_referee_assignments'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS DISTINCT FROM '9ec273071d309641425a3d30d704a14b' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_list_referee_assignments';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_list_referee_assignments';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_list_referee_assignments';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_list_referee_assignments';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_list_referee_assignments';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_list_referee_assignments';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_list_referee_assignments';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_list_referee_assignments';
  END IF;

  IF to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_list_referee_corrections'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS DISTINCT FROM '513f41aabc74d5864a879d714796b53a' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_list_referee_corrections';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
  ) IS DISTINCT FROM 'STABLE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_list_referee_corrections';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_list_referee_corrections';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_list_referee_corrections';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_list_referee_corrections';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_list_referee_corrections';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_list_referee_corrections';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_list_referee_corrections';
  END IF;

  IF to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_referee_match_access_ops'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS DISTINCT FROM '4229dd7686b6eaae990e9353e764f927' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_referee_match_access_ops';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_referee_match_access_ops';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_referee_match_access_ops';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_referee_match_access_ops';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_referee_match_access_ops';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_referee_match_access_ops';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_referee_match_access_ops';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_referee_match_access_ops';
  END IF;

  IF to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_reopen_referee_match'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_reopen_referee_match';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_reopen_referee_match';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_reopen_referee_match';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_reopen_referee_match';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_reopen_referee_match';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_reopen_referee_match';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_reopen_referee_match';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_reopen_referee_match';
  END IF;

  IF to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_request_referee_correction'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) IS DISTINCT FROM '42b96c5091086edfc822392ed49999d2' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_request_referee_correction';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_request_referee_correction';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_request_referee_correction';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_request_referee_correction';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_request_referee_correction';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_request_referee_correction';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_request_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_request_referee_correction';
  END IF;

  IF to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_review_referee_correction'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) IS DISTINCT FROM '175c9ee13eeefaccdbb67160cd0a5a16' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_review_referee_correction';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_review_referee_correction';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_review_referee_correction';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_review_referee_correction';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_review_referee_correction';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_review_referee_correction';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_review_referee_correction';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_review_referee_correction';
  END IF;

  IF to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NULL THEN RAISE EXCEPTION 'VERIFY missing team_tournament_revoke_referee_assignment'; END IF;
  IF md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d' THEN
    RAISE EXCEPTION 'VERIFY def_md5 team_tournament_revoke_referee_assignment';
  END IF;
  IF (
    SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
    FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
  ) IS DISTINCT FROM 'VOLATILE' THEN
    RAISE EXCEPTION 'VERIFY volatility team_tournament_revoke_referee_assignment';
  END IF;
  IF (
    SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
  ) IS DISTINCT FROM 'plpgsql' THEN
    RAISE EXCEPTION 'VERIFY language team_tournament_revoke_referee_assignment';
  END IF;
  IF (SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY security_definer team_tournament_revoke_referee_assignment';
  END IF;
  IF coalesce((SELECT pp.proconfig::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), '{}') IS DISTINCT FROM '{search_path=public}' THEN
    RAISE EXCEPTION 'VERIFY proconfig team_tournament_revoke_referee_assignment';
  END IF;
  IF (SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS DISTINCT FROM 'postgres' THEN
    RAISE EXCEPTION 'VERIFY owner team_tournament_revoke_referee_assignment';
  END IF;
  IF (SELECT pp.proacl::text FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS DISTINCT FROM '{postgres=X/postgres,authenticated=X/postgres}' THEN
    RAISE EXCEPTION 'VERIFY proacl team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY public denied team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') THEN
    RAISE EXCEPTION 'VERIFY anon denied team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'VERIFY authenticated team_tournament_revoke_referee_assignment';
  END IF;
  IF has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'VERIFY service_role team_tournament_revoke_referee_assignment';
  END IF;

  IF has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'SELECT')
     OR has_table_privilege('anon', 'public.team_tournament_referee_correction_requests', 'INSERT') THEN
    RAISE EXCEPTION 'VERIFY anon table denied';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'SELECT') IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFY authenticated SELECT';
  END IF;
  IF has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'INSERT')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.team_tournament_referee_correction_requests', 'DELETE') THEN
    RAISE EXCEPTION 'VERIFY authenticated write denied';
  END IF;

  IF (
    SELECT count(*) FROM supabase_migrations.schema_migrations
    WHERE version='20260731150000' AND name='phase5d_tt5d_controlled_reconciliation'
      AND statements = ARRAY['phase5d_tt5d_controlled_reconciliation_volatility_and_acl']::text[]
  ) <> 1 THEN
    RAISE EXCEPTION 'VERIFY provenance row';
  END IF;

  RAISE NOTICE 'PHASE5D_POST_APPLY_VERIFY_PASS';
END
$verify$;
