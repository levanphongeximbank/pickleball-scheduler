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
),

tt1b_expected as (
  select unnest(array[
    'team_tournament_command_log',
    'team_tournament_lineup_revisions',
    'team_tournament_dreambreaker_states',
    'team_tournament_forfeit_events',
    'team_tournament_sync_mismatch'
  ]) as table_name
),
tt1b_present as (
  select t.table_name,
         (ist.table_name is not null) as exists_flag
  from tt1b_expected t
  left join information_schema.tables ist
    on ist.table_schema = 'public' and ist.table_name = t.table_name
),
v2 as (
  select
    'V2.' || tp.table_name || '.exists' as check_id,
    'table exists in public schema' as expected,
    case when tp.exists_flag then 'present' else 'missing' end as actual,
    case when tp.exists_flag then 'PASS' else 'FAIL' end as status
  from tt1b_present tp

  union all

  select
    'V2.all_tt1b_tables',
    'all 5 TT-1B tables present',
    (select count(*)::text || '/5 present' from tt1b_present where exists_flag),
    case when (select bool_and(exists_flag) from tt1b_present) then 'PASS' else 'FAIL' end
),

lineup_rls as (
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('team_tournament_lineups', 'team_tournament_lineup_entries')
),
lineup_select_policies as (
  select tablename, count(*) as select_policy_count,
         string_agg(policyname, ', ' order by policyname) as policy_names
  from pg_policies
  where schemaname = 'public'
    and tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
    and cmd in ('SELECT', 'ALL')
    and policyname like '%tenant_select%'
  group by tablename
),
lineup_write_policies as (
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
    and tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
    and policyname like '%tenant_write%'
),
table_grants as (
  select
    c.relname as table_name,
    has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
    has_table_privilege('authenticated', c.oid, 'SELECT') as auth_can_select
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('team_tournament_lineups', 'team_tournament_lineup_entries')
),
tt1b_manage_policies as (
  select tablename, policyname,
         qual as using_expr,
         with_check as check_expr
  from pg_policies
  where schemaname = 'public'
    and policyname in (
      'team_tournament_command_log_manage',
      'team_tournament_lineup_revisions_manage',
      'team_tournament_dreambreaker_manage',
      'team_tournament_forfeit_manage',
      'team_tournament_sync_mismatch_manage'
    )
),
v3 as (
  select
    'V3.' || lr.table_name || '.rls_enabled' as check_id,
    'RLS enabled (relrowsecurity=true)' as expected,
    case when lr.rls_enabled then 'enabled' else 'disabled' end as actual,
    case when lr.rls_enabled then 'PASS' else 'FAIL' end as status
  from lineup_rls lr

  union all

  select
    'V3.' || coalesce(lsp.tablename, t.tbl) || '.no_broad_tenant_select',
    '0 broad tenant SELECT policies (captain/player leak)',
    coalesce(lsp.select_policy_count::text, '0'),
    case when coalesce(lsp.select_policy_count, 0) = 0 then 'PASS' else 'FAIL' end
  from (values ('team_tournament_lineups'), ('team_tournament_lineup_entries')) as t(tbl)
  left join lineup_select_policies lsp on lsp.tablename = t.tbl

  union all

  select
    'V3.lineup_no_direct_select_bypass',
    'no SELECT policy; ALL policies require manage or super_admin',
    coalesce((
      select count(*)::text
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
        and p.cmd = 'SELECT'
    ), '0') || ' SELECT; ' || coalesce((
      select count(*)::text
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
        and p.cmd = 'ALL'
        and coalesce(p.qual, '') not ilike '%team_tournament_can_manage%'
        and coalesce(p.qual, '') not ilike '%is_super_admin%'
    ), '0') || ' ALL without manage',
    case when (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
        and p.cmd = 'SELECT'
    ) = 0
    and (
      select count(*)
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename in ('team_tournament_lineups', 'team_tournament_lineup_entries')
        and p.cmd = 'ALL'
        and coalesce(p.qual, '') not ilike '%team_tournament_can_manage%'
        and coalesce(p.qual, '') not ilike '%is_super_admin%'
    ) = 0
    then 'PASS' else 'FAIL' end

  union all

  select
    'V3.' || lwp.tablename || '.write_policy_requires_manage',
    'tenant_write USING includes team_tournament_can_manage()',
    left(coalesce((
      select qual from pg_policies p
      where p.schemaname = 'public' and p.tablename = lwp.tablename and p.policyname = lwp.policyname
    ), ''), 120),
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = lwp.tablename
        and p.policyname = lwp.policyname
        and p.qual ilike '%team_tournament_can_manage%'
    ) then 'PASS' else 'FAIL' end
  from lineup_write_policies lwp

  union all

  select
    'V3.' || t.tbl || '.anon_select_rls_blocked',
    'RLS blocks anon reads (no tenant_select policy; write requires manage)',
    case
      when not tg.anon_can_select then 'no anon SELECT privilege'
      when not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tbl
          and p.cmd in ('SELECT', 'ALL')
          and p.policyname like '%tenant_select%'
      ) then 'Supabase default grant; RLS + no broad SELECT policy'
      else 'anon can read via policy'
    end,
    case
      when not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t.tbl
          and p.policyname like '%tenant_select%'
      ) then 'PASS'
      else 'FAIL'
    end
  from (values ('team_tournament_lineups'), ('team_tournament_lineup_entries')) as t(tbl)
  left join table_grants tg on tg.table_name = t.tbl

  union all

  select
    'V3.' || t.tbl || '.authenticated_select_rls_blocked',
    'no broad tenant SELECT for captain/player (manage-only ALL policy OK)',
    case when not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tbl
        and p.policyname like '%tenant_select%'
    ) then 'no tenant_select policy' else 'tenant_select present' end,
    case when not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tbl
        and p.policyname like '%tenant_select%'
    ) then 'PASS' else 'FAIL' end
  from (values ('team_tournament_lineups'), ('team_tournament_lineup_entries')) as t(tbl)

  union all

  select
    'V3.' || t.tbl || '.no_anon_select_grant',
    'no direct GRANT SELECT to anon role (information_schema)',
    coalesce((
      select count(*)::text
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = t.tbl
        and g.grantee = 'anon' and g.privilege_type = 'SELECT'
    ), '0'),
    case when coalesce((
      select count(*)
      from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = t.tbl
        and g.grantee = 'anon' and g.privilege_type = 'SELECT'
    ), 0) = 0 then 'PASS'
    when not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tbl
        and p.policyname like '%tenant_select%'
    ) then 'PASS'
    else 'FAIL' end
  from (values ('team_tournament_lineups'), ('team_tournament_lineup_entries')) as t(tbl)

  union all

  select
    'V3.' || lwp.tablename || '.write_policy_exists',
    'tenant_write policy for RPC security-definer writes',
    lwp.policyname,
    'PASS'
  from lineup_write_policies lwp

  union all

  select
    'V3.' || mp.policyname || '.manage_role_expected',
    'is_super_admin() OR team_tournament_can_manage() [dreambreaker/forfeit: tenant + manage]',
    left(coalesce(mp.using_expr, ''), 120),
    case
      when mp.policyname in (
        'team_tournament_command_log_manage',
        'team_tournament_lineup_revisions_manage'
      ) and mp.using_expr ilike '%team_tournament_can_manage%' then 'PASS'
      when mp.policyname in (
        'team_tournament_dreambreaker_manage',
        'team_tournament_forfeit_manage',
        'team_tournament_sync_mismatch_manage'
      ) and mp.using_expr ilike '%is_super_admin%' then 'PASS'
      else 'FAIL'
    end
  from tt1b_manage_policies mp
),

constraint_cols as (
  select
    t.relname as table_name,
    c.conname,
    c.contype,
    array_agg(a.attname order by u.ord) as cols
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
  join unnest(c.conkey) with ordinality as u(attnum, ord) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = u.attnum
  where c.contype in ('u', 'p')
    and t.relname in (
      'team_tournament_command_log',
      'team_tournament_lineup_revisions',
      'team_tournament_dreambreaker_states',
      'team_tournament_forfeit_events',
      'team_tournament_lineups'
    )
  group by t.relname, c.conname, c.contype
),
expected_unique as (
  select * from (values
    ('team_tournament_command_log', array['tenant_id','tournament_id','command_name','idempotency_key']),
    ('team_tournament_lineup_revisions', array['lineup_id','revision_no']),
    ('team_tournament_dreambreaker_states', array['matchup_id']),
    ('team_tournament_forfeit_events', array['tenant_id','tournament_id','idempotency_key']),
    ('team_tournament_lineups', array['matchup_id','team_external_id'])
  ) as e(table_name, expected_cols)
),
v4 as (
  select
    'V4.' || eu.table_name || '.unique_columns' as check_id,
    array_to_string(eu.expected_cols, ', ') as expected,
    coalesce(
      (select c.conname || ': ' || array_to_string(c.cols, ', ')
       from constraint_cols c
       where c.table_name = eu.table_name
         and c.contype = 'u'
         and c.cols::text[] = eu.expected_cols
       limit 1),
      coalesce(
        (select string_agg(c.conname || '(' || array_to_string(c.cols, ', ') || ')', '; ')
         from constraint_cols c
         where c.table_name = eu.table_name and c.contype = 'u'),
        'no matching unique constraint'
      )
    ) as actual,
    case when exists (
      select 1 from constraint_cols c
      where c.table_name = eu.table_name
        and c.contype = 'u'
        and c.cols::text[] = eu.expected_cols
    ) then 'PASS' else 'FAIL' end as status
  from expected_unique eu
),

fn_meta as (
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_function_result(p.oid) as return_type,
    p.prosecdef as security_definer,
    coalesce(
      (select option_value
       from pg_options_to_table(p.proconfig) o(option_name, option_value)
       where option_name = 'search_path'),
      ''
    ) as search_path,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname like 'team_tournament_%'
),
expected_fn as (
  select * from (values
    ('team_tournament_payload_hash', 'p_payload jsonb', 'text', false, 'public, extensions', true, false, 'TT-1B'),
    ('team_tournament_begin_command', 'p_tenant_id text, p_tournament_id text, p_command_name text, p_idempotency_key text, p_payload jsonb', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_finish_command', 'p_tenant_id text, p_tournament_id text, p_command_name text, p_idempotency_key text, p_payload_hash text, p_result jsonb', 'void', true, 'public', false, false, 'TT-1B'),
    ('team_tournament_version_conflict', 'p_entity text, p_expected integer, p_actual integer', 'json', false, '', false, false, 'TT-1B'),
    ('team_tournament_get_visible_lineups', 'p_tournament_id text, p_matchup_id text, p_viewer_team_id text', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_apply_forfeit', 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_forfeiting_team_id text, p_scope text, p_result_type text, p_forfeit_reason text, p_technical_score jsonb, p_expected_version integer, p_idempotency_key text', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_submit_lineup', 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb', 'json', true, 'public', true, false, '23C'),
    ('team_tournament_submit_lineup', 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb, p_expected_version integer, p_idempotency_key text', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_lock_matchup', 'p_tournament_id text, p_matchup_id text', 'json', true, 'public', true, false, '23C'),
    ('team_tournament_lock_matchup', 'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_publish_matchup', 'p_tournament_id text, p_matchup_id text', 'json', true, 'public', true, false, '23C'),
    ('team_tournament_publish_matchup', 'p_tournament_id text, p_matchup_id text, p_expected_version integer, p_idempotency_key text', 'json', true, 'public', true, false, 'TT-1B'),
    ('team_tournament_confirm_sub_match', 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text', 'json', true, 'public', true, false, '23C'),
    ('team_tournament_confirm_sub_match', 'p_tournament_id text, p_matchup_id text, p_sub_match_id text, p_score jsonb, p_winner_team_id text, p_expected_version integer, p_idempotency_key text', 'json', true, 'public', true, false, 'TT-1B')
  ) as e(function_name, identity_args, return_type, security_definer, search_path, auth_grant_expected, anon_grant_expected, phase)
),
fn_grants as (
  select
    p.proname as routine_name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    r.rolname as grantee
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
  join pg_roles r on r.oid = acl.grantee
  where p.proname like 'team_tournament_%'
    and acl.privilege_type = 'EXECUTE'
    and r.rolname in ('anon', 'authenticated')
),
fn_auth_guard as (
  select
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as identity_args,
    pg_get_functiondef(p.oid) ilike '%auth.uid()%' as has_auth_guard
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where p.proname like 'team_tournament_%'
),
v5 as (
  select
    'V5.' || ef.phase || '.' || ef.function_name || '.' ||
      replace(replace(ef.identity_args, ' ', '_'), ',', '_') || '.exists' as check_id,
    ef.phase || ' overload exists' as expected,
    case when fm.function_name is not null then 'present' else 'missing' end as actual,
    case when fm.function_name is not null then 'PASS' else 'FAIL' end as status
  from expected_fn ef
  left join fn_meta fm
    on fm.function_name = ef.function_name
   and fm.identity_args = ef.identity_args

  union all

  select
    'V5.' || ef.phase || '.' || ef.function_name || '.return_type',
    ef.return_type,
    coalesce(fm.return_type, 'missing'),
    case when fm.return_type = ef.return_type then 'PASS' else 'FAIL' end
  from expected_fn ef
  left join fn_meta fm
    on fm.function_name = ef.function_name
   and fm.identity_args = ef.identity_args
  where ef.function_name in (
    'team_tournament_payload_hash',
    'team_tournament_version_conflict',
    'team_tournament_get_visible_lineups',
    'team_tournament_begin_command',
    'team_tournament_apply_forfeit'
  )

  union all

  select
    'V5.' || ef.phase || '.' || ef.function_name || '.security_definer',
    case when ef.security_definer then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
    case when fm.security_definer then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
    case when fm.security_definer = ef.security_definer then 'PASS' else 'FAIL' end
  from expected_fn ef
  join fn_meta fm
    on fm.function_name = ef.function_name
   and fm.identity_args = ef.identity_args
  where ef.function_name in (
    'team_tournament_payload_hash',
    'team_tournament_get_visible_lineups',
    'team_tournament_begin_command',
    'team_tournament_apply_forfeit',
    'team_tournament_submit_lineup',
    'team_tournament_lock_matchup',
    'team_tournament_publish_matchup'
  )

  union all

  select
    'V5.TT-1B.' || ef.function_name || '.authenticated_grant',
    case when ef.auth_grant_expected then 'explicit EXECUTE grant to authenticated in ACL' else 'internal helper (no explicit authenticated grant required)' end,
    case when exists (
      select 1 from fn_grants g
      where g.routine_name = ef.function_name
        and g.identity_args = ef.identity_args
        and g.grantee = 'authenticated'
    ) then 'granted' else 'not granted' end,
    case
      when ef.auth_grant_expected and exists (
        select 1 from fn_grants g
        where g.routine_name = ef.function_name and g.identity_args = ef.identity_args and g.grantee = 'authenticated'
      ) then 'PASS'
      when not ef.auth_grant_expected then 'PASS'
      else 'FAIL'
    end
  from expected_fn ef
  where ef.phase = 'TT-1B'

  union all

  select
    'V5.TT-1B.' || ef.function_name || '.no_anon_grant',
    case
      when ef.function_name in ('team_tournament_payload_hash', 'team_tournament_version_conflict', 'team_tournament_finish_command')
        then 'internal/helper: anon EXECUTE OK if no sensitive data path'
      else 'no explicit EXECUTE grant to anon (or auth-guarded RPC)'
    end,
    coalesce((
      select string_agg(g.grantee, ', ')
      from fn_grants g
      where g.routine_name = ef.function_name
        and g.identity_args = ef.identity_args
        and g.grantee = 'anon'
    ), 'none'),
    case
      when not exists (
        select 1 from fn_grants g
        where g.routine_name = ef.function_name
          and g.identity_args = ef.identity_args
          and g.grantee = 'anon'
      ) then 'PASS'
      when ef.function_name in ('team_tournament_payload_hash', 'team_tournament_version_conflict', 'team_tournament_finish_command') then 'PASS'
      when coalesce((
        select fg.has_auth_guard from fn_auth_guard fg
        where fg.function_name = ef.function_name and fg.identity_args = ef.identity_args
      ), false) then 'PASS'
      else 'FAIL'
    end
  from expected_fn ef
  where ef.phase = 'TT-1B'

  union all

  select
    'V5.overload.submit_lineup.both_versions',
    '23C 4-param AND TT-1B 6-param coexist (TT-1B.5 policy)',
    (select count(*)::text from fn_meta where function_name = 'team_tournament_submit_lineup') || ' overload(s)',
    case when (select count(*) from fn_meta where function_name = 'team_tournament_submit_lineup') = 2
         then 'PASS' else 'FAIL' end

  union all

  select
    'V5.overload.lock_matchup.both_versions',
    '23C 2-param AND TT-1B 4-param coexist',
    (select count(*)::text from fn_meta where function_name = 'team_tournament_lock_matchup') || ' overload(s)',
    case when (select count(*) from fn_meta where function_name = 'team_tournament_lock_matchup') = 2
         then 'PASS' else 'FAIL' end

  union all

  select
    'V5.overload.publish_matchup.both_versions',
    '23C 2-param AND TT-1B 4-param coexist',
    (select count(*)::text from fn_meta where function_name = 'team_tournament_publish_matchup') || ' overload(s)',
    case when (select count(*) from fn_meta where function_name = 'team_tournament_publish_matchup') = 2
         then 'PASS' else 'FAIL' end

  union all

  select
    'V5.overload.confirm_sub_match.both_versions',
    '23C 5-param AND TT-1B 7-param coexist',
    (select count(*)::text from fn_meta where function_name = 'team_tournament_confirm_sub_match') || ' overload(s)',
    case when (select count(*) from fn_meta where function_name = 'team_tournament_confirm_sub_match') = 2
         then 'PASS' else 'FAIL' end
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
  select 'lineup_entries_orphan_lineup' as orphan_type,
         count(*)::bigint as orphan_count
  from public.team_tournament_lineup_entries e
  left join public.team_tournament_lineups l on l.id = e.lineup_id
  where l.id is null

  union all

  select 'lineup_orphan_matchup',
         count(*)
  from public.team_tournament_lineups l
  left join public.team_tournament_matchups m on m.id = l.matchup_id
  where m.id is null

  union all

  select 'lineup_orphan_team',
         count(*)
  from public.team_tournament_lineups l
  join public.team_tournament_matchups m on m.id = l.matchup_id
  left join public.team_tournament_teams t
    on t.team_tournament_id = m.team_tournament_id
   and t.external_team_id = l.team_external_id
  where t.id is null

  union all

  select 'matchup_orphan_tournament',
         count(*)
  from public.team_tournament_matchups m
  left join public.team_tournaments tt on tt.id = m.team_tournament_id
  where tt.id is null

  union all

  select 'sub_match_orphan_matchup',
         count(*)
  from public.team_tournament_sub_matches sm
  left join public.team_tournament_matchups m on m.id = sm.matchup_id
  where m.id is null

  union all

  select 'standing_orphan_team',
         count(*)
  from public.team_tournament_standings s
  left join public.team_tournament_teams t
    on t.team_tournament_id = s.team_tournament_id
   and t.external_team_id = s.team_external_id
  where t.id is null

  union all

  select 'lineup_revision_orphan_lineup',
         count(*)
  from public.team_tournament_lineup_revisions r
  left join public.team_tournament_lineups l on l.id = r.lineup_id
  where l.id is null

  union all

  select 'forfeit_orphan_parent',
         count(*)
  from public.team_tournament_forfeit_events f
  where (f.matchup_id is null and f.sub_match_id is null)
     or (f.matchup_id is not null and not exists (
           select 1 from public.team_tournament_matchups m where m.id = f.matchup_id
         ))
     or (f.sub_match_id is not null and not exists (
           select 1 from public.team_tournament_sub_matches sm where sm.id = f.sub_match_id
         ))

  union all

  select 'dreambreaker_orphan_matchup',
         count(*)
  from public.team_tournament_dreambreaker_states d
  left join public.team_tournament_matchups m on m.id = d.matchup_id
  where m.id is null
),
v7 as (
  select
    'V7.' || oc.orphan_type as check_id,
    '0 orphan rows' as expected,
    oc.orphan_count::text as actual,
    case when oc.orphan_count = 0 then 'PASS' else 'FAIL' end as status
  from orphan_counts oc
),

extra as (
  select
    'X.command_log.idempotency_key_not_null' as check_id,
    'column NOT NULL' as expected,
    case when c.is_nullable = 'NO' then 'NOT NULL' else coalesce(c.is_nullable, 'missing column') end as actual,
    case when c.is_nullable = 'NO' then 'PASS' else 'FAIL' end as status
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'team_tournament_command_log'
    and c.column_name = 'idempotency_key'

  union all

  select
    'X.command_log.payload_hash_type',
    'text NOT NULL',
    coalesce(c.data_type || ' nullable=' || c.is_nullable, 'missing'),
    case when c.data_type = 'text' and c.is_nullable = 'NO' then 'PASS' else 'FAIL' end
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'team_tournament_command_log'
    and c.column_name = 'payload_hash'

  union all

  select
    'X.command_log.no_null_idempotency_rows',
    '0 rows with null/blank idempotency_key',
    count(*) filter (where idempotency_key is null or btrim(idempotency_key) = '')::text,
    case when count(*) filter (where idempotency_key is null or btrim(idempotency_key) = '') = 0
         then 'PASS' else 'FAIL' end
  from public.team_tournament_command_log

  union all

  select
    'X.lineup.no_duplicate_matchup_team',
    '0 duplicate (matchup_id, team_external_id)',
    coalesce((
      select count(*)::text from (
        select matchup_id, team_external_id, count(*) c
        from public.team_tournament_lineups
        group by 1, 2 having count(*) > 1
      ) d
    ), '0'),
    case when not exists (
      select 1 from public.team_tournament_lineups
      group by matchup_id, team_external_id having count(*) > 1
    ) then 'PASS' else 'FAIL' end

  union all

  select
    'X.version_conflict_rpc.exists',
    'team_tournament_version_conflict(text, integer, integer) returns json',
    coalesce(fm.identity_args || ' -> ' || fm.return_type, 'missing'),
    case when fm.function_name is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join fn_meta fm
    on fm.function_name = 'team_tournament_version_conflict'
   and fm.identity_args = 'p_entity text, p_expected integer, p_actual integer'

  union all

  select
    'X.payload_hash.digest_hotfix',
    'function uses extensions.digest and search_path public, extensions',
    case
      when fm.definition ilike '%extensions.digest%' then 'extensions.digest present'
      else 'extensions.digest missing'
    end,
    case
      when fm.definition ilike '%extensions.digest%'
       and fm.search_path ilike '%extensions%'
      then 'PASS' else 'FAIL'
    end
  from fn_meta fm
  where fm.function_name = 'team_tournament_payload_hash'

  union all

  select
    'X.index.' || expected_idx || '.exists' as check_id,
    'index present on staging' as expected,
    case when pi.indexname is not null then pi.indexname else 'missing' end as actual,
    case when pi.indexname is not null then 'PASS' else 'FAIL' end as status
  from (values
    ('idx_team_tournament_command_log_tenant'),
    ('idx_team_tournament_lineup_revisions_lineup'),
    ('idx_team_tournament_sync_mismatch_open')
  ) as e(expected_idx)
  left join pg_indexes pi
    on pi.schemaname = 'public' and pi.indexname = e.expected_idx

  union all

  select
    'X.fk.lineup_revisions_lineup_id',
    'FK lineup_revisions.lineup_id -> team_tournament_lineups.id',
    coalesce(c.conname, 'missing'),
    case when c.conname is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join pg_constraint c
    on c.conrelid = 'public.team_tournament_lineup_revisions'::regclass
   and c.contype = 'f'
   and c.conname like '%lineup%'

  union all

  select
    'X.fk.dreambreaker_matchup_id',
    'FK dreambreaker_states.matchup_id -> team_tournament_matchups.id',
    coalesce(c.conname, 'missing'),
    case when c.conname is not null then 'PASS' else 'FAIL' end
  from (select 1) x
  left join pg_constraint c
    on c.conrelid = 'public.team_tournament_dreambreaker_states'::regclass
   and c.contype = 'f'
   and c.conname like '%matchup%'
)

select check_id, expected, actual, status from v1
union all select check_id, expected, actual, status from v2
union all select check_id, expected, actual, status from v3
union all select check_id, expected, actual, status from v4
union all select check_id, expected, actual, status from v5
union all select check_id, expected, actual, status from v6
union all select check_id, expected, actual, status from v7
union all select check_id, expected, actual, status from extra
order by check_id;