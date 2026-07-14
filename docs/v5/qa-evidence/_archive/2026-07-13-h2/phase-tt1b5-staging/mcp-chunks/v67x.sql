with row_stats as (
  select 'team_tournaments' as table_name,
         count(*)::bigint as row_count,
         count(*) filter (where version is null)::bigint as null_version_count,
         count(*) filter (where version < 1)::bigint as invalid_version_count
  from public.team_tournaments
  union all
  select 'team_tournament_matchups', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_matchups
  union all
  select 'team_tournament_lineups', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_lineups
  union all
  select 'team_tournament_sub_matches', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_sub_matches
  union all
  select 'team_tournament_standings', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_standings
  union all
  select 'team_tournament_dreambreaker_states', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_dreambreaker_states
  union all
  select 'team_tournament_forfeit_events', count(*),
         count(*) filter (where version is null),
         count(*) filter (where version < 1)
  from public.team_tournament_forfeit_events
),
version_bounds as (
  select 'team_tournaments' as table_name, min(version) as min_v, max(version) as max_v from public.team_tournaments
  union all select 'team_tournament_matchups', min(version), max(version) from public.team_tournament_matchups
  union all select 'team_tournament_lineups', min(version), max(version) from public.team_tournament_lineups
  union all select 'team_tournament_sub_matches', min(version), max(version) from public.team_tournament_sub_matches
  union all select 'team_tournament_standings', min(version), max(version) from public.team_tournament_standings
  union all select 'team_tournament_dreambreaker_states', min(version), max(version) from public.team_tournament_dreambreaker_states
  union all select 'team_tournament_forfeit_events', min(version), max(version) from public.team_tournament_forfeit_events
),
v6 as (
  select
    'V6.' || rs.table_name || '.summary' as check_id,
    'row_count>=0; null_version=0; invalid_version=0; min/max valid if non-empty' as expected,
    format(
      'rows=%s null=%s invalid=%s min=%s max=%s',
      rs.row_count,
      rs.null_version_count,
      rs.invalid_version_count,
      case when rs.row_count = 0 then 'null' else vb.min_v::text end,
      case when rs.row_count = 0 then 'null' else vb.max_v::text end
    ) as actual,
    case
      when rs.null_version_count > 0 or rs.invalid_version_count > 0 then 'FAIL'
      when rs.row_count = 0 then 'PASS'
      when coalesce(vb.min_v, 0) >= 1 and coalesce(vb.max_v, 0) >= 1 then 'PASS'
      else 'FAIL'
    end as status
  from row_stats rs
  left join version_bounds vb on vb.table_name = rs.table_name
),
orphan_counts as (
  select 'lineup_entries_orphan_lineup' as orphan_type, count(*)::bigint as orphan_count
  from public.team_tournament_lineup_entries e
  left join public.team_tournament_lineups l on l.id = e.lineup_id
  where l.id is null
  union all
  select 'lineup_orphan_matchup', count(*)
  from public.team_tournament_lineups l
  left join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.id is null
  union all
  select 'lineup_orphan_team', count(*)
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  left join public.team_tournament_teams t
    on t.team_tournament_id = m.team_tournament_id and t.external_team_id = l.team_external_id
  where t.id is null
  union all
  select 'matchup_orphan_tournament', count(*)
  from public.team_tournament_matchups m
  left join public.team_tournaments tt on tt.id = m.team_tournament_id
  where tt.id is null
  union all
  select 'sub_match_orphan_matchup', count(*)
  from public.team_tournament_sub_matches sm
  left join public.team_tournament_matchups m on m.id = sm.matchup_id
  where m.id is null
  union all
  select 'standing_orphan_team', count(*)
  from public.team_tournament_standings s
  left join public.team_tournament_teams t
    on t.team_tournament_id = s.team_tournament_id and t.external_team_id = s.team_external_id
  where t.id is null
  union all
  select 'lineup_revision_orphan_lineup', count(*)
  from public.team_tournament_lineup_revisions r
  left join public.team_tournament_lineups l on l.id = r.lineup_id
  where l.id is null
  union all
  select 'forfeit_orphan_parent', count(*)
  from public.team_tournament_forfeit_events f
  where (f.matchup_id is null and f.sub_match_id is null)
     or (f.matchup_id is not null and not exists (select 1 from public.team_tournament_matchups m where m.id = f.matchup_id))
     or (f.sub_match_id is not null and not exists (select 1 from public.team_tournament_sub_matches sm where sm.id = f.sub_match_id))
  union all
  select 'dreambreaker_orphan_matchup', count(*)
  from public.team_tournament_dreambreaker_states d
  left join public.team_tournament_matchups m on m.id = d.matchup_id
  where m.id is null
),
v7 as (
  select 'V7.' || oc.orphan_type as check_id, '0 orphan rows' as expected,
         oc.orphan_count::text as actual,
         case when oc.orphan_count = 0 then 'PASS' else 'FAIL' end as status
  from orphan_counts oc
),
fn_meta as (
  select p.proname as function_name,
         pg_get_function_identity_arguments(p.oid) as identity_args,
         pg_get_function_result(p.oid) as return_type,
         coalesce((select option_value from pg_options_to_table(p.proconfig) o(option_name, option_value) where option_name = 'search_path'), '') as search_path,
         pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'team_tournament_%'
),
extra as (
  select 'X.command_log.idempotency_key_not_null' as check_id, 'column NOT NULL' as expected,
         case when c.is_nullable = 'NO' then 'NOT NULL' else coalesce(c.is_nullable, 'missing column') end as actual,
         case when c.is_nullable = 'NO' then 'PASS' else 'FAIL' end as status
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'team_tournament_command_log' and c.column_name = 'idempotency_key'
  union all
  select 'X.command_log.payload_hash_type', 'text NOT NULL',
         coalesce(c.data_type || ' nullable=' || c.is_nullable, 'missing'),
         case when c.data_type = 'text' and c.is_nullable = 'NO' then 'PASS' else 'FAIL' end
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'team_tournament_command_log' and c.column_name = 'payload_hash'
  union all
  select 'X.command_log.no_null_idempotency_rows', '0 rows with null/blank idempotency_key',
         count(*) filter (where idempotency_key is null or btrim(idempotency_key) = '')::text,
         case when count(*) filter (where idempotency_key is null or btrim(idempotency_key) = '') = 0 then 'PASS' else 'FAIL' end
  from public.team_tournament_command_log
  union all
  select 'X.lineup.no_duplicate_matchup_team', '0 duplicate (matchup_id, team_external_id)',
         coalesce((select count(*)::text from (select matchup_id, team_external_id from public.team_tournament_lineups group by 1,2 having count(*)>1) d), '0'),
         case when not exists (select 1 from public.team_tournament_lineups group by matchup_id, team_external_id having count(*)>1) then 'PASS' else 'FAIL' end
  union all
  select 'X.version_conflict_rpc.exists', 'team_tournament_version_conflict(text, integer, integer) returns json',
         coalesce(fm.identity_args || ' -> ' || fm.return_type, 'missing'),
         case when fm.function_name is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join fn_meta fm on fm.function_name = 'team_tournament_version_conflict'
    and fm.identity_args = 'p_entity text, p_expected integer, p_actual integer'
  union all
  select 'X.payload_hash.digest_hotfix', 'function uses extensions.digest and search_path public, extensions',
         case when fm.definition ilike '%extensions.digest%' then 'extensions.digest present' else 'extensions.digest missing' end,
         case when fm.definition ilike '%extensions.digest%' and fm.search_path ilike '%extensions%' then 'PASS' else 'FAIL' end
  from fn_meta fm where fm.function_name = 'team_tournament_payload_hash'
  union all
  select 'X.index.' || expected_idx || '.exists', 'index present on staging',
         case when pi.indexname is not null then pi.indexname else 'missing' end,
         case when pi.indexname is not null then 'PASS' else 'FAIL' end
  from (values ('idx_team_tournament_command_log_tenant'),('idx_team_tournament_lineup_revisions_lineup'),('idx_team_tournament_sync_mismatch_open')) as e(expected_idx)
  left join pg_indexes pi on pi.schemaname = 'public' and pi.indexname = e.expected_idx
  union all
  select 'X.fk.lineup_revisions_lineup_id', 'FK lineup_revisions.lineup_id -> team_tournament_lineups.id',
         coalesce(c.conname, 'missing'), case when c.conname is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join pg_constraint c on c.conrelid = 'public.team_tournament_lineup_revisions'::regclass and c.contype = 'f' and c.conname like '%lineup%'
  union all
  select 'X.fk.dreambreaker_matchup_id', 'FK dreambreaker_states.matchup_id -> team_tournament_matchups.id',
         coalesce(c.conname, 'missing'), case when c.conname is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join pg_constraint c on c.conrelid = 'public.team_tournament_dreambreaker_states'::regclass and c.contype = 'f' and c.conname like '%matchup%'
)
select check_id, expected, actual, status from v6
union all select check_id, expected, actual, status from v7
union all select check_id, expected, actual, status from extra
order by check_id;
