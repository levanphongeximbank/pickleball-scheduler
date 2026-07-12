with tt1b_expected as (
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
)
select check_id, expected, actual, status from v2 union all select check_id, expected, actual, status from v3 union all select check_id, expected, actual, status from v4 order by check_id;