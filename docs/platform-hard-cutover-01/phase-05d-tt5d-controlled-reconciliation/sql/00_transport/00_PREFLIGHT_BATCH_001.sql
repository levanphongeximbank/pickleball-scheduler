-- Phase 5D A.5 transport-safe SELECT-only preflight batch
-- batch_id=00_PREFLIGHT_BATCH_001
-- manifest_fingerprint=19214b111bf72dce76d49967b226c40a5526caf5e974590f5a83fc8792cd0c6e
-- Contract versions: ACL_EXPLODED_SET_V1, INDEX_CATALOG_V1, CONSTRAINT_CATALOG_V1, COLUMN_DEFAULT_EXPR_V1, PROCONFIG_TEXT_ARRAY_V1, WS_COLLAPSE_V1.
-- One WITH...SELECT only. No BEGIN/COMMIT/DO/DDL/DML/RPC.

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
)
SELECT '00_PREFLIGHT_BATCH_001' AS batch_id,
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
