-- Phase 5D exact baseline rollback — same advisory lock as apply. Fail closed typed guards.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(hashtextextended('phase5d_tt5d_controlled_reconciliation', 0));

DO $pre$
BEGIN
  -- Require exact post-apply state before rollback mutations
  -- GUARD_ID: table.function_count_13
  IF NOT ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13) THEN
    RAISE EXCEPTION 'VERIFY table.function_count_13';
  END IF;
  -- GUARD_ID: table.referee_assignments.owner
  IF NOT ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.owner';
  END IF;
  -- GUARD_ID: table.referee_assignments.rls
  IF NOT ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.rls';
  END IF;
  -- GUARD_ID: table.referee_assignments.rls_forced
  IF NOT ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.rls_forced';
  END IF;
  -- GUARD_ID: table.referee_assignments.tt5d_columns_count
  IF NOT ((SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='referee_assignments' AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')) = 6) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.tt5d_columns_count';
  END IF;
  -- GUARD_ID: table.correction.owner
  IF NOT ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY table.correction.owner';
  END IF;
  -- GUARD_ID: table.correction.column_count
  IF NOT ((SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests') = 25) THEN
    RAISE EXCEPTION 'VERIFY table.correction.column_count';
  END IF;
  -- GUARD_ID: table.correction.rls
  IF NOT ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE) THEN
    RAISE EXCEPTION 'VERIFY table.correction.rls';
  END IF;
  -- GUARD_ID: table.correction.rls_forced
  IF NOT ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE) THEN
    RAISE EXCEPTION 'VERIFY table.correction.rls_forced';
  END IF;
  -- GUARD_ID: table.referee_assignments.version_column
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND t.relname = 'referee_assignments'
      AND a.attname = 'version'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND format_type(a.atttypid, a.atttypmod) = 'integer'
      AND a.attnotnull IS TRUE
      AND btrim(regexp_replace((pg_get_expr(ad.adbin, ad.adrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('1')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.version_column';
  END IF;
  -- GUARD_ID: table.referee_assignments.matchup_id_fkey
  IF NOT (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.matchup_id_fkey';
  END IF;
  -- GUARD_ID: table.referee_assignments.sub_match_id_fkey
  IF NOT (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.sub_match_id_fkey';
  END IF;
  -- GUARD_ID: table.referee_assignments.status_check
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referee_assignments'
      AND c.conname = 'referee_assignments_status_check'
      AND c.contype = 'c'
      AND c.convalidated IS TRUE
      AND c.condeferrable IS FALSE
      AND c.condeferred IS FALSE
      AND btrim(regexp_replace((pg_get_expr(c.conbin, c.conrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('((status = ANY (ARRAY[''pending''::text, ''active''::text, ''expired''::text, ''revoked''::text, ''completed''::text])))')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.status_check';
  END IF;
  -- GUARD_ID: table.referee_assignments.sub_match_index
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public'
      AND i.relname = 'referee_assignments_sub_match_idx'
      AND t.relname = 'referee_assignments'
      AND am.amname = 'btree'
      AND idx.indisunique = FALSE
      AND pg_get_userbyid(i.relowner) = 'postgres'
      AND (
        SELECT coalesce(array_agg(a.attname ORDER BY k.ord), ARRAY[]::name[])
        FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND k.attnum > 0
      ) = ARRAY['sub_match_id', 'status']::name[]
      AND btrim(regexp_replace((pg_get_expr(idx.indpred, idx.indrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('sub_match_id IS NOT NULL')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'VERIFY table.referee_assignments.sub_match_index';
  END IF;
  -- GUARD_ID: table.correction.index
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public'
      AND i.relname = 'tt5d_correction_pending_idx'
      AND t.relname = 'team_tournament_referee_correction_requests'
      AND am.amname = 'btree'
      AND idx.indisunique = FALSE
      AND pg_get_userbyid(i.relowner) = 'postgres'
      AND (
        SELECT coalesce(array_agg(a.attname ORDER BY k.ord), ARRAY[]::name[])
        FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND k.attnum > 0
      ) = ARRAY['tenant_id', 'tournament_id', 'status']::name[]
      AND btrim(regexp_replace((pg_get_expr(idx.indpred, idx.indrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('status = ''pending''::text')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'VERIFY table.correction.index';
  END IF;
  -- GUARD_ID: table.correction.acl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'team_tournament_referee_correction_requests')))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'INSERT', 'postgres', false),
      ('postgres', 'SELECT', 'postgres', false),
      ('postgres', 'UPDATE', 'postgres', false),
      ('postgres', 'DELETE', 'postgres', false),
      ('postgres', 'TRUNCATE', 'postgres', false),
      ('postgres', 'REFERENCES', 'postgres', false),
      ('postgres', 'TRIGGER', 'postgres', false),
      ('postgres', 'MAINTAIN', 'postgres', false),
      ('authenticated', 'SELECT', 'postgres', false),
      ('service_role', 'INSERT', 'postgres', false),
      ('service_role', 'SELECT', 'postgres', false),
      ('service_role', 'UPDATE', 'postgres', false),
      ('service_role', 'DELETE', 'postgres', false),
      ('service_role', 'TRUNCATE', 'postgres', false),
      ('service_role', 'REFERENCES', 'postgres', false),
      ('service_role', 'TRIGGER', 'postgres', false),
      ('service_role', 'MAINTAIN', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'INSERT', 'postgres', false),
      ('postgres', 'SELECT', 'postgres', false),
      ('postgres', 'UPDATE', 'postgres', false),
      ('postgres', 'DELETE', 'postgres', false),
      ('postgres', 'TRUNCATE', 'postgres', false),
      ('postgres', 'REFERENCES', 'postgres', false),
      ('postgres', 'TRIGGER', 'postgres', false),
      ('postgres', 'MAINTAIN', 'postgres', false),
      ('authenticated', 'SELECT', 'postgres', false),
      ('service_role', 'INSERT', 'postgres', false),
      ('service_role', 'SELECT', 'postgres', false),
      ('service_role', 'UPDATE', 'postgres', false),
      ('service_role', 'DELETE', 'postgres', false),
      ('service_role', 'TRUNCATE', 'postgres', false),
      ('service_role', 'REFERENCES', 'postgres', false),
      ('service_role', 'TRIGGER', 'postgres', false),
      ('service_role', 'MAINTAIN', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'team_tournament_referee_correction_requests')))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY table.correction.acl';
  END IF;
  -- GUARD_ID: policy.tt5d_correction_referee_select
  IF NOT (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) THEN
    RAISE EXCEPTION 'VERIFY policy.tt5d_correction_referee_select';
  END IF;
  -- GUARD_ID: policy.tt5d_correction_no_client_write
  IF NOT (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) THEN
    RAISE EXCEPTION 'VERIFY policy.tt5d_correction_no_client_write';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.missing
  IF NOT (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) IS NOT DISTINCT FROM '11b7d3121eb0efd7c05cf2fd8a92da19') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.public_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.anon_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_apply_admin_result_revision.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.missing
  IF NOT (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.public_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.anon_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assert_assignment_write.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.missing
  IF NOT (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'ed3cf88b96355d92d5483eb0f4e1a6aa') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'sql') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.public_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.anon_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_assignment_effective_status.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.missing
  IF NOT (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) IS NOT DISTINCT FROM '2223a22afbef0ccccc0d0df04ae873f1') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'sql') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.public_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.anon_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_current_user_has_assignment.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.missing
  IF NOT (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) IS NOT DISTINCT FROM '0f2e5ea3915cf34cdb0297ac3a844d4d') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.public_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.anon_denied';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.referee_v5_mark_assignment_expired_if_needed.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.missing
  IF NOT (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) IS NOT DISTINCT FROM '08f6d53845ba88c750caef815543fa46') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_create_referee_assignment.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.missing
  IF NOT (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_assignments.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.missing
  IF NOT (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_list_referee_corrections.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.missing
  IF NOT (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_referee_match_access_ops.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.missing
  IF NOT (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_reopen_referee_match.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.missing
  IF NOT (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) IS NOT DISTINCT FROM '42b96c5091086edfc822392ed49999d2') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_request_referee_correction.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.missing
  IF NOT (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) IS NOT DISTINCT FROM '175c9ee13eeefaccdbb67160cd0a5a16') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_review_referee_correction.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.missing
  IF NOT (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.volatility
  IF NOT ((SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.language
  IF NOT ((SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.public_denied
  IF NOT (NOT has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.public_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.anon_denied
  IF NOT (NOT has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE')) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.anon_denied';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'VERIFY fn.team_tournament_revoke_referee_assignment.service_role_execute';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20260731150000' AND name='phase5d_tt5d_controlled_reconciliation'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_MISSING_PROVENANCE';
  END IF;
END
$pre$;

ALTER FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) IMMUTABLE;

REVOKE ALL ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_current_user_has_assignment(text, text, text, text[]) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.referee_v5_mark_assignment_expired_if_needed(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_list_referee_assignments(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_assignments(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_list_referee_corrections(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_list_referee_corrections(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_referee_match_access_ops(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_reopen_referee_match(text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text) TO authenticated, service_role;

REVOKE ALL ON TABLE public.team_tournament_referee_correction_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO authenticated;
GRANT ALL ON TABLE public.team_tournament_referee_correction_requests TO service_role;

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260731150000' AND name = 'phase5d_tt5d_controlled_reconciliation';

DO $post$
BEGIN
  -- GUARD_ID: provenance.absent
  IF NOT (NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH provenance.absent';
  END IF;
  -- GUARD_ID: provenance.club_ai_data_absent
  IF NOT (to_regclass('public.club_ai_data') IS NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH provenance.club_ai_data_absent';
  END IF;
  -- GUARD_ID: table.function_count_13
  IF NOT ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.function_count_13';
  END IF;
  -- GUARD_ID: table.referee_assignments.owner
  IF NOT ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.owner';
  END IF;
  -- GUARD_ID: table.referee_assignments.rls
  IF NOT ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.rls';
  END IF;
  -- GUARD_ID: table.referee_assignments.rls_forced
  IF NOT ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.rls_forced';
  END IF;
  -- GUARD_ID: table.referee_assignments.tt5d_columns_count
  IF NOT ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.tt5d_columns_count';
  END IF;
  -- GUARD_ID: table.referee_assignments.version_column
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attrdef ad ON ad.adrelid = t.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND t.relname = 'referee_assignments'
      AND a.attname = 'version'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND format_type(a.atttypid, a.atttypmod) = 'integer'
      AND a.attnotnull IS TRUE
      AND btrim(regexp_replace((pg_get_expr(ad.adbin, ad.adrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('1')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.version_column';
  END IF;
  -- GUARD_ID: table.referee_assignments.matchup_id_fkey
  IF NOT (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.matchup_id_fkey';
  END IF;
  -- GUARD_ID: table.referee_assignments.sub_match_id_fkey
  IF NOT (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.sub_match_id_fkey';
  END IF;
  -- GUARD_ID: table.referee_assignments.status_check
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referee_assignments'
      AND c.conname = 'referee_assignments_status_check'
      AND c.contype = 'c'
      AND c.convalidated IS TRUE
      AND c.condeferrable IS FALSE
      AND c.condeferred IS FALSE
      AND btrim(regexp_replace((pg_get_expr(c.conbin, c.conrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('((status = ANY (ARRAY[''pending''::text, ''active''::text, ''expired''::text, ''revoked''::text, ''completed''::text])))')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.status_check';
  END IF;
  -- GUARD_ID: table.referee_assignments.sub_match_index
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public'
      AND i.relname = 'referee_assignments_sub_match_idx'
      AND t.relname = 'referee_assignments'
      AND am.amname = 'btree'
      AND idx.indisunique = FALSE
      AND pg_get_userbyid(i.relowner) = 'postgres'
      AND (
        SELECT coalesce(array_agg(a.attname ORDER BY k.ord), ARRAY[]::name[])
        FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND k.attnum > 0
      ) = ARRAY['sub_match_id', 'status']::name[]
      AND btrim(regexp_replace((pg_get_expr(idx.indpred, idx.indrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('sub_match_id IS NOT NULL')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.referee_assignments.sub_match_index';
  END IF;
  -- GUARD_ID: table.correction.index
  IF NOT (EXISTS (
    SELECT 1
    FROM pg_index idx
    JOIN pg_class i ON i.oid = idx.indexrelid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    WHERE n.nspname = 'public'
      AND i.relname = 'tt5d_correction_pending_idx'
      AND t.relname = 'team_tournament_referee_correction_requests'
      AND am.amname = 'btree'
      AND idx.indisunique = FALSE
      AND pg_get_userbyid(i.relowner) = 'postgres'
      AND (
        SELECT coalesce(array_agg(a.attname ORDER BY k.ord), ARRAY[]::name[])
        FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum AND k.attnum > 0
      ) = ARRAY['tenant_id', 'tournament_id', 'status']::name[]
      AND btrim(regexp_replace((pg_get_expr(idx.indpred, idx.indrelid, false))::text, '[[:space:]]+', ' ', 'g')) IS NOT DISTINCT FROM btrim(regexp_replace(('status = ''pending''::text')::text, '[[:space:]]+', ' ', 'g'))
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.index';
  END IF;
  -- GUARD_ID: table.correction.owner
  IF NOT ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.owner';
  END IF;
  -- GUARD_ID: table.correction.acl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'team_tournament_referee_correction_requests')))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'INSERT', 'postgres', false),
      ('postgres', 'SELECT', 'postgres', false),
      ('postgres', 'UPDATE', 'postgres', false),
      ('postgres', 'DELETE', 'postgres', false),
      ('postgres', 'TRUNCATE', 'postgres', false),
      ('postgres', 'REFERENCES', 'postgres', false),
      ('postgres', 'TRIGGER', 'postgres', false),
      ('postgres', 'MAINTAIN', 'postgres', false),
      ('authenticated', 'INSERT', 'postgres', false),
      ('authenticated', 'SELECT', 'postgres', false),
      ('authenticated', 'UPDATE', 'postgres', false),
      ('authenticated', 'DELETE', 'postgres', false),
      ('authenticated', 'TRUNCATE', 'postgres', false),
      ('authenticated', 'REFERENCES', 'postgres', false),
      ('authenticated', 'TRIGGER', 'postgres', false),
      ('authenticated', 'MAINTAIN', 'postgres', false),
      ('service_role', 'INSERT', 'postgres', false),
      ('service_role', 'SELECT', 'postgres', false),
      ('service_role', 'UPDATE', 'postgres', false),
      ('service_role', 'DELETE', 'postgres', false),
      ('service_role', 'TRUNCATE', 'postgres', false),
      ('service_role', 'REFERENCES', 'postgres', false),
      ('service_role', 'TRIGGER', 'postgres', false),
      ('service_role', 'MAINTAIN', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'INSERT', 'postgres', false),
      ('postgres', 'SELECT', 'postgres', false),
      ('postgres', 'UPDATE', 'postgres', false),
      ('postgres', 'DELETE', 'postgres', false),
      ('postgres', 'TRUNCATE', 'postgres', false),
      ('postgres', 'REFERENCES', 'postgres', false),
      ('postgres', 'TRIGGER', 'postgres', false),
      ('postgres', 'MAINTAIN', 'postgres', false),
      ('authenticated', 'INSERT', 'postgres', false),
      ('authenticated', 'SELECT', 'postgres', false),
      ('authenticated', 'UPDATE', 'postgres', false),
      ('authenticated', 'DELETE', 'postgres', false),
      ('authenticated', 'TRUNCATE', 'postgres', false),
      ('authenticated', 'REFERENCES', 'postgres', false),
      ('authenticated', 'TRIGGER', 'postgres', false),
      ('authenticated', 'MAINTAIN', 'postgres', false),
      ('service_role', 'INSERT', 'postgres', false),
      ('service_role', 'SELECT', 'postgres', false),
      ('service_role', 'UPDATE', 'postgres', false),
      ('service_role', 'DELETE', 'postgres', false),
      ('service_role', 'TRUNCATE', 'postgres', false),
      ('service_role', 'REFERENCES', 'postgres', false),
      ('service_role', 'TRIGGER', 'postgres', false),
      ('service_role', 'MAINTAIN', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'team_tournament_referee_correction_requests')))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.acl';
  END IF;
  -- GUARD_ID: table.correction.column_count
  IF NOT ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
    ) = 25) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.column_count';
  END IF;
  -- GUARD_ID: table.correction.rls
  IF NOT ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.rls';
  END IF;
  -- GUARD_ID: table.correction.rls_forced
  IF NOT ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH table.correction.rls_forced';
  END IF;
  -- GUARD_ID: policy.tt5d_correction_referee_select
  IF NOT (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH policy.tt5d_correction_referee_select';
  END IF;
  -- GUARD_ID: policy.tt5d_correction_no_client_write
  IF NOT (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH policy.tt5d_correction_no_client_write';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.missing
  IF NOT (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_apply_admin_result_revision'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.overload_count';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) IS NOT DISTINCT FROM '11b7d3121eb0efd7c05cf2fd8a92da19') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.public_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.anon_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_apply_admin_result_revision.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_apply_admin_result_revision.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.missing
  IF NOT (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assert_assignment_write'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.overload_count';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.public_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.anon_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assert_assignment_write.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assert_assignment_write.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.missing
  IF NOT (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assignment_effective_status'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.overload_count';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'IMMUTABLE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'sql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('anon', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('anon', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.public_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.anon_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_assignment_effective_status.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_assignment_effective_status.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.missing
  IF NOT (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_current_user_has_assignment'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.overload_count';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) IS NOT DISTINCT FROM '2223a22afbef0ccccc0d0df04ae873f1') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'sql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('anon', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('anon', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.public_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.anon_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_current_user_has_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_current_user_has_assignment.service_role_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.missing
  IF NOT (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.missing';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_mark_assignment_expired_if_needed'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.overload_count';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) IS NOT DISTINCT FROM '0f2e5ea3915cf34cdb0297ac3a844d4d') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.def_md5';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.volatility';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.language';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.security_definer';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.proconfig';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.owner';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.proacl';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.public_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.anon_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.referee_v5_mark_assignment_expired_if_needed.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.referee_v5_mark_assignment_expired_if_needed.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.missing
  IF NOT (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_create_referee_assignment'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) IS NOT DISTINCT FROM '08f6d53845ba88c750caef815543fa46') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_create_referee_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_create_referee_assignment.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.missing
  IF NOT (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_assignments'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_assignments.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_assignments.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.missing
  IF NOT (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_corrections'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_list_referee_corrections.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_list_referee_corrections.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.missing
  IF NOT (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_referee_match_access_ops'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_referee_match_access_ops.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_referee_match_access_ops.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.missing
  IF NOT (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_reopen_referee_match'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_reopen_referee_match.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_reopen_referee_match.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.missing
  IF NOT (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_request_referee_correction'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) IS NOT DISTINCT FROM '42b96c5091086edfc822392ed49999d2') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_request_referee_correction.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_request_referee_correction.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.missing
  IF NOT (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_review_referee_correction'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) IS NOT DISTINCT FROM '175c9ee13eeefaccdbb67160cd0a5a16') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_review_referee_correction.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_review_referee_correction.service_role_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.missing
  IF NOT (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.missing';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.overload_count
  IF NOT ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_revoke_referee_assignment'
        ) = 1) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.overload_count';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.def_md5
  IF NOT (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.def_md5';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.volatility
  IF NOT ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.volatility';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.language
  IF NOT ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.language';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.security_definer
  IF NOT ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.security_definer';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.proconfig
  IF NOT (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.proconfig';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.owner
  IF NOT ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres') THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.owner';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.proacl
  IF NOT (NOT EXISTS (
    SELECT 1
    FROM (
      ((SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))) EXCEPT (SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)))
      UNION ALL
      ((SELECT grantee, privilege_type, grantor, is_grantable FROM (VALUES
      ('postgres', 'EXECUTE', 'postgres', false),
      ('authenticated', 'EXECUTE', 'postgres', false),
      ('service_role', 'EXECUTE', 'postgres', false)
    ) AS e(grantee, privilege_type, grantor, is_grantable)) EXCEPT (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))))
    ) diff
  )) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.proacl';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.public_execute
  IF NOT (has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.public_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.anon_execute
  IF NOT (has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.anon_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.authenticated_execute
  IF NOT (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.authenticated_execute';
  END IF;
  -- GUARD_ID: fn.team_tournament_revoke_referee_assignment.service_role_execute
  IF NOT (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) THEN
    RAISE EXCEPTION 'PHASE5D_BASELINE_MISMATCH fn.team_tournament_revoke_referee_assignment.service_role_execute';
  END IF;
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version='20260731150000' OR name='phase5d_tt5d_controlled_reconciliation'
  ) THEN
    RAISE EXCEPTION 'ROLLBACK_PROVENANCE_STILL_PRESENT';
  END IF;
END
$post$;

COMMIT;
