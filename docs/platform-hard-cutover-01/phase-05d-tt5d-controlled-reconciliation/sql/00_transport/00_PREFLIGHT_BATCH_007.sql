-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_007
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 124 AS guard_order,
       'fn.team_tournament_list_referee_corrections.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"serviceRoleExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 125 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"present":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 126 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"overload_count":1}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_referee_match_access_ops'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_referee_match_access_ops'
        ) = 1) AS matches_guard
UNION ALL
SELECT 127 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       {"defMd5":"4229dd7686b6eaae990e9353e764f927"}::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927') AS matches_guard
UNION ALL
SELECT 128 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"volatility":"VOLATILE"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 129 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"language":"plpgsql"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 130 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"securityDefiner":true}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 131 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       {"proconfig":["search_path=public"]}::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 132 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"owner":"postgres"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 133 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       {"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 134 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"publicExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 135 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"anonExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 136 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"authenticatedExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 137 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"serviceRoleExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 138 AS guard_order,
       'fn.team_tournament_reopen_referee_match.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"present":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 139 AS guard_order,
       'fn.team_tournament_reopen_referee_match.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"overload_count":1}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_reopen_referee_match'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_reopen_referee_match'
        ) = 1) AS matches_guard
UNION ALL
SELECT 140 AS guard_order,
       'fn.team_tournament_reopen_referee_match.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       {"defMd5":"81f3b086288dc8da26700349bbbab3b2"}::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2') AS matches_guard
UNION ALL
SELECT 141 AS guard_order,
       'fn.team_tournament_reopen_referee_match.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"volatility":"VOLATILE"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 142 AS guard_order,
       'fn.team_tournament_reopen_referee_match.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"language":"plpgsql"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 143 AS guard_order,
       'fn.team_tournament_reopen_referee_match.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"securityDefiner":true}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 144 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       {"proconfig":["search_path=public"]}::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 145 AS guard_order,
       'fn.team_tournament_reopen_referee_match.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"owner":"postgres"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 146 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       {"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 147 AS guard_order,
       'fn.team_tournament_reopen_referee_match.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"publicExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 148 AS guard_order,
       'fn.team_tournament_reopen_referee_match.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"anonExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_007' AS batch_id,
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
