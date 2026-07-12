with fn_meta as (
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
)
select check_id, expected, actual, status from v5 order by check_id;