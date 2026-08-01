-- Phase 5D precondition — SELECT-only typed guard shadow (parity with sql/10 pre $guard$).
-- Target must be Staging project_ref qyewbxjsiiyufanzcjcq. Forbidden: expuvcohlcjzvrrauvud.
-- No BEGIN/COMMIT/DO/DDL/DML. Registry-driven UNION ALL + preflight_all_pass summary.
-- expected_json via renderJsonbLiteral (quoted SQL string)::jsonb — never bare {...}::jsonb.

-- Phase 5D precondition — SELECT-only typed guard shadow (registry parity with sql/10 pre guards).
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- Returns all guard rows then a deterministic summary. Non-fail-fast. No DDL/DML/BEGIN/COMMIT/DO.

WITH guard_results AS (
SELECT 1 AS guard_order,
       'provenance.absent' AS guard_id,
       'migration_provenance' AS object_class,
       'supabase_migrations.schema_migrations' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    ))) AS actual_json,
       (NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    )) AS matches_guard
UNION ALL
SELECT 2 AS guard_order,
       'provenance.club_ai_data_absent' AS guard_id,
       'table' AS object_class,
       'public.club_ai_data' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"absent":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regclass('public.club_ai_data') IS NULL)) AS actual_json,
       (to_regclass('public.club_ai_data') IS NULL) AS matches_guard
UNION ALL
SELECT 3 AS guard_order,
       'table.function_count_13' AS guard_id,
       'function_set' AS object_class,
       'public.tt5d_functions' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"count":13}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13)) AS actual_json,
       ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13) AS matches_guard
UNION ALL
SELECT 4 AS guard_order,
       'table.referee_assignments.owner' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 5 AS guard_order,
       'table.referee_assignments.rls' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relrowsecurity":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE)) AS actual_json,
       ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE) AS matches_guard
UNION ALL
SELECT 6 AS guard_order,
       'table.referee_assignments.rls_forced' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relforcerowsecurity":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE)) AS actual_json,
       ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE) AS matches_guard
UNION ALL
SELECT 7 AS guard_order,
       'table.referee_assignments.tt5d_columns_count' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"tt5d_column_count":6}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6)) AS actual_json,
       ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6) AS matches_guard
UNION ALL
SELECT 8 AS guard_order,
       'table.referee_assignments.version_column' AS guard_id,
       'column' AS object_class,
       'public.referee_assignments.version' AS object_identity,
       'COLUMN_DEFAULT_EXPR_V1' AS contract_version,
       '{"dataType":"integer","notNull":true,"defaultExprNormalized":"1"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 9 AS guard_order,
       'table.referee_assignments.matchup_id_fkey' AS guard_id,
       'foreign_key' AS object_class,
       'public.referee_assignments.matchup_id' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"references":"public.team_tournament_matchups(id)","onDelete":"SET NULL"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) AS matches_guard
UNION ALL
SELECT 10 AS guard_order,
       'table.referee_assignments.sub_match_id_fkey' AS guard_id,
       'foreign_key' AS object_class,
       'public.referee_assignments.sub_match_id' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"references":"public.team_tournament_sub_matches(id)","onDelete":"SET NULL"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) AS matches_guard
UNION ALL
SELECT 11 AS guard_order,
       'table.referee_assignments.status_check' AS guard_id,
       'constraint' AS object_class,
       'public.referee_assignments.referee_assignments_status_check' AS object_identity,
       'CONSTRAINT_CATALOG_V1' AS contract_version,
       '{"exprNormalized":"((status = ANY (ARRAY[''pending''::text, ''active''::text, ''expired''::text, ''revoked''::text, ''completed''::text])))"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 12 AS guard_order,
       'table.referee_assignments.sub_match_index' AS guard_id,
       'index' AS object_class,
       'public.referee_assignments_sub_match_idx' AS object_identity,
       'INDEX_CATALOG_V1' AS contract_version,
       '{"indexName":"referee_assignments_sub_match_idx","tableName":"referee_assignments","amname":"btree","keyColumns":["sub_match_id","status"],"predicateNormalized":"sub_match_id IS NOT NULL","owner":"postgres","unique":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 13 AS guard_order,
       'table.correction.index' AS guard_id,
       'index' AS object_class,
       'public.tt5d_correction_pending_idx' AS object_identity,
       'INDEX_CATALOG_V1' AS contract_version,
       '{"indexName":"tt5d_correction_pending_idx","tableName":"team_tournament_referee_correction_requests","amname":"btree","keyColumns":["tenant_id","tournament_id","status"],"predicateNormalized":"status = ''pending''::text","owner":"postgres","unique":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 14 AS guard_order,
       'table.correction.owner' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
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
UNION ALL
SELECT 29 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 31 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 32 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 33 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 34 AS guard_order,
       'fn.referee_v5_assert_assignment_write.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 35 AS guard_order,
       'fn.referee_v5_assert_assignment_write.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"e7854c03e3ffebf81a7928d6b8740ad5"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5') AS matches_guard
UNION ALL
SELECT 37 AS guard_order,
       'fn.referee_v5_assert_assignment_write.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 40 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 41 AS guard_order,
       'fn.referee_v5_assert_assignment_write.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 42 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 44 AS guard_order,
       'fn.referee_v5_assert_assignment_write.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 45 AS guard_order,
       'fn.referee_v5_assert_assignment_write.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 46 AS guard_order,
       'fn.referee_v5_assert_assignment_write.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 47 AS guard_order,
       'fn.referee_v5_assignment_effective_status.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 48 AS guard_order,
       'fn.referee_v5_assignment_effective_status.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"c91ffb1ec3faa1e6fa2b3ea9395c4058"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058') AS matches_guard
UNION ALL
SELECT 50 AS guard_order,
       'fn.referee_v5_assignment_effective_status.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"IMMUTABLE"}'::jsonb AS expected_json,
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
       '{"language":"sql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
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
UNION ALL
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
UNION ALL
SELECT 99 AS guard_order,
       'fn.team_tournament_list_referee_assignments.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 100 AS guard_order,
       'fn.team_tournament_list_referee_assignments.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_assignments'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_assignments'
        ) = 1) AS matches_guard
UNION ALL
SELECT 101 AS guard_order,
       'fn.team_tournament_list_referee_assignments.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"9ec273071d309641425a3d30d704a14b"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b') AS matches_guard
UNION ALL
SELECT 102 AS guard_order,
       'fn.team_tournament_list_referee_assignments.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"STABLE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') AS matches_guard
UNION ALL
SELECT 103 AS guard_order,
       'fn.team_tournament_list_referee_assignments.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 104 AS guard_order,
       'fn.team_tournament_list_referee_assignments.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 105 AS guard_order,
       'fn.team_tournament_list_referee_assignments.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 106 AS guard_order,
       'fn.team_tournament_list_referee_assignments.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 107 AS guard_order,
       'fn.team_tournament_list_referee_assignments.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 108 AS guard_order,
       'fn.team_tournament_list_referee_assignments.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 109 AS guard_order,
       'fn.team_tournament_list_referee_assignments.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 110 AS guard_order,
       'fn.team_tournament_list_referee_assignments.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 111 AS guard_order,
       'fn.team_tournament_list_referee_assignments.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 112 AS guard_order,
       'fn.team_tournament_list_referee_corrections.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 113 AS guard_order,
       'fn.team_tournament_list_referee_corrections.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_corrections'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_corrections'
        ) = 1) AS matches_guard
UNION ALL
SELECT 114 AS guard_order,
       'fn.team_tournament_list_referee_corrections.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"513f41aabc74d5864a879d714796b53a"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a') AS matches_guard
UNION ALL
SELECT 115 AS guard_order,
       'fn.team_tournament_list_referee_corrections.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"STABLE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') AS matches_guard
UNION ALL
SELECT 116 AS guard_order,
       'fn.team_tournament_list_referee_corrections.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 117 AS guard_order,
       'fn.team_tournament_list_referee_corrections.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 118 AS guard_order,
       'fn.team_tournament_list_referee_corrections.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 119 AS guard_order,
       'fn.team_tournament_list_referee_corrections.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 120 AS guard_order,
       'fn.team_tournament_list_referee_corrections.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 121 AS guard_order,
       'fn.team_tournament_list_referee_corrections.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 122 AS guard_order,
       'fn.team_tournament_list_referee_corrections.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 123 AS guard_order,
       'fn.team_tournament_list_referee_corrections.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 124 AS guard_order,
       'fn.team_tournament_list_referee_corrections.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 125 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 126 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"4229dd7686b6eaae990e9353e764f927"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927') AS matches_guard
UNION ALL
SELECT 128 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 131 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 132 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 133 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 135 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 136 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 137 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 138 AS guard_order,
       'fn.team_tournament_reopen_referee_match.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 139 AS guard_order,
       'fn.team_tournament_reopen_referee_match.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"81f3b086288dc8da26700349bbbab3b2"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2') AS matches_guard
UNION ALL
SELECT 141 AS guard_order,
       'fn.team_tournament_reopen_referee_match.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 144 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 145 AS guard_order,
       'fn.team_tournament_reopen_referee_match.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 146 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 148 AS guard_order,
       'fn.team_tournament_reopen_referee_match.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
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
UNION ALL
SELECT 172 AS guard_order,
       'fn.team_tournament_review_referee_correction.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 173 AS guard_order,
       'fn.team_tournament_review_referee_correction.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 174 AS guard_order,
       'fn.team_tournament_review_referee_correction.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 175 AS guard_order,
       'fn.team_tournament_review_referee_correction.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 176 AS guard_order,
       'fn.team_tournament_review_referee_correction.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 177 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 178 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_revoke_referee_assignment'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_revoke_referee_assignment'
        ) = 1) AS matches_guard
UNION ALL
SELECT 179 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"f3280a760c9f4449aee6916d16c5026d"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d') AS matches_guard
UNION ALL
SELECT 180 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 181 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 182 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 183 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 184 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 185 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 186 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 187 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 188 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 189 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
)
SELECT guard_order, guard_id, object_class, object_identity, contract_version, expected_json, actual_json, matches_guard
FROM guard_results
ORDER BY guard_order;

WITH guard_results AS (
SELECT 1 AS guard_order,
       'provenance.absent' AS guard_id,
       'migration_provenance' AS object_class,
       'supabase_migrations.schema_migrations' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    ))) AS actual_json,
       (NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE name = 'phase5d_tt5d_controlled_reconciliation' OR version = '20260731150000'
    )) AS matches_guard
UNION ALL
SELECT 2 AS guard_order,
       'provenance.club_ai_data_absent' AS guard_id,
       'table' AS object_class,
       'public.club_ai_data' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"absent":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regclass('public.club_ai_data') IS NULL)) AS actual_json,
       (to_regclass('public.club_ai_data') IS NULL) AS matches_guard
UNION ALL
SELECT 3 AS guard_order,
       'table.function_count_13' AS guard_id,
       'function_set' AS object_class,
       'public.tt5d_functions' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"count":13}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13)) AS actual_json,
       ((
      SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
      WHERE nn.nspname='public' AND pp.proname IN ('referee_v5_apply_admin_result_revision', 'referee_v5_assert_assignment_write', 'referee_v5_assignment_effective_status', 'referee_v5_current_user_has_assignment', 'referee_v5_mark_assignment_expired_if_needed', 'team_tournament_create_referee_assignment', 'team_tournament_list_referee_assignments', 'team_tournament_list_referee_corrections', 'team_tournament_referee_match_access_ops', 'team_tournament_reopen_referee_match', 'team_tournament_request_referee_correction', 'team_tournament_review_referee_correction', 'team_tournament_revoke_referee_assignment')
    ) = 13) AS matches_guard
UNION ALL
SELECT 4 AS guard_order,
       'table.referee_assignments.owner' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 5 AS guard_order,
       'table.referee_assignments.rls' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relrowsecurity":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE)) AS actual_json,
       ((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM TRUE) AS matches_guard
UNION ALL
SELECT 6 AS guard_order,
       'table.referee_assignments.rls_forced' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"relforcerowsecurity":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE)) AS actual_json,
       ((SELECT c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='referee_assignments') IS NOT DISTINCT FROM FALSE) AS matches_guard
UNION ALL
SELECT 7 AS guard_order,
       'table.referee_assignments.tt5d_columns_count' AS guard_id,
       'table' AS object_class,
       'public.referee_assignments' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"tt5d_column_count":6}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6)) AS actual_json,
       ((
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='referee_assignments'
        AND column_name IN ('external_matchup_id','external_sub_match_id','matchup_id','sub_match_id','revoke_reason','version')
    ) = 6) AS matches_guard
UNION ALL
SELECT 8 AS guard_order,
       'table.referee_assignments.version_column' AS guard_id,
       'column' AS object_class,
       'public.referee_assignments.version' AS object_identity,
       'COLUMN_DEFAULT_EXPR_V1' AS contract_version,
       '{"dataType":"integer","notNull":true,"defaultExprNormalized":"1"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 9 AS guard_order,
       'table.referee_assignments.matchup_id_fkey' AS guard_id,
       'foreign_key' AS object_class,
       'public.referee_assignments.matchup_id' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"references":"public.team_tournament_matchups(id)","onDelete":"SET NULL"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='matchup_id'
        AND ccu.table_name='team_tournament_matchups' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) AS matches_guard
UNION ALL
SELECT 10 AS guard_order,
       'table.referee_assignments.sub_match_id_fkey' AS guard_id,
       'foreign_key' AS object_class,
       'public.referee_assignments.sub_match_id' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"references":"public.team_tournament_sub_matches(id)","onDelete":"SET NULL"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    ))) AS actual_json,
       (EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=rc.constraint_name AND kcu.constraint_schema=rc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=rc.constraint_name AND ccu.constraint_schema=rc.constraint_schema
      WHERE kcu.table_schema='public' AND kcu.table_name='referee_assignments' AND kcu.column_name='sub_match_id'
        AND ccu.table_name='team_tournament_sub_matches' AND ccu.column_name='id' AND rc.delete_rule='SET NULL'
    )) AS matches_guard
UNION ALL
SELECT 11 AS guard_order,
       'table.referee_assignments.status_check' AS guard_id,
       'constraint' AS object_class,
       'public.referee_assignments.referee_assignments_status_check' AS object_identity,
       'CONSTRAINT_CATALOG_V1' AS contract_version,
       '{"exprNormalized":"((status = ANY (ARRAY[''pending''::text, ''active''::text, ''expired''::text, ''revoked''::text, ''completed''::text])))"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 12 AS guard_order,
       'table.referee_assignments.sub_match_index' AS guard_id,
       'index' AS object_class,
       'public.referee_assignments_sub_match_idx' AS object_identity,
       'INDEX_CATALOG_V1' AS contract_version,
       '{"indexName":"referee_assignments_sub_match_idx","tableName":"referee_assignments","amname":"btree","keyColumns":["sub_match_id","status"],"predicateNormalized":"sub_match_id IS NOT NULL","owner":"postgres","unique":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 13 AS guard_order,
       'table.correction.index' AS guard_id,
       'index' AS object_class,
       'public.tt5d_correction_pending_idx' AS object_identity,
       'INDEX_CATALOG_V1' AS contract_version,
       '{"indexName":"tt5d_correction_pending_idx","tableName":"team_tournament_referee_correction_requests","amname":"btree","keyColumns":["tenant_id","tournament_id","status"],"predicateNormalized":"status = ''pending''::text","owner":"postgres","unique":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (EXISTS (
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
  ))) AS actual_json,
       (EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 14 AS guard_order,
       'table.correction.owner' AS guard_id,
       'table' AS object_class,
       'public.team_tournament_referee_correction_requests' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(c.relowner) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='team_tournament_referee_correction_requests') IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
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
UNION ALL
SELECT 29 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 31 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 32 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 33 AS guard_order,
       'fn.referee_v5_apply_admin_result_revision.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_apply_admin_result_revision(text, text, text, uuid, text, jsonb, text, text, text, uuid)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 34 AS guard_order,
       'fn.referee_v5_assert_assignment_write.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 35 AS guard_order,
       'fn.referee_v5_assert_assignment_write.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"e7854c03e3ffebf81a7928d6b8740ad5"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'))) IS NOT DISTINCT FROM 'e7854c03e3ffebf81a7928d6b8740ad5') AS matches_guard
UNION ALL
SELECT 37 AS guard_order,
       'fn.referee_v5_assert_assignment_write.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 40 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proconfig' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 41 AS guard_order,
       'fn.referee_v5_assert_assignment_write.owner' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 42 AS guard_order,
       'fn.referee_v5_assert_assignment_write.proacl' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 44 AS guard_order,
       'fn.referee_v5_assert_assignment_write.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 45 AS guard_order,
       'fn.referee_v5_assert_assignment_write.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 46 AS guard_order,
       'fn.referee_v5_assert_assignment_write.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.referee_v5_assert_assignment_write(text, text, text, uuid, boolean)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 47 AS guard_order,
       'fn.referee_v5_assignment_effective_status.missing' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 48 AS guard_order,
       'fn.referee_v5_assignment_effective_status.overload_count' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"c91ffb1ec3faa1e6fa2b3ea9395c4058"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)'))) IS NOT DISTINCT FROM 'c91ffb1ec3faa1e6fa2b3ea9395c4058') AS matches_guard
UNION ALL
SELECT 50 AS guard_order,
       'fn.referee_v5_assignment_effective_status.volatility' AS guard_id,
       'function' AS object_class,
       'public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"IMMUTABLE"}'::jsonb AS expected_json,
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
       '{"language":"sql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz)')) IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
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
UNION ALL
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
UNION ALL
SELECT 99 AS guard_order,
       'fn.team_tournament_list_referee_assignments.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 100 AS guard_order,
       'fn.team_tournament_list_referee_assignments.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_assignments'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_assignments'
        ) = 1) AS matches_guard
UNION ALL
SELECT 101 AS guard_order,
       'fn.team_tournament_list_referee_assignments.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"9ec273071d309641425a3d30d704a14b"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'))) IS NOT DISTINCT FROM '9ec273071d309641425a3d30d704a14b') AS matches_guard
UNION ALL
SELECT 102 AS guard_order,
       'fn.team_tournament_list_referee_assignments.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"STABLE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') AS matches_guard
UNION ALL
SELECT 103 AS guard_order,
       'fn.team_tournament_list_referee_assignments.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 104 AS guard_order,
       'fn.team_tournament_list_referee_assignments.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 105 AS guard_order,
       'fn.team_tournament_list_referee_assignments.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 106 AS guard_order,
       'fn.team_tournament_list_referee_assignments.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 107 AS guard_order,
       'fn.team_tournament_list_referee_assignments.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_assignments(text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 108 AS guard_order,
       'fn.team_tournament_list_referee_assignments.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 109 AS guard_order,
       'fn.team_tournament_list_referee_assignments.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 110 AS guard_order,
       'fn.team_tournament_list_referee_assignments.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 111 AS guard_order,
       'fn.team_tournament_list_referee_assignments.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_assignments(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_assignments(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 112 AS guard_order,
       'fn.team_tournament_list_referee_corrections.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 113 AS guard_order,
       'fn.team_tournament_list_referee_corrections.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_corrections'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_list_referee_corrections'
        ) = 1) AS matches_guard
UNION ALL
SELECT 114 AS guard_order,
       'fn.team_tournament_list_referee_corrections.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"513f41aabc74d5864a879d714796b53a"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'))) IS NOT DISTINCT FROM '513f41aabc74d5864a879d714796b53a') AS matches_guard
UNION ALL
SELECT 115 AS guard_order,
       'fn.team_tournament_list_referee_corrections.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"STABLE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'STABLE') AS matches_guard
UNION ALL
SELECT 116 AS guard_order,
       'fn.team_tournament_list_referee_corrections.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 117 AS guard_order,
       'fn.team_tournament_list_referee_corrections.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 118 AS guard_order,
       'fn.team_tournament_list_referee_corrections.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 119 AS guard_order,
       'fn.team_tournament_list_referee_corrections.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 120 AS guard_order,
       'fn.team_tournament_list_referee_corrections.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_list_referee_corrections(text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 121 AS guard_order,
       'fn.team_tournament_list_referee_corrections.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 122 AS guard_order,
       'fn.team_tournament_list_referee_corrections.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 123 AS guard_order,
       'fn.team_tournament_list_referee_corrections.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 124 AS guard_order,
       'fn.team_tournament_list_referee_corrections.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_list_referee_corrections(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_list_referee_corrections(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 125 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 126 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"4229dd7686b6eaae990e9353e764f927"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'))) IS NOT DISTINCT FROM '4229dd7686b6eaae990e9353e764f927') AS matches_guard
UNION ALL
SELECT 128 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 131 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 132 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 133 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 135 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 136 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 137 AS guard_order,
       'fn.team_tournament_referee_match_access_ops.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_referee_match_access_ops(text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_referee_match_access_ops(text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 138 AS guard_order,
       'fn.team_tournament_reopen_referee_match.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 139 AS guard_order,
       'fn.team_tournament_reopen_referee_match.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
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
       '{"defMd5":"81f3b086288dc8da26700349bbbab3b2"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'))) IS NOT DISTINCT FROM '81f3b086288dc8da26700349bbbab3b2') AS matches_guard
UNION ALL
SELECT 141 AS guard_order,
       'fn.team_tournament_reopen_referee_match.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
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
       '{"language":"plpgsql"}'::jsonb AS expected_json,
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
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 144 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 145 AS guard_order,
       'fn.team_tournament_reopen_referee_match.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 146 AS guard_order,
       'fn.team_tournament_reopen_referee_match.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
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
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 148 AS guard_order,
       'fn.team_tournament_reopen_referee_match.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_reopen_referee_match(text, text, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_reopen_referee_match(text, text, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
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
UNION ALL
SELECT 172 AS guard_order,
       'fn.team_tournament_review_referee_correction.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 173 AS guard_order,
       'fn.team_tournament_review_referee_correction.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 174 AS guard_order,
       'fn.team_tournament_review_referee_correction.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 175 AS guard_order,
       'fn.team_tournament_review_referee_correction.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 176 AS guard_order,
       'fn.team_tournament_review_referee_correction.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_review_referee_correction(text, uuid, text, text, integer, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 177 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.missing' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"present":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL)) AS actual_json,
       (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)') IS NOT NULL) AS matches_guard
UNION ALL
SELECT 178 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.overload_count' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"overload_count":1}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_revoke_referee_assignment'
        ) = 1)) AS actual_json,
       ((
          SELECT count(*) FROM pg_proc pp JOIN pg_namespace nn ON nn.oid=pp.pronamespace
          WHERE nn.nspname='public' AND pp.proname='team_tournament_revoke_referee_assignment'
        ) = 1) AS matches_guard
UNION ALL
SELECT 179 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.def_md5' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'INTENTIONAL_EXACT_FINGERPRINT' AS contract_version,
       '{"defMd5":"f3280a760c9f4449aee6916d16c5026d"}'::jsonb AS expected_json,
       jsonb_build_object('matches', (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d')) AS actual_json,
       (md5(pg_get_functiondef(to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'))) IS NOT DISTINCT FROM 'f3280a760c9f4449aee6916d16c5026d') AS matches_guard
UNION ALL
SELECT 180 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.volatility' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"volatility":"VOLATILE"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE')) AS actual_json,
       ((
          SELECT CASE pp.provolatile WHEN 'i' THEN 'IMMUTABLE' WHEN 's' THEN 'STABLE' WHEN 'v' THEN 'VOLATILE' END
          FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'VOLATILE') AS matches_guard
UNION ALL
SELECT 181 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.language' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"language":"plpgsql"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql')) AS actual_json,
       ((
          SELECT l.lanname FROM pg_proc pp JOIN pg_language l ON l.oid=pp.prolang WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')
        ) IS NOT DISTINCT FROM 'plpgsql') AS matches_guard
UNION ALL
SELECT 182 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.security_definer' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"securityDefiner":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true)) AS actual_json,
       ((SELECT pp.prosecdef FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 183 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.proconfig' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'PROCONFIG_TEXT_ARRAY_V1' AS contract_version,
       '{"proconfig":["search_path=public"]}'::jsonb AS expected_json,
       jsonb_build_object('matches', (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[]))) AS actual_json,
       (NOT (coalesce((SELECT pp.proconfig FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')), ARRAY[]::text[]) IS DISTINCT FROM ARRAY['search_path=public']::text[])) AS matches_guard
UNION ALL
SELECT 184 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.owner' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"owner":"postgres"}'::jsonb AS expected_json,
       jsonb_build_object('matches', ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres')) AS actual_json,
       ((SELECT pg_get_userbyid(pp.proowner) FROM pg_proc pp WHERE pp.oid=to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')) IS NOT DISTINCT FROM 'postgres') AS matches_guard
UNION ALL
SELECT 185 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.proacl' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'ACL_EXPLODED_SET_V1' AS contract_version,
       '{"aclExploded":[{"grantee":"postgres","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"authenticated","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false},{"grantee":"service_role","privilege_type":"EXECUTE","grantor":"postgres","is_grantable":false}]}'::jsonb AS expected_json,
       coalesce((SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY grantee, privilege_type, grantor, is_grantable), '[]'::jsonb)
    FROM (SELECT CASE grantee WHEN 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
           privilege_type,
           pg_get_userbyid(grantor) AS grantor,
           is_grantable
    FROM aclexplode(((SELECT coalesce(pp.proacl, acldefault('f', pp.proowner))
      FROM pg_proc pp WHERE pp.oid = (to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)')))))) x), jsonb_build_object('matches', (NOT EXISTS (
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
  )))) AS actual_json,
       (NOT EXISTS (
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
  )) AS matches_guard
UNION ALL
SELECT 186 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.public_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"publicExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('public', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 187 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.anon_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"anonExecute":false}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false)) AS actual_json,
       (has_function_privilege('anon', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM false) AS matches_guard
UNION ALL
SELECT 188 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.authenticated_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"authenticatedExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('authenticated', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
UNION ALL
SELECT 189 AS guard_order,
       'fn.team_tournament_revoke_referee_assignment.service_role_execute' AS guard_id,
       'function' AS object_class,
       'public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)' AS object_identity,
       'TYPED_COMPARISON' AS contract_version,
       '{"serviceRoleExecute":true}'::jsonb AS expected_json,
       jsonb_build_object('matches', (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true)) AS actual_json,
       (has_function_privilege('service_role', to_regprocedure('public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text)'), 'EXECUTE') IS NOT DISTINCT FROM true) AS matches_guard
)
SELECT
  count(*)::int AS total_guard_count,
  count(*) FILTER (WHERE matches_guard)::int AS passed_guard_count,
  count(*) FILTER (WHERE NOT matches_guard)::int AS failed_guard_count,
  bool_and(matches_guard) AS preflight_all_pass
FROM guard_results;
