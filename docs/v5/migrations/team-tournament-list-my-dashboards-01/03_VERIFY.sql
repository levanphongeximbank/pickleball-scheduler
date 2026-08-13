-- team-tournament-list-my-dashboards-01 / 03_VERIFY
-- LOCAL ONLY. Do not apply without Owner GO.

do $$
declare
  v_def text;
begin
  if to_regprocedure('public.team_tournament_list_my_dashboards()') is null then
    raise exception 'VERIFY_FAIL: team_tournament_list_my_dashboards missing';
  end if;

  v_def := pg_get_functiondef('public.team_tournament_list_my_dashboards()'::regprocedure);

  if position('from public.athletes' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: must resolve athletes.id from auth.uid()';
  end if;

  if position('team_tournament_can_view_dashboard' in lower(v_def)) = 0 then
    raise exception 'VERIFY_FAIL: must reuse can_view_dashboard parity';
  end if;

  if position('team_tournament_user_player_id' in lower(v_def)) > 0
     or position('p.player_id' in lower(v_def)) > 0 then
    raise exception 'VERIFY_FAIL: legacy player_id authority must not appear';
  end if;

  if position('p_tenant_id' in lower(v_def)) > 0
     or position('p_club_id' in lower(v_def)) > 0
     or position('p_player_id' in lower(v_def)) > 0 then
    raise exception 'VERIFY_FAIL: must not require client tenant/club/player args';
  end if;

  raise notice 'VERIFY_PASS: team_tournament_list_my_dashboards contract';
end $$;

-- Auth-simulated matrix helpers (Owner fixture when present).
-- Does not mutate rows. Caller must be authenticated as the seed user for live PASS.
select
  'helper_contract' as check_name,
  to_regprocedure('public.team_tournament_list_my_dashboards()') is not null as rpc_present,
  has_function_privilege('authenticated', 'public.team_tournament_list_my_dashboards()', 'execute') as authenticated_execute,
  not has_function_privilege('anon', 'public.team_tournament_list_my_dashboards()', 'execute') as anon_denied;
