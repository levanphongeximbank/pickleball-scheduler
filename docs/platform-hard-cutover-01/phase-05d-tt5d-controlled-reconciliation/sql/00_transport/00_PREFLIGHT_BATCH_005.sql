-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_005
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 76 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 77 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.language' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 78 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.security_definer' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 79 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 80 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 81 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 82 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.public_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 83 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 84 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 85 AS guard_order,
       'fn.referee_v5_mark_assignment_expired_if_needed.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_mark_assignment_expired_if_needed(uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_mark_assignment_expired_if_needed(uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 86 AS guard_order,
       'fn.team_tournament_create_referee_assignment.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 87 AS guard_order,
       'fn.team_tournament_create_referee_assignment.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_create_referee_assignment'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_create_referee_assignment'
        ) = 1) AS matches_guard
UNION ALL
SELECT 88 AS guard_order,
       'fn.team_tournament_create_referee_assignment.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"08f6d53845ba88c750caef815543fa46"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) IS NOT DISTINCT FROM '08f6d53845ba88c750caef815543fa46')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'))) IS NOT DISTINCT FROM '08f6d53845ba88c750caef815543fa46') AS matches_guard
UNION ALL
SELECT 89 AS guard_order,
       'fn.team_tournament_create_referee_assignment.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 90 AS guard_order,
       'fn.team_tournament_create_referee_assignment.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 91 AS guard_order,
       'fn.team_tournament_create_referee_assignment.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 92 AS guard_order,
       'fn.team_tournament_create_referee_assignment.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 93 AS guard_order,
       'fn.team_tournament_create_referee_assignment.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 94 AS guard_order,
       'fn.team_tournament_create_referee_assignment.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 95 AS guard_order,
       'fn.team_tournament_create_referee_assignment.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 96 AS guard_order,
       'fn.team_tournament_create_referee_assignment.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 97 AS guard_order,
       'fn.team_tournament_create_referee_assignment.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 98 AS guard_order,
       'fn.team_tournament_create_referee_assignment.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_005' AS batch_id,
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
