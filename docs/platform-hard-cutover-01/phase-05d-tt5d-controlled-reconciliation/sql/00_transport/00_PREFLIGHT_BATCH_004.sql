-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_004
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 53 AS guard_order,
       'fn.referee_v5_assignment_effective_status.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":[]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY[]::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY[]::text[])) AS matches_guard
UNION ALL
SELECT 54 AS guard_order,
       'fn.referee_v5_assignment_effective_status.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 55 AS guard_order,
       'fn.referee_v5_assignment_effective_status.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"anon","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 56 AS guard_order,
       'fn.referee_v5_assignment_effective_status.public_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 57 AS guard_order,
       'fn.referee_v5_assignment_effective_status.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 58 AS guard_order,
       'fn.referee_v5_assignment_effective_status.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 59 AS guard_order,
       'fn.referee_v5_assignment_effective_status.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 60 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 61 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_current_user_has_assignment'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_current_user_has_assignment'
        ) = 1) AS matches_guard
UNION ALL
SELECT 62 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.def_md5' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"2223a22afbef0ccccc0d0df04ae873f1"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) IS NOT DISTINCT FROM '2223a22afbef0ccccc0d0df04ae873f1')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'))) IS NOT DISTINCT FROM '2223a22afbef0ccccc0d0df04ae873f1') AS matches_guard
UNION ALL
SELECT 63 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"STABLE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'STABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'STABLE') AS matches_guard
UNION ALL
SELECT 64 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.language' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"sql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'sql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')
        ) IS NOT DISTINCT FROM 'sql') AS matches_guard
UNION ALL
SELECT 65 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.security_definer' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 66 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 67 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 68 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"anon","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 69 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.public_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 70 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 71 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 72 AS guard_order,
       'fn.referee_v5_current_user_has_assignment.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_current_user_has_assignment(text, text, text, text[])' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_current_user_has_assignment(text, text, text, text[])'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 73 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 74 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_mark_assignment_expired_if_needed'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_mark_assignment_expired_if_needed'
        ) = 1) AS matches_guard
UNION ALL
SELECT 75 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.def_md5' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"0f2e5ea3915cf34cdb0297ac3a844d4d"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) IS NOT DISTINCT FROM '0f2e5ea3915cf34cdb0297ac3a844d4d')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'))) IS NOT DISTINCT FROM '0f2e5ea3915cf34cdb0297ac3a844d4d') AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_004' AS batch_id,
       '19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e' AS manifest_fingerprint,
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
