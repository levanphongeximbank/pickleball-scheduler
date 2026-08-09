-- Select-only verification for dreambreaker advancement package.
-- Safe to run after apply. Does not mutate data.
-- FAILS HARD if final recompute body is not Dreambreaker-aware
-- (guards against 30_FORFEIT_WITHDRAW_PARITY regressing file 10).

select 'team_tournament_dreambreaker_states' as obj,
  to_regclass('public.team_tournament_dreambreaker_states') is not null as present;

select p.proname, pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'team_tournament_recompute_matchup_result',
    'team_tournament_maybe_activate_dreambreaker',
    'team_tournament_confirm_sub_match',
    'team_tournament_submit_dreambreaker_order',
    'team_tournament_lock_dreambreaker_order',
    'team_tournament_start_dreambreaker',
    'team_tournament_record_dreambreaker_point',
    'team_tournament_undo_dreambreaker_point',
    'team_tournament_dreambreaker_injury',
    'team_tournament_sync_dreambreaker',
    'team_tournament_apply_forfeit',
    'team_tournament_withdraw_team',
    'team_tournament_randomize_lineup'
  )
order by 1, 2;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_tournament_teams'
  and column_name in ('withdrawn', 'withdrawn_at', 'withdrawal_reason')
order by 1;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'team_tournament_standings'
  and column_name = 'forfeit_count';

-- Hard invariant: final recompute must remain Dreambreaker-aware after
-- ordered package apply (10 → 20 → 30 → 40). Presence-only checks are
-- insufficient — a legacy overwrite previously left needsDreambreaker=false
-- while maybe_activate still existed.
do $verify_recompute_dreambreaker$
declare
  v_recompute_oid oid;
  v_recompute_def text;
  v_maybe_oid oid;
  v_missing text[] := array[]::text[];
  v_fn text;
  v_required text[] := array[
    'team_tournament_maybe_activate_dreambreaker',
    'team_tournament_submit_dreambreaker_order',
    'team_tournament_lock_dreambreaker_order',
    'team_tournament_start_dreambreaker',
    'team_tournament_record_dreambreaker_point',
    'team_tournament_undo_dreambreaker_point',
    'team_tournament_dreambreaker_injury',
    'team_tournament_sync_dreambreaker',
    'team_tournament_apply_forfeit',
    'team_tournament_withdraw_team',
    'team_tournament_randomize_lineup'
  ];
begin
  -- Identity args may be "uuid" or "p_matchup_id uuid" depending on catalog/create style.
  select p.oid into v_recompute_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_recompute_matchup_result'
    and pg_get_function_identity_arguments(p.oid) in ('uuid', 'p_matchup_id uuid')
  order by p.oid
  limit 1;

  if v_recompute_oid is null then
    raise exception 'VERIFY_FAIL: team_tournament_recompute_matchup_result(uuid) missing';
  end if;

  if not has_function_privilege('authenticated', v_recompute_oid, 'EXECUTE') then
    raise exception 'VERIFY_FAIL: authenticated missing EXECUTE on recompute_matchup_result';
  end if;

  if has_function_privilege('anon', v_recompute_oid, 'EXECUTE') then
    raise exception 'VERIFY_FAIL: anon must not EXECUTE recompute_matchup_result';
  end if;

  v_recompute_def := pg_get_functiondef(v_recompute_oid);

  if position('needsDreambreaker' in v_recompute_def) = 0 then
    raise exception 'VERIFY_FAIL: recompute body missing needsDreambreaker (legacy overwrite regression)';
  end if;

  if position('v_needs_db' in v_recompute_def) = 0 then
    raise exception 'VERIFY_FAIL: recompute body missing Dreambreaker decision variable v_needs_db';
  end if;

  if position('dreambreakerEnabled' in v_recompute_def) = 0 then
    raise exception 'VERIFY_FAIL: recompute body missing dreambreakerEnabled gate';
  end if;

  select p.oid into v_maybe_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'team_tournament_maybe_activate_dreambreaker';

  if v_maybe_oid is null then
    raise exception 'VERIFY_FAIL: team_tournament_maybe_activate_dreambreaker missing';
  end if;

  if not has_function_privilege('authenticated', v_maybe_oid, 'EXECUTE') then
    raise exception 'VERIFY_FAIL: authenticated missing EXECUTE on maybe_activate_dreambreaker';
  end if;

  foreach v_fn in array v_required
  loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_fn
    ) then
      v_missing := array_append(v_missing, v_fn);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception 'VERIFY_FAIL: missing required RPCs: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'VERIFY_OK: recompute Dreambreaker-aware; maybe_activate + command RPCs present; grants checked';
end
$verify_recompute_dreambreaker$;

select
  true as recompute_has_needs_dreambreaker,
  true as maybe_activate_present,
  true as verify_hard_assertions_passed;
