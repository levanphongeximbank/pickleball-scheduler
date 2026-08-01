-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_003
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

WITH guard_results AS (
SELECT 29 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       {"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 30 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.public_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"publicExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 31 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"anonExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 32 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"authenticatedExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 33 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"serviceRoleExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 34 AS guard_order,
       'fn.referee_v5_assert_assignment_write.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"present":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 35 AS guard_order,
       'fn.referee_v5_assert_assignment_write.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"overload_count":1}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assert_assignment_write'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assert_assignment_write'
        ) = 1) AS matches_guard
UNION ALL
SELECT 36 AS guard_order,
       'fn.referee_v5_assert_assignment_write.def_md5' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       {"defMd5":"e7854c03e3ffebf81a7928d6b8740ad5"}::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5') AS matches_guard
UNION ALL
SELECT 37 AS guard_order,
       'fn.referee_v5_assert_assignment_write.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"volatility":"VOLATILE"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 38 AS guard_order,
       'fn.referee_v5_assert_assignment_write.language' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"language":"plpgsql"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 39 AS guard_order,
       'fn.referee_v5_assert_assignment_write.security_definer' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"securityDefiner":true}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 40 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       {"proconfig":["search_path=public"]}::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 41 AS guard_order,
       'fn.referee_v5_assert_assignment_write.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"owner":"postgres"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 42 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       {"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 43 AS guard_order,
       'fn.referee_v5_assert_assignment_write.public_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"publicExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 44 AS guard_order,
       'fn.referee_v5_assert_assignment_write.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"anonExecute":false}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 45 AS guard_order,
       'fn.referee_v5_assert_assignment_write.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"authenticatedExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 46 AS guard_order,
       'fn.referee_v5_assert_assignment_write.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"serviceRoleExecute":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 47 AS guard_order,
       'fn.referee_v5_assignment_effective_status.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"present":true}::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 48 AS guard_order,
       'fn.referee_v5_assignment_effective_status.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"overload_count":1}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assignment_effective_status'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='referee_v5_assignment_effective_status'
        ) = 1) AS matches_guard
UNION ALL
SELECT 49 AS guard_order,
       'fn.referee_v5_assignment_effective_status.def_md5' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       {"defMd5":"c91ffb1ec3faa1e6fa2b3ea9395c4058"}::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058') AS matches_guard
UNION ALL
SELECT 50 AS guard_order,
       'fn.referee_v5_assignment_effective_status.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"volatility":"IMMUTABLE"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'IMMUTABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'IMMUTABLE') AS matches_guard
UNION ALL
SELECT 51 AS guard_order,
       'fn.referee_v5_assignment_effective_status.language' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"language":"sql"}::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'sql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')
        ) IS NOT DISTINCT FROM 'sql') AS matches_guard
UNION ALL
SELECT 52 AS guard_order,
       'fn.referee_v5_assignment_effective_status.security_definer' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       {"securityDefiner":false}::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false) AS matches_guard
)
SELECT '00_PREFLIGHT_BATCH_003' AS batch_id,
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
