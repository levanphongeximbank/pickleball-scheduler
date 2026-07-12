with version_tables as (
  select *
  from (values
    ('team_tournaments', true),
    ('team_tournament_teams', false),
    ('team_tournament_matchups', true),
    ('team_tournament_lineups', true),
    ('team_tournament_sub_matches', true),
    ('team_tournament_standings', true),
    ('team_tournament_dreambreaker_states', true),
    ('team_tournament_forfeit_events', true)
  ) as t(table_name, required_by_tt1b)
),
col_meta as (
  select
    vt.table_name,
    vt.required_by_tt1b,
    c.column_name is not null as col_exists,
    c.data_type,
    c.is_nullable,
    c.column_default
  from version_tables vt
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = vt.table_name
   and c.column_name = 'version'
),
row_stats as (
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
v1 as (
  select
    'V1.' || cm.table_name || '.column_exists' as check_id,
    case when cm.required_by_tt1b then 'version column exists'
         else 'no version column (not in TT-1B SSOT)' end as expected,
    case when cm.required_by_tt1b then
           case when cm.col_exists then 'exists' else 'missing' end
         else case when cm.col_exists then 'exists (unexpected)' else 'absent (OK)' end
    end as actual,
    case
      when not cm.required_by_tt1b and not cm.col_exists then 'PASS'
      when cm.required_by_tt1b and cm.col_exists then 'PASS'
      else 'FAIL'
    end as status
  from col_meta cm

  union all

  select
    'V1.' || cm.table_name || '.data_type_integer',
    'integer',
    coalesce(cm.data_type, 'missing'),
    case when cm.required_by_tt1b and cm.data_type = 'integer' then 'PASS'
         when not cm.required_by_tt1b then 'PASS'
         else 'FAIL' end
  from col_meta cm

  union all

  select
    'V1.' || cm.table_name || '.not_null',
    'NO',
    coalesce(cm.is_nullable, 'missing'),
    case when cm.required_by_tt1b and cm.is_nullable = 'NO' then 'PASS'
         when not cm.required_by_tt1b then 'PASS'
         else 'FAIL' end
  from col_meta cm

  union all

  select
    'V1.' || cm.table_name || '.default_1',
    'default = 1',
    coalesce(cm.column_default, 'missing'),
    case
      when not cm.required_by_tt1b then 'PASS'
      when cm.column_default ~ '1'::text then 'PASS'
      else 'FAIL'
    end
  from col_meta cm

  union all

  select
    'V1.' || rs.table_name || '.no_null_version_rows',
    '0 null version rows',
    rs.null_version_count::text,
    case when rs.null_version_count = 0 then 'PASS' else 'FAIL' end
  from row_stats rs
  join version_tables vt on vt.table_name = rs.table_name and vt.required_by_tt1b

  union all

  select
    'V1.' || rs.table_name || '.no_invalid_version_rows',
    '0 rows with version < 1',
    rs.invalid_version_count::text,
    case when rs.invalid_version_count = 0 then 'PASS' else 'FAIL' end
  from row_stats rs
  join version_tables vt on vt.table_name = rs.table_name and vt.required_by_tt1b
)
select check_id, expected, actual, status from v1 order by check_id;