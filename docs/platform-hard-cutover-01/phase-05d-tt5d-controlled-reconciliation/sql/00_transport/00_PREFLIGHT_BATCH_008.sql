-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_008
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 149 AS guard_order,
       'fn.team_tournament_reopen_referee_match.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 150 AS guard_order,
       'fn.team_tournament_reopen_referee_match.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 151 AS guard_order,
       'fn.team_tournament_request_referee_correction.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 152 AS guard_order,
       'fn.team_tournament_request_referee_correction.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_request_referee_correction'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_request_referee_correction'
        ) = 1) AS matches_guard
UNION ALL
SELECT 153 AS guard_order,
       'fn.team_tournament_request_referee_correction.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"42b96c5091086edfc822392ed49999d2"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) IS NOT DISTINCT FROM '42b96c5091086edfc822392ed49999d2')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'))) IS NOT DISTINCT FROM '42b96c5091086edfc822392ed49999d2') AS matches_guard
UNION ALL
SELECT 154 AS guard_order,
       'fn.team_tournament_request_referee_correction.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 155 AS guard_order,
       'fn.team_tournament_request_referee_correction.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 156 AS guard_order,
       'fn.team_tournament_request_referee_correction.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 157 AS guard_order,
       'fn.team_tournament_request_referee_correction.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 158 AS guard_order,
       'fn.team_tournament_request_referee_correction.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 159 AS guard_order,
       'fn.team_tournament_request_referee_correction.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 160 AS guard_order,
       'fn.team_tournament_request_referee_correction.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 161 AS guard_order,
       'fn.team_tournament_request_referee_correction.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 162 AS guard_order,
       'fn.team_tournament_request_referee_correction.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 163 AS guard_order,
       'fn.team_tournament_request_referee_correction.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_request_referee_correction(text, text, uuid, jsonb, text, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 164 AS guard_order,
       'fn.team_tournament_review_referee_correction.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 165 AS guard_order,
       'fn.team_tournament_review_referee_correction.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_review_referee_correction'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_review_referee_correction'
        ) = 1) AS matches_guard
UNION ALL
SELECT 166 AS guard_order,
       'fn.team_tournament_review_referee_correction.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"175c9ee13eeefaccdbb67160cd0a5a16"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) IS NOT DISTINCT FROM '175c9ee13eeefaccdbb67160cd0a5a16')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'))) IS NOT DISTINCT FROM '175c9ee13eeefaccdbb67160cd0a5a16') AS matches_guard
UNION ALL
SELECT 167 AS guard_order,
       'fn.team_tournament_review_referee_correction.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 168 AS guard_order,
       'fn.team_tournament_review_referee_correction.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 169 AS guard_order,
       'fn.team_tournament_review_referee_correction.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 170 AS guard_order,
       'fn.team_tournament_review_referee_correction.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 171 AS guard_order,
       'fn.team_tournament_review_referee_correction.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_008' AS batch_id,
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
