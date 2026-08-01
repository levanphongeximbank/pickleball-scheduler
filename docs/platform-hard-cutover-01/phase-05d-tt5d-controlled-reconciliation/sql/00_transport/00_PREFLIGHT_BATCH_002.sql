-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_002
-- manifest_fingerprint=228f530a4867a5a3b82fc03032b3e078d38994df5905cac369fdb9497b508d92
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1, CATALOG_EXPR_CANON_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 15 AS guard_order,
       'table.correction.acl' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"INSERT","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"SELECT","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"UPDATE","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"DELETE","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"TRUNCATE","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"REFERENCES","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"TRIGGER","grantor":"postgres","is_grantable":false},{"grantee":"postgres","privilege_type":"MAINTAIN","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"INSERT","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"SELECT","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"UPDATE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"DELETE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"TRUNCATE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"REFERENCES","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"TRIGGER","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"MAINTAIN","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"INSERT","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"SELECT","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"UPDATE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"DELETE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"TRUNCATE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"REFERENCES","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"TRIGGER","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"MAINTAIN","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(c.relacl, acldefault('r', c.relowner))
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'team_tournament_referee_correction_requests')))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 16 AS guard_order,
       'table.correction.column_count' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"column_count":25}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
    ) = 25)) AS actual_json,
       ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='team_tournament_referee_correction_requests'
    ) = 25) AS matches_guard
UNION ALL
SELECT 17 AS guard_order,
       'table.correction.rls' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relrowsecurity":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE)) AS actual_json,
       ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM TRUE) AS matches_guard
UNION ALL
SELECT 18 AS guard_order,
       'table.correction.rls_forced' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relforcerowsecurity":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE)) AS actual_json,
       ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM FALSE) AS matches_guard
UNION ALL
SELECT 19 AS guard_order,
       'policy.tt5d_correction_referee_select' AS guard_id,
       'policy' AS object_class,
       'public.team_tournament_referee_correction_requests.tt5d_correction_referee_select' AS object_identity,
       'WS_COLLAPSE_V1' AS contract_version,
       '{"cmd":"r","roles":["authenticated"],"usingNormalized":"(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))","withCheck":null}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_referee_select'
        AND pol.polcmd='r'
        AND btrim(regexp_replace((pg_get_expr(pol.polqual, pol.polrelid, false))::text, '[[:space:]]+', ' ', 'g')) = btrim(regexp_replace(('(team_tournament_can_manage() OR (requested_by = auth.uid()) OR (EXISTS ( SELECT 1 FROM referee_assignments ra WHERE ((ra.id = team_tournament_referee_correction_requests.assignment_id) AND (ra.referee_user_id = auth.uid())))))')::text, '[[:space:]]+', ' ', 'g'))
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) IS NULL
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) AS matches_guard
UNION ALL
SELECT 20 AS guard_order,
       'policy.tt5d_correction_no_client_write' AS guard_id,
       'policy' AS object_class,
       'public.team_tournament_referee_correction_requests.tt5d_correction_no_client_write' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"cmd":"*","roles":["authenticated"],"using":"false","withCheck":"false"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND pol.polname='tt5d_correction_no_client_write'
        AND pol.polcmd='*'
        AND pg_get_expr(pol.polqual, pol.polrelid, false) = 'false'
        AND pg_get_expr(pol.polwithcheck, pol.polrelid, false) = 'false'
        AND array(select rolname from pg_roles r where r.oid = any(pol.polroles)) = ARRAY['authenticated']::name[]
    )) AS matches_guard
UNION ALL
SELECT 21 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 22 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_apply_admin_result_revision'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_apply_admin_result_revision'
        ) = 1) AS matches_guard
UNION ALL
SELECT 23 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.def_md5' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"11b7d3121eb0efd7c05cf2fd8a92da19"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) IS NOT DISTINCT FROM '11b7d3121eb0efd7c05cf2fd8a92da19')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'))) IS NOT DISTINCT FROM '11b7d3121eb0efd7c05cf2fd8a92da19') AS matches_guard
UNION ALL
SELECT 24 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 25 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.language' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 26 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.security_definer' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 27 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=pg_catalog, public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[])) AS matches_guard
UNION ALL
SELECT 28 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_002' AS batch_id,
       '228f530a4867a5a3b82fc03032b3e078d38994df5905cac369fdb9497b508d92' AS manifest_fingerprint,
       guard_order,
       guard_id,
       object_class,
       object_identity,
       contract_version,
       expected_json,
       actual_json,
       matches_guard
FROM guard_results
ORDER BY guard_order;
